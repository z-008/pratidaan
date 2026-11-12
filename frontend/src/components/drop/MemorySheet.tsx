/** "What Drop remembers": each memory can be deleted; health facts live in the Plan, not here. */
import { useEffect, useState } from 'react';
import { Icon } from '../../ui';

export default function MemorySheet({ memory, onForget, onForgetAll, onClose }: {
  memory: { id: string; text: string }[]; onForget: (id: string) => void; onForgetAll: () => void; onClose: () => void;
}) {
  const [confirmAll, setConfirmAll] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="What Drop remembers" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="row between"><div className="card-title"><Icon name="drop" size={18} /> What Drop remembers</div><button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">×</button></div>
        <div className="stack mt-12" style={{ gap: 0 }}>
          {memory.map((m) => (
            <div key={m.id} className="row" style={{ minHeight: 52, borderBottom: '1px solid var(--border)' }}>
              <span style={{ flex: 1 }}>{m.text}</span>
              <button className="btn btn-sm" style={{ minWidth: 44, minHeight: 44 }} aria-label={`Forget: ${m.text}`} onClick={() => onForget(m.id)}>×</button>
            </div>
          ))}
          {!memory.length && <p className="muted small">Nothing yet. Drop remembers things you tell it, like which days suit you.</p>}
        </div>
        <p className="tiny muted mt-12">Your readings, tablets and goals are kept in your Plan, not here. Drop never keeps religion, caste, income, your family's health or anything about the patients your blood helped.</p>
        {memory.length > 0 && (
          <button className="btn mt-12" style={{ minHeight: 44, color: 'var(--bad)' }} onClick={() => (confirmAll ? (onForgetAll(), setConfirmAll(false)) : setConfirmAll(true))}>
            {confirmAll ? 'Tap again to forget everything' : 'Forget everything'}
          </button>
        )}
      </div>
    </div>
  );
}
