/**
 * The Cycle as a stretch between two free health checks (CONTEXT.md: Cycle,
 * Cycle report): where the Donor is in it, what this Cycle's focus is, and the
 * Cycle report when a donation's results arrive. Reads the existing rules
 * (health.eligibility, Goals); changes none of them.
 */

const store = require('../data/store');
const health = require('./health');
const bands = require('./bands');
const careLevel = require('./careLevel');
const signals = require('./signals');
const weekPlan = require('./weekPlan');
const impact = require('./impact');
const ref = require('../data/reference');
const { addDays, between, fmt, range, weekStart } = require('./dates');

const drop = () => require('./drop');
const NON_DONOR_DAYS = 120; // CONTEXT.md: a Donor who isn't donating has a 120-day Cycle
const PHASES = { recover: 'Recover', build: 'Build', prep: 'Get ready', due: 'Ready to donate', waiting: 'Waiting on your Goal' };
const FOCUS_OF = { bp: 'bp', hba1c: 'sugar', ldl: 'lipids', tg: 'lipids', hb: 'iron', ferritin: 'iron' };

/** Where the Donor is between donations, or null before their first visit. */
function current(donorId) {
  const visits = store.getDonations(donorId);
  if (!visits.length) return null;
  const last = visits[visits.length - 1];
  const el = health.eligibility(donorId);
  const today = store.today();
  const completed = visits.filter((v) => v.status === 'completed').length;
  const length = last.status === 'completed' ? el.gapDays : NON_DONOR_DAYS;
  const nominal = el.nextEligibleDate || (last.status === 'completed' ? addDays(last.date, el.gapDays) : null);
  const day = between(last.date, today);
  let phase = 'build';
  if (el.eligibleNow) phase = 'due';
  else if (day <= 3 && last.status === 'completed') phase = 'recover';
  else if (nominal && nominal < today) phase = 'waiting';
  else if (nominal && between(today, nominal) <= 14) phase = 'prep';
  return {
    number: Math.max(1, completed), start: last.date, startStatus: last.status, day, length, nextFrom: nominal,
    daysTo: nominal ? Math.max(0, between(today, nominal)) : null, eligibleNow: el.eligibleNow, phase, phaseLabel: PHASES[phase],
    text: `Cycle ${Math.max(1, completed)} · ${PHASES[phase]} · day ${Math.min(day, length)} of ${length}`,
  };
}

/** This Cycle's focus: the first active Goal's marker, else the marker furthest from its best band ("level up"). */
function focus(st) {
  const donorId = st.donorId;
  const levels = careLevel.all(donorId, st);
  if (!levels.length) return null;
  const goal = signals.goals(st).find((g) => g.state === 'active' && g.target);
  const cfg = ref.markerSignals().focus;
  let key; let from; let reason;
  if (goal) {
    key = FOCUS_OF[goal.target.marker] || 'bp';
    from = 'goal';
    reason = `Your Goal: ${goal.name}`;
  } else {
    const order = ['iron', 'bp', 'sugar', 'lipids'];
    const rank = { urgent: 0, doctor_first: 1, below: 2, low_normal: 3, optimal: 4, not_needed: 5 };
    const worst = levels.filter((l) => order.includes(l.marker)).sort((a, b) => rank[a.level] - rank[b.level] || order.indexOf(a.marker) - order.indexOf(b.marker))[0];
    if (worst && worst.level !== 'optimal' && worst.level !== 'not_needed') {
      key = worst.marker; from = 'levelup'; reason = `${worst.label} is on the low side of healthy: room to level up`;
    } else {
      key = 'iron'; from = 'keep'; reason = 'Every donation takes about 200–250 mg of iron: keeping it comfortable keeps you donating';
    }
  }
  const def = cfg[key];
  const level = levels.find((l) => l.marker === key) || null;
  return { key, label: def.label, from, reason, goalId: goal?.id || null, urgent: goal?.severity === 'urgent', level, targets: def.targets.map((t) => ({ ...t, status: targetStatus(st, t) })), source: def.source, status: overall(st, def.targets) };
}

/** On track / drifting / no data for one leading target, over the last 3 weeks. */
function targetStatus(st, t) {
  const today = store.today();
  const from = addDays(today, -20);
  if (t.signal === 'active_min') {
    const list = signals.daily(st, 'active_min', from, today);
    if (list.length < 7) return { state: 'none', text: 'Connect a watch to see this' };
    const perWeek = Math.round((list.reduce((s, x) => s + x.value, 0) / list.length) * 7);
    return { state: perWeek >= 0.7 * t.perWeek ? 'on' : perWeek >= 0.5 * t.perWeek ? 'drift' : 'off', text: `About ${perWeek} active minutes a week` };
  }
  if (t.signal === 'sleep_min') {
    const list = signals.daily(st, 'sleep_min', from, today);
    if (list.length < 7) return { state: 'none', text: 'Connect a watch or ring to see this' };
    const good = list.filter((x) => x.value >= t.perNight).length / list.length;
    const n = Math.round(good * 7);
    return { state: good >= 0.7 ? 'on' : good >= 0.5 ? 'drift' : 'off', text: `7+ hours on ${n} night${n === 1 ? '' : 's'} a week` };
  }
  if (t.signal === 'food_habit') {
    const item = signals.ensure(st).weekPlan?.items.find((i) => i.measuredBy === 'food_habit' && !i.setAside);
    if (!item) return { state: 'none', text: 'Add it to your Week plan' };
    const days = range(from, today).map((d) => weekPlan.kept(st, item, d)).filter((x) => x !== null);
    if (days.length < 7) return { state: 'none', text: 'Tick it in your habit app or Your day' };
    const perWeek = Math.round((days.filter(Boolean).length / days.length) * 7);
    return { state: perWeek >= 0.7 * t.perWeek ? 'on' : perWeek >= 0.5 * t.perWeek ? 'drift' : 'off', text: `Kept on about ${perWeek} days a week` };
  }
  return { state: 'none', text: '' };
}

function overall(st, targets) {
  const states = targets.map((t) => targetStatus(st, t).state).filter((s) => s !== 'none');
  if (!states.length) return { state: 'none', label: 'No data yet' };
  if (states.every((s) => s === 'on')) return { state: 'on', label: 'On track' };
  if (states.some((s) => s === 'off')) return { state: 'off', label: 'Drifting' };
  return { state: 'drift', label: 'Nearly there' };
}

const cycleSignal = (st, signal, from, to) => {
  const list = signals.daily(st, signal, from, to);
  return list.length >= 7 ? signals.mean(list) : null;
};

/** Visits with a lab panel, oldest first. */
const panelVisits = (donorId) => store.getDonations(donorId).filter((v) => store.getObservations(donorId).some((o) => o.visitId === v.id));

/** A Cycle report for one visit's results, compared with the visit before (plain text slides, played by the Story viewer). */
function report(st, visitId) {
  const donorId = st.donorId;
  const visits = panelVisits(donorId);
  const i = visits.findIndex((v) => v.id === visitId);
  if (i < 0) throw new Error('No results for that visit');
  const visit = visits[i];
  const prev = visits[i - 1] || null;
  const donor = store.getDonor(donorId);
  const now = bands.atVisit(donorId, visit.id);
  const before = prev ? bands.atVisit(donorId, prev.id) : {};
  const f = focus(st);
  const focusMarkers = f ? ref.markerSignals().focus[f.key].markers : [];
  const defs = ref.bands().markers;
  const slides = [`Your free health check from ${fmt(visit.date)}${visit.status === 'deferred' ? ' (you couldn\'t donate this time)' : ''}.`];
  const changed = [];
  for (const m of Object.keys(defs)) {
    if (!now[m]) continue;
    const b = bands.bandOf(m, bands.raw(m, now[m]), donor);
    const pb = before[m] ? bands.bandOf(m, bands.raw(m, before[m]), donor) : null;
    const line = `${defs[m].label}: ${before[m] ? `${bands.text(m, before[m])} → ` : ''}${bands.text(m, now[m])} ${defs[m].unit}. ${b.label}${pb && pb.index > b.index ? ', up a band' : pb && pb.index < b.index ? ', down a band' : ''}.`;
    if (focusMarkers.includes(m)) slides.push(line);
    else if (pb && pb.index !== b.index) changed.push(line);
  }
  slides.push(...changed.slice(0, 2));
  const best = Object.keys(defs).map((m) => ({ m, p: i === visits.length - 1 ? bands.percentile(m, donorId) : null })).filter((x) => x.p && x.p.text).sort((a, b) => b.p.pct - a.p.pct)[0];
  if (best) slides.push(`${defs[best.m].label}: ${best.p.text}.`);
  if (prev) {
    const parts = [];
    const steps = cycleSignal(st, 'steps', prev.date, visit.date);
    const stepsBefore = i > 1 ? cycleSignal(st, 'steps', visits[i - 2].date, prev.date) : null;
    if (steps) parts.push(`about ${Math.round(steps).toLocaleString('en-IN')} steps a day${stepsBefore ? ` (${Math.round(stepsBefore).toLocaleString('en-IN')} the Cycle before)` : ''}`);
    const sleep = cycleSignal(st, 'sleep_min', prev.date, visit.date);
    if (sleep) parts.push(`${(sleep / 60).toFixed(1)} h sleep a night`);
    const iron = cycleSignal(st, 'iron_mg', prev.date, visit.date);
    if (iron) parts.push(`about ${iron.toFixed(0)} mg iron from food a day`);
    const food = signals.ensure(st).weekPlan?.items.find((x) => x.measuredBy === 'food_habit');
    if (food) {
      const days = range(addDays(visit.date, -27), visit.date).map((d) => weekPlan.kept(st, food, d)).filter((x) => x !== null);
      if (days.length >= 7) parts.push(`your iron add-on on ${Math.round((days.filter(Boolean).length / days.length) * 7)} days a week`);
    }
    if (parts.length) slides.push(`Alongside, from your apps: ${parts.join(', ')}.`);
  }
  if (visit.status === 'completed') {
    const parts = store.getComponents(donorId).filter((c) => c.donationId === visit.id).length;
    if (parts) slides.push(`This donation's ${parts} parts can each help a patient.`);
  } else {
    slides.push(`You couldn't donate this time${visit.deferralReason ? `: ${visit.deferralReason.toLowerCase()}` : ''}. Next Cycle is about getting there.`);
  }
  const c = current(donorId);
  slides.push(`Next Cycle's focus: ${f ? f.label.toLowerCase() : 'staying well'}.${c && c.nextFrom ? ` Your next free health check: from ${fmt(c.nextFrom)}.` : ''}`);
  return { visitId: visit.id, date: visit.date, status: visit.status, title: `Cycle report · ${fmt(visit.date)}`, slides };
}

/** Every Cycle report, newest first, with whether the Donor has watched it. */
function reports(st) {
  const seen = signals.ensure(st).reportsSeen;
  return panelVisits(st.donorId).slice(1).reverse().map((v) => ({ visitId: v.id, date: v.date, status: v.status, title: `Cycle report · ${require('./dates').fmtMonth(v.date)}`, seen: seen.includes(v.id) }));
}

/** The newest report not yet watched, when its results arrived since Drop started (for the Home chip). */
function unseenReport(st) {
  const latest = reports(st)[0];
  if (!latest || latest.seen) return null;
  const arrived = store.getObservations(st.donorId).filter((o) => o.visitId === latest.visitId).reduce((m, o) => ((o.availableOn || o.date) > m ? (o.availableOn || o.date) : m), '');
  return arrived >= st.createdOn ? latest : null;
}

const weekOfToday = () => weekStart(store.today());

module.exports = { current, focus, report, reports, unseenReport, targetStatus, FOCUS_OF, PHASES, weekOfToday, impact };
