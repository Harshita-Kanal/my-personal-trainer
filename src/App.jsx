import { useState, useRef, useEffect } from 'react';
import { Send, Dumbbell, Zap, TrendingUp, Plus, MessageSquare, Menu, User, Loader2, Calendar, Activity } from 'lucide-react';
import { getLLMConfig, streamLLMChat } from './lib/llm';
import { executeTool } from './lib/tools';
import { api } from './lib/api';

function App() {
  const llmConfig = getLLMConfig();
  const suggestionPrompts = [
    {
      title: 'Log a Set',
      description: 'Track weights, reps, and performance.',
      prompt: 'I want to log a set. Walk me through it.'
    },
    {
      title: 'Check Progression',
      description: 'Analyze past performance and volume.',
      prompt: 'Check my bench press progression and tell me what to target next.'
    },
    {
      title: 'Form Check',
      description: 'Get mechanical cues and safety tips.',
      prompt: 'Give me form cues for squat.'
    },
    {
      title: 'Manage Fatigue',
      description: 'Autoregulate volume based on recovery.',
      prompt: 'I want to assess my readiness to train today. Ask me what you need.'
    }
  ];
  
  const [currentView, setCurrentView] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sidebarHistory, setSidebarHistory] = useState([]);
  
  const [messages, setMessages] = useState([]);
  const [geminiHistory, setGeminiHistory] = useState([]);
  const [trainingLog, setTrainingLog] = useState([]);
  
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  const isNewChat = messages.length === 0 && currentView === 'chat';

  // Load sidebar history on mount
  useEffect(() => {
    api.getSessions().then(setSidebarHistory);
  }, []);

  useEffect(() => {
    if (currentView === 'chat' && !isNewChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isNewChat, currentView]);

  const refreshTrainingLog = async () => {
    const entries = await api.getTrainingLog();
    setTrainingLog(entries);
  };

  useEffect(() => {
    if (currentView === 'history') {
      refreshTrainingLog();
    }
  }, [currentView]);

  const loadSession = async (sessionId) => {
    setCurrentSessionId(sessionId);
    setCurrentView('chat');
    setSidebarOpen(false);
    const msgs = await api.getMessages(sessionId);
    setMessages(msgs);
    
    const gHistory = msgs
      .filter(m => m.content || m.card)
      .map(m => {
        let text = m.content;
        if (!text && m.card) {
          text = m.card.title + (m.card.stats ? ': ' + m.card.stats.map(s => `${s.label} ${s.value}`).join(', ') : '') + (m.card.insight ? '. ' + m.card.insight : '');
        }
        return { role: m.role === 'model' ? 'model' : 'user', parts: [{ text }] };
      });
    setGeminiHistory(gHistory);
  };

  const processLLMResponse = async (historyContext, activeSessionId, updateTitle = false) => {
    try {
      if (!llmConfig.apiKey) {
        throw new Error(`Missing ${llmConfig.missingKeyName} in environment variables.`);
      }

      let isToolCall = false;
      const stream = streamLLMChat(historyContext, llmConfig);
      
      const assistantMessageId = Date.now() + Math.random();
      setMessages(prev => [...prev, { id: assistantMessageId, role: 'model', content: '' }]);

      let accumulatedText = '';
      let functionCalls = [];

      for await (const parts of stream) {
        for (const part of parts) {
          if (part.text) {
            accumulatedText += part.text;
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId ? { ...msg, content: accumulatedText } : msg
            ));
          }
          if (part.functionCall) {
            isToolCall = true;
            functionCalls.push(part.functionCall);
          }
        }
      }

      const modelReplyParts = [];
      if (accumulatedText) modelReplyParts.push({ text: accumulatedText });
      if (functionCalls.length > 0) {
        for (const fc of functionCalls) modelReplyParts.push({ functionCall: fc });
      }
      
      if (modelReplyParts.length > 0) {
        historyContext.push({ role: 'model', parts: modelReplyParts });
      }

      if (isToolCall && !accumulatedText) {
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
      }

      if (isToolCall) {
        const functionResponses = [];
        let toolCardRendered = !accumulatedText; // if no text, treat first card as a new message
        for (const call of functionCalls) {
           let result;
           try {
             result = await executeTool(call);
             functionResponses.push({
               functionResponse: { name: call.name, response: result }
             });
           } catch (toolError) {
             console.error(`Tool execution failed for ${call.name}:`, toolError);
             const errorMessage = `Sorry, I encountered an error while trying to ${call.name.replace(/_/g, ' ')}. Please try again or rephrase your request.`;
             
             const errorMsgId = Date.now() + Math.random();
             setMessages(prev => [...prev, { id: errorMsgId, role: 'model', content: errorMessage }]);
             
             functionResponses.push({
               functionResponse: { name: call.name, response: { error: toolError.message } }
             });
             continue; 
           }

           
           let cardData = null;
           if (call.name === 'log_workout_set') {
             const savedLog = result.log || call.args;
             cardData = { 
                type: 'progress', 
                title: 'Set Logged Successfully', 
                stats: [
                  {label: 'Exercise', value: savedLog.exercise}, 
                  {label: 'Weight', value: `${savedLog.weight}${savedLog.unit}`}, 
                  {label: 'Reps', value: savedLog.reps}
                ], 
                insight: 'Saved to your running log.' 
             };
           } else if (call.name === 'get_exercise_history') {
             cardData = { 
                type: 'progress', 
                title: 'Analyzing Log History', 
                stats: [{label: 'Exercise', value: call.args.exercise}], 
                insight: `Found ${result.history?.length || 0} recent sets.` 
             };
           } else if (call.name === 'look_up_form') {
             cardData = { 
                type: 'form', 
                title: `Form Check: ${call.args.exercise.toUpperCase()}`, 
                insight: result.cues 
             };
           } else if (call.name === 'log_recovery_metrics') {
             const savedRecovery = result.recovery || call.args;
             cardData = {
                type: 'recovery',
                title: 'Recovery Logged',
                stats: [
                  {label: 'Sleep', value: savedRecovery.sleep_hours ? `${savedRecovery.sleep_hours}h` : 'Not logged'},
                  {label: 'Soreness', value: savedRecovery.soreness_level ? `${savedRecovery.soreness_level}/10` : 'Not logged'},
                  {label: 'Energy', value: savedRecovery.energy_level ? `${savedRecovery.energy_level}/10` : 'Not logged'}
                ],
                insight: 'Recovery markers saved to your training log.'
             };
           }

           if (cardData) {
             const savedMessage = await api.saveMessage(activeSessionId, 'model', '', cardData);
             if (toolCardRendered) {
               setMessages(prev => [...prev, {
                 id: savedMessage?.id || Date.now() + Math.random(),
                 role: 'model',
                 content: '',
                 card: cardData
               }]);
             } else {
               setMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, card: cardData } : msg));
               toolCardRendered = true;
             }
           }

           if (currentView === 'history' && ['log_workout_set', 'log_recovery_metrics'].includes(call.name)) {
             await refreshTrainingLog();
           }
        }
        
        historyContext.push({ role: 'user', parts: functionResponses });
        await processLLMResponse(historyContext, activeSessionId);
        return;
      } else {
        if (accumulatedText) {
          await api.saveMessage(activeSessionId, 'model', accumulatedText, null);
          if (updateTitle) {
            const title = accumulatedText.replace(/\n/g, ' ').slice(0, 40).trimEnd() + (accumulatedText.length > 40 ? '…' : '');
            await api.updateSessionTitle(activeSessionId, title);
            setSidebarHistory(prev => prev.map(s => s.id === activeSessionId ? { ...s, title } : s));
          }
        }
      }

      setGeminiHistory([...historyContext]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now(), role: 'model', content: `Error: ${error.message}` }]);
    }
  };

  const handleSend = async (e, forceText = null) => {
    if (e) e.preventDefault();
    const userText = forceText || inputValue.trim();
    if (!userText || isStreaming) return;

    setInputValue('');
    setIsStreaming(true);

    let activeSessionId = currentSessionId;
    const isFirstMessage = !activeSessionId;
    if (!activeSessionId) {
       const newSession = await api.createSession('New workout');
       if (newSession) {
         activeSessionId = newSession.id;
         setCurrentSessionId(activeSessionId);
         setSidebarHistory(prev => [newSession, ...prev]);
       }
    }

    if (activeSessionId) {
      await api.saveMessage(activeSessionId, 'user', userText, null);
    }

    const newUserMsg = { id: Date.now(), role: 'user', content: userText };
    setMessages(prev => [...prev, newUserMsg]);

    const geminiUserMsg = { role: 'user', parts: [{ text: userText }] };
    let currentHistory = [...geminiHistory, geminiUserMsg];
    
    if (activeSessionId) {
      await processLLMResponse(currentHistory, activeSessionId, isFirstMessage);
    }
    
    setIsStreaming(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setGeminiHistory([]);
    setCurrentView('chat');
    setSidebarOpen(false);
  };

  const renderInputBox = (centered = false) => (
    <div className={centered ? "input-container-centered" : "input-container"}>
      <div 
        className="input-wrapper" 
        style={centered ? { padding: '12px 20px', borderRadius: '32px', background: 'var(--bg-sidebar)', borderColor: 'transparent' } : {}}
      >
        <textarea
          className="message-input"
          placeholder={centered ? "Log your set or ask for a progression check..." : "Message Strength Coach..."}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
          }}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          rows={1}
          style={centered ? { fontSize: '1.1rem', padding: '12px 0' } : {}}
        />
        <button 
          className="send-btn"
          onClick={(e) => handleSend(e)}
          disabled={!inputValue.trim() || isStreaming}
          style={centered ? { width: '40px', height: '40px', marginBottom: '4px' } : {}}
        >
          <Send size={centered ? 18 : 16} />
        </button>
      </div>
      {!centered && (
        <div className="disclaimer">
          Strength Coach can make mistakes. Always verify heavy lifts with a spotter.
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <button className="new-chat-btn" onClick={startNewChat}>
          <Plus size={18} />
          New workout
        </button>
        
        <div className="history-section-title">Chat History</div>
        <div className="history-list">
          {sidebarHistory.map((item) => (
            <div 
              className={`history-item ${currentSessionId === item.id && currentView === 'chat' ? 'active' : ''}`} 
              key={item.id} 
              onClick={() => loadSession(item.id)}
            >
              <MessageSquare size={16} />
              {item.title}
            </div>
          ))}
          {sidebarHistory.length === 0 && (
            <div style={{ padding: '0 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No previous sessions.</div>
          )}
        </div>
        
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <div className={`history-item ${currentView === 'history' ? 'active' : ''}`} onClick={() => { setCurrentView('history'); setSidebarOpen(false); }} style={{ fontWeight: 600 }}>
            <Calendar size={18} />
            Training Log
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="header-mobile">
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }} onClick={() => setSidebarOpen(o => !o)}>
            <Menu size={20} />
          </button>
          <span>Strength Coach</span>
        </div>

        {currentView === 'history' ? (
          <div style={{ flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: '#f9fafb' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={24} color="var(--primary)"/> Training Log
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Your complete history of logged workouts and progression.</p>
              
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Exercise</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Weight</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reps</th>
                      <th style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingLog.length === 0 ? (
                      <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No logs found. Start chatting to track your sets!</td></tr>
                    ) : (
                      trainingLog.map((log) => (
                        <tr key={`${log.type}-${log.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>{log.date}</td>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem', fontWeight: '500' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              {log.type === 'exercise' ? <Dumbbell size={16} /> : <Activity size={16} />}
                              {log.type === 'exercise' ? log.exercise : 'Recovery'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>
                            {log.type === 'exercise' ? `${log.weight}${log.unit}` : `${log.sleep_hours || '-'}h sleep`}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>
                            {log.type === 'exercise' ? log.reps : `Soreness ${log.soreness_level || '-'} / Energy ${log.energy_level || '-'}`}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {log.recommendation}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : isNewChat ? (
          <div className="new-chat-container">
            <div className="hero-branding">
              <Dumbbell size={56} strokeWidth={1.5} />
              <h2>What are we lifting today?</h2>
            </div>
            {renderInputBox(true)}
            
            <div className="suggestions-grid">
              {suggestionPrompts.map((suggestion) => (
                <button
                  className="suggestion-card"
                  key={suggestion.title}
                  onClick={() => handleSend(null, suggestion.prompt)}
                  type="button"
                >
                  <h4>{suggestion.title}</h4>
                  <p>{suggestion.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="chat-area">
              {messages.map((msg) => (
                <div key={msg.id} className={`message-wrapper ${msg.role}`}>
                  <div className={`avatar ${msg.role}`}>
                    {msg.role === 'model' ? <Dumbbell size={20} /> : <User size={20} />}
                  </div>
                  <div className="message-content">
                    {msg.content && (
                      <div className="message-bubble">
                        {msg.content}
                      </div>
                    )}
                    {msg.card && (
                      <div className="agent-card">
                        <div className="agent-card-title">
                          {msg.card.type === 'progress' ? <TrendingUp size={18} /> : <Zap size={18} />}
                          {msg.card.title}
                        </div>
                        {msg.card.stats && msg.card.stats.map((stat, idx) => (
                          <div className="stat-row" key={idx}>
                            <span className="stat-label">{stat.label}</span>
                            <span className="stat-value">{stat.value}</span>
                          </div>
                        ))}
                        {msg.card.insight && (
                          <div style={{ 
                            marginTop: msg.card.stats ? '12px' : '0', 
                            paddingTop: msg.card.stats ? '12px' : '0', 
                            borderTop: msg.card.stats ? '1px solid var(--border)' : 'none', 
                            fontSize: msg.card.type === 'form' ? '0.95rem' : '0.85rem', 
                            color: msg.card.type === 'form' ? 'var(--text-main)' : 'var(--text-muted)', 
                            lineHeight: '1.5' 
                          }}>
                            {msg.card.type === 'progress' && <Zap size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-3px' }}/>}
                            {msg.card.insight}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isStreaming && messages[messages.length - 1]?.role === 'user' && (
                <div className="message-wrapper model">
                  <div className="avatar model">
                    <Dumbbell size={20} />
                  </div>
                  <div className="message-content" style={{ justifyContent: 'center' }}>
                    <Loader2 size={20} color="var(--text-muted)" className="lucide-spin" style={{ animation: 'spin 2s linear infinite' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {renderInputBox(false)}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
