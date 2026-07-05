import { InputBox } from './InputBox';

export const DEFAULT_SUGGESTIONS = [
  {
    title: 'Log a Set',
    description: 'Track weights, reps, and performance.',
    prompt: 'I want to log a set. Ask me what exercise, weight, and reps.',
    icon: '🏋️',
    accent: 'mint',
  },
  {
    title: 'Check Progression',
    description: 'Analyze past performance and volume.',
    prompt: 'I want to check my progression. Ask me which exercise.',
    icon: '📈',
    accent: 'lavender',
  },
  {
    title: 'Form Check',
    description: 'Get mechanical cues and safety tips.',
    prompt: 'I want a form check. Ask me which exercise.',
    icon: '🎯',
    accent: 'mint',
  },
  {
    title: 'Manage Fatigue',
    description: 'Autoregulate volume based on recovery.',
    prompt: 'Help me assess my readiness to train today. Ask me about my sleep, soreness, and energy.',
    icon: '🔋',
    accent: 'lavender',
  },
];

export function NewChatScreen({ suggestions = DEFAULT_SUGGESTIONS, inputRef, inputValue, onInputChange, onSend, isStreaming }) {
  return (
    <div className="new-chat-container">
      <div className="hero-branding">
        <span className="hero-icon-badge">🏋️</span>
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
            {s.icon && (
              <span className={`suggestion-card-icon suggestion-card-icon--${s.accent ?? 'mint'}`}>
                {s.icon}
              </span>
            )}
            <span>
              <h4>{s.title}</h4>
              <p>{s.description}</p>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
