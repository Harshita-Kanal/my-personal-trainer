import { useEffect, useRef } from 'react';
import { Dumbbell, Loader2 } from 'lucide-react';
import { MessageBubble } from './MessageBubble';

export function ChatArea({ messages, isStreaming }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lastIsUser = messages[messages.length - 1]?.role === 'user';

  return (
    <div className="chat-area">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {isStreaming && lastIsUser && (
        <div className="message-wrapper model">
          <div className="avatar model">
            <Dumbbell size={20} />
          </div>
          <div className="message-content" style={{ justifyContent: 'center' }}>
            <Loader2 size={20} color="var(--text-muted)" style={{ animation: 'spin 2s linear infinite' }} />
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
