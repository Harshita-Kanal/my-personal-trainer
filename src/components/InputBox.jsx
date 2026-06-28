import { forwardRef, useRef, useImperativeHandle } from 'react';
import { Send } from 'lucide-react';

export const InputBox = forwardRef(function InputBox({ value, onChange, onSend, disabled, centered = false }, ref) {
  const textareaRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className={centered ? 'input-container-centered' : 'input-container'}>
      <div
        className="input-wrapper"
        style={centered ? { padding: '12px 20px', borderRadius: '32px', background: 'var(--bg-sidebar)', borderColor: 'transparent' } : {}}
      >
        <textarea
          ref={textareaRef}
          className="message-input"
          placeholder={centered ? 'Log your set or ask for a progression check...' : 'Message Strength Coach...'}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          style={centered ? { fontSize: '1.1rem', padding: '12px 0' } : {}}
        />
        <button
          className="send-btn"
          onClick={() => onSend()}
          disabled={!value.trim() || disabled}
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
});
