/**
 * "Why this?" (CONTEXT.md): every recommendation Drop makes between donations
 * carries an explanation built by the rules that made it, never by the AI.
 */

const NOT_USED = [
  'Nothing here changes your health score, when you can donate or your cover.',
  'Your lab results are never sent to your habit apps or to Circles.',
];

function make({ title, dataUsed = [], rule, guidance = [], preferences = [], effect = null, wouldChange = null, notUsed = [] }) {
  return { title, dataUsed, rule, guidance, preferences, effect, wouldChange, notUsed: [...notUsed, ...NOT_USED] };
}

module.exports = { make, NOT_USED };
