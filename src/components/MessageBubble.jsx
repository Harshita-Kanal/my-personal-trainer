import { Dumbbell, User } from 'lucide-react';
import { AgentCard } from './AgentCard';

export function MessageBubble({ message }) {
  const { role, content, card } = message;

  return (
    <div className={`message-wrapper ${role}`}>
      <div className={`avatar ${role}`}>
        {role === 'model' ? <Dumbbell size={20} /> : <User size={20} />}
      </div>
      <div className="message-content">
        {content && <div className="message-bubble">{content}</div>}
        {card && <AgentCard card={card} />}
      </div>
    </div>
  );
}
