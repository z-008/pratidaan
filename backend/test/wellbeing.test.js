/**
 * Connected apps, consent, bands and the age-group comparison, Cycle reports, the AI food check,
 * and isolation: nothing between donations changes the score, eligibility, cover or Badges.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const drop = require('../src/domain/drop');
const health = require('../src/domain/health');
const cover = require('../src/domain/cover');
const { badges } = require('../src/domain/badges');
const wellbeing = require('../src/domain/wellbeing');
const bands = require('../src/domain/bands');
const donation = require('../src/domain/donation');
const foodGuard = require('../src/ai/foodGuard');
const wellbeingTools = require('../src/ai/wellbeingTools');
const tools = require('../src/ai/tools');

test.beforeEach(() => store.resetDemo());

test('a data type the Donor did not allow is never read, and Disconnect & delete removes it', async () => {
  await wellbeing.connect('D-001', 'fitbit_demo', { consentedTypes: ['steps'] });
  const st = wellbeing.state('D-001');
  assert.ok(wellbeing.signals.daily(st, 'steps', '2026-10-01', '2026-10-10').length);
  assert.equal(wellbeing.signals.daily(st, 'sleep_min', '2026-10-01', '2026-10-10').length, 0);
  wellbeing.disconnect('D-001', 'cn-fitbit_demo');
  assert.equal(wellbeing.signals.daily(st, 'steps', '2026-10-01', '2026-10-10').length, 0);
});

test('a live account is never stored on a Persona', async () => {
  await assert.rejects(() => wellbeing.connect('D-001', 'habitify_live'), /nothing is stored/);
});

test('the demo watch reports the Weekly report\'s own activity minutes from the demo start', async () => {
  await wellbeing.connect('D-001', 'fitbit_demo');
  const st = wellbeing.state('D-001');
  assert.equal(wellbeing.signals.valueOn(st, 'active_min', '2026-10-10').value, drop.activityMinutes('D-001', '2026-10-10'));
});

test('the comparison is shown only from 50%, and groups smaller than 20 widen', () => {
  for (const id of ['D-001', 'D-002', 'D-003', 'D-175']) {
    for (const r of bands.rows(id)) if (r.percentile) assert.match(r.percentile, /Better than ([5-9]\d|100)%/);
    const p = bands.percentile('hb', id);
    assert.ok(p.size >= 20);
  }
});

test('a Cycle report follows a donation, with the focus marker, a comparison and the apps alongside', async () => {
  await wellbeing.connect('D-003', 'oura_demo');
  const slot = donation.slots('D-003').slots.find((s) => s.date === store.today());
  const ap = donation.book('D-003', { slotId: slot.id });
  const r = donation.checkIn('D-003', ap.id, { haemoglobin: 13.9 });
  const st = wellbeing.state('D-003');
  assert.equal(wellbeing.cycle.unseenReport(st).visitId, r.visitId);
  const rep = wellbeing.cycle.report(st, r.visitId);
  assert.ok(rep.slides.some((s) => /Haemoglobin: 13\.5 → 13\.9/.test(s)));
  assert.ok(rep.slides.some((s) => /Alongside, from your apps/.test(s)));
  assert.ok(rep.slides.every((s) => !/Better than [0-4]\d%/.test(s)));
});

test('the AI food check: stray foods, medicines and numbers fall back to the rule wording; the doctor line is always added', () => {
  const st = wellbeing.state('D-175');
  const ok = foodGuard.check(st, 'Try bajra roti at lunch with lemon.', { marker: 'iron' });
  assert.equal(ok.replaced, false);
  assert.match(ok.reply, /डॉक्टर|doctor/);
  assert.equal(foodGuard.check(st, 'Take an iron tablet daily.').replaced, true);
  assert.equal(foodGuard.check(st, 'Chicken liver is great.').replaced, true, 'not in her eggetarian list');
  assert.equal(foodGuard.check(st, 'Eat 45 grams of bajra.').replaced, true, 'a number no rule gave');
});

test('existing Chats keep their tools; Habit and Goal Chats get the new ones', () => {
  assert.ok(!tools.definitions().some((d) => d.name === 'find_foods'), 'the default list is unchanged');
  assert.deepEqual(wellbeingTools.namesFor('general'), ['get_cycle', 'get_bands']);
  assert.ok(wellbeingTools.namesFor('habit:food').includes('find_foods'));
  assert.ok(tools.definitions(['find_foods']).length === 1);
  assert.ok(tools.run('find_foods', { marker: 'iron' }, 'D-175').foods.length);
});

test('nothing between donations changes the score, eligibility, cover or Badges', async () => {
  const before = { score: health.currentScore('D-001'), el: health.eligibility('D-001'), cover: cover.evaluate('D-001'), badges: badges('D-001').map((b) => b.earned) };
  await wellbeing.connect('D-001', 'fitbit_demo');
  wellbeing.foodCoach.setProfile(wellbeing.state('D-001'), { diet: 'nonveg', region: 'south', budget: 'moderate', staple: 'rice', eatsAt: 'canteen' });
  drop.answer('D-001', wellbeing.offerWeekPlan('D-001', 'movement').cardId, 'save');
  const after = { score: health.currentScore('D-001'), el: health.eligibility('D-001'), cover: cover.evaluate('D-001'), badges: badges('D-001').map((b) => b.earned) };
  assert.deepEqual(after, before);
});

test('FHIR export: a donation panel as a Bundle with LOINC-coded Observations', () => {
  const b = wellbeing.fhirBundle('D-001', 'D-001-V3');
  assert.equal(b.resourceType, 'Bundle');
  assert.equal(b.entry[0].resource.resourceType, 'DiagnosticReport');
  assert.ok(b.entry.slice(1).every((e) => e.resource.code.coding[0].system === 'http://loinc.org'));
});
