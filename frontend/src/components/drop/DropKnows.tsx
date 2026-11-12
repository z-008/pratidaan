/**
 * "What Drop knows" (demo mode): the engine's real state for the Donor being
 * viewed, so a reviewer can see why a Card appeared, waited or folded away.
 */
import { useEffect, useRef, useState } from 'react';
import { api, fmtDate, type DropView } from '../../api';
import { Icon } from '../../ui';
import './drop.css';

const PART_TIMES: Record<string, string> = { morning: '8 am', afternoon: '2 pm', evening: '7 pm', night: '9 pm' };
const LANGUAGE_NAMES: Record<string, string> = { en: 'English', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam' };

function Meter({ label, used, cap }: { label: string; used: number; cap: number }) {
  return (
    <div className="knows-meter">
      <div className="row between small"><span>{label}</span><b>{used} of {cap}</b></div>
      <div className="knows-track"><span style={{ width: `${Math.min(100, (used / cap) * 100)}%`, background: used >= cap ? 'var(--warn)' : 'var(--ai)' }} /></div>
    </div>
  );
}

export default function DropKnows({ donorId, onClose }: { donorId: string; onClose: () => void }) {
  const [view, setView] = useState<DropView | null>(null);
  const [name, setName] = useState('');
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const load = () => api.drop(donorId).then(setView).catch(() => {});
    load();
    api.personas().then((p) => setName(p.find((x) => x.id === donorId)?.name || donorId)).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('drop:changed', load);
    window.addEventListener('demo:clock', load);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('drop:changed', load);
      window.removeEventListener('demo:clock', load);
      window.removeEventListener('keydown', onKey);
    };
  }, [donorId]);

  const b = view?.budget;
  return (
    <aside className="knows" role="complementary" aria-label="What Drop knows">
      <div className="knows-head">
        <div>
          <div className="bold"><Icon name="cpu" size={16} /> What Drop knows</div>
          <div className="tiny muted">{name} · rules engine state</div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ minWidth: 40, minHeight: 40 }} aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>
      {!view || !b ? <div className="skeleton" style={{ height: 200 }} /> : (
        <div className="knows-body">
          <section>
            <h4>Now</h4>
            <p>{fmtDate(view.clock.date)}, {PART_TIMES[view.clock.partName]}{b.quiet ? ' · quiet hours: only urgent Cards and the Donor\'s own Reminders' : ''}</p>
            <p className="tiny muted">Drop writes in {LANGUAGE_NAMES[view.language] || view.language} · {view.open.filter((c) => c.byAi).length} of {view.open.length} open Cards worded by the AI</p>
          </section>

          <section>
            <h4>Message budget</h4>
            <p className="tiny muted">{b.kind === 'goal' ? 'Has a health goal' : 'Healthy'}: at most {b.perDay} new Card a day and {b.perWeek} a week, plus a {b.report === 'week' ? 'weekly' : 'monthly'} report on Sunday afternoon.</p>
            <Meter label="New Cards today" used={b.today} cap={b.perDay} />
            <Meter label={`This week (from ${fmtDate(b.weekOf)})`} used={b.week} cap={b.perWeek} />
          </section>

          <section>
            <h4>On Home now · {view.open.length}</h4>
            {view.open.length === 0 && <p className="muted small">Nothing open.</p>}
            {view.open.map((c) => (
              <div key={c.id} className="knows-row">
                <span>{c.label}</span>
                <span className={`pill ${c.urgent ? 'pill-bad' : c.counted ? 'pill-ai' : 'pill-neutral'}`}>{c.urgent ? 'urgent' : c.counted ? 'counted' : 'outside budget'}</span>
              </div>
            ))}
          </section>

          <section>
            <h4>Waiting · {view.waiting.length}</h4>
            {view.waiting.length === 0 && <p className="muted small">Nothing waiting.</p>}
            {view.waiting.map((w, i) => (
              <div key={i} className="knows-row"><span>{w.name}</span><span className="tiny muted">{w.foldOnly ? 'only ever in the report' : 'budget used up, or quiet hours'}</span></div>
            ))}
          </section>

          {view.later.length > 0 && (
            <section>
              <h4>Snoozed, hidden or folded</h4>
              {view.later.map((l, i) => (
                <div key={i} className="knows-row"><span>{l.label}</span><span className="tiny muted">{l.status}{l.reason ? `: ${l.reason}` : l.snoozes ? ` (${l.snoozes}×)` : ''}</span></div>
              ))}
            </section>
          )}

          <section>
            <h4>Coming up</h4>
            {view.upcoming.length === 0 && <p className="muted small">Nothing scheduled.</p>}
            {view.upcoming.map((u, i) => <div key={i} className="knows-row"><span>{u.name}</span><span className="tiny muted">{fmtDate(u.on)}</span></div>)}
          </section>

          <section>
            <h4>What just happened</h4>
            <ol className="knows-log">{view.log.map((l, i) => <li key={i}><span className="tiny faint">{l.at}</span> {l.text}</li>)}</ol>
          </section>

          <section>
            <h4>Plan and memory</h4>
            <p className="small">{view.plan || view.goals.length ? [...view.goals.filter((g) => g.state !== 'done').map((g) => g.name), view.plan?.activity?.label].filter(Boolean).join(' · ') || 'Reminders only' : 'No Plan yet'}</p>
            {view.plan?.reminders.map((r) => <p key={r.id} className="tiny muted">Reminder: {r.label} at {r.time}</p>)}
            <p className="tiny muted">Remembers: {view.memory.map((m) => m.text).join('; ') || 'nothing'}</p>
            <p className="tiny muted">Readings added: {view.readings.length} · Donation: {view.donate.daysTo == null ? 'on hold' : view.donate.daysTo === 0 ? 'can donate now' : `in ${view.donate.daysTo} days`}</p>
          </section>
        </div>
      )}
    </aside>
  );
}
