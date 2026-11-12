const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const impact = require('../src/domain/impact');
const concerns = require('../src/domain/concerns');
const cover = require('../src/domain/cover');
const { candidates } = require('../src/domain/bookingRank');
const health = require('../src/domain/health');

function expiredUnit() {
  for (const donor of store.allDonors()) {
    const unit = impact.donorJourneys(donor.id).find((j) => j.expiry);
    if (unit) return { donorId: donor.id, unit };
  }
  return null;
}

test('an expired unit explains why it was not used and what follows', () => {
  const found = expiredUnit();
  assert.ok(found, 'the synthetic data has expired units');
  const { expiry } = found.unit;
  assert.ok(expiry.cause.length >= 2);
  assert.match(expiry.cause[0], /on the shelf for \d+ day/);
  assert.equal(expiry.effect.length, 3);
  assert.match(expiry.effect[0], /never given to anyone/);
});

test('a concern has an owner and a deadline, and escalates once answered or overdue', () => {
  store.resetDemo();
  const { donorId, unit } = expiredUnit();
  const raised = concerns.raise(donorId, { category: 'wasted', details: 'Why was it thrown away?', unitId: unit.id });
  assert.equal(raised.level, 1);
  assert.match(raised.owner, /Medical Officer/);
  assert.equal(raised.canEscalate, false);
  assert.throws(() => concerns.escalate(donorId, raised.id), /escalate after/);

  for (let i = 0; i < 4 * 3; i += 1) store.stepClock(); // three demo days
  const answered = concerns.list(donorId)[0];
  assert.equal(answered.answered, true);
  assert.ok(answered.steps.some((s) => s.text.startsWith('Illustrative answer')));
  assert.equal(answered.canEscalate, true);

  const up = concerns.escalate(donorId, raised.id);
  assert.equal(up.level, 2);
  assert.match(up.owner, /State Blood Transfusion Council/);
  assert.equal(up.canEscalate, false);
  const done = concerns.resolve(donorId, raised.id);
  assert.equal(done.status, 'resolved');
  assert.equal(new Set(done.steps.map((s) => s.text)).size, done.steps.length);
  assert.throws(() => concerns.raise(donorId, { category: 'nope' }), /Choose/);
  store.resetDemo();
});

test('cover shows base terms, the policy stack and premium discounts', () => {
  const c = cover.evaluate('D-003');
  assert.ok(c.baseTerms.length >= 6);
  assert.equal(c.stack.multiple, true);
  assert.equal(c.stack.total, c.stack.layers.reduce((s, l) => s + l.cover, 0));
  assert.ok(c.discounts.percentOff <= c.discounts.cap);
  assert.equal(c.discounts.saving, Math.round((c.discounts.fullPremium * c.discounts.percentOff) / 100));
  const retail = cover.evaluate('D-002');
  assert.equal(retail.policy.paidBy, 'You');
  assert.ok(retail.discounts.premiumsYouPay.length >= 1);
});

test('a chosen date window limits the slots offered', () => {
  const donorId = store.allDonors().find((d) => health.eligibility(d.id).nextEligibleDate)?.id;
  const all = candidates(donorId, { timeWindows: ['morning'] }).slots;
  const first = all[0].date;
  const to = new Date(Date.parse(`${first}T00:00:00Z`) + 2 * 864e5).toISOString().slice(0, 10);
  const windowed = candidates(donorId, { timeWindows: ['morning'], dateFrom: first, dateTo: to }).slots;
  assert.ok(windowed.length > 0 && windowed.length < all.length);
  assert.ok(windowed.every((s) => s.date >= first && s.date <= to));
});
