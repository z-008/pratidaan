/** Food coaching: diet, Jain, allergy, budget and region filters; safety across findings; doctor first; the data itself. */

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const foodCoach = require('../src/domain/foodCoach');
const ref = require('../src/data/reference');

test.beforeEach(() => store.resetDemo());
const st = (donorId, language = 'en') => ({ donorId, language });
const kindOf = (id) => ref.foods().find((f) => f.id === id);

test('a vegetarian never gets meat, fish or egg; a Jain donor never gets roots, onion or garlic', () => {
  for (const diet of ['veg', 'jain', 'vegan']) {
    const s = st('D-175');
    foodCoach.setProfile(s, { diet, region: 'south', budget: 'flexible', staple: 'rice', eatsAt: 'home' });
    for (const marker of ['iron', 'b12', 'bp', 'sugar', 'lipids']) {
      for (const f of foodCoach.suggest(s, marker).foods) {
        const food = kindOf(f.id);
        assert.ok(foodCoach.allowedFor(diet, food), `${diet} got ${f.id}`);
        if (diet === 'jain') assert.equal(food.root, false);
        if (diet === 'vegan') assert.equal(food.kind, 'plant');
      }
    }
  }
});

test('the budget caps each food, allergies leave foods out, and the same input gives the same list', () => {
  const s = st('D-175');
  foodCoach.setProfile(s, { diet: 'nonveg', region: 'south', budget: 'tight', staple: 'rice', eatsAt: 'home', allergies: ['sesame'] });
  const a = foodCoach.suggest(s, 'iron');
  assert.ok(a.foods.length >= 3);
  a.foods.forEach((f) => assert.ok(f.cost.max <= 8, `${f.id} costs up to ₹${f.cost.max}`));
  assert.ok(!a.foods.some((f) => f.id === 'sesame'));
  assert.deepEqual(foodCoach.suggest(s, 'iron').foods, a.foods);
});

test('prediabetes or diabetes leaves out jaggery and dates, and says so', () => {
  store.stepClock(); store.stepClock(); store.stepClock(); store.stepClock(); // Arjun's 11 Oct results: HbA1c 5.7
  const s = st('D-050'); // Karthik: HbA1c 6.1
  foodCoach.setProfile(s, { diet: 'veg', region: 'south', budget: 'flexible', staple: 'rice', eatsAt: 'home' });
  const iron = foodCoach.suggest({ ...s, wb: s.wb }, 'iron');
  assert.ok(!iron.foods.some((f) => ['jaggery', 'dates'].includes(f.id)));
  assert.ok(foodCoach.safetyRules('D-050').some((r) => r.flag === 'highSugar'));
});

test('doctor first: no foods at all, only the rule and the doctor', () => {
  store.addObservations('D-175', [{ id: 'T-hb', donorId: 'D-175', visitId: null, code: '718-7', key: 'hb', name: 'Haemoglobin', value: 9.2, unit: 'g/dL', date: '2026-10-10', source: 'uploaded_report' }]);
  const s = foodCoach.suggest(st('D-175'), 'iron');
  assert.equal(s.rulesOnly, true);
  assert.equal(s.foods.length, 0);
  assert.match(s.text, /See a doctor first/);
});

test('every suggestion carries its doctor line and a rules-built explanation', () => {
  const s = foodCoach.suggest(st('D-175'), 'iron');
  assert.equal(s.doctor.urgency, 'recommended');
  assert.ok(s.text.includes(s.doctor.text));
  assert.equal(s.explanation.rule.id, 'IRON-LN');
  assert.ok(s.explanation.preferences.length);
  assert.ok(s.explanation.notUsed.some((n) => /medicine/.test(n)));
});

test('until a profile is set, only vegetarian foods, and the profile says it is the default', () => {
  const s = st('D-001');
  const p = foodCoach.profile(s);
  assert.equal(p.isDefault, true);
  assert.equal(p.diet, 'veg');
  assert.equal(p.region, 'south', 'from Bengaluru Urban');
  assert.throws(() => foodCoach.setProfile(s, { diet: 'pescatarian' }), /Choose a diet/);
});

test('food data: every food has names, a price, a kind and per-serving nutrients; values are flagged as unverified', () => {
  for (const f of ref.foods()) {
    assert.ok(f.en && f.names.hi && f.names.kn && f.names.ta, `${f.id} names`);
    assert.ok(Array.isArray(f.cost) && f.cost[0] <= f.cost[1], `${f.id} cost`);
    assert.ok(['plant', 'dairy', 'egg', 'meat', 'fish'].includes(f.kind), `${f.id} kind`);
    assert.equal(typeof f.verified, 'boolean');
    for (const [k, v] of Object.entries(f.per)) assert.ok(v >= 0 && v < 1000, `${f.id} ${k}`);
  }
});
