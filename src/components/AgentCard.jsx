import { TrendingUp, Zap, Activity, Globe } from 'lucide-react';

const ICONS = {
  progress: TrendingUp,
  form:     Zap,
  recovery: Activity,
  search:   Globe,
};

export function AgentCard({ card }) {
  const Icon = ICONS[card.type] || Zap;
  const isForm = card.type === 'form';

  return (
    <div className="agent-card">
      <div className="agent-card-title">
        <Icon size={18} />
        {card.title}
      </div>

      {card.stats?.map((stat, idx) => (
        <div className="stat-row" key={idx}>
          <span className="stat-label">{stat.label}</span>
          <span className="stat-value">{stat.value}</span>
        </div>
      ))}

      {card.insight && (
        <div style={{
          marginTop:  card.stats ? '12px' : '0',
          paddingTop: card.stats ? '12px' : '0',
          borderTop:  card.stats ? '1px solid var(--border)' : 'none',
          fontSize:   isForm ? '0.95rem' : '0.85rem',
          color:      isForm ? 'var(--text-main)' : 'var(--text-muted)',
          lineHeight: '1.5',
        }}>
          {card.type === 'progress' && (
            <Zap size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: '-3px' }} />
          )}
          {card.insight}
        </div>
      )}
    </div>
  );
}
