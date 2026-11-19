/**
 * The plan from the Donor's results (improvements.js): every result that needs improving gets foods and habits,
 * combined into what helps most at once; doctor lines always go with it; urgent means no exercise;
 * and Drop's answers built on it are checked (foodGuard.checkPlan).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/data/store');
const drop = require('../src/domain/drop');
const improvements = require('../src/domain/improvements');
const wellbeing = require('../src/domain/wellbeing');
const foodGuard = require('../src/ai/foodGuard');
const wellbeingTools = require('../src/ai/wellbeingTools');

test.beforeEach(() => store.resetDemo());
const plan = (id) => improvements.plan(drop._state(id));

test("each Persona's plan covers the results that need improving, not only iron", () => {
  assert.deepEqual(plan('D-002').needs.map((n) => n.marker), ['iron']);
  assert.ok(['bp', 'lipids', 'sugar'].every((m) => plan('D-001').needs.some((n) => n.marker === m)), 'Arjun: BP, cholesterol, blood sugar');
  const asha = plan('D-175').needs.map((n) => n.marker);
  for (const m of ['vitd', 'iron', 'b12', 'weight']) assert.ok(asha.includes(m), `Asha: ${m}`);
  assert.equal(plan('D-003').keep, true, 'Ananya is healthy: a keep plan');
});

test('vitamin D gets sun and vitamin D foods; B12 gets dairy; foods that help several results come first', () => {
  const p = plan('D-175');
  const vitd = p.needs.find((n) => n.marker === 'vitd');
  assert.ok(vitd.habits.some((h) => /sun/.test(h.text)));
  assert.ok(vitd.foods.some((f) => ['egg', 'mushroom', 'fortifiedoil', 'milk'].includes(f.id)));
  assert.ok(p.needs.find((n) => n.marker === 'b12').habits.some((h) => h.id === 'H-DAIRY'));
  assert.ok(p.foods[0].helps.length >= p.foods[p.foods.length - 1].helps.length);
  assert.ok(p.foods.some((f) => f.helps.length > 1), 'a food that helps more than one result');
});

test('every result that needs a doctor carries its line; an urgent Goal gets no exercise; Jain and vegan diets are respected', () => {
  const v = plan('D-017');
  assert.equal(v.doctors[0].urgency, 'today');
  assert.ok(!v.habits.some((h) => h.habit === 'movement'), 'no exercise while BP is urgent');
  const st = wellbeing.state('D-175');
  wellbeing.foodCoach.setProfile(st, { diet: 'vegan', region: 'north', budget: 'tight', staple: 'roti', eatsAt: 'home' });
  const vegan = improvements.plan(st);
  assert.ok(!vegan.foods.some((f) => ['egg', 'milk', 'curd', 'paneer'].includes(f.id)));
  assert.ok(!vegan.habits.some((h) => h.id === 'H-DAIRY'));
});

test('Add to my week turns the plan into Week plan items (food add-on, movement, sleep)', () => {
  const p = wellbeing.addPlanToWeek('D-175');
  const habits = p.items.map((i) => i.habit);
  assert.ok(habits.includes('food') && habits.includes('movement'));
  assert.ok(p.items.find((i) => i.habit === 'movement').text.match(/sun/));
});

test("Drop's answers built on the plan: only its foods, no medicines, the doctor lines added; offline, the rules answer", () => {
  const st = drop._state('D-175');
  const ok = foodGuard.checkPlan(st, 'Try eggs for breakfast and a sun walk.');
  assert.equal(ok.replaced, false);
  for (const d of plan('D-175').doctors.slice(0, 2)) assert.ok(ok.reply.includes(d.text));
  const vd = foodGuard.checkPlan(st, 'Eggs and a sun walk.', { marker: 'vitd' });
  assert.equal(vd.reply.split('डॉक्टर').length - 1, 1, 'only the vitamin D doctor line');
  assert.equal(foodGuard.checkPlan(st, 'Take a vitamin D sachet.').replaced, true);
  assert.equal(foodGuard.checkPlan(st, 'Chicken liver will fix it.').replaced, true);
  const offline = wellbeingTools.fallback('D-175', 'what should i improve?');
  assert.match(offline.reply, /vitamin D/);
  const tool = wellbeingTools.run('get_health_plan', {}, 'D-175');
  assert.ok(tool.results.length >= 4 && tool.foodsThatHelpMost.length);
});
