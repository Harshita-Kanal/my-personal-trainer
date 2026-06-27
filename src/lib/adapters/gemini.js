import { gymTools } from '../tools';
import { SYSTEM_PROMPT } from '../prompt';

export async function* streamGeminiChat(messages, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;
  
  const payload = {
    contents: messages,
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    tools: gymTools
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API Error: ${response.status} ${err}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') return;
        if (!dataStr) continue;
        
        try {
          const data = JSON.parse(dataStr);
          if (data.candidates?.[0]?.content?.parts) {
            yield data.candidates[0].content.parts;
          }
        } catch (e) {
          console.error("SSE parse error", e, dataStr);
        }
      }
    }
  }
}
