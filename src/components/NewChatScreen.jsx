import { Dumbbell } from 'lucide-react';
import { InputBox } from './InputBox';

export const DEFAULT_SUGGESTIONS = [
  {
    title: 'Log a Set',
    description: 'Track weights, reps, and performance.',
    prompt: 'I want to log a set. Ask me what exercise, weight, and reps.',
  },
  {
    title: 'Check Progression',
    description: 'Analyze past performance and volume.',
    prompt: 'I want to check my progression. Ask me which exercise.',
  },
  {
    title: 'Form Check',
    description: 'Get mechanical cues and safety tips.',
    prompt: 'I want a form check. Ask me which exercise.',
  },
  {
    title: 'Manage Fatigue',
    description: 'Autoregulate volume based on recovery.',
    prompt: 'Help me assess my readiness to train today. Ask me about my sleep, soreness, and energy.',
  },
];

export function NewChatScreen({ suggestions = DEFAULT_SUGGESTIONS, inputRef, inputValue, onInputChange, onSend, isStreaming }) {
  return (
    <div className="new-chat-container">
      <div className="hero-branding">
        <Dumbbell size={56} strokeWidth={1.5} />
        <h2>What are we lifting today?</h2>
      </div>

      <InputBox
        ref={inputRef}
        value={inputValue}
        onChange={onInputChange}
        onSend={onSend}
        disabled={isStreaming}
        centered
      />

      <div className="suggestions-grid">
        {suggestions.map((s) => (
          <button
            key={s.title}
            className="suggestion-card"
            type="button"
            onClick={() => onSend(s.prompt)}
          >
            <h4>{s.title}</h4>
            <p>{s.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
