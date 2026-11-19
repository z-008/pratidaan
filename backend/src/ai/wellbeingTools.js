/**
 * Drop's between-donation tools and context (Week plans, the Cycle, food).
 * Kept apart from tools.js so the existing Chats keep exactly their tool list:
 * General gets only get_cycle and get_bands; Habit and Goal Chats get the rest.
 * Every tool reads the rules (domain/wellbeing.js); the model can open a Week
 * plan Card or explain a recommendation, but never decide one.
 */

const store = require('../data/store');
const drop = require('../domain/drop');
const wellbeing = require('../domain/wellbeing');
const llm = require('./llm');
const foodGuard = require('./foodGuard');

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const MARKERS = ['iron', 'bp', 'sugar', 'lipids', 'b12', 'vitd'];
const SIGNALS = ['steps', 'active_min', 'sleep_min', 'rhr_bpm', 'iron_mg', 'water_ml'];

const DEFINITIONS = [
  { name: 'get_cycle', description: 'Where the donor is between donations: Cycle number, phase, days to their next free health check, this Cycle\'s focus and whether its targets are on track.', input_schema: obj({}) },
  { name: 'get_bands', description: 'Each donation-result marker\'s band (e.g. optimal, above ideal) and, when 50% or more, how they compare with donors of their sex and age. From results only.', input_schema: obj({}) },
  { name: 'get_signal_summary', description: 'Summary of one signal from the donor\'s connected apps over the last 7 and 28 days (averages only, never raw data).', input_schema: obj({ signal: { type: 'string', enum: SIGNALS } }, ['signal']) },
  { name: 'get_week_plan', description: 'The donor\'s Week plan: items, how many days each was kept this week, and anything set aside or stepped down.', input_schema: obj({}) },
  { name: 'offer_week_plan', description: 'Open a Week plan Card for one Habit (movement, food or mind) with items from the rules; the donor taps to save it. Use when they ask for a plan for the week.', input_schema: obj({ habit: { type: 'string', enum: ['movement', 'food', 'mind'] } }, ['habit']) },
  { name: 'get_food_profile', description: 'How the donor eats: diet, region, staple, where they eat, budget, allergies and fasting days (as labels).', input_schema: obj({}) },
  { name: 'get_care_level', description: 'For one marker, whether food coaching leads or a doctor comes first, with the doctor advice that must go with it.', input_schema: obj({ marker: { type: 'string', enum: MARKERS } }, ['marker']) },
  { name: 'find_foods', description: 'Local, affordable foods that fit the donor\'s Food profile for one marker, chosen by rules, with amounts, price per day, how to fit each in and pairing tips. Mention only these foods.', input_schema: obj({ marker: { type: 'string', enum: MARKERS }, maxCost: { type: 'number' } }, ['marker']) },
  { name: 'get_health_plan', description: 'What the donor\'s results ask of them: every result that needs improving (iron, vitamin D, B12, BP, blood sugar, cholesterol, weight, liver) with its level, the foods and everyday habits that help, the combined list that helps most at once, how each habit is going from their apps, and the doctor advice that must go with it. Use for "what should I improve", "what should I eat", "what habits", "how do I get healthier".', input_schema: obj({}) },
  { name: 'get_habits_from_apps', description: 'This week from the donor\'s connected apps, per Habit (Movement, Food, Mind), against healthy targets (active minutes, steps, sleep, resting heart rate, iron from food, water), and for each Goal what changed since it started. Aggregates only.', input_schema: obj({}) },
  { name: 'get_readiness', description: 'Before their next donation: a checklist from their last results and apps (Hb, BP, recent sleep, water, iron, resting heart rate). A checklist only: the blood centre decides on the day.', input_schema: obj({}) },
  { name: 'get_cycle_report', description: 'The Cycle report for their latest donation (what changed in their results since the donation before, with what their apps recorded alongside).', input_schema: obj({}) },
  { name: 'explain_recommendation', description: 'The rules\' explanation for a food suggestion (id "food:<marker>") or a Card (id "card:<cardId>").', input_schema: obj({ id: { type: 'string' } }, ['id']) },
];
const NAMES = DEFINITIONS.map((d) => d.name);

const habitOf = (chat) => (String(chat).startsWith('habit:') ? String(chat).slice(6) : null);
const isGoal = (chat) => String(chat).startsWith('goal:');

/** Every Chat gets the between-donation tools, so Drop answers questions about them with the model (rules only when it is offline). */
function namesFor() {
  return NAMES;
}

const handles = (name) => NAMES.includes(name);

function run(name, input, donorId) {
  const def = DEFINITIONS.find((d) => d.name === name);
  if (!llm.validate(input, def.input_schema)) return { error: 'Invalid tool arguments' };
  const st = wellbeing.state(donorId);
  switch (name) {
    case 'get_cycle': {
      const c = wellbeing.cycle.current(donorId);
      const f = wellbeing.cycle.focus(st);
      return c ? { cycle: c.text, nextFreeHealthCheck: c.nextFrom, daysTo: c.daysTo, focus: f && { label: f.label, why: f.reason, status: f.status.label, targets: f.targets.map((t) => `${t.text}: ${t.status.text}`) } } : { cycle: null, note: 'No donations yet' };
    }
    case 'get_bands': return { bands: wellbeing.summary(donorId).bands.map((b) => ({ marker: b.label, value: `${b.value} ${b.unit}`, band: b.band.label, comparison: b.percentile })) };
    case 'get_signal_summary': {
      const today = store.today();
      if (!wellbeing.signals.has(st, input.signal)) return { connected: false, note: 'No connected app shares this' };
      const w7 = wellbeing.signals.average(st, input.signal, today, 7);
      const w28 = wellbeing.signals.average(st, input.signal, today, 28);
      return { signal: input.signal, last7DaysAverage: Math.round(w7.value), last28DaysAverage: Math.round(w28.value), from: w7.app };
    }
    case 'get_week_plan': {
      const p = wellbeing.weekPlan.view(st);
      return p ? { endsOn: p.endsOn, items: p.items.map((i) => ({ habit: i.habit, text: i.text, keptThisWeek: `${i.week.keptDays} of ${i.perWeek}`, setAside: i.setAside, steppedDown: i.steppedDown, for: i.forText })) } : { weekPlan: null };
    }
    case 'offer_week_plan': {
      const r = wellbeing.offerWeekPlan(donorId, input.habit);
      const card = r.view.open.find((c) => c.id === r.cardId);
      return { shown: card.text, note: 'They tap Save on the Card; nothing is saved until then.', _ui: { type: 'card', cardId: r.cardId } };
    }
    case 'get_food_profile': {
      const p = wellbeing.foodCoach.profile(st);
      return { diet: wellbeing.foodCoach.DIET_WORDS[p.diet], region: p.region, staple: p.staple, eatsAt: p.eatsAt, budget: wellbeing.foodCoach.BUDGET_WORDS[p.budget], allergies: p.allergies, fasting: p.fasting, setByDonor: !p.isDefault };
    }
    case 'get_care_level': {
      const l = wellbeing.careLevel.of(donorId, st, input.marker);
      return l ? { level: l.level, coaching: l.coaching, rule: l.rule, doctorAdvice: l.doctor?.text || null } : { level: null, note: 'No results for this yet' };
    }
    case 'find_foods': {
      const s = wellbeing.foodCoach.suggest(st, input.marker, { maxCost: input.maxCost });
      if (s.rulesOnly) return { rulesOnly: true, say: s.text };
      return { foods: s.foods.map((f) => ({ name: f.name, english: f.nameEn, serving: f.serving, amount: f.amount, rupeesPerDay: `${f.cost.min}–${f.cost.max}`, fitIn: f.fitIn, pairWith: f.pairWith })), tips: s.tips.map((t) => t.text), limit: s.limit, leftOut: s.safety, dailyNeed: s.target?.text || null, doctorAdvice: s.doctor?.text || null };
    }
    case 'get_health_plan': {
      const p = wellbeing.improvements.plan(st);
      if (!p) return { plan: null, note: 'No results yet: their first donation includes a free health check' };
      return {
        headline: p.headline,
        results: p.needs.map((n) => ({ result: n.label, level: n.levelWords, why: n.rule, evidence: n.evidence, foods: n.foods.map((f) => f.name), habits: n.habits.map((h) => h.text) })),
        foodsThatHelpMost: p.foods.map((f) => ({ name: f.name, english: f.nameEn, helps: f.helps, rupeesPerDay: `${f.cost.min}–${f.cost.max}`, fitIn: f.fitIn })),
        habitsThatHelpMost: p.habits.map((h) => ({ habit: h.text, helps: h.helps, fromApps: h.status ? `${h.status.text} (${h.status.state === 'on' ? 'on target' : 'not yet on target'}, ${h.status.app})` : null })),
        doctorAdvice: p.doctors.map((d) => `${d.labels.join(', ')}: ${d.text}`),
        diet: wellbeing.foodCoach.DIET_WORDS[p.profile.diet],
        note: 'Mention only these foods and habits. The app adds the doctor advice itself.',
      };
    }
    case 'get_habits_from_apps': {
      const s = wellbeing.summary(donorId);
      return {
        habits: s.habits.map((h) => ({ habit: h.habit, measured: h.metrics.map((m) => `${m.label}: ${m.value}${m.target ? ` (healthy: ${m.target}; ${m.state === 'on' ? 'on target' : m.state === 'drift' ? 'nearly' : 'below target'})` : ''} from ${m.app}`), weekPlan: h.items.map((i) => `${i.text}: ${i.week.keptDays} of ${i.perWeek} days`), notConnected: h.hint })),
        goals: s.goalSignals.filter((g) => g.text).map((g) => g.text),
        connectedApps: s.connections.map((c) => `${c.label}${c.mode === 'demo' ? ' (demo)' : ''}`),
      };
    }
    case 'get_readiness': {
      const r = wellbeing.habits.readiness(st);
      return r ? { canDonateFrom: r.eligibleNow ? 'now' : r.from, checklist: r.items.map((i) => `${i.text}: ${i.state === 'on' ? 'good' : 'not yet'} (${i.source})`), lookingGood: `${r.done} of ${r.total}`, note: r.note } : { note: 'No results yet' };
    }
    case 'get_cycle_report': {
      const latest = wellbeing.cycle.reports(st)[0];
      return latest ? { report: wellbeing.cycle.report(st, latest.visitId).slides } : { report: null, note: 'Their first Cycle report comes with their next donation\'s results' };
    }
    case 'explain_recommendation': {
      const e = wellbeing.coaching.explanationFor(st, input.id);
      return { rule: e.rule, dataUsed: e.dataUsed.map((d) => d.text), guidance: e.guidance.map((g) => `${g.text} (${g.source})`), preferences: e.preferences, wouldChange: e.wouldChange };
    }
    default: return { error: `Unknown tool ${name}` };
  }
}

/** Replaces the "saving a Week plan is coming" line in Habit and Goal Chats, now that Week plans exist. */
function chatLine(donorId, chat) {
  const habit = habitOf(chat);
  const goal = isGoal(chat) ? drop.goals(donorId).find((g) => `goal:${g.id}` === chat) : null;
  const where = goal ? `the Chat about their Goal "${goal.name}"` : habit ? `the Chat about their ${habit.charAt(0).toUpperCase()}${habit.slice(1)} Habit` : 'their General Chat';
  const food = ' For what to eat or which habits to build, call get_health_plan (all their results) or find_foods (one result) and suggest only the foods and habits they return, in the donor\'s words (local names), with the price and how to fit each in, and say which result each helps. Never name a medicine, tablet or supplement, never say food replaces treatment, and do not write doctor advice yourself: the app adds it. If a result is "See a doctor first" or find_foods says rulesOnly, say only what it says.';
  const apps = ' For their activity, sleep, food or water this week call get_habits_from_apps; before a donation, get_readiness; for their latest results compared with the donation before, get_cycle_report. Quote numbers only from these tools.';
  return `\nThis conversation is ${where}. If they ask for a plan for the week, call offer_week_plan${habit ? ` with habit "${habit}"` : ' with the Habit that fits (movement, food or mind)'}: it opens a Card they tap to save (and can add to their habit app). Never claim you saved or scheduled anything yourself.${food}${apps}`;
}

/** Between-donation facts for every Chat: aggregates and labels only, never raw logs (and none if the Donor turned it off). */
function context(donorId, chat) {
  const st = wellbeing.state(donorId);
  if (!wellbeing.signals.active(st) || wellbeing.signals.ensure(st).aiSummaries === false) return '';
  const c = wellbeing.cycle.current(donorId);
  const f = wellbeing.cycle.focus(st);
  const p = wellbeing.weekPlan.view(st);
  const lines = [];
  if (c) lines.push(`Between donations: ${c.text}${c.nextFrom ? `; next free health check from ${c.nextFrom}` : ''}.`);
  if (f) lines.push(`This Cycle's focus: ${f.label} (${f.status.label}).`);
  const week = wellbeing.habits.weekLine(st);
  if (week) lines.push(`Their apps, last 7 days: ${week}. You may mention these when relevant; they never change the score, eligibility or cover.`);
  if (p) lines.push(`Week plan until ${p.endsOn}: ${p.items.map((i) => `${i.text} (kept ${i.week.keptDays} of ${i.perWeek} this week${i.setAside ? ', set aside' : ''})`).join('; ')}.`);
  const plan = wellbeing.improvements.plan(st);
  if (plan) lines.push(`From their results: ${plan.headline}`);
  if (habitOf(chat) === 'food') {
    const prof = wellbeing.foodCoach.profile(st);
    lines.push(`Food profile: ${wellbeing.foodCoach.DIET_WORDS[prof.diet]}, ${prof.region} Indian food, ${wellbeing.foodCoach.BUDGET_WORDS[prof.budget]}${prof.isDefault ? ' (not set yet)' : ''}.`);
  }
  return lines.length ? `\n${lines.join(' ')}` : '';
}

/** After the model: food answers are checked against the rules and always end with the doctor's line. */
function afterReply({ donorId, chat, reply, steps = [], actions = [] }) {
  const usedFood = steps.some((s) => s.tool === 'find_foods');
  const usedPlan = steps.some((s) => s.tool === 'get_health_plan');
  if (habitOf(chat) !== 'food' && !usedFood && !usedPlan) return { reply, actions };
  const st = wellbeing.state(donorId);
  if (usedPlan && !usedFood) return { reply: foodGuard.checkPlan(st, reply).reply, actions };
  return { reply: foodGuard.check(st, reply, { marker: (steps.find((s) => s.tool === 'find_foods')?.input?.marker) || 'iron' }).reply, actions };
}

/** Rule answers for food and plan questions when the AI is unavailable (checked after every existing rule answer). */
function fallback(donorId, m, chat = 'general') {
  const st = wellbeing.state(donorId);
  if (/\b(week plan|plan (for|this) (the )?week|plan my week|add (that|it|this|them)? ?to my week)\b/.test(m)) {
    const habit = /food|eat|diet/.test(m) ? 'food' : /sleep|mind|stress/.test(m) ? 'mind' : /walk|move|active|exercise/.test(m) ? 'movement' : habitOf(chat) || 'movement';
    const r = wellbeing.offerWeekPlan(donorId, habit);
    const fromGoal = wellbeing.signals.goals(st).some((g) => g.state === 'active');
    return { reply: `Here is a plan for this week from your ${fromGoal ? 'Goal' : 'results'}. Tap Save to keep it.`, actions: [{ type: 'card', cardId: r.cardId }] };
  }
  const named = /vitamin d\b|\bsun\b/.test(m) ? 'vitd' : /\bb12\b/.test(m) ? 'b12' : /\b(iron|haemoglobin|hemoglobin|anaemi|anemi|ferritin)\b/.test(m) ? 'iron'
    : /\b(bp|blood pressure)\b/.test(m) ? 'bp' : /\b(sugar|hba1c|diabet)/.test(m) ? 'sugar' : /\b(cholesterol|ldl|triglycer)/.test(m) ? 'lipids' : /\b(weight|bmi)\b/.test(m) ? 'weight' : null;
  if (named && /\b(raise|improve|increase|lower|reduce|bring|eat|food|foods|habit|what else|help|fix|deficien|low|high)/.test(m)) {
    return { reply: foodGuard.needReply(st, named), actions: [] };
  }
  if (/\bwhy\b/.test(m) && /\b(food|foods|suggest|plan|these|habit)/.test(m)) return { reply: foodGuard.whyReply(st), actions: [] };
  if (/\b(don'?t|do not|can'?t|never) eat\b|\b(i'?m|i am) (vegetarian|vegan|jain)\b|\bno (eggs?|meat|fish|dairy)\b/.test(m)) {
    return { reply: 'Tell Drop how you eat under Progress → How you eat (diet, budget, allergies) and every suggestion changes to fit. Nothing you choose there is shared.', actions: [{ type: 'navigate', screen: 'progress' }] };
  }
  if (/\b(cost|price|how much|rupees|afford|cheap)\b/.test(m)) {
    const p = wellbeing.improvements.plan(st);
    if (p && p.foods.length) {
      const three = p.foods.slice(0, 3);
      return { reply: `${three.map((f) => `${f.name}: ₹${f.cost.min}–${f.cost.max} a day`).join('; ')}. About ₹${three.reduce((a, f) => a + f.cost.min, 0)}–${three.reduce((a, f) => a + f.cost.max, 0)} a day for all three (approximate Bengaluru prices).`, actions: [] };
    }
  }
  if (/\b(improve|healthier|work on|my plan|health plan|what should i (do|change)|habits?|deficien)/.test(m)) {
    return { reply: foodGuard.planReply(st), actions: [{ type: 'navigate', screen: 'progress' }] };
  }
  if (/\b(sleep|slept|steps|active|walked|my week|my apps|fitbit|oura|watch|water)\b/.test(m)) {
    const h = wellbeing.summary(donorId);
    // The numbers the question is about: sleep → Mind, steps or walking → Movement, water or iron → Food
    const want = /sleep|slept/.test(m) ? ['mind'] : /steps|active|walk/.test(m) ? ['movement'] : /water|iron/.test(m) ? ['food'] : ['movement', 'food', 'mind'];
    const lines = h.habits.filter((x) => want.includes(x.habit)).flatMap((x) => x.metrics).map((x) => `${x.label}: ${x.value}${x.target ? ` (healthy: ${x.target})` : ''}`);
    return { reply: lines.length ? `From your apps this week: ${lines.slice(0, 4).join('; ')}.` : 'No app shares this yet. You can connect your watch or food app under Connected apps.', actions: [] };
  }
  if (/\b(ready|prepare|get ready|before (my )?donat)/.test(m)) {
    const r = wellbeing.habits.readiness(st);
    if (r) return { reply: `Before your next donation: ${r.items.map((i) => `${i.text} (${i.state === 'on' ? 'good' : 'not yet'})`).join('; ')}. ${r.note}`, actions: [] };
  }
  if (/\b(eat|food|foods|diet|breakfast|lunch|dinner|snack|cheap|budget|khana|meal)\b/.test(m)) {
    const marker = /\b(bp|blood pressure|salt)\b/.test(m) ? 'bp' : /\b(sugar|hba1c|diabet)/.test(m) ? 'sugar' : /cholesterol|ldl|fat/.test(m) ? 'lipids' : /b12/.test(m) ? 'b12' : /vitamin d|sun/.test(m) ? 'vitd' : /iron|haemoglobin|hemoglobin|anaemi|anemi/.test(m) ? 'iron' : null;
    return { reply: marker ? foodGuard.ruleReply(st, marker) : foodGuard.planReply(st), actions: [] };
  }
  return null;
}

module.exports = { DEFINITIONS, NAMES, namesFor, handles, run, chatLine, context, afterReply, fallback };
