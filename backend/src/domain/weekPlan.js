/**
 * Week plans, Your day and Simplify my plan (CONTEXT.md). A Week plan is what
 * the Donor agreed with Drop for up to a week, ending on Sunday: one or two
 * items per Habit (Movement, Food, Mind). Items come from their Goal's steps or
 * their Cycle's focus; Drop never saves one without a tap. Whether an item was
 * kept comes from the Donor's own apps (watch, habit app) or their own tap.
 */

const store = require('../data/store');
const signals = require('./signals');
const foodCoach = require('./foodCoach');
const { addDays, weekStart, sundayOf, range, fmt } = require('./dates');

const HABITS = ['movement', 'food', 'mind'];
const MAX_PER_HABIT = 2;
const drop = () => require('./drop');

/** "Brisk walks, 30 minutes on 5 days a week" → minutes 30, perWeek 5. */
function parseStep(text) {
  const minutes = Number((text.match(/(\d+)\s*minutes?/) || [])[1]) || null;
  const perWeek = Number((text.match(/on (\d) days/) || [])[1]) || (/150 minutes a week/.test(text) ? 5 : null);
  return { minutes: minutes && minutes > 60 ? 30 : minutes, perWeek };
}

/**
 * Up to two items Drop suggests for one Habit, from the Goal steps first.
 * An urgent Goal gets no Movement items (its write-up has no exercise step).
 */
function suggest(st, habit) {
  if (!HABITS.includes(habit)) throw new Error(`No Habit ${habit}`);
  const goals = signals.goals(st).filter((g) => g.state === 'active' && g.writeup);
  const urgent = goals.some((g) => g.severity === 'urgent');
  const items = [];
  if (habit === 'movement' && urgent) return { items, note: 'No Movement plan until a doctor has seen you: your urgent Goal comes first.' };
  for (const g of goals) {
    for (const step of g.writeup.steps.filter((s) => s.tag === habit)) {
      if (items.length >= MAX_PER_HABIT) break;
      const { minutes, perWeek } = parseStep(step.text);
      // A first week starts lighter than the target: three sessions, not five
      const week = habit === 'movement' ? { minutes: minutes || 30, perWeek: Math.min(perWeek || 3, 3), measuredBy: 'active_min', kind: 'session', text: `${minutes || 30}-minute brisk walk` }
        : { perWeek: 7, kind: 'guide', measuredBy: 'you', text: step.text };
      items.push({ habit, goalId: g.id, forText: `for your ${g.name}`, source: step.evidence?.[0] || null, ...week });
    }
  }
  if (habit === 'food' && items.length < MAX_PER_HABIT) {
    const iron = foodCoach.suggest(st, 'iron');
    if (iron.level && ['low_normal', 'below'].includes(iron.level.level) && iron.foods[0]) {
      items.unshift({ habit, kind: 'session', perWeek: 5, measuredBy: 'food_habit', focus: 'iron', text: `Iron add-on with lunch: ${iron.foods[0].nameEn.toLowerCase()} or ${iron.foods[1]?.nameEn.toLowerCase() || 'greens'}`, forText: 'for your iron', source: 'ICMR-NIN Dietary Guidelines 2024' });
    }
  }
  if (!items.length) {
    const fallback = {
      movement: { kind: 'session', perWeek: 3, minutes: 20, measuredBy: 'active_min', text: '20-minute walk' },
      food: { kind: 'guide', perWeek: 7, measuredBy: 'you', text: 'Greens or dal at lunch every day' },
      mind: { kind: 'session', perWeek: 5, measuredBy: 'sleep_min', minutes: 420, text: "7 hours' sleep, same wake-up time" },
    }[habit];
    items.push({ habit, forText: null, source: null, ...fallback });
  }
  return { items: items.slice(0, MAX_PER_HABIT) };
}

/** Saves items for their Habits (each Habit's earlier items are replaced). Ends on Sunday. */
function save(st, items, { sync } = {}) {
  const w = signals.ensure(st);
  const today = store.today();
  // A plan made on a Sunday runs to next Sunday, so it is never a one-day week
  const ends = new Date(`${today}T00:00:00Z`).getUTCDay() === 0 ? addDays(today, 7) : sundayOf(today);
  const plan = w.weekPlan && w.weekPlan.endsOn >= today && !(w.weekPlan.endsOn === today && ends > today) ? w.weekPlan : { id: signals.nextId(st, 'wp'), weekOf: weekStart(today), endsOn: ends, items: [], createdOn: today };
  const habits = new Set(items.map((i) => i.habit));
  plan.items = plan.items.filter((i) => !habits.has(i.habit));
  for (const i of items) {
    const item = { id: signals.nextId(st, 'wi'), habit: i.habit, kind: i.kind || 'session', text: i.text, perWeek: i.perWeek || 7, minutes: i.minutes || null,
      measuredBy: i.measuredBy || 'you', goalId: i.goalId || null, focus: i.focus || null, forText: i.forText || null, source: i.source || null, setAside: false, stepDown: null, sync: null };
    if (sync) item.sync = { connectionId: sync.id, app: sync.label, since: today };
    plan.items.push(item);
  }
  w.weekPlan = plan;
  return plan;
}

/** The plan item as it applies today (a step-down Drop and the Donor agreed makes it smaller for a week). */
function effective(item, date = store.today()) {
  const s = item.stepDown && date <= item.stepDown.until ? item.stepDown : null;
  return { minutes: s?.minutes ?? item.minutes, perWeek: s?.perWeek ?? item.perWeek, text: s?.text ?? item.text, steppedDown: Boolean(s) };
}

/** Was this item kept on this day? true / false, or null when nothing recorded it. */
function kept(st, item, date) {
  const w = signals.ensure(st);
  const mine = w.planLog[date]?.[item.id];
  if (mine === 'done') return true;
  if (mine === 'skipped') return false;
  const e = effective(item, date);
  if (item.measuredBy === 'active_min') {
    const v = signals.valueOn(st, 'active_min', date);
    if (v) return v.value >= (e.minutes || 20);
  }
  if (item.measuredBy === 'sleep_min') {
    const v = signals.valueOn(st, 'sleep_min', date);
    if (v) return v.value >= (item.minutes || 420);
  }
  const tick = signals.habitDone(st, item, date);
  if (tick !== null) return tick === 1;
  return null;
}

/** One week of an item: days kept, out of how many planned. */
function weekOf(st, item, weekStartDate) {
  const days = range(weekStartDate, addDays(weekStartDate, 6)).map((d) => ({ date: d, state: d > store.today() ? 'future' : (() => { const k = kept(st, item, d); return k === null ? 'none' : k ? 'kept' : 'missed'; })() }));
  return { keptDays: days.filter((d) => d.state === 'kept').length, planned: effective(item, weekStartDate).perWeek, days };
}

/** The Week plan as the app shows it: items with this week's days, sources, and what is set aside. */
function view(st) {
  const w = signals.ensure(st);
  const plan = w.weekPlan;
  if (!plan) return null;
  const today = store.today();
  const ws = weekStart(today);
  return {
    id: plan.id, weekOf: plan.weekOf, endsOn: plan.endsOn, ended: plan.endsOn < today, endsText: fmt(plan.endsOn),
    items: plan.items.map((i) => {
      const e = effective(i);
      const wk = weekOf(st, i, ws);
      const source = i.measuredBy === 'active_min' && signals.has(st, 'active_min') ? signals.appsFor(st, 'active_min')[0]
        : i.measuredBy === 'sleep_min' && signals.has(st, 'sleep_min') ? signals.appsFor(st, 'sleep_min')[0]
          : i.sync ? `${i.sync.app}${i.sync.connectionId.endsWith('_demo') ? ' (demo)' : ''}` : 'You';
      return { id: i.id, habit: i.habit, text: e.text, original: i.text, perWeek: e.perWeek, minutes: e.minutes, steppedDown: e.steppedDown, forText: i.forText, goalId: i.goalId, setAside: i.setAside, synced: i.sync ? i.sync.app : null, source, week: wk };
    }),
  };
}

/** The Donor ticked or skipped an item (from Your day, a Card or the Habits list). */
function log(st, itemId, date, state, barrier) {
  const w = signals.ensure(st);
  if (!w.weekPlan?.items.some((i) => i.id === itemId)) throw new Error('That Week plan item is not in your plan');
  (w.planLog[date] = w.planLog[date] || {})[itemId] = state;
  if (state === 'skipped' && barrier) w.barriers.push({ date, code: barrier, itemId, source: 'you' });
}

/**
 * Simplify my plan (CONTEXT.md): keep the one item that matters most, make it smaller but never nothing,
 * and set the rest aside until the Donor brings them back. Never touches Goals, Reminders or Your day.
 */
function simplify(st) {
  const plan = signals.ensure(st).weekPlan;
  const live = plan ? plan.items.filter((i) => !i.setAside) : [];
  if (!live.length) throw new Error('There is no Week plan to simplify');
  const firstGoal = signals.goals(st).find((g) => g.state === 'active');
  const ws = weekStart(store.today());
  const rate = (i) => weekOf(st, i, ws).keptDays / Math.max(1, effective(i).perWeek);
  // The item that matters most: it serves the first active Goal, else this Cycle's focus, else it was kept most
  const focus = require('./cycle').focus(st);
  const keep = live.find((i) => firstGoal && i.goalId === firstGoal.id) || live.find((i) => focus && i.focus === focus.key) || [...live].sort((a, b) => rate(b) - rate(a))[0];
  for (const i of live) if (i !== keep) i.setAside = true;
  const e = effective(keep);
  const smaller = keep.minutes && keep.measuredBy === 'active_min'
    ? { minutes: Math.max(10, Math.round((e.minutes || 30) / 2)), perWeek: e.perWeek, text: `${Math.max(10, Math.round((e.minutes || 30) / 2))}-minute walk` }
    : { perWeek: Math.max(2, Math.ceil((e.perWeek || 7) / 2)), minutes: e.minutes, text: e.text };
  keep.stepDown = { ...smaller, until: plan.endsOn, by: 'simplify', on: store.today() };
  return { kept: keep.id, setAside: live.filter((i) => i !== keep).map((i) => i.id) };
}

function bringBack(st, itemId) {
  const item = signals.ensure(st).weekPlan?.items.find((i) => i.id === itemId);
  if (!item) throw new Error('That Week plan item is not in your plan');
  item.setAside = false;
  return item;
}

function remove(st) { signals.ensure(st).weekPlan = null; }

/** Your day: opt in at a time the Donor chose; outside the Message budget (CONTEXT.md). */
function setDay(st, time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) throw new Error('Choose a time like 21:00');
  signals.ensure(st).day = { time, since: store.today() };
}
function clearDay(st) { signals.ensure(st).day = null; }

module.exports = { HABITS, suggest, save, effective, kept, weekOf, view, log, simplify, bringBack, remove, setDay, clearDay, parseStep };
