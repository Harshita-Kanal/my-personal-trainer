import { streamOpenAIChat } from './adapters/openai';
import { streamGroqChat } from './adapters/groq';

export const getLLMConfig = () => {
  const provider = import.meta.env.VITE_LLM_PROVIDER || (import.meta.env.VITE_GROQ_API_KEY ? 'groq' : 'openai');

  if (provider === 'groq') {
    return {
      provider,
      apiKey: import.meta.env.VITE_GROQ_API_KEY || '',
      missingKeyName: 'VITE_GROQ_API_KEY'
    };
  }

  return {
    provider: 'openai',
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
    missingKeyName: 'VITE_OPENAI_API_KEY'
  };
};

export const streamLLMChat = async function*(messages, config = getLLMConfig()) {
  if (config.provider === 'groq') {
    yield* streamGroqChat(messages, config.apiKey);
    return;
  }

  yield* streamOpenAIChat(messages, config.apiKey);
};
