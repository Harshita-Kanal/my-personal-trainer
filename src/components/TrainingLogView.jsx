import { useState } from 'react';
import { Calendar, Dumbbell, Activity, Trash2 } from 'lucide-react';

export function TrainingLogView({ trainingLog, onClearHistory }) {
  const [confirming, setConfirming] = useState(false);

  const handleClear = async () => {
    if (!confirming) { setConfirming(true); return; }
    await onClearHistory();
    setConfirming(false);
  };

  return (
    <div style={{ flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={24} color="var(--primary)" /> Training Log
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              Your complete history of logged workouts and progression.
            </p>
          </div>
          <button
            onClick={handleClear}
            onBlur={() => setConfirming(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', border: '1px solid',
              borderColor: confirming ? '#ef4444' : 'var(--border)',
              background: confirming ? '#fef2f2' : 'white',
              color: confirming ? '#ef4444' : 'var(--text-muted)',
              fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap',
              marginTop: '4px',
            }}
          >
            <Trash2 size={14} />
            {confirming ? 'Confirm delete' : 'Clear history'}
          </button>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                {['Date', 'Exercise', 'Weight', 'Reps', 'Recommendation'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trainingLog.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No logs yet. Start chatting to track your sets.
                  </td>
                </tr>
              ) : (
                trainingLog.map((log) => (
                  <tr key={`${log.type}-${log.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>{log.date}</td>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem', fontWeight: '500' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {log.type === 'exercise' ? <Dumbbell size={16} /> : <Activity size={16} />}
                        {log.type === 'exercise' ? log.exercise : 'Recovery'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>
                      {log.type === 'exercise' ? `${log.weight}${log.unit}` : `${log.sleep_hours || '—'}h sleep`}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>
                      {log.type === 'exercise'
                        ? log.reps
                        : `Soreness ${log.soreness_level || '—'} / Energy ${log.energy_level || '—'}`}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {log.recommendation}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
