/**
 * When a routine slips (CONTEXT.md: Disruption, Barrier): fixed rules over the
 * Donor's own signals and Week plan. Each rule has an id the "Why this?" sheet
 * cites. A barrier is only ever what the Donor said when they skipped something
 * (or their habit app's skip note); a skipped day is never asked about later.
 */

const store = require('../data/store');
const signals = require('./signals');
const weekPlan = require('./weekPlan');
const { addDays, dow, range } = require('./dates');

const RULES = {
  R1: 'A Week plan item was kept on less than half its planned days this week, after a good run before.',
  R2: 'Your steps for the last 7 days are under 70% of your usual (the 28 days before).',
  R3: 'Under 6 hours of sleep on 3 of the last 5 nights.',
  R4: 'Your iron add-on was kept on fewer than 3 of the last 7 days, after a good run before.',
};
const BARRIERS = { busy: 'Busy', travel: 'Travelling', unwell: 'Unwell', weather: 'Weather', festival: 'Festival or fasting', low_energy: 'Low energy', caring: 'Caring for family', other: 'Something else' };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Which days the misses fall on: P1 when 3 of the last 4 share weekdays. */
function weekdayPattern(missDates) {
  const last = missDates.slice(-4);
  if (last.length < 3) return null;
  const counts = {};
  last.forEach((d) => { counts[dow(d)] = (counts[dow(d)] || 0) + 1; });
  const days = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(([, n]) => n >= 1);
  const covered = days.reduce((s, [, n]) => s + n, 0);
  return covered >= 3 ? { id: 'P1', days: days.map(([d]) => DAY_NAMES[d]), text: `Most misses were on ${days.map(([d]) => DAY_NAMES[d]).join(' and ')}` } : null;
}

/** The barrier the Donor gave most in the last 14 days. */
function topBarrier(st, today) {
  const from = addDays(today, -13);
  const recent = signals.ensure(st).barriers.filter((b) => b.date >= from && b.date <= today);
  if (!recent.length) return null;
  const counts = {};
  recent.forEach((b) => { counts[b.code] = (counts[b.code] || 0) + 1; });
  const [code, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { code, label: BARRIERS[code], count: n, source: recent.find((b) => b.code === code).source };
}

/** Disruptions on `today`, most important first: [{ ruleId, habit, itemId?, text, evidence[] }]. */
function detect(st, today = store.today()) {
  const out = [];
  const barrier = topBarrier(st, today);
  // R2: steps
  const recent = signals.daily(st, 'steps', addDays(today, -6), today);
  const usual = signals.daily(st, 'steps', addDays(today, -34), addDays(today, -7));
  if (recent.length >= 5 && usual.length >= 14) {
    const r = signals.mean(recent);
    const u = signals.mean(usual);
    if (r < 0.7 * u) {
      const misses = [...usual, ...recent].filter((x) => x.value < 0.7 * u).map((x) => x.date);
      out.push({ ruleId: 'R2', habit: 'movement', text: RULES.R2, pattern: weekdayPattern(misses), barrier,
        evidence: [`Steps: about ${Math.round(r).toLocaleString('en-IN')} a day this week vs ${Math.round(u).toLocaleString('en-IN')} usually (${recent[0].app})`] });
    }
  }
  // R3: sleep
  const sleep = signals.daily(st, 'sleep_min', addDays(today, -4), today);
  if (sleep.length >= 5 && sleep.filter((x) => x.value < 360).length >= 3) {
    out.push({ ruleId: 'R3', habit: 'mind', text: RULES.R3, barrier, evidence: [`Sleep under 6 h on ${sleep.filter((x) => x.value < 360).length} of the last 5 nights (${sleep[0].app})`] });
  }
  // R1 / R4: Week plan items
  const plan = signals.ensure(st).weekPlan;
  for (const item of (plan && plan.endsOn >= today ? plan.items : []).filter((i) => !i.setAside)) {
    const last7 = range(addDays(today, -6), today).map((d) => weekPlan.kept(st, item, d));
    const before = range(addDays(today, -27), addDays(today, -7)).map((d) => weekPlan.kept(st, item, d));
    if (last7.filter((x) => x !== null).length < 5) continue;
    const perWeek = weekPlan.effective(item, today).perWeek || 7;
    const keptNow = last7.filter(Boolean).length;
    const keptBefore = before.filter(Boolean).length / 3;
    if (keptNow < perWeek / 2 && keptBefore >= 0.7 * perWeek) {
      const ruleId = item.measuredBy === 'food_habit' ? 'R4' : 'R1';
      const misses = range(addDays(today, -27), today).filter((d) => weekPlan.kept(st, item, d) === false);
      out.push({ ruleId, habit: item.habit, itemId: item.id, text: RULES[ruleId], pattern: weekdayPattern(misses), barrier,
        evidence: [`"${item.text}": kept on ${keptNow} of the last 7 days (you planned ${perWeek}); about ${Math.round(keptBefore)} a week before`] });
    }
  }
  const order = { R1: 0, R4: 1, R2: 2, R3: 3 };
  return out.sort((a, b) => order[a.ruleId] - order[b.ruleId]);
}

module.exports = { detect, RULES, BARRIERS, topBarrier, weekdayPattern };
