/**
 * Care levels (CONTEXT.md): when food coaching leads and when the doctor comes first.
 * Boundaries use a stand-in Hb/ferritin so every rule is exercised.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const careLevel = require('../src/domain/careLevel');

test.beforeEach(() => store.resetDemo());

const levelOf = (id) => Object.fromEntries(careLevel.all(id, { donorId: id, language: 'en' }).map((l) => [l.marker, l.level]));

test('each Persona gets the expected iron level', () => {
  assert.equal(levelOf('D-001').iron, 'optimal', 'Arjun: Hb 14.3, ferritin 105');
  assert.equal(levelOf('D-002').iron, 'below', 'Meera: Hb 11.8, ferritin 8');
  assert.equal(levelOf('D-175').iron, 'low_normal', 'Asha: Hb 12.7 (minimum 12.5), ferritin 25');
  assert.equal(levelOf('D-017').bp, 'urgent', 'Vikram: 184/118');
});

function withHb(donorId, value, extra = []) {
  store.addObservations(donorId, [{ id: `T-${donorId}-${value}`, donorId, visitId: null, code: '718-7', key: 'hb', name: 'Haemoglobin', value, unit: 'g/dL', date: '2026-10-10', source: 'uploaded_report' }, ...extra]);
  return careLevel.of(donorId, { donorId, language: 'en' }, 'iron');
}

test('iron boundaries: below the minimum, low-normal, doctor first under 10, urgent under 7', () => {
  assert.equal(withHb('D-175', 12.4).level, 'below');
  store.resetDemo();
  assert.equal(withHb('D-175', 13.6).level, 'low_normal', 'ferritin 25 keeps it low-normal');
  store.resetDemo();
  const df = withHb('D-175', 9.9);
  assert.equal(df.level, 'doctor_first');
  assert.equal(df.coaching, 'rules_only');
  assert.equal(df.doctor.urgency, 'first');
  store.resetDemo();
  assert.equal(withHb('D-175', 6.5).level, 'urgent');
});

test('a doctor is recommended even within the limit, and the advice is fixed text', () => {
  const l = careLevel.of('D-175', { donorId: 'D-175', language: 'en' }, 'iron');
  assert.equal(l.doctor.urgency, 'recommended');
  assert.match(l.doctor.text, /doctor's check is recommended/);
  const hi = careLevel.of('D-175', { donorId: 'D-175', language: 'hi' }, 'iron');
  assert.match(hi.doctor.text, /डॉक्टर/);
});

test('small red cells with normal iron stores send the donor to a doctor, not to iron', () => {
  const l = withHb('D-175', 12.9, [
    { id: 'T-mcv', donorId: 'D-175', visitId: null, code: '787-2', key: 'mcv', name: 'MCV', value: 72, unit: 'fL', date: '2026-10-10', source: 'uploaded_report' },
    { id: 'T-fer', donorId: 'D-175', visitId: null, code: '2276-4', key: 'ferritin', name: 'Ferritin', value: 60, unit: 'ng/mL', date: '2026-10-10', source: 'uploaded_report' },
  ]);
  assert.equal(l.ruleId, 'IRON-DF-MCV');
});

test('a vegan with B12 on the low side always has the doctor in it', () => {
  store.addObservations('D-003', [{ id: 'T-b12', donorId: 'D-003', visitId: null, code: '2132-9', key: 'b12', name: 'Vitamin B12', value: 250, unit: 'pg/mL', date: '2026-10-10', source: 'uploaded_report' }]);
  const plain = careLevel.of('D-003', { donorId: 'D-003', language: 'en' }, 'b12');
  assert.equal(plain.level, 'low_normal');
  const vegan = careLevel.of('D-003', { donorId: 'D-003', language: 'en', wb: { foodProfile: { diet: 'vegan' }, redFlags: [] } }, 'b12');
  assert.equal(vegan.level, 'below');
  assert.equal(vegan.ruleId, 'B12-VEGAN');
});
