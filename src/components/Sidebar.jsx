import { Dumbbell, Plus, MessageSquare, Calendar, Trash2 } from 'lucide-react';

export function Sidebar({ sessions, currentSessionId, currentView, onNewChat, onLoadSession, onDeleteSession, onViewChange, isOpen, onClose }) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <div className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <Dumbbell size={22} strokeWidth={2} />
          <span>Strength Coach</span>
        </div>

        <button className="new-chat-btn" onClick={onNewChat}>
          <Plus size={18} />
          New workout
        </button>

        <div className="history-section-title">Chat History</div>
        <div className="history-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`history-item ${currentSessionId === session.id && currentView === 'chat' ? 'active' : ''}`}
              onClick={() => onLoadSession(session.id)}
            >
              <MessageSquare size={16} className="history-item-icon" />
              <span className="history-item-title">{session.title}</span>
              <button
                className="history-item-delete"
                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                title="Delete session"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div style={{ padding: '0 12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              No previous sessions.
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <div
            className={`history-item ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => onViewChange('history')}
            style={{ fontWeight: 600 }}
          >
            <Calendar size={18} />
            Training Log
          </div>
        </div>
      </div>
    </>
  );
}
