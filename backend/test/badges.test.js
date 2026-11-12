const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const impact = require('../src/domain/impact');
const { badges } = require('../src/domain/badges');

const byId = (list) => Object.fromEntries(list.map((b) => [b.id, b]));

test('Arjun (D-001) holds 6 of 8, with progress on the two he has not earned', () => {
  store.resetDemo();
  const list = badges('D-001');
  assert.deepEqual(list.map((b) => b.name), ['First patient', '5 patients', '10 patients', 'Regular donor', 'Nothing wasted', 'All five parts', 'Plasma to medicine', 'Helped a child']);
  assert.equal(list.filter((b) => b.earned).length, 6);
  const b = byId(list);
  assert.equal(b.patients_10.earned, false);
  assert.equal(b.patients_10.progress, '8 so far');
  assert.equal(b.patients_10.progressRatio, 0.8);
  assert.equal(b.all_five_parts.earned, false);
  assert.equal(b.all_five_parts.progress, '3 of 5 so far');
  assert.equal(b.all_five_parts.progressRatio, 0.6);
  assert.equal(b.helped_child.earnedMonth, '2026-07');
  const child = impact.donorJourneys('D-001').find((j) => j.id === b.helped_child.completedBy.componentId);
  assert.ok(child.recipient.patient.startsWith('Teenager'));
  for (const x of list.filter((y) => y.earned)) assert.equal(x.progress, null);
});

test('Ananya (D-003) holds 8 of 8; 10 patients was earned in May 2026 by her 15 Apr 2026 red cells', () => {
  store.resetDemo();
  const list = badges('D-003');
  assert.ok(list.every((b) => b.earned));
  const ten = byId(list).patients_10;
  assert.equal(ten.earnedMonth, '2026-05');
  assert.equal(ten.earnedLabel, 'May 2026');
  const unit = store.getComponents('D-003').find((c) => c.id === ten.completedBy.componentId);
  assert.equal(unit.kind, 'PRBC');
  assert.equal(store.getDonations('D-003').find((d) => d.id === unit.donationId).date, '2026-04-15');
});

test('a new donor has nothing earned and no recipient facts leak into Badges', () => {
  store.resetDemo();
  const list = badges('D-NEW');
  assert.ok(list.every((b) => !b.earned && b.earnedMonth === null));
  assert.ok(!JSON.stringify(badges('D-001')).match(/Bengaluru|Karnataka|Adult|female|male|recovered/));
});

test('same history, same Badges', () => {
  store.resetDemo();
  const first = JSON.stringify(store.allDonors().map((d) => badges(d.id)));
  store.resetDemo();
  assert.equal(JSON.stringify(store.allDonors().map((d) => badges(d.id))), first);
});

test('advancing the clock never removes a Badge, except Helped a child when its age band is withdrawn', () => {
  store.resetDemo();
  const ids = store.allDonors().map((d) => d.id);
  const held = new Map(ids.map((id) => [id, new Set(badges(id).filter((b) => b.earned).map((b) => b.id))]));
  for (let step = 0; step < 4 * 120; step += 1) {
    store.stepClock();
    if (step % 28) continue; // check once a demo week
    for (const id of ids) {
      const now = new Set(badges(id).filter((b) => b.earned).map((b) => b.id));
      for (const b of held.get(id)) if (b !== 'helped_child') assert.ok(now.has(b), `${id} lost ${b} on ${store.today()}`);
      held.set(id, now);
    }
  }
  store.resetDemo();
});
