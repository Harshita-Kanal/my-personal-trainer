import { gymTools } from '../tools';
import { SYSTEM_PROMPT } from '../prompt';

const toOpenAISchema = (schema) => {
  if (Array.isArray(schema)) return schema.map(toOpenAISchema);
  if (!schema || typeof schema !== 'object') return schema;

  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      key === 'type' && typeof value === 'string' ? value.toLowerCase() : toOpenAISchema(value)
    ])
  );
};

const getOpenAITools = () => gymTools[0].functionDeclarations.map((func) => ({
  type: 'function',
  function: {
    name: func.name,
    description: func.description,
    parameters: toOpenAISchema(func.parameters)
  }
}));

const toOpenAIMessages = (messages) => {
  const formattedMessages = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const textPart = msg.parts.find((p) => p.text);
      if (textPart) {
        formattedMessages.push({ role: 'user', content: textPart.text });
      }

      const funcResps = msg.parts.filter((p) => p.functionResponse);
      for (const [index, res] of funcResps.entries()) {
        formattedMessages.push({
          role: 'tool',
          tool_call_id: `call_${res.functionResponse.name}_${index}`,
          name: res.functionResponse.name,
          content: JSON.stringify(res.functionResponse.response)
        });
      }
    } else if (msg.role === 'model') {
      const textPart = msg.parts.find((p) => p.text);
      const funcCalls = msg.parts.filter((p) => p.functionCall);
      const msgObj = { role: 'assistant', content: textPart ? textPart.text : null };

      if (funcCalls.length > 0) {
        msgObj.tool_calls = funcCalls.map((c, index) => ({
          id: `call_${c.functionCall.name}_${index}`,
          type: 'function',
          function: {
            name: c.functionCall.name,
            arguments: JSON.stringify(c.functionCall.args)
          }
        }));
      }

      if (msgObj.content || msgObj.tool_calls) {
        formattedMessages.push(msgObj);
      }
    }
  }

  return formattedMessages;
};

export async function* streamOpenAICompatibleChat({
  messages,
  apiKey,
  model,
  baseUrl,
  providerName
}) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: toOpenAIMessages(messages),
      tools: getOpenAITools(),
      tool_choice: 'auto',
      stream: true
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${providerName} API Error: ${response.status} ${err}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let streamDone = false;
  const toolCallsBuffer = {};

  while (!streamDone) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      const dataStr = line.slice(6).trim();
      if (dataStr === '[DONE]') {
        streamDone = true;
        break;
      }
      if (!dataStr) continue;

      try {
        const data = JSON.parse(dataStr);
        const delta = data.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          yield [{ text: delta.content }];
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallsBuffer[tc.index]) {
              toolCallsBuffer[tc.index] = { name: '', argsString: '' };
            }
            if (tc.function?.name) {
              toolCallsBuffer[tc.index].name = tc.function.name;
            }
            if (tc.function?.arguments) {
              toolCallsBuffer[tc.index].argsString += tc.function.arguments;
            }
          }
        }
      } catch (e) {
        console.error('SSE parse error', e, dataStr);
      }
    }
  }

  const finalTools = Object.values(toolCallsBuffer).filter((tool) => tool.name);
  for (const tool of finalTools) {
    try {
      const args = JSON.parse(tool.argsString || '{}');
      yield [{ functionCall: { name: tool.name, args } }];
    } catch {
      console.error('Failed to parse tool args', tool.argsString);
    }
  }
}

export async function* streamOpenAIChat(messages, apiKey) {
  yield* streamOpenAICompatibleChat({
    messages,
    apiKey,
    model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o',
    baseUrl: 'https://api.openai.com/v1',
    providerName: 'OpenAI'
  });
}
