/**
 * Checks Drop's food answers against the rules (CONTEXT.md: Care level). After
 * the model: a food the rules didn't choose, any medicine or supplement, or a
 * number no rule gave replaces the answer with the rule wording. The doctor's
 * line is then added by code, so the model can never leave it out or soften it.
 */

const foodCoach = require('../domain/foodCoach');
const ref = require('../data/reference');

const MEDICINE = /\b(tablets?|capsules?|supplements?|ferrous|folic acid|syrup|injections?|shots?|sachets?|multivitamins?|pills?|dose|dosage|prescription)\b/i;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every name a food goes by (English words and local names), for spotting foods in a reply. */
function namesOf(f) {
  const main = f.en.split(/[()]/)[0].trim();
  return [main, ...(f.en.match(/\(([^)]+)\)/) ? [f.en.match(/\(([^)]+)\)/)[1]] : []), ...Object.values(f.names || {})].filter((n) => n && n.length > 2);
}

function mentioned(reply) {
  return ref.foods().filter((f) => namesOf(f).some((n) => new RegExp(`(^|[^\\p{L}])${escape(n)}`, 'iu').test(reply))).map((f) => f.id);
}

/** The rule wording: the chosen foods with prices, one tip, and the doctor's line. */
function ruleReply(st, marker) {
  const s = foodCoach.suggest(st, marker);
  if (s.rulesOnly || !s.foods.length) return s.text;
  const list = s.foods.slice(0, 3).map((f) => `${f.name} (${f.fitIn}, ₹${f.cost.min}–${f.cost.max})`).join('; ');
  return `For your ${s.label.toLowerCase()}: ${list}. ${s.tips[0] ? s.tips[0].text : ''} ${s.doctor ? s.doctor.text : ''}`.replace(/\s+/g, ' ').trim();
}

/** The plan from all their results in rule wording: what needs improving, foods and habits that help most, the doctor lines. */
const lc = (t) => t.charAt(0).toLowerCase() + t.slice(1);
const labelWords = (t) => t.toLowerCase().replace(/vitamin (\w+)/g, (m, x) => `vitamin ${x.toUpperCase()}`);

function planReply(st) {
  const p = require('../domain/improvements').plan(st);
  if (!p) return 'Your first donation includes a free health check; your plan starts from its results.';
  const top = p.needs.slice(0, 3).map((n) => `${labelWords(n.label)} (${n.levelWords.toLowerCase()})`).join(', ');
  const more = p.needs.length > 3 ? ` and ${p.needs.length - 3} more on Progress` : '';
  const foods = p.foods.slice(0, 3).map((f) => `${f.name} (for ${labelWords(f.helps.join(' and '))})`).join(', ');
  const habit = p.habits[0] ? ` A habit that helps most: ${lc(p.habits[0].text)}.` : '';
  const head = p.keep ? p.headline : `Your results ask most for ${top}${more}.`;
  return `${head} Foods: ${foods}.${habit} ${p.doctors.slice(0, 2).map((d) => d.text).join(' ')}`.replace(/\s+/g, ' ').trim();
}

/** One result in rule wording: its level, its foods, its habit and its doctor line. */
function needReply(st, marker) {
  const p = require('../domain/improvements').plan(st);
  const n = p && p.needs.find((x) => x.marker === marker);
  const name = { vitd: 'vitamin D', b12: 'vitamin B12', iron: 'iron', bp: 'blood pressure', sugar: 'blood sugar', lipids: 'cholesterol', weight: 'weight' }[marker] || marker;
  if (!n) return `Your ${name} is fine in your latest results${p ? `. ${planReply(st)}` : '.'}`;
  if (n.coaching === 'rules_only') return `${n.rule} ${n.doctor ? n.doctor.text : ''}`.trim();
  const foods = n.foods.map((f) => `${f.name} (${f.fitIn}, ₹${f.cost.min}–${f.cost.max})`).join('; ');
  const habit = n.habits[0] ? ` Habit: ${lc(n.habits[0].text)}.` : '';
  return `Your ${name} is ${n.levelWords.toLowerCase()}. ${foods ? `Foods: ${foods}.` : ''}${habit} ${n.doctor ? n.doctor.text : ''}`.replace(/\s+/g, ' ').trim();
}

/** "Why these foods?" in rule wording, from the plan's own explanation. */
function whyReply(st) {
  const p = require('../domain/improvements').plan(st);
  if (!p) return 'Drop suggests foods once your first donation\'s results are in.';
  const prefs = p.explanation.preferences.slice(0, 3).join(', ').toLowerCase();
  return `Because your results show ${p.needs.length ? p.needs.slice(0, 3).map((n) => `${labelWords(n.label)} ${n.levelWords.toLowerCase()}`).join(', ') : 'everything healthy, and each donation takes iron'}. The foods fit how you eat (${prefs}), and the ones that help several results come first. Tap "Why this plan?" on Progress for the full reasons.`;
}

/** A model answer built from get_health_plan: only the plan's foods, no medicines, and every doctor line it carries. */
function checkPlan(st, reply, { marker } = {}) {
  const p = require('../domain/improvements').plan(st);
  if (!p) return { reply, replaced: false };
  const label = marker ? require('../domain/improvements').LABELS[marker] : null;
  const doctors = label ? p.doctors.filter((d) => d.labels.includes(label)) : p.doctors.slice(0, 2);
  // Any food the rules allow for one of their results (right diet, allergies, budget and safety) is fine, not only the top ones
  const markers = p.keep ? ['iron'] : p.needs.map((n) => (n.marker === 'weight' ? 'sugar' : n.marker)).filter((m) => ['iron', 'b12', 'vitd', 'bp', 'sugar', 'lipids'].includes(m));
  const allowed = new Set([...p.foods.map((f) => f.id), ...p.needs.flatMap((n) => n.foods.map((f) => f.id)),
    ...markers.flatMap((m) => foodCoach.allowedFoods(st, m).map((f) => f.id)), 'lemon', 'tomato', 'amla', 'guava', 'onion']);
  // With an urgent Goal there is no exercise at all, not even "after checking with a doctor"
  const urgent = require('../domain/signals').goals(st).some((g) => g.state === 'active' && g.severity === 'urgent');
  // Sentence by sentence: drop any that names a medicine, a food the rules don't allow, exercise with an urgent Goal,
  // or talks about doctors (the rules add their own line); fall back to the rule wording only if too little is left
  const removed = [];
  const parts = String(reply).split(/(?<=[.!?।])\s+/).map((x) => x.replace(/\s*\([^)]*app will add[^)]*\)/i, ''));
  const kept = parts.filter((x) => {
    const why = MEDICINE.test(x) ? 'medicine' : mentioned(x).some((id) => !allowed.has(id)) ? 'food not allowed' : urgent && EXERCISE.test(x) ? 'exercise with an urgent Goal' : DOCTOR_TALK.test(x) ? 'doctor talk' : null;
    if (why && why !== 'doctor talk') removed.push(why);
    return !why;
  });
  const left = kept.join(' ').trim();
  const enough = left.length > 0 && (!removed.length || left.length >= 40);
  const reason = enough ? null : (removed[0] || 'too little left');
  let out = enough ? kept.join(' ').trim() : withoutDoctorTalk(label ? needReply(st, marker) : planReply(st));
  for (const d of doctors) if (!out.includes(d.text)) out = `${out.trim()} ${d.text}`;
  return { reply: out, replaced: Boolean(reason), reason, removed };
}

const EXERCISE = /\b(walk|walking|walks|jog|jogging|run|running|exercise|workout|gym|cycling|yoga|stairs|sport)\b|सैर|टहल|दौड़|व्यायाम|ಓಟ|ನಡಿಗೆ|ಜಾಗಿಂಗ್|நடை|ஓட்ட|உடற்பயிற்சி/i;
const DOCTOR_TALK = /doctor|clinician|physician|app will add|डॉक्टर|चिकित्सक|ವೈದ್ಯ|மருத்துவ|వైద్య|ഡോക്ടർ/i;

/** A reply without its own sentences about seeing a doctor (the rules add theirs). */
function withoutDoctorTalk(text) {
  const parts = String(text).split(/(?<=[.!?।])\s+/);
  const kept = parts.map((p) => p.replace(/\s*\([^)]*app will add[^)]*\)/i, '')).filter((p) => !DOCTOR_TALK.test(p));
  return (kept.length ? kept : parts).join(' ').replace(/[;,]\s*$/, '.').trim();
}

function numbersIn(text) { return (String(text).match(/\d+(?:\.\d+)?/g) || []).map(Number); }

function check(st, reply, { marker = 'iron' } = {}) {
  const s = foodCoach.suggest(st, marker);
  if (s.rulesOnly) return { reply: s.text, replaced: true, reason: 'doctor_first' };
  // Foods other markers' rules also allow (a donor can ask about more than one thing), and pairing foods
  const allowed = new Set([...s.foods.map((f) => f.id), ...['iron', 'bp', 'sugar', 'lipids'].flatMap((m) => foodCoach.suggest(st, m).foods.map((f) => f.id)), 'lemon', 'tomato', 'amla', 'guava']);
  const foods = mentioned(reply);
  const stray = foods.filter((id) => !allowed.has(id));
  const factNumbers = new Set([...JSON.stringify(s).match(/\d+(?:\.\d+)?/g) || [], '1', '2', '3', '4', '5', '6', '7', '10', '15', '20', '30'].map(Number));
  const strayNumber = numbersIn(reply).find((n) => !factNumbers.has(n));
  let reason = null;
  if (MEDICINE.test(reply)) reason = 'medicine';
  else if (stray.length) reason = `food not chosen by the rules: ${stray.join(', ')}`;
  else if (strayNumber !== undefined) reason = `number not from the rules: ${strayNumber}`;
  let out = reason ? ruleReply(st, marker) : reply;
  // The doctor's line always goes with food coaching, added by code
  if (s.doctor && !out.includes(s.doctor.text)) out = `${out.trim()} ${s.doctor.text}`;
  return { reply: out, replaced: Boolean(reason), reason };
}

module.exports = { check, checkPlan, ruleReply, planReply, needReply, whyReply, mentioned, withoutDoctorTalk };
