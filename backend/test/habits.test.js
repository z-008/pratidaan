/**
 * Every demo Persona's apps feed their Habits, Goals and the next donation (habits.js), and none of it
 * changes the score, eligibility or cover. The New donor starts with nothing connected.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const health = require('../src/domain/health');
const wellbeing = require('../src/domain/wellbeing');

test.beforeEach(() => store.resetDemo());
const PERSONAS = ['D-001', 'D-002', 'D-003', 'D-017', 'D-050', 'D-033', 'D-175'];

test('every demo Persona has connected apps, a Food profile and measured Habits; the New donor has none', () => {
  for (const id of PERSONAS) {
    const s = wellbeing.summary(id);
    assert.ok(s.connections.length >= 1, `${id} apps`);
    assert.ok(s.foodProfile, `${id} food profile`);
    assert.ok(s.habits.some((h) => h.metrics.length), `${id} measured habit`);
    assert.ok(s.habits.find((h) => h.habit === 'mind').metrics.some((m) => m.signal === 'sleep_min'), `${id} sleep`);
  }
  const n = wellbeing.summary('D-NEW');
  assert.equal(n.connections.length, 0);
  assert.deepEqual(n.habits, []);
});

test('Habits measure against healthy targets with their sources', () => {
  const meera = wellbeing.summary('D-002').habits;
  const iron = meera.find((h) => h.habit === 'food').metrics.find((m) => m.signal === 'iron_mg');
  assert.match(iron.target, /29 mg a day for women/);
  assert.equal(iron.state, 'off', 'about 11 mg against 29');
  const move = meera.find((h) => h.habit === 'movement').metrics.find((m) => m.signal === 'active_min');
  assert.match(move.source, /WHO/);
});

test('a Goal shows what the apps recorded before it started, then since', () => {
  const before = wellbeing.summary('D-001').goalSignals[0];
  assert.match(before.text, /Before this Goal/);
  for (let i = 0; i < 4 * 9; i += 1) store.stepClock();
  const after = wellbeing.summary('D-001').goalSignals[0];
  assert.match(after.text, /Since this Goal started/);
});

test('food coaching knows what the Donor eats and sizes the suggestion to the gap', () => {
  const s = wellbeing.foodCoach.suggest(wellbeing.state('D-002'), 'iron');
  assert.ok(s.target.eaten > 5 && s.target.eaten < 20);
  assert.match(s.target.text, /Your food app \(Cronometer\) shows about/);
});

test('the readiness checklist reads results and apps but never changes eligibility', () => {
  const before = health.eligibility('D-001');
  const r = wellbeing.summary('D-001').readiness;
  assert.ok(r.items.some((i) => i.id === 'bp' && i.state === 'off'), 'BP 148/94 is over 140/90');
  assert.ok(r.items.some((i) => i.id === 'sleep'));
  assert.deepEqual(health.eligibility('D-001'), before);
});

test('the Weekly report adds a slide from the apps, after the existing slides', () => {
  wellbeing.state('D-001'); // the Persona is opened at the demo start, as in the app
  for (let i = 0; i < 4 + 2; i += 1) store.stepClock(); // Sun 11 Oct afternoon
  const report = wellbeing.state('D-001').cards.find((c) => c.type === 'report');
  assert.ok(report);
  const extra = report.data.slides.slice(report.data.slides.length - report.data.extraSlides);
  assert.ok(extra.some((x) => /^From my apps this week/.test(x)));
  assert.ok(!report.data.slides.slice(0, -report.data.extraSlides).some((x) => /From my apps/.test(x)));
  assert.ok(!extra.some((x) => /active minutes/.test(x)), 'the existing slide already has them');
});
