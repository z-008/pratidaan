/**
 * What the Donor's apps say about their days, measured against healthy targets, for every Habit
 * (Movement, Food, Mind), every Goal and the next donation. This is where the data from connected apps
 * meets the central idea: staying healthy between donations, not only being able to donate.
 * Never changes the score, eligibility or cover (those stay with the donation results).
 */

const store = require('../data/store');
const health = require('./health');
const signals = require('./signals');
const weekPlan = require('./weekPlan');
const ref = require('../data/reference');
const { addDays, between, range, fmt } = require('./dates');

const drop = () => require('./drop');

// Healthy targets for adults, with their sources (shown in the app)
const TARGETS = {
  active_min: { value: 150, per: 'week', text: '150 active minutes a week', source: 'WHO 2020 physical activity guidelines' },
  sleep_min: { value: 420, per: 'night', text: '7 hours or more a night', source: 'AASM / CDC sleep guidance for adults' },
  water_ml: { value: 2000, per: 'day', text: 'about 2 litres a day (more on hot days and after donating)', source: 'General guidance; NBTC advice for donors' },
};
const ironNeed = (donorId) => {
  const sex = store.getDonor(donorId)?.sex;
  const r = ref.requirements().iron;
  return sex ? { value: r[sex], text: `${r[sex]} mg a day for ${sex === 'F' ? 'women' : 'men'}`, source: ref.requirements().source } : null;
};

const stateOf = (ratio) => (ratio >= 0.9 ? 'on' : ratio >= 0.6 ? 'drift' : 'off');
const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

/** One measured number for the last 7 days, or null when no connected app shares it. */
function metric(st, signal, today = store.today()) {
  const list = signals.daily(st, signal, addDays(today, -6), today);
  if (list.length < 3) return null;
  const mean = signals.mean(list);
  const app = `${list[0].app}${list[0].mode === 'demo' ? ' (demo)' : list[0].mode === 'sandbox' ? ' (sandbox)' : ''}`;
  switch (signal) {
    case 'active_min': {
      const week = Math.round(mean * 7);
      return { signal, label: 'Active minutes', value: `${week} min this week`, target: TARGETS.active_min.text, state: stateOf(week / TARGETS.active_min.value), app, source: TARGETS.active_min.source, raw: week };
    }
    case 'steps': return { signal, label: 'Steps', value: `${Math.round(mean).toLocaleString('en-IN')} a day`, target: null, state: null, app, raw: Math.round(mean) };
    case 'sleep_min': {
      const nights = list.filter((x) => x.value >= TARGETS.sleep_min.value).length;
      return { signal, label: 'Sleep', value: `${round(mean / 60, 1)} h a night · 7 h+ on ${nights} of ${list.length} nights`, target: TARGETS.sleep_min.text, state: stateOf(nights / list.length / 0.7), app, source: TARGETS.sleep_min.source, raw: round(mean / 60, 1) };
    }
    case 'rhr_bpm': return { signal, label: 'Resting heart rate', value: `${Math.round(mean)} bpm`, target: null, state: null, app, raw: Math.round(mean) };
    case 'iron_mg': {
      const need = ironNeed(st.donorId);
      return { signal, label: 'Iron from food', value: `${round(mean, 1)} mg a day`, target: need?.text || null, state: need ? stateOf(mean / need.value) : null, app, source: need?.source, raw: round(mean, 1) };
    }
    case 'water_ml': return { signal, label: 'Water', value: `${round(mean / 1000, 1)} L a day`, target: TARGETS.water_ml.text, state: stateOf(mean / TARGETS.water_ml.value), app, source: TARGETS.water_ml.source, raw: round(mean / 1000, 1) };
    default: return null;
  }
}

const HABIT_SIGNALS = { movement: ['active_min', 'steps'], food: ['iron_mg', 'water_ml'], mind: ['sleep_min', 'rhr_bpm'] };
const HABIT_HINT = {
  movement: 'Connect a watch or phone app to see your activity here',
  food: 'Connect a food app (like Cronometer) to see iron and water here',
  mind: 'Connect a watch or ring to see your sleep here',
};

/** Movement, Food and Mind: this week's measured numbers against healthy targets, and the Week plan items. */
function view(st) {
  const plan = weekPlan.view(st);
  return Object.entries(HABIT_SIGNALS).map(([habit, sigs]) => {
    const metrics = sigs.map((s) => metric(st, s)).filter(Boolean);
    const items = (plan?.items || []).filter((i) => i.habit === habit);
    const scored = metrics.filter((m) => m.state);
    const state = !scored.length ? null : scored.every((m) => m.state === 'on') ? 'on' : scored.some((m) => m.state === 'off') ? 'off' : 'drift';
    return { habit, metrics, items, state, hint: metrics.length ? null : HABIT_HINT[habit] };
  });
}

/** For each live Goal: what the apps recorded in the 4 weeks before it started, and since. */
function goals(st) {
  const today = store.today();
  return signals.goals(st).filter((g) => g.state === 'active' || g.state === 'upnext').map((g) => {
    const start = g.createdOn;
    const sigs = (g.writeup?.steps || []).some((s) => s.tag === 'movement') || g.target?.marker === 'bp' ? ['active_min', 'steps', 'sleep_min'] : ['iron_mg', 'sleep_min'];
    const days = between(start, today);
    const parts = [];
    for (const s of sigs) {
      const before = signals.daily(st, s, addDays(start, -28), addDays(start, -1));
      if (before.length < 7) continue;
      const b = signals.mean(before);
      const since = days >= 7 ? signals.daily(st, s, start, today) : [];
      const n = since.length >= 5 ? signals.mean(since) : null;
      const show = (v) => (s === 'active_min' ? `${Math.round(v * 7)} min a week` : s === 'steps' ? `${Math.round(v).toLocaleString('en-IN')} steps a day` : s === 'sleep_min' ? `${round(v / 60, 1)} h sleep` : `${round(v, 1)} mg iron`);
      parts.push({ signal: s, before: show(b), now: n === null ? null : show(n), better: n === null ? null : n >= b });
    }
    if (!parts.length) return { goalId: g.id, text: null, parts };
    const text = days >= 7 && parts.some((p) => p.now)
      ? `Since this Goal started on ${fmt(start)}: ${parts.filter((p) => p.now).map((p) => `${p.before} → ${p.now}`).join(' · ')}`
      : `Before this Goal (from your apps): ${parts.map((p) => p.before).join(' · ')}. Drop will show what changes.`;
    return { goalId: g.id, text, parts, app: signals.appsFor(st, parts[0].signal)[0] || null };
  });
}

/**
 * Before the next donation: what the Donor's results and apps say about feeling well on the day.
 * A checklist, not a rule: the blood centre decides on the day.
 */
function readiness(st) {
  const donorId = st.donorId;
  const visits = health.vitalsSeries(donorId);
  if (!visits.length) return null;
  const today = store.today();
  const el = health.eligibility(donorId);
  const next = el.nextEligibleDate;
  const soon = el.eligibleNow || (next && between(today, next) <= 21);
  const items = [];
  const donor = store.getDonor(donorId);
  const hbMin = health.hbMin(donor);
  const hb = require('./bands').latest(donorId).hb;
  if (hb) items.push({ id: 'hb', text: `Haemoglobin ${hb.value} (you need ${hbMin})`, state: hb.value >= hbMin ? 'on' : 'off', source: 'Your last result' });
  const last = visits[visits.length - 1];
  const reading = (st.readings || []).filter((r) => r.marker === 'bp').pop();
  const bp = reading && reading.date > last.date ? { s: reading.s, d: reading.d, from: 'your latest reading' } : { s: last.systolic, d: last.diastolic, from: 'your last donation' };
  items.push({ id: 'bp', text: `BP ${bp.s}/${bp.d} (under 140/90 to donate)`, state: bp.s <= 140 && bp.d <= 90 ? 'on' : 'off', source: bp.from });
  const sleep = signals.daily(st, 'sleep_min', addDays(today, -2), today);
  if (sleep.length) items.push({ id: 'sleep', text: `Sleep: 6+ hours on ${sleep.filter((x) => x.value >= 360).length} of the last ${sleep.length} nights`, state: sleep.every((x) => x.value >= 360) ? 'on' : 'drift', source: sleep[0].app });
  const water = metric(st, 'water_ml');
  if (water) items.push({ id: 'water', text: `Water: ${water.value}`, state: water.state, source: water.app });
  const iron = metric(st, 'iron_mg');
  const plan = signals.ensure(st).weekPlan;
  const add = plan?.items.find((i) => i.measuredBy === 'food_habit' && !i.setAside);
  if (iron) items.push({ id: 'iron', text: `Iron from food: ${iron.value}`, state: iron.state, source: iron.app });
  else if (add) {
    const kept = range(addDays(today, -6), today).map((d) => weekPlan.kept(st, add, d)).filter(Boolean).length;
    items.push({ id: 'iron', text: `Iron add-on: ${kept} of the last 7 days`, state: kept >= 4 ? 'on' : 'drift', source: add.sync ? add.sync.app : 'You' });
  }
  const rhr = signals.daily(st, 'rhr_bpm', addDays(today, -34), today);
  if (rhr.length >= 14) {
    const base = signals.mean(rhr.slice(0, -5));
    const recent = signals.mean(rhr.slice(-5));
    items.push({ id: 'rhr', text: `Resting heart rate ${Math.round(recent)} bpm (usual ${Math.round(base)})`, state: recent - base < 5 ? 'on' : 'drift', source: rhr[0].app, note: recent - base >= 5 ? 'Higher than usual can mean you are tired or coming down with something; rest first.' : null });
  }
  const done = items.filter((i) => i.state === 'on').length;
  return { soon: Boolean(soon), from: next, eligibleNow: el.eligibleNow, items, done, total: items.length, note: 'For feeling well on the day. The blood centre decides on the day.' };
}

/** One line for the Weekly report and Drop's context: last 7 days from the apps against the targets. */
function weekLine(st, { skip = [] } = {}) {
  const m = ['steps', 'active_min', 'sleep_min', 'iron_mg', 'water_ml'].filter((s) => !skip.includes(s)).map((s) => metric(st, s)).filter(Boolean);
  if (!m.length) return null;
  return m.map((x) => `${x.label.toLowerCase()} ${x.value}${x.state === 'on' ? ' (on target)' : x.state ? ` (target: ${x.target})` : ''}`).join('; ');
}

module.exports = { view, goals, readiness, metric, weekLine, TARGETS, ironNeed };
