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

module.exports = { check, ruleReply, mentioned };
