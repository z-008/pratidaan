/**
 * The New donor (a new user with no records) and the demo Reset: the overlay adds
 * the New donor without touching the synthetic data, and Reset never reuses a Card id.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const store = require('../src/data/store');
const drop = require('../src/domain/drop');

const advance = (parts) => { for (let i = 0; i < parts; i += 1) store.stepClock(); };
const cardIds = (donorId) => {
  const v = drop.view(donorId);
  return [...v.open.map((c) => c.id), ...v.earlier.map((c) => c.id), ...v.receipts.map((c) => c.id)];
};

test.beforeEach(() => store.resetDemo());

test('card ids never repeat after a Reset', () => {
  const before = new Set(['D-001', 'D-002', 'D-017'].flatMap(cardIds));
  advance(4); // Arjun's results arrive: a new Card
  cardIds('D-001').forEach((id) => before.add(id));
  store.resetDemo();
  const after = ['D-001', 'D-002', 'D-017'].flatMap(cardIds);
  assert.ok(after.length > 0);
  for (const id of after) assert.ok(!before.has(id), `${id} was used before the Reset`);
});

test('the New donor loads with no records', () => {
  const donor = store.getDonor('D-NEW');
  assert.ok(donor, 'New donor exists');
  assert.equal(donor.name, 'New donor');
  assert.equal(donor.bloodGroup, null);
  assert.equal(donor.policyId, null);
  assert.deepEqual(donor.communityIds, []);
  assert.deepEqual(donor.consent, { shareHealthWithInsurer: false, showOnLeaderboard: true, includeInCommunityStats: true });
  assert.equal(donor.language, 'en');
  assert.deepEqual(store.getDonations('D-NEW'), []);
  assert.deepEqual(store.getObservations('D-NEW'), []);
  assert.deepEqual(store.getComponents('D-NEW'), []);
  const v = drop.view('D-NEW');
  assert.deepEqual(v.open, []);
  assert.deepEqual(v.earlier, []);
  assert.deepEqual(v.memory, []);
  assert.equal(v.plan, null);
  advance(4 * 7); // a week on, Drop still has nothing to send someone with no records
  assert.deepEqual(drop.view('D-NEW').open, []);
});

test('Reset keeps the New donor', () => {
  store.resetDemo();
  assert.ok(store.getDonor('D-NEW'));
  assert.equal(drop.view('D-NEW').open.length, 0);
});

test("no existing donor's data changed", () => {
  const dataDir = path.join(__dirname, '../../data/synthetic');
  const synthetic = JSON.parse(fs.readFileSync(path.join(dataDir, 'donors.json'), 'utf8'));
  for (const d of synthetic) assert.deepEqual(store.getDonor(d.id), d, d.id);
  assert.equal(store.allDonors().length, synthetic.length + 1);
  assert.equal(store.allDonors().filter((d) => d.newUser).length, 1);
});
