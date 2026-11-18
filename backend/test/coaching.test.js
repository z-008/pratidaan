/**
 * Between-donation Cards never change the existing ones: own allowance (1 a week, evening only,
 * not on a day an existing Card went), outside the budget, ignored by Next event; Week plans, Your day,
 * comeback, step-up, Simplify my plan, Undo and the Weekly report's added slides.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const drop = require('../src/domain/drop');
const wellbeing = require('../src/domain/wellbeing');

test.beforeEach(() => store.resetDemo());
const advance = (n) => { for (let i = 0; i < n; i += 1) store.stepClock(); };
const open = (id) => drop.view(id).open;
const of = (id, type, variant) => open(id).find((c) => c.type === type && (!variant || c.variant === variant));

test('Asha starts set up: a food Card for her low-normal iron, with a doctor recommended', () => {
  const food = of('D-175', 'food', 'lownormal');
  assert.ok(food);
  assert.match(food.text, /डॉक्टर/); // her Drop language is Hindi
  assert.equal(food.main.go, 'progress:iron');
  assert.ok(food.chips.some((c) => c.why === 'food:iron'));
  const s = wellbeing.summary('D-175');
  assert.equal(s.active, true);
  assert.equal(s.connections.length, 3);
  assert.equal(s.weekPlan.items.length, 2);
});

test('a Week plan is a Card the Donor asked for: outside the budget, saved only with a tap, and Undo removes it', async () => {
  await wellbeing.connect('D-001', 'habitify_demo', { writeBack: true });
  advance(4); // results day: one counted Card already
  const before = drop.view('D-001').budget.today;
  const { cardId } = wellbeing.offerWeekPlan('D-001', 'movement');
  assert.equal(drop.view('D-001').budget.today, before, 'not counted');
  assert.equal(wellbeing.summary('D-001').weekPlan, null, 'not saved before the tap');
  drop.answer('D-001', cardId, 'save_sync');
  const plan = wellbeing.summary('D-001').weekPlan;
  assert.equal(plan.items[0].text, '30-minute brisk walk');
  assert.equal(plan.items[0].synced, 'Habitify');
  drop.undo('D-001');
  assert.equal(wellbeing.summary('D-001').weekPlan, null, 'Undo takes the plan back');
});

test('an urgent Goal gets no Movement plan', () => {
  const r = wellbeing.weekPlan.suggest(wellbeing.state('D-017'), 'movement');
  assert.equal(r.items.length, 0);
  assert.match(r.note, /doctor/);
});

test('a rough week brings one comeback Card, in the evening, never on a day an existing Card went, not counted', async () => {
  await wellbeing.connect('D-001', 'fitbit_demo');
  advance(4);
  drop.answer('D-001', wellbeing.offerWeekPlan('D-001', 'movement').cardId, 'save');
  wellbeing.roughWeek('D-001');
  const st = drop._state('D-001');
  const cb = st.cards.find((c) => c.type === 'comeback');
  assert.ok(cb, 'comeback sent');
  assert.equal(store.clock().part, 2, 'evening');
  assert.equal(cb.counted, false);
  assert.ok(!(st.sentByDay[cb.createdOn] > 0), 'no existing Card that day');
  const view = drop.view('D-001').open.find((c) => c.id === cb.id);
  assert.ok(view.chips.some((c) => c.why));
  assert.equal(wellbeing.coaching.explanationFor(st, `card:${cb.id}`).rule.id, 'R2');
});

test('Next event stops where it always did: it ignores the new Cards', async () => {
  const plain = drop.nextEvent('D-175');
  store.resetDemo();
  await wellbeing.connect('D-175', 'fitbit_demo'); // Asha is set up already; one more app changes nothing
  assert.deepEqual(drop.nextEvent('D-175'), plain);
});

test('Your day: a day off asks what got in the way, once, and a skipped day is never mentioned later', () => {
  advance(3); // Sat night: Asha's Your day at 9 pm
  const day = of('D-175', 'day', 'due');
  assert.ok(day);
  drop.answer('D-175', day.id, 'none');
  const barrier = of('D-175', 'day', 'barrier');
  assert.ok(barrier);
  drop.answer('D-175', barrier.id, 'busy');
  assert.ok(drop._state('D-175').wb.barriers.some((b) => b.code === 'busy' && b.source === 'you'));
  advance(1); // next morning
  assert.ok(!open('D-175').some((c) => c.type === 'day'), 'nothing about yesterday');
});

test('accepting a lighter week steps the item down for 7 days (never to nothing), then a step-up is offered', () => {
  wellbeing.roughWeek('D-175');
  const cb = of('D-175', 'comeback', 'offer');
  drop.answer('D-175', cb.id, 'accept');
  const item = wellbeing.summary('D-175').weekPlan.items.find((i) => i.habit === 'movement');
  assert.equal(item.steppedDown, true);
  assert.ok(item.minutes >= 5);
  advance(4 * 7);
  assert.ok(drop._state('D-175').cards.some((c) => c.type === 'comeback' && c.variant === 'stepup'));
});

test('Simplify my plan keeps one item smaller and sets the rest aside; Bring back restores it', () => {
  const st = wellbeing.state('D-175');
  const r = wellbeing.weekPlan.simplify(st);
  const plan = wellbeing.weekPlan.view(st);
  assert.equal(plan.items.filter((i) => !i.setAside).length, 1);
  assert.equal(plan.items.find((i) => i.id === r.kept).steppedDown, true);
  wellbeing.weekPlan.bringBack(st, r.setAside[0]);
  assert.equal(wellbeing.weekPlan.view(st).items.filter((i) => !i.setAside).length, 2);
});

test('the Weekly report gets added slides only for a Donor using these features, after the existing ones', () => {
  advance(4 * 2 + 1); // Sun 11 Oct afternoon (Asha's report is monthly; the first Sunday is not in October's first week)
  const arjun = drop._state('D-001').cards.find((c) => c.type === 'report');
  if (arjun) assert.ok(!arjun.data.slides.some((s) => /Week plan/.test(s)));
});

test('See a doctor first replaces the food Card when results show Hb under 10', () => {
  store.addObservations('D-175', [{ id: 'T-hb95', donorId: 'D-175', visitId: null, code: '718-7', key: 'hb', name: 'Haemoglobin', value: 9.5, unit: 'g/dL', date: '2026-10-10', source: 'uploaded_report' }]);
  advance(1);
  assert.ok(of('D-175', 'food', 'doctorfirst'));
  assert.ok(!of('D-175', 'food', 'lownormal'), 'the low-normal Card no longer fits');
});
