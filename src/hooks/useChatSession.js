import { useState } from 'react';
import { streamLLMChat } from '../lib/llm';
import { executeTool } from '../lib/tools';
import { buildCardData } from '../lib/cards';
import { sessionService } from '../services/sessionService';

const friendlyError = (err) => {
  const msg = err?.message || '';
  if (msg.includes('429') || msg.includes('rate_limit')) {
    return "I'm hitting the rate limit. Give it a few seconds and try again.";
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid_api_key')) {
    return "There's an issue with the API key. Check your .env file and restart the dev server.";
  }
  if (msg.includes('Missing') && msg.includes('API_KEY')) {
    return "No API key found. Add your key to .env and restart the server.";
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return "Can't reach the server right now. Check your connection and try again.";
  }
  return "Something went wrong. Try sending that again.";
};

export function useChatSession(llmConfig, onToolAction) {
  const [messages, setMessages] = useState([]);
  const [geminiHistory, setGeminiHistory] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const showError = (err, placeholderId = null) => {
    setMessages((prev) => {
      const cleaned = placeholderId
        ? prev.filter((m) => m.id !== placeholderId)
        : prev.filter((m) => !(m.role === 'model' && !m.content && !m.card));
      return [...cleaned, { id: Date.now() + Math.random(), role: 'model', content: friendlyError(err) }];
    });
  };

  const processLLMResponse = async (historyContext, activeSessionId, updateTitle = false) => {
    if (!llmConfig.apiKey) {
      throw new Error(`Missing ${llmConfig.missingKeyName} in environment variables.`);
    }

    const assistantId = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id: assistantId, role: 'model', content: '' }]);

    let accumulatedText = '';
    const functionCalls = [];

    // ── stream ───────────────────────────────────────────────────────────────
    try {
      for await (const parts of streamLLMChat(historyContext, llmConfig)) {
        for (const part of parts) {
          if (part.text) {
            accumulatedText += part.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: accumulatedText } : m))
            );
          }
          if (part.functionCall) {
            functionCalls.push(part.functionCall);
          }
        }
      }
    } catch (err) {
      showError(err, assistantId);
      return;
    }

    const isToolCall = functionCalls.length > 0;

    const modelParts = [];
    if (accumulatedText) modelParts.push({ text: accumulatedText });
    for (const fc of functionCalls) modelParts.push({ functionCall: fc });
    if (modelParts.length > 0) historyContext.push({ role: 'model', parts: modelParts });

    if (isToolCall && !accumulatedText) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    }

    // ── tool calls ───────────────────────────────────────────────────────────
    if (isToolCall) {
      const functionResponses = [];
      let firstCard = !accumulatedText;

      for (const call of functionCalls) {
        let result;
        try {
          result = await executeTool(call, historyContext);
        } catch (err) {
          console.error(`Tool failed: ${call.name}`, err);
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + Math.random(), role: 'model', content: `Couldn't complete ${call.name.replace(/_/g, ' ')}. Please try again.` },
          ]);
          functionResponses.push({ functionResponse: { name: call.name, response: { error: err.message } } });
          continue;
        }

        functionResponses.push({ functionResponse: { name: call.name, response: result } });

        const cardData = buildCardData(call.name, call.args, result);
        if (cardData) {
          const saved = await sessionService.saveMessage(activeSessionId, 'model', '', cardData);
          const cardMsg = { id: saved?.id ?? Date.now() + Math.random(), role: 'model', content: '', card: cardData };
          if (firstCard) {
            setMessages((prev) => [...prev, cardMsg]);
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, card: cardData } : m))
            );
            firstCard = true;
          }
        }

        if (['log_workout_set', 'log_multiple_sets', 'log_recovery_metrics'].includes(call.name)) {
          onToolAction?.();
        }
      }

      historyContext.push({ role: 'user', parts: functionResponses });
      await processLLMResponse(historyContext, activeSessionId);
      return;
    }

    // ── text-only response ───────────────────────────────────────────────────
    if (accumulatedText) {
      await sessionService.saveMessage(activeSessionId, 'model', accumulatedText, null);
      if (updateTitle) {
        const title =
          accumulatedText.replace(/\n/g, ' ').slice(0, 40).trimEnd() +
          (accumulatedText.length > 40 ? '…' : '');
        await sessionService.updateTitle(activeSessionId, title);
        setGeminiHistory([...historyContext]);
        return title;
      }
    }

    setGeminiHistory([...historyContext]);
  };

  const sendMessage = async (text, onSessionCreated, onTitleUpdated) => {
    if (!text || isStreaming) return;
    setIsStreaming(true);

    try {
      let activeSessionId = currentSessionId;
      const isFirst = !activeSessionId;

      if (!activeSessionId) {
        const session = await sessionService.create('New Workout');
        if (session) {
          activeSessionId = session.id;
          setCurrentSessionId(activeSessionId);
          onSessionCreated?.(session);
        }
      }

      if (activeSessionId) {
        await sessionService.saveMessage(activeSessionId, 'user', text, null);
      }

      setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: text }]);

      const historyContext = [...geminiHistory, { role: 'user', parts: [{ text }] }];

      if (activeSessionId) {
        const title = await processLLMResponse(historyContext, activeSessionId, isFirst);
        if (isFirst && title) {
          onTitleUpdated?.(activeSessionId, title);
        }
      }
    } catch (err) {
      // Only reaches here for pre-streaming errors (missing key, session create failure)
      console.error(err);
      showError(err);
    } finally {
      setIsStreaming(false);
    }
  };

  const loadSession = async (sessionId) => {
    setCurrentSessionId(sessionId);
    const msgs = await sessionService.getMessages(sessionId);
    setMessages(msgs);

    const history = msgs
      .filter((m) => m.content || m.card)
      .map((m) => {
        let text = m.content;
        if (!text && m.card) {
          text =
            m.card.title +
            (m.card.stats ? ': ' + m.card.stats.map((s) => `${s.label} ${s.value}`).join(', ') : '') +
            (m.card.insight ? '. ' + m.card.insight : '');
        }
        return { role: m.role === 'model' ? 'model' : 'user', parts: [{ text }] };
      });

    setGeminiHistory(history);
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setGeminiHistory([]);
  };

  return { messages, isStreaming, currentSessionId, sendMessage, loadSession, startNewChat };
}
