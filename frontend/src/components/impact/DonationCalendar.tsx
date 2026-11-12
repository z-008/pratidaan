/** A small month calendar: donation days are marked, and clicking one picks that donation. */
import { useState } from 'react';
import { Icon } from '../../ui';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (iso: string) => iso.slice(0, 7);

function shiftMonth(key: string, by: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

interface Props {
  dates: string[];
  selected: string;
  today?: string;
  onPick: (date: string) => void;
}

export default function DonationCalendar({ dates, selected, today, onPick }: Props) {
  const [month, setMonth] = useState(monthKey(selected));
  const [shownFor, setShownFor] = useState(selected);
  if (shownFor !== selected) {
    setShownFor(selected);
    setMonth(monthKey(selected));
  }

  const marked = new Set(dates);
  const sorted = [...dates].sort();
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
  const idx = sorted.indexOf(selected);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const inMonth = dates.filter((d) => monthKey(d) === month).length;

  return (
    <div className="cal">
      <div className="cal-head">
        <button className="cal-nav" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><Icon name="chevron" size={14} className="flip" /></button>
        <span className="bold small">{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
        <button className="cal-nav" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><Icon name="chevron" size={14} /></button>
      </div>
      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((w, i) => <span key={i} className="cal-wd">{w}</span>)}
        {cells.map((d, i) => d == null ? <span key={i} /> : (
          <button key={d} role="gridcell" disabled={!marked.has(d)}
            className={`cal-day${marked.has(d) ? ' has' : ''}${d === selected ? ' sel' : ''}${d === today ? ' today' : ''}`}
            aria-pressed={d === selected} aria-label={`${d}${marked.has(d) ? ', donation' : ''}`} onClick={() => onPick(d)}>
            {Number(d.slice(8))}
          </button>
        ))}
      </div>
      <div className="tiny muted mt-8">{inMonth ? `${inMonth} donation${inMonth === 1 ? '' : 's'} this month` : 'No donations this month'}</div>
      <div className="row between mt-8">
        <button className="btn btn-ghost btn-sm" disabled={!prev} onClick={() => prev && onPick(prev)}>← Earlier donation</button>
        <button className="btn btn-ghost btn-sm" disabled={!next} onClick={() => next && onPick(next)}>Later donation →</button>
      </div>
    </div>
  );
}
