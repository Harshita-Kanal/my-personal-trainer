import { streamOpenAICompatibleChat } from './openai';

export async function* streamGroqChat(messages, apiKey) {
  yield* streamOpenAICompatibleChat({
    messages,
    apiKey,
    model: import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    providerName: 'Groq'
  });
}
