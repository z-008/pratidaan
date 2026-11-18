/**
 * Small adjustments for a slipped routine (CONTEXT.md: Adjustment, Comeback
 * Card). Rules choose from a fixed library (data/nutrition/adjustments.json);
 * the AI may only word the one chosen. Never zero, never exercise during an
 * urgent Goal or while unwell, never a food plan when the doctor comes first.
 */

const signals = require('./signals');
const careLevel = require('./careLevel');
const ref = require('../data/reference');

const drop = () => require('./drop');

/** Why a library entry can't be offered right now, or null. */
function forbidden(st, a) {
  const urgent = signals.goals(st).some((g) => g.state === 'active' && g.severity === 'urgent');
  if (urgent && a.habit === 'movement') return 'urgent_goal';
  const iron = careLevel.of(st.donorId, st, 'iron');
  if (a.habit === 'food' && iron && iron.coaching === 'rules_only') return 'doctor_first';
  return null;
}

/** Candidates for one disruption, best first. `exclude` are ids the Donor already turned down. */
function candidates(st, disruption, exclude = []) {
  const history = signals.ensure(st).adjustments;
  return ref.adjustments().library
    .filter((a) => a.habit === disruption.habit && a.rules.includes(disruption.ruleId) && !exclude.includes(a.id) && !forbidden(st, a))
    .map((a) => {
      let score = 0;
      if (disruption.barrier && a.barriers.includes(disruption.barrier.code)) score += 3;
      if (disruption.pattern && (a.patterns || []).includes(disruption.pattern.id)) score += 2;
      if (history.some((h) => h.adjId === a.id && h.answer === 'accepted')) score += 1;
      if (history.some((h) => h.adjId === a.id && h.answer === 'declined')) score -= 2;
      // "Unwell" entries only when the Donor said they were unwell
      if (a.kind === 'unwell' && disruption.barrier?.code !== 'unwell') score -= 10;
      return { ...a, score };
    })
    .filter((a) => a.score > -5)
    .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
}

/** The step a chosen adjustment makes to a Week plan item: a smaller version for 7 days. Never nothing. */
function stepDownFor(item, a, today, until) {
  if (a.minutes) return { minutes: Math.max(5, a.minutes), perWeek: item.perWeek, text: a.text, until, adjId: a.id, on: today };
  return { minutes: item.minutes, perWeek: Math.max(1, a.perWeek || Math.ceil(item.perWeek / 2)), text: a.text, until, adjId: a.id, on: today };
}

module.exports = { candidates, forbidden, stepDownFor };
