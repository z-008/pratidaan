/**
 * The additive contract (docs/changes/2026-11-18-technical-implementation-plan.md, C3/C4): every existing
 * Persona's existing behaviour (Cards of the existing kinds and their timing and words, events, budget, Drop's
 * own log, the Weekly report's existing slides, Goals, findings, score, eligibility, cover, Badges, impact,
 * Drop's lines, the Intro, rule answers) is exactly what the v1-baseline build gave, now that every Persona
 * also has connected apps and Food profiles. New behaviour is recorded apart (see golden/snapshot.js).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { capture } = require('./golden/snapshot');
const baseline = require('./golden/baseline.json');

// Every key the baseline has must match; objects may gain new keys, arrays may not gain items
function contains(actual, expected, where) {
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${where}: expected an array`);
    assert.equal(actual.length, expected.length, `${where}: length changed`);
    expected.forEach((e, i) => contains(actual[i], e, `${where}[${i}]`));
  } else if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object', `${where}: expected an object`);
    for (const k of Object.keys(expected)) contains(actual[k], expected[k], `${where}.${k}`);
  } else {
    assert.deepEqual(actual, expected, where);
  }
}

test('every existing Persona behaves exactly as in v1-baseline', () => {
  const now = capture();
  for (const donorId of Object.keys(baseline)) contains(now[donorId], baseline[donorId], donorId);
});
