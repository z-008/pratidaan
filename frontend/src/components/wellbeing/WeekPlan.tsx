/**
 * My health's Habits and This week (CONTEXT.md: Habit, Week plan), for every Donor with connected apps or a
 * Week plan: what their apps recorded this week against healthy targets, and their Week plan items with the
 * days kept. A Donor with neither keeps My health's "Plan this week" shells exactly as before.
 */
import { api, type WbHabit, type WbPlanItem, type WbWeekPlan } from '../../api';
import { Icon } from '../../ui';
import { HABITS, STATUS_PILL, dayLabel, wellbeingChanged } from './wellbeing';
import './wellbeing.css';

const STATE_WORD: Record<string, string> = { on: 'On target', drift: 'Nearly', off: 'Below target' };

/** "2 of 3 days", or "3 of 3 days ✓" once the week's plan is met (extra days count as met, not as more). */
export const kept = (i: WbPlanItem) => (i.week.keptDays >= i.perWeek ? `${i.perWeek} of ${i.perWeek} days ✓` : `${i.week.keptDays} of ${i.perWeek} days`);

function Days({ item }: { item: WbPlanItem }) {
  return (
    <span className="wb-days" aria-label={`Kept on ${item.week.keptDays} of ${item.perWeek} planned days this week`}>
      {item.week.days.map((d) => <span key={d.date} className={d.state} title={`${dayLabel(d.date)}: ${d.state === 'kept' ? 'kept' : d.state === 'missed' ? 'not done' : d.state === 'future' ? 'to come' : 'no record'}`} />)}
    </span>
  );
}

/** Movement, Food and Mind: the headline from the Donor's apps (or their plan), with how it compares with a healthy target. */
export function PlanShelf({ habits, plan, onPlan }: { habits: WbHabit[]; plan: WbWeekPlan | null; onPlan: (habit: string) => void }) {
  return (
    <section className="card wb">
      <div className="row wrap" style={{ alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span className="card-title">Habits</span>
        <span className="muted small">· {plan ? `Week plan until ${plan.endsText}${plan.ended ? ' (ended)' : ''}` : 'no Week plan yet'} · from your apps this week</span>
      </div>
      <div className="habit-row">
        {HABITS.map((h) => {
          const data = habits.find((x) => x.habit === h.id);
          const items = (data?.items || []).filter((i) => !i.setAside);
          const top = data?.metrics.find((m) => m.state) || data?.metrics[0];
          const line = items.length ? items.map((i) => `${i.text} · ${kept(i)}`).join('; ') : top ? `${top.label}: ${top.value}` : 'Plan this week';
          return (
            <button key={h.id} className={`hb${items.length || top ? '' : ' idle'}`} onClick={() => onPlan(h.id)}>
              <span className={`disc${items.length || top ? ' on' : ''}`}><Icon name={h.icon} size={22} /></span>
              <span>
                <b>{h.name}{data?.state && <span className={`pill ${STATUS_PILL[data.state]}`} style={{ marginLeft: 6 }}>{STATE_WORD[data.state]}</span>}</b>
                <span className="s">{line}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Per Habit: each measured number against its target and source, then the Week plan items with the days kept. */
export function PlanWeek({ donorId, habits, plan, weekLabel, onPlan }: { donorId: string; habits: WbHabit[]; plan: WbWeekPlan | null; weekLabel: string; onPlan: (habit: string) => void }) {
  const tick = (id: string, state: 'done' | 'skipped') => api.wbLogItem(donorId, id, state).then(() => wellbeingChanged()).catch(() => {});
  return (
    <section className="card wb">
      <div className="row between wrap">
        <div className="card-title">This week</div>
        <span className="tiny muted">{weekLabel}</span>
      </div>
      <div className="stack mt-12" style={{ gap: 8 }}>
        {HABITS.map((h) => {
          const data = habits.find((x) => x.habit === h.id);
          const items = (plan?.items || []).filter((i) => i.habit === h.id);
          return (
            <div key={h.id} className="stack" style={{ gap: 6 }}>
              {(data?.metrics || []).map((m) => (
                <div key={m.signal} className="item">
                  <span className="disc sm on"><Icon name={h.icon} size={18} /></span>
                  <span className="grow"><b>{h.name} · {m.label}: {m.value}</b><small>{m.target ? `Healthy: ${m.target}` : 'For your record'} · from {m.app}</small></span>
                  {m.state && <span className={`pill ${STATUS_PILL[m.state]}`}>{STATE_WORD[m.state]}</span>}
                </div>
              ))}
              {items.map((i) => (
                <div key={i.id} className="item" style={i.setAside ? { opacity: 0.6 } : undefined}>
                  <span className="disc sm on"><Icon name="flag" size={16} /></span>
                  <span className="grow">
                    <b>{i.text}{i.steppedDown && <span className="pill pill-info" style={{ marginLeft: 6 }}>Lighter this week</span>}{i.setAside && <span className="pill pill-neutral" style={{ marginLeft: 6 }}>Set aside</span>}</b>
                    <small>Week plan · {kept(i)}{i.forText ? ` · ${i.forText}` : ''} · tracked by {i.source}{i.synced ? ` · in ${i.synced}` : ''}</small>
                  </span>
                  <Days item={i} />
                  {i.setAside
                    ? <button className="btn btn-sm" onClick={() => api.wbBringBack(donorId, i.id).then(() => wellbeingChanged())}>Bring back</button>
                    : i.source === 'You' && <button className="btn btn-sm" onClick={() => tick(i.id, 'done')}>Done today</button>}
                </div>
              ))}
              {!items.length && (
                <div className="item">
                  <span className="disc sm"><Icon name={h.icon} size={18} /></span>
                  <span className="grow"><b>{h.name}</b><small>{data?.metrics.length ? 'No Week plan: Drop can suggest one from your Goal' : data?.hint || 'No Week plan'}</small></span>
                  <button className="btn btn-sm" onClick={() => onPlan(h.id)}>Plan this week</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
