/**
 * The Donor's Choices (CONTEXT.md): what each switch changes, and that a demo
 * Reset puts every Persona's Choices back to where they started.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const community = require('../src/domain/community');
const cover = require('../src/domain/cover');

const family = (viewer = 'D-001') => community.summary('C-RAOFAM', viewer);

test.beforeEach(() => store.resetDemo());

test("Circle totals leave out a member whose totals Choice is off, and say how many weren't counted", () => {
  const before = family();
  assert.equal(before.notCounted, 0);
  const member = store.getDonor('D-286'); // 3 donations
  member.consent.includeInCommunityStats = false;
  const after = family();
  assert.equal(after.notCounted, 1);
  assert.equal(after.memberCount, before.memberCount, 'still a member');
  assert.equal(after.totals.donations, before.totals.donations - 3);
  assert.ok(after.totals.patientsHelped <= before.totals.patientsHelped);
  assert.equal(after.bloodGroups.reduce((n, g) => n + g.count, 0), before.memberCount - 1, 'blood group mix leaves them out');
  // Home's "Your circles" tile reads the same totals
  const tile = community.forDonor('D-001').find((c) => c.id === 'C-RAOFAM');
  assert.equal(tile.totals.donations, after.totals.donations);
  assert.equal(tile.notCounted, 1);
});

test('with their leaderboard Choice off, the donor still sees themself, marked as only visible to them', () => {
  store.getDonor('D-001').consent.showOnLeaderboard = false;
  const own = family('D-001');
  const me = own.leaderboard.find((m) => m.isYou);
  assert.ok(me, 'still on their own view');
  assert.equal(me.onlyYou, true);
  assert.equal(own.hiddenMembers, 0, "they aren't counted as hidden from themself");
  const other = family('D-044');
  assert.ok(!other.leaderboard.some((m) => m.name.startsWith('Arjun')), 'others no longer see them');
  assert.equal(other.hiddenMembers, 1);
});

test('the insurer Choice says what it does now, and turning it off drops cover back at once', () => {
  const ananya = cover.evaluate('D-003');
  assert.deepEqual([ananya.insurerEffect.on, ananya.insurerEffect.off], [800000, 500000]);
  store.getDonor('D-003').consent.shareHealthWithInsurer = false;
  assert.equal(cover.evaluate('D-003').currentCover, 500000);
  const arjun = cover.evaluate('D-001').insurerEffect;
  assert.equal(arjun.on, 500000);
  assert.equal(arjun.next, 600000);
  assert.equal(arjun.scoreForNext, 80);
});

test("demo Reset puts every Persona's Choices back to where they started", () => {
  const ids = ['D-NEW', 'D-001', 'D-002', 'D-003', 'D-017', 'D-050', 'D-033'];
  const start = Object.fromEntries(ids.map((id) => [id, { ...store.getDonor(id).consent }]));
  for (const id of ids) Object.keys(start[id]).forEach((k) => { store.getDonor(id).consent[k] = !start[id][k]; });
  store.resetDemo();
  for (const id of ids) assert.deepEqual(store.getDonor(id).consent, start[id], id);
});
