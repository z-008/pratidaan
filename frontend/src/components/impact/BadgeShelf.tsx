/**
 * The Badge shelf on My Impact (spec section 2): all 8 Badges in shelf order.
 * Earned slots show a small medal and the month; unearned ones are greyed with
 * their goal and progress. Clicking an earned Badge opens it to share.
 */
import { useId } from 'react';
import type { Badge } from '../../api';
import './badges.css';

const DROP = 'M12 2.5c-3.6 4.6-6.5 8.4-6.5 12A6.5 6.5 0 0 0 12 21a6.5 6.5 0 0 0 6.5-6.5c0-3.6-2.9-7.4-6.5-12z';
const HEART = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';

/** The ring glyph, as on the share image: a number, or an icon for check, five-drop, vial and heart. */
function Glyph({ ring }: { ring: string }) {
  const ink = '#fff6e6';
  if (ring === 'heart') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={HEART} fill={ink} /></svg>;
  if (ring === 'check') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12.5l3.8 3.8L17.8 8.5" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (ring === 'vial') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4h8M10 4v12a2 2 0 0 0 4 0V4" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11.5h4V16a2 2 0 0 1-4 0z" fill={ink} />
      </svg>
    );
  }
  if (ring === 'five-drop') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          const x = 12 + Math.cos(a) * 5.4 - 12 * 0.38;
          const y = 12 + Math.sin(a) * 5.4 - 12 * 0.38;
          return <path key={i} d={DROP} fill={ink} transform={`translate(${x} ${y}) scale(0.38)`} />;
        })}
      </svg>
    );
  }
  return <span className={ring.length > 2 ? 'medal-num long' : 'medal-num'}>{ring}</span>;
}

const RING_R = 25;
const RING_LEN = 2 * Math.PI * RING_R;

export function Medal({ ring, earned, progressRatio, compact }: { ring: string; earned?: boolean; progressRatio?: number | null; compact?: boolean }) {
  const gid = useId().replace(/:/g, '');
  const done = Boolean(earned);
  const pct = done ? 1 : Math.max(0, Math.min(1, progressRatio ?? 0));
  const size = compact ? 48 : 56;
  const uid = `medal-gold-${gid}`;
  return (
    <span className={`medal-wrap${compact ? ' compact' : ''}`} style={{ width: size, height: size }}>
      {!done && (
        <svg className="medal-progress" viewBox="0 0 56 56" aria-hidden="true">
          <defs>
            <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e9cf7a" /><stop offset="50%" stopColor="#fff3c4" /><stop offset="100%" stopColor="#b88a2a" />
            </linearGradient>
          </defs>
          <circle cx="28" cy="28" r={RING_R} fill="none" stroke="var(--border)" strokeWidth="3.5" opacity="0.55" />
          {pct > 0 && (
            <circle cx="28" cy="28" r={RING_R} fill="none" stroke={`url(#${uid})`} strokeWidth="3.5"
              strokeDasharray={`${pct * RING_LEN} ${RING_LEN}`} strokeLinecap="round" transform="rotate(-90 28 28)" />
          )}
        </svg>
      )}
      <span className={`medal${done ? '' : ' in-progress'}`}>
        <span className="medal-disc"><Glyph ring={ring} /></span>
      </span>
    </span>
  );
}

export default function BadgeShelf({ badges, fresh, onOpen }: { badges: Badge[]; fresh: string[]; onOpen: (badge: Badge) => void }) {
  const held = badges.filter((b) => b.earned).length;
  return (
    <div className="card badge-shelf">
      <div className="badge-shelf-head"><b>Badges</b><span>· {held} of {badges.length}</span></div>
      <div className="badge-slots">
        {badges.map((b) => b.earned
          ? (
            <button key={b.id} className={`badge-slot${fresh.includes(b.id) ? ' new' : ''}`} onClick={() => onOpen(b)}
              aria-label={`${fresh.includes(b.id) ? 'New Badge: ' : ''}${b.name}, earned ${b.earnedLabel}. Open to share`}>
              <Medal ring={b.ring} earned />
              <span className="badge-slot-text">{fresh.includes(b.id) && <i className="badge-new">New</i>}<b>{b.name}</b><span>Earned {b.earnedLabel}</span></span>
            </button>
          )
          : (
            <div key={b.id} className="badge-slot locked">
              <Medal ring={b.ring} progressRatio={b.progressRatio} />
              <span className="badge-slot-text"><b>{b.name}</b><span>{b.goal}{b.progress ? ` · ${b.progress}` : ''}</span></span>
            </div>
          ))}
      </div>
    </div>
  );
}
