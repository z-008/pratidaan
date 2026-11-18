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
  { name: 'explain_recommendation', description: 'The rules\' explanation for a food suggestion (id "food:<marker>") or a Card (id "card:<cardId>").', input_schema: obj({ id: { type: 'string' } }, ['id']) },
];
const NAMES = DEFINITIONS.map((d) => d.name);

const habitOf = (chat) => (String(chat).startsWith('habit:') ? String(chat).slice(6) : null);
const isGoal = (chat) => String(chat).startsWith('goal:');

/** The extra tools a Chat gets. */
function namesFor(chat) {
  if (habitOf(chat) || isGoal(chat)) return NAMES;
  return ['get_cycle', 'get_bands'];
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
  if (!habit && !isGoal(chat)) return null;
  const goal = isGoal(chat) ? drop.goals(donorId).find((g) => `goal:${g.id}` === chat) : null;
  const where = goal ? `the Chat about their Goal "${goal.name}"` : `the Chat about their ${habit.charAt(0).toUpperCase()}${habit.slice(1)} Habit`;
  const food = habit === 'food' || (goal && /haemoglobin|iron|BP|sugar|cholesterol/i.test(goal.name))
    ? ' For food questions call find_foods and suggest only foods it returns, in their words (local names), with the price and how to fit each in; never name a medicine, tablet or supplement, never say food replaces treatment, and do not add doctor advice yourself (the app adds it). If find_foods says rulesOnly, say exactly what it says.'
    : '';
  return `\nThis conversation is ${where}. If they ask for a plan for the week, call offer_week_plan${habit ? ` with habit "${habit}"` : ''}: it opens a Card they tap to save (and can add to their habit app). Never claim you saved or scheduled anything yourself.${food}`;
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
  if (habitOf(chat) === 'food') {
    const prof = wellbeing.foodCoach.profile(st);
    lines.push(`Food profile: ${wellbeing.foodCoach.DIET_WORDS[prof.diet]}, ${prof.region} Indian food, ${wellbeing.foodCoach.BUDGET_WORDS[prof.budget]}${prof.isDefault ? ' (not set yet)' : ''}.`);
  }
  return lines.length ? `\n${lines.join(' ')}` : '';
}

/** After the model: food answers are checked against the rules and always end with the doctor's line. */
function afterReply({ donorId, chat, reply, steps = [], actions = [] }) {
  const usedFood = steps.some((s) => s.tool === 'find_foods');
  if (habitOf(chat) !== 'food' && !usedFood) return { reply, actions };
  return { reply: foodGuard.check(wellbeing.state(donorId), reply, { marker: (steps.find((s) => s.tool === 'find_foods')?.input?.marker) || 'iron' }).reply, actions };
}

/** Rule answers for food and plan questions when the AI is unavailable (checked after every existing rule answer). */
function fallback(donorId, m) {
  const st = wellbeing.state(donorId);
  if (/\b(week plan|plan (for|this) (the )?week|plan my week)\b/.test(m)) {
    const habit = /food|eat|diet/.test(m) ? 'food' : /sleep|mind|stress/.test(m) ? 'mind' : 'movement';
    const r = wellbeing.offerWeekPlan(donorId, habit);
    return { reply: 'Here is a plan for this week from your Goal. Tap Save to keep it.', actions: [{ type: 'card', cardId: r.cardId }] };
  }
  if (/\b(eat|food|foods|diet|breakfast|lunch|dinner|snack|cheap|budget|khana|meal)\b/.test(m)) {
    const marker = /\b(bp|blood pressure|salt)\b/.test(m) ? 'bp' : /\b(sugar|hba1c|diabet)/.test(m) ? 'sugar' : /cholesterol|ldl|fat/.test(m) ? 'lipids' : /b12/.test(m) ? 'b12' : 'iron';
    return { reply: foodGuard.ruleReply(st, marker), actions: [] };
  }
  return null;
}

module.exports = { DEFINITIONS, NAMES, namesFor, handles, run, chatLine, context, afterReply, fallback };
