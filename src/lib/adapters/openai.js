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
  let contentBuffer = '';

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

        // Groq streams tool_use_failed as a top-level error object
        if (data.error) {
          const { code, failed_generation } = data.error;
          if (code === 'tool_use_failed' && failed_generation) {
            const parsed = extractTextModeFunctionCall(failed_generation);
            if (parsed) {
              for (const fc of parsed.calls) {
                yield [{ functionCall: fc }];
              }
            } else {
              throw new Error(`${providerName} tool_use_failed: ${data.error.message}`);
            }
          } else {
            throw new Error(`${providerName} API Error: ${data.error.message}`);
          }
          streamDone = true;
          break;
        }

        const delta = data.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          contentBuffer += delta.content;
          // Don't yield yet — wait until we know it's not a text-mode tool call
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

  // If the model emitted tool calls via delta.tool_calls, contentBuffer is clean prose — yield it.
  // If it emitted tool calls as raw text (text-mode fallback), extract them and don't yield as text.
  const textModeCall = finalTools.length === 0 ? extractTextModeFunctionCall(contentBuffer) : null;

  if (textModeCall) {
    // Yield any prose that appeared before the function call tag
    if (textModeCall.preamble.trim()) {
      yield [{ text: textModeCall.preamble }];
    }
    for (const fc of textModeCall.calls) {
      yield [{ functionCall: fc }];
    }
  } else {
    if (contentBuffer) {
      yield [{ text: contentBuffer }];
    }
    for (const tool of finalTools) {
      try {
        const args = JSON.parse(tool.argsString || '{}');
        yield [{ functionCall: { name: tool.name, args } }];
      } catch {
        console.error('Failed to parse tool args', tool.argsString);
      }
    }
  }
}

// Parses text-mode function call formats emitted by some models instead of structured tool_calls.
// Handles: <tool_call>{"name":...,"arguments":...}</tool_call>
//          <function_calls><invoke name="..."><parameter name="p">v</parameter></invoke></function_calls>
function extractTextModeFunctionCall(text) {
  const calls = [];
  let preamble = text;

  // Format 1: <tool_call>{...}</tool_call>
  const toolCallRe = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
  let m;
  while ((m = toolCallRe.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      const name = obj.name;
      const args = obj.arguments ?? obj.parameters ?? obj.args ?? {};
      if (name) {
        calls.push({ name, args });
        preamble = preamble.replace(m[0], '');
      }
    } catch { /* ignore malformed */ }
  }

  // Format 2: <function_calls><invoke name="...">...</invoke></function_calls>
  const invokeRe = /<function_calls>[\s\S]*?<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>[\s\S]*?<\/function_calls>/g;
  while ((m = invokeRe.exec(text)) !== null) {
    const name = m[1];
    const body = m[2];
    const args = {};
    const paramRe = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g;
    let p;
    while ((p = paramRe.exec(body)) !== null) {
      args[p[1]] = p[2].trim();
    }
    calls.push({ name, args });
    preamble = preamble.replace(m[0], '');
  }

  // Format 3: <function=name ...body... </function> — Groq/Llama text-mode format
  // body may be: {"key":"val"}, ({"key":"val"}), or key="val" pairs
  if (calls.length === 0) {
    const groqRe = /<function=(\w+)\s*([\s\S]*?)\s*<\/function>/g;
    while ((m = groqRe.exec(text)) !== null) {
      try {
        const name = m[1];
        let body = m[2].trim();
        // strip wrapping parens: ({"k":"v"}) → {"k":"v"}
        if (body.startsWith('(') && body.endsWith(')')) body = body.slice(1, -1).trim();
        // find the JSON object within body
        const jsonStart = body.indexOf('{');
        const jsonEnd = body.lastIndexOf('}');
        const args = jsonStart !== -1 && jsonEnd !== -1
          ? JSON.parse(body.slice(jsonStart, jsonEnd + 1))
          : {};
        calls.push({ name, args });
        preamble = preamble.replace(m[0], '');
      } catch { /* ignore */ }
    }
  }

  // Format 4: <function(name)(args)> — parens around both name and args
  if (calls.length === 0) {
    const parenRe = /<function\((\w+)\)\s*\(([\s\S]*?)\)\s*(?:<\/function>)?/g;
    while ((m = parenRe.exec(text)) !== null) {
      try {
        const name = m[1];
        const body = m[2].trim();
        const jsonStart = body.indexOf('{');
        const jsonEnd = body.lastIndexOf('}');
        const args = jsonStart !== -1 && jsonEnd !== -1 ? JSON.parse(body.slice(jsonStart, jsonEnd + 1)) : {};
        calls.push({ name, args });
        preamble = preamble.replace(m[0], '');
      } catch { /* ignore */ }
    }
  }

  // Format 5: <function\name {json}></function> or variants — backslash/space/underscore separator
  if (calls.length === 0) {
    const funcRe = /<function[_\s\\\/](\w+)\s*(\{[\s\S]*?\})[^<]*(?:<\/function>)?/g;
    while ((m = funcRe.exec(text)) !== null) {
      try {
        const name = m[1];
        const args = JSON.parse(m[2]);
        calls.push({ name, args });
        preamble = preamble.replace(m[0], '');
      } catch { /* ignore */ }
    }
  }

  return calls.length > 0 ? { calls, preamble: preamble.trim() } : null;
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
