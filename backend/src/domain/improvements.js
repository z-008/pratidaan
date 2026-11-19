/**
 * What the Donor's results ask of them (CONTEXT.md: Care level, Food habit): every result that needs
 * improving (iron, vitamin D, B12, BP, blood sugar, cholesterol, weight, liver), each with foods that fit
 * how they eat and everyday habits, then one combined plan: the foods and habits that help the most of
 * their results at once. Fixed rules; the AI may only word it. The doctor's line for each result always
 * goes with it, and when the doctor comes first there is no food or exercise plan for that result.
 */

const store = require('../data/store');
const health = require('./health');
const careLevel = require('./careLevel');
const foodCoach = require('./foodCoach');
const signals = require('./signals');
const explain = require('./explain');
const ref = require('../data/reference');

const RANK = { urgent: 0, doctor_first: 1, below: 2, low_normal: 3, watch: 4 };
const WEIGHT = { urgent: 0, doctor_first: 0, below: 3, low_normal: 2, watch: 1 };
const LABELS = { ...careLevel.LABELS, weight: 'Weight', liver: 'Liver enzyme' };
const FOOD_MARKERS = ['iron', 'b12', 'vitd', 'bp', 'sugar', 'lipids'];
const HIGH = ['bp', 'sugar', 'lipids', 'weight', 'liver'];
const habitLib = () => ref.habitsLib();

/** "On the low side" for iron, "Close to the line" for BP: the level in words that fit the result. */
function levelWords(marker, level) {
  if (level === 'watch') return HIGH.includes(marker) ? 'Above the healthy range' : 'Worth watching';
  if (HIGH.includes(marker)) return { below: 'Above the healthy range', low_normal: 'Close to the line', doctor_first: 'See a doctor first', urgent: 'See a doctor today' }[level] || level;
  return { below: marker === 'iron' ? 'Below the donation level' : 'Low', low_normal: 'On the low side', doctor_first: 'See a doctor first', urgent: 'See a doctor today' }[level] || level;
}

/** Every result that needs improving, most serious first. */
function needs(st) {
  const donorId = st.donorId;
  const out = careLevel.all(donorId, st).filter((l) => !['optimal', 'not_needed'].includes(l.level))
    .map((l) => ({ marker: l.marker, label: LABELS[l.marker], level: l.level, ruleId: l.ruleId, rule: l.rule, evidence: l.evidence, doctor: l.doctor, coaching: l.coaching }));
  const findings = health.findings(donorId);
  const bmi = findings.find((f) => f.id === 'BMI_HIGH');
  if (bmi) out.push({ marker: 'weight', label: LABELS.weight, level: 'watch', ruleId: 'WEIGHT-HIGH', rule: 'Weight above the healthy range for Asian adults (BMI 23 or more).', evidence: [bmi.detail], doctor: null, coaching: 'food' });
  const alt = findings.find((f) => f.id === 'ALT_HIGH');
  if (alt) {
    out.push({ marker: 'liver', label: LABELS.liver, level: 'watch', ruleId: 'LIVER-ALT', rule: 'A raised liver enzyme (ALT) is worth a doctor\'s look; alcohol, fried food and weight all affect it.', evidence: [alt.detail],
      doctor: { urgency: 'recommended', text: (careLevel.doctorFor('low_normal', st.language) || {}).text }, coaching: 'habits' });
  }
  return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
}

const urgentGoal = (st) => signals.goals(st).some((g) => g.state === 'active' && g.severity === 'urgent');

/** Habits for one result, filtered by diet and safety (no exercise with an urgent Goal, nothing when the doctor comes first). */
function habitsFor(st, need, profile) {
  if (need.coaching === 'rules_only') return [];
  const noMove = urgentGoal(st);
  return habitLib().filter((h) => h.for.includes(need.marker))
    .filter((h) => !(noMove && h.habit === 'movement'))
    .filter((h) => !h.diets || h.diets.includes(profile.diet));
}

/** How a habit is going, from the Donor's apps, when an app measures it. */
function habitStatus(st, h) {
  const m = ['active_min', 'sleep_min'].includes(h.measuredBy) ? require('./habits').metric(st, h.measuredBy) : null;
  return m ? { state: m.state, text: m.value, app: m.app } : null;
}

/** The plan: each result that needs improving with its foods and habits, and the combined list that helps most at once. */
function plan(st) {
  const donorId = st.donorId;
  if (store.getDonor(donorId)?.newUser || !health.vitalsSeries(donorId).length) return null;
  const p = foodCoach.profile(st);
  const list = needs(st);
  const language = st.language || 'en';
  const keep = !list.length;
  // With nothing to improve, the plan keeps iron comfortable: every donation takes about 200–250 mg
  const targets = keep ? [{ marker: 'iron', label: LABELS.iron, level: 'watch', ruleId: 'KEEP-IRON', rule: 'All your results are healthy. Every donation takes about 200–250 mg of iron, so keep iron-rich food in your week.', evidence: [], doctor: null, coaching: 'maintain' }] : list;

  const detailed = targets.map((n) => {
    const s = FOOD_MARKERS.includes(n.marker) && !['rules_only', 'habits'].includes(n.coaching) ? foodCoach.suggest(st, n.marker) : null;
    const weightFoods = n.marker === 'weight' ? foodCoach.suggest(st, 'sugar') : null;
    const foods = ((s && !s.rulesOnly) ? s.foods : weightFoods ? weightFoods.foods : []).slice(0, 3);
    const habits = habitsFor(st, n, p).map((h) => ({ id: h.id, habit: h.habit, text: h.text, perWeek: h.perWeek, minutes: h.minutes || null, measuredBy: h.measuredBy, source: h.source, status: habitStatus(st, h) }));
    return { ...n, levelWords: levelWords(n.marker, n.level), foods, habits, tips: s ? s.tips.slice(0, 2) : [], target: s?.target || null };
  });

  // Combined: a food or habit that helps several results counts for each of them
  const foodMap = new Map();
  const habitMap = new Map();
  detailed.forEach((n, i) => {
    const w = (WEIGHT[n.level] ?? 1) + (detailed.length - i) * 0.1;
    n.foods.forEach((f, j) => {
      const e = foodMap.get(f.id) || { ...f, helps: [], score: 0 };
      e.helps.push(n.label); e.score += w - j * 0.2;
      foodMap.set(f.id, e);
    });
    n.habits.forEach((h, j) => {
      const e = habitMap.get(h.id) || { ...h, helps: [], score: 0 };
      e.helps.push(n.label); e.score += w - j * 0.2;
      habitMap.set(h.id, e);
    });
  });
  const foods = [];
  const groups = {};
  for (const f of [...foodMap.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    const g = ref.foods().find((x) => x.id === f.id)?.group;
    if ((groups[g] || 0) >= 2 || foods.length >= 6) continue;
    groups[g] = (groups[g] || 0) + 1;
    foods.push(f);
  }
  // Habits: one for each result first (most serious first), then the ones that help most
  const habits = [];
  for (const n of detailed) {
    const best = n.habits.map((h) => habitMap.get(h.id)).filter((h) => !habits.includes(h)).sort((a, b) => b.helps.length - a.helps.length || b.score - a.score)[0];
    if (best && habits.length < 5) habits.push(best);
  }
  for (const h of [...habitMap.values()].sort((a, b) => b.helps.length - a.helps.length || b.score - a.score)) if (habits.length < 5 && !habits.includes(h)) habits.push(h);

  const doctors = detailed.filter((n) => n.doctor).sort((a, b) => ['today', 'first', 'weeks', 'recommended'].indexOf(a.doctor.urgency) - ['today', 'first', 'weeks', 'recommended'].indexOf(b.doctor.urgency))
    .map((n) => ({ marker: n.marker, label: n.label, ...n.doctor }));
  const lower = (t) => (/^Vitamin/.test(t) ? `v${t.slice(1)}` : t.toLowerCase());
  const headline = keep ? 'Your results are healthy: keep it that way, and keep your iron comfortable for donating.'
    : `Your results ask for: ${detailed.map((n) => `${lower(n.label)} (${n.levelWords.toLowerCase()})`).join(', ')}.`;
  // The same doctor line once, for all the results it covers
  const grouped = [];
  for (const d of doctors) {
    const g = grouped.find((x) => x.text === d.text);
    if (g) g.labels.push(d.label); else grouped.push({ urgency: d.urgency, text: d.text, labels: [d.label] });
  }
  const out = {
    keep, headline, needs: detailed,
    foods: foods.map(({ score, ...f }) => f), habits: habits.map(({ score, ...h }) => h), doctors: grouped,
    profile: p, language,
  };
  out.explanation = explain.make({
    title: 'Why this plan',
    dataUsed: detailed.flatMap((n) => n.evidence.map((text) => ({ text, source: /lab report you added/.test(text) ? 'A lab report you added' : 'Your donation results' }))),
    rule: { id: detailed.map((n) => n.ruleId).join(' · '), text: 'Each result that needs improving gets its own foods and habits; the plan puts first what helps the most of them at once. Proposed thresholds, pending clinical review.' },
    guidance: [...new Set(habits.map((h) => h.source))].map((s) => ({ text: 'Habit guidance', source: s })).slice(0, 4),
    preferences: [foodCoach.DIET_WORDS[p.diet], `${ref.regions().labels[p.region]} food`, foodCoach.BUDGET_WORDS[p.budget], ...(p.isDefault ? ['(not set yet: vegetarian until you tell Drop)'] : [])],
    effect: doctors[0] ? doctors[0].text : null,
    wouldChange: 'Your next donation\'s results (or a lab report you add) change the plan; so does your Food profile.',
    notUsed: ['Drop never names a medicine or supplement, and food never replaces treatment your doctor gives you.'],
  });
  return out;
}

module.exports = { plan, needs, levelWords, LABELS };
