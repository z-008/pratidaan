/** A few Badges on Home; full shelf lives on My Impact only. */
import type { Badge } from '../../api';
import { Icon } from '../../ui';
import { Medal } from './BadgeShelf';
import './badges.css';

export function pickHomeBadges(badges: Badge[], n = 4): Badge[] {
  const earned = badges.filter((b) => b.earned);
  const closing = badges
    .filter((b) => !b.earned && (b.progressRatio ?? 0) > 0)
    .sort((a, z) => (z.progressRatio ?? 0) - (a.progressRatio ?? 0));
  const rest = badges.filter((b) => !b.earned && !(b.progressRatio ?? 0));
  const out: Badge[] = [];
  for (const b of [...earned.slice(-2), ...closing.slice(0, 2), ...rest]) {
    if (out.length >= n) break;
    if (!out.some((x) => x.id === b.id)) out.push(b);
  }
  return out.slice(0, n);
}

export default function BadgeHomePreview({ badges, fresh, onMore }: { badges: Badge[]; fresh?: string[]; onMore: () => void }) {
  const held = badges.filter((b) => b.earned).length;
  const shown = pickHomeBadges(badges);
  if (!shown.length) return null;

  return (
    <div className="card badge-home">
      <div className="row between wrap" style={{ gap: 8 }}>
        <div>
          <div className="stat-label">Your badges</div>
          <div className="small muted">{held} of {badges.length} earned</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onMore}>See all on My Impact <Icon name="arrow" size={14} /></button>
      </div>
      <div className="badge-home-row">
        {shown.map((b) => (
          <div key={b.id} className="badge-home-item" title={b.earned ? `Earned ${b.earnedLabel}` : `${b.goal}${b.progress ? ` · ${b.progress}` : ''}`}>
            <Medal ring={b.ring} earned={b.earned} progressRatio={b.progressRatio} compact />
            <span className="badge-home-name">{b.name}{fresh?.includes(b.id) && <i className="badge-new">New</i>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
