/**
 * Goals in code (build plan step 1; ticket 01, "Which findings make which Goal"):
 * groups, names, the targets table, order, two active Goals plus Up next, and states.
 * The demo Personas plus synthetic donors from data/synthetic for the cases no Persona has.
 */

const test = require('node:test');
const assert = require('node:assert');
const store = require('../src/data/store');
const goals = require('../src/domain/goals');
const drop = require('../src/domain/drop');

test.beforeEach(() => store.resetDemo());

const summary = (donorId) => drop.goals(donorId).map((g) => ({ id: g.id, name: g.name, state: g.state, target: g.target && g.target.text }));

test('Arjun: one lifestyle Goal, "BP and cholesterol", BP under 130/80, and it holds up his donation', () => {
  const [g, ...rest] = drop.goals('D-001');
  assert.equal(rest.length, 0);
  assert.equal(g.id, 'lifestyle');
  assert.equal(g.name, 'BP and cholesterol');
  assert.equal(g.target.text, 'BP under 130/80');
  assert.equal(g.state, 'active');
  assert.equal(g.lead.id, 'BP_GRADE1');
  assert.ok(g.stopsDonation);
  // His rising BP and borderline cholesterol are watch findings that join the Goal his stage 1 BP made
  assert.deepEqual(g.findings.map((f) => f.id), ['BP_GRADE1', 'BP_RISING', 'LIPIDS_BORDERLINE']);
  assert.deepEqual(goals.keepAnEye('D-001'), []);
});

test('Karthik: "Blood sugar, BP and cholesterol", led by prediabetes, target HbA1c under 5.7%', () => {
  assert.deepEqual(summary('D-050'), [{ id: 'lifestyle', name: 'Blood sugar, BP and cholesterol', state: 'active', target: 'HbA1c under 5.7%' }]);
  assert.equal(drop.goals('D-050')[0].stopsDonation, false);
});

test('Meera: "Haemoglobin and iron", with the donation minimum for women', () => {
  assert.deepEqual(summary('D-002'), [{ id: 'iron', name: 'Haemoglobin and iron', state: 'active', target: 'Haemoglobin 12.5 or more, ferritin 15 or more' }]);
});

test('Imran (D-013, prediabetes only) now gets a Goal, and a Plan follows his results', () => {
  assert.deepEqual(summary('D-013'), [{ id: 'lifestyle', name: 'Blood sugar', state: 'active', target: 'HbA1c under 5.7%' }]);
});

test('Rohan: BP above ideal is watch only, so no Goal; it is a "keep an eye on" line', () => {
  assert.deepEqual(drop.goals('D-033'), []);
  assert.deepEqual(goals.keepAnEye('D-033').map((f) => f.id), ['BP_ELEVATED']);
  assert.equal(drop._state('D-033').budgetKind, 'healthy');
});

test('Ananya, all in range: no Goal and nothing to keep an eye on', () => {
  assert.deepEqual(drop.goals('D-003'), []);
  assert.deepEqual(goals.keepAnEye('D-003'), []);
});

test('Hb target by sex: 13.0 for men (D-087), and his watch findings stay outside the iron Goal', () => {
  assert.deepEqual(summary('D-087'), [{ id: 'iron', name: 'Haemoglobin', state: 'active', target: 'Haemoglobin 13.0 or more, ferritin 15 or more' }]);
  assert.deepEqual(goals.keepAnEye('D-087').map((f) => f.id), ['BP_ELEVATED', 'LIPIDS_BORDERLINE']);
});

test("the diabetes range (D-053) makes a Goal whose target is a doctor's check, with no number", () => {
  const [g] = drop.goals('D-053');
  assert.equal(g.name, 'Blood sugar, cholesterol and weight');
  assert.equal(g.target.text, "A doctor's check within 30 days");
  assert.equal(g.target.doctor, true);
  assert.equal(g.target.line, null);
});

test('a raised ALT makes no Goal (D-185): it is rechecked at the next donation', () => {
  assert.deepEqual(drop.goals('D-185').map((g) => g.name), ['Blood sugar, cholesterol and weight']);
  assert.deepEqual(goals.keepAnEye('D-185').map((f) => f.id), ['ALT_HIGH']);
});

test('cholesterol as the lead (D-015): its target names both LDL and triglycerides', () => {
  assert.deepEqual(summary('D-015'), [{ id: 'lifestyle', name: 'Cholesterol and BP', state: 'active', target: 'LDL under 130, triglycerides under 150' }]);
});

test('Vikram: an urgent Goal names up to three kinds, and it cannot be stopped', () => {
  const [g] = drop.goals('D-017');
  assert.equal(g.name, 'BP, blood sugar and cholesterol');
  assert.equal(g.severity, 'urgent');
  assert.throws(() => goals.stop(drop._state('D-017').goals, 'D-017', 'lifestyle'), /urgent Goal can't be stopped/);
});

test('two Goals on a tie: the one that stops donation comes first (D-038)', () => {
  assert.deepEqual(drop.goals('D-038').map((g) => [g.name, g.state]), [['Haemoglobin', 'active'], ['Blood sugar', 'active']]);
});

test('order: urgent before high before moderate, then stopping donation, then older; a third Goal waits in Up next', () => {
  const g = (id, severity, stopsDonation) => ({ id, name: id, severity, stopsDonation });
  const records = {
    a: { createdOn: '2026-09-01' }, b: { createdOn: '2026-08-01' }, c: { createdOn: '2026-10-01' }, d: { createdOn: '2026-07-01', state: 'stopped' },
  };
  const out = goals.arrange([g('a', 'moderate', false), g('b', 'moderate', false), g('c', 'urgent', false), g('d', 'high', true)], records);
  assert.deepEqual(out.map((x) => [x.id, x.state]), [['c', 'active'], ['b', 'active'], ['a', 'upnext'], ['d', 'stopped']]);
  assert.equal(out[2].startsWhen, 'b');
  // On a severity tie, the Goal that stops donation goes first even if newer
  const tie = goals.arrange([g('a', 'moderate', false), g('c', 'moderate', true)], records);
  assert.deepEqual(tie.map((x) => x.id), ['c', 'a']);
});

test('stop and Start again keep the same Goal', () => {
  const records = drop._state('D-001').goals;
  assert.deepEqual(goals.stop(records, 'D-001', 'lifestyle').map((g) => [g.id, g.state]), [['lifestyle', 'stopped']]);
  assert.deepEqual(summary('D-001').map((g) => g.state), ['stopped']);
  assert.deepEqual(goals.startAgain(records, 'D-001', 'lifestyle').map((g) => [g.id, g.state]), [['lifestyle', 'active']]);
  assert.throws(() => goals.startAgain(records, 'D-001', 'lifestyle'), /not stopped/);
});

test("Meera's Goal carries on as the lead clears, is done when nothing worse than watch is left, and reopens", () => {
  const add = (key, value, id) => store.addObservations('D-002', [{ id, donorId: 'D-002', visitId: null, code: key, key, name: key, value, unit: '', date: '2026-10-08', source: 'uploaded_report', labId: null }]);
  const createdOn = drop.goals('D-002')[0].createdOn;
  add('hb', 12.6, 'OBS-test-hb');
  // Hb clears; low ferritin is still moderate, so the same Goal goes on with a new name
  assert.deepEqual(summary('D-002'), [{ id: 'iron', name: 'Iron', state: 'active', target: 'Haemoglobin 12.5 or more, ferritin 15 or more' }]);
  add('ferritin', 30, 'OBS-test-ferritin');
  const [done] = drop.goals('D-002');
  assert.deepEqual([done.id, done.name, done.state, done.doneOn], ['iron', 'Iron', 'done', store.today()]);
  store.removeObservation('D-002', 'OBS-test-ferritin');
  const [back] = drop.goals('D-002');
  assert.deepEqual([back.id, back.state, back.createdOn, back.reopenedOn], ['iron', 'active', createdOn, store.today()]);
});

test('BP_GOAL 135/85 is gone: a home reading counts as reaching the target only under 130/80', () => {
  assert.equal(drop.BP_GOAL, undefined);
  assert.equal(goals.bpReached(132, 78), false);
  assert.equal(goals.bpReached(128, 82), false);
  assert.equal(goals.bpReached(128, 78), true);
  drop.logReading('D-001', { s: 133, d: 84 }); // under the old 135/85, over 130/80
  assert.ok(!drop._state('D-001').events.some((e) => e.kind === 'goal'));
  drop.logReading('D-001', { s: 126, d: 78 });
  assert.ok(drop._state('D-001').events.some((e) => e.kind === 'goal'));
});

test("Meera's Hb Check-in asks for 12.5, the minimum for women, from her Goal", () => {
  const c = drop.view('D-002').open.find((x) => x.type === 'checkin' && x.variant === 'hb');
  assert.match(c.text, /Hb 12\.5 or more/);
});

test('the code-written facts: the trend in plain words with real numbers, and the Goal\'s other findings', () => {
  const [g] = drop.goals('D-001');
  const f = goals.facts(g, 'D-001', (m) => drop.chartPoints('D-001', m));
  assert.equal(f.trend.words, 'Up at each of your last 4 donations');
  assert.equal(f.trend.range, '126/78 → 148/94');
  assert.equal(f.trend.line, 130);
  assert.deepEqual(f.also, ['Triglycerides 138 → 152 → 168']);
  assert.match(f.doctorNote, /High blood pressure \(stage 1\): 148\/94 mmHg \(BP-G1\)/);
  assert.equal(f.urgency, 'moderate');
});

/* ------------------------------------------------------------------ the Goal write-up (build plan step 2) */

const writeup = require('../src/domain/goalWriteup');

test("every Persona's Goal has a rules write-up: two sentences of why, 2-3 tagged steps, each with evidence", () => {
  for (const id of ['D-001', 'D-002', 'D-017', 'D-050', 'D-013']) {
    for (const g of drop.goals(id)) {
      const w = g.writeup;
      assert.equal(w.by, 'rules', `${id} ${g.name}`);
      assert.equal(w.why.split(/(?<=[.!?])\s+/).length, 2, `${id}: ${w.why}`);
      assert.ok(w.steps.length >= 2 && w.steps.length <= 3, `${id} steps`);
      for (const s of w.steps) {
        assert.ok(writeup.TAGS.includes(s.tag), s.tag);
        assert.ok(s.evidence.length, `${id} "${s.text}" has evidence`);
      }
      // The write-up never sets grouping, a target or the order
      assert.deepEqual(Object.keys(w).sort(), ['by', 'steps', 'why', 'writtenOn']);
    }
  }
});

test("Arjun's write-up: walks, less salt and a doctor, with the guidance's own numbers", () => {
  const w = drop.goals('D-001')[0].writeup;
  assert.deepEqual(w.steps.map((s) => s.tag), ['movement', 'food', 'doctor']);
  assert.match(w.why, /^Your BP is above the 130\/80 target, and your donations wait until it comes down\./);
  assert.ok(w.steps[0].evidence.includes('Aerobic Exercise: 5-7 mmHg systolic (ICMR Guidelines, ACC/AHA 2017)'));
  assert.equal(w.steps[2].text, 'See a doctor within 3 weeks'); // BP-G1 follow-up, 21 days
});

test('an urgent Goal starts with a doctor today and offers no Movement step (Vikram)', () => {
  const w = drop.goals('D-017')[0].writeup;
  assert.equal(w.steps[0].tag, 'doctor');
  assert.equal(w.steps[0].text, 'See a doctor today');
  assert.ok(!w.steps.some((s) => s.tag === 'movement'));
});

test('the diabetes range starts with a doctor within 30 days (D-053)', () => {
  assert.equal(drop.goals('D-053')[0].writeup.steps[0].text, 'See a doctor within 30 days');
});

test('the write-up is written once, and again only when the Goal\'s findings change', () => {
  const st = drop._state('D-002');
  const first = drop.goals('D-002')[0].writeup;
  store.stepClock();
  drop.view('D-002');
  assert.equal(drop.goals('D-002')[0].writeup, first, 'a view never rewrites it');
  store.addObservations('D-002', [{ id: 'OBS-test-hb', donorId: 'D-002', visitId: null, code: 'hb', key: 'hb', name: 'hb', value: 12.6, unit: 'g/dL', date: '2026-10-08', source: 'uploaded_report', labId: null }]);
  const next = drop.goals('D-002')[0].writeup;
  assert.notEqual(next, first);
  assert.match(next.why, /^Your iron stores are low, with ferritin under 15\./);
  assert.equal(st.goals.iron.writeup, next, 'kept with the Goal');
});

test('the Detailed analysis route is gone', () => {
  const routes = require('../src/routes/donors').stack.map((l) => l.route?.path).filter(Boolean);
  assert.ok(!routes.includes('/:donorId/care-plan'));
  assert.equal(store.session.carePlans, undefined);
});

/* ------------------------------------------------------------------ Health shows Goals (build plan step 4) */

const screenLines = require('../src/domain/screenLines');
const DAY = 4; // parts of a day on the demo clock

test("Arjun's results Card opens his Goal's Chat; there is no Save my Plan, and the Plan comes with the results", () => {
  for (let i = 0; i < DAY; i += 1) store.stepClock(); // Sun 11 Oct: his 3 Oct lab panel arrives
  const v = drop.view('D-001');
  const results = v.open.find((c) => c.type === 'results' && c.variant === 'results');
  // The lab panel adds prediabetes to the same lifestyle Goal, which takes its new name
  assert.equal(results.main.label, 'Open BP, blood sugar and cholesterol');
  assert.equal(results.main.value, 'goal');
  assert.equal(results.main.open.goalId, 'lifestyle');
  assert.match(results.main.open.text, /^BP, blood sugar and cholesterol\. Target: BP under 130\/80\. Up at each of your last 4 donations: 126\/78 → 148\/94\.$/);
  assert.deepEqual(results.chips.map((c) => c.label), ['Try check-up slots', 'Explain my results']);
  assert.ok(drop._state('D-001').plan.nextCheckin, 'the Plan and its first Check-in come with the results');
  drop.answer('D-001', results.id, 'goal');
  assert.equal(drop.view('D-001').receipts[0].receipt, 'Results seen · opened BP, blood sugar and cholesterol');
  for (let i = 0; i < DAY * 3; i += 1) store.stepClock();
  assert.ok(!drop._state('D-001').cards.some((c) => c.variant === 'plan'), 'no "Your Plan is ready" Card');
  // ALT came with the panel: no Goal, kept an eye on
  assert.deepEqual(drop.view('D-001').keepAnEye.map((f) => f.id), ['ALT_HIGH']);
});

test("Health's view of a Goal: the write-up, the trend against the target and what opens its Chat", () => {
  const [g] = drop.view('D-001').goals;
  assert.equal(g.name, 'BP and cholesterol');
  assert.equal(g.trend.marker, 'bp');
  assert.equal(g.trend.line, 130);
  assert.deepEqual(g.trend.points.map((p) => p.value), [126, 132, 136, 148]);
  assert.deepEqual(g.also, ['Triglycerides 138 → 152 → 168']);
  assert.equal(g.nextCheck, 'By 31 Oct'); // BP-G1 follow-up, 21 days from 10 Oct
  assert.deepEqual(g.chat.questions, ['What could I do this week?', 'Why does my BP and cholesterol Goal matter?', 'Show my BP trend']);
  assert.equal(g.writeup.by, 'rules');
});

test('a BP reading added from the Goal joins its trend as your own point, and never changes the Health score', () => {
  const health = require('../src/domain/health');
  const before = health.currentScore('D-001').score;
  drop.logReading('D-001', { s: 128, d: 78 });
  const [g] = drop.view('D-001').goals;
  assert.deepEqual(g.trend.points.at(-1), { date: store.today(), value: 128, value2: 78, source: 'yours' });
  assert.equal(health.currentScore('D-001').score, before);
});

test('"Your Plan has the next steps" is gone from Drop\'s line', () => {
  for (const id of ['D-001', 'D-002', 'D-017', 'D-050', 'D-033', 'D-003']) assert.doesNotMatch(screenLines.line(id, 'health').text, /Your Plan has the next steps/);
});

test("the Chat over the app: Stop this Goal and Start again through Drop, and each state's Chat (step 5)", () => {
  const chat = () => drop.view('D-001').goals[0].chat;
  assert.equal(chat().questions[0], 'What could I do this week?');
  let v = drop.stopGoal('D-001', 'lifestyle');
  assert.equal(v.goals[0].state, 'stopped');
  assert.equal(v.goals[0].stoppedOn, store.today());
  // Stopped: read-only, so no questions to tap
  assert.match(chat().text, /^You stopped BP and cholesterol on .*read-only; Start again/);
  assert.deepEqual(chat().questions, []);
  v = drop.startGoalAgain('D-001', 'lifestyle');
  assert.equal(v.goals[0].state, 'active');
  assert.throws(() => drop.startGoalAgain('D-001', 'lifestyle'), /not stopped/);
  // An urgent Goal can't be stopped
  assert.throws(() => drop.stopGoal('D-017', 'lifestyle'), /urgent Goal can't be stopped/);
  assert.equal(drop.view('D-017').goals[0].state, 'active');
});

test('an Up next Chat offers no Week plans, and says when it starts', () => {
  const g = { id: 'iron', name: 'Iron', state: 'upnext', startsWhen: 'BP and cholesterol', target: { text: 'Ferritin 15 or more' } };
  const st = drop._state('D-001');
  const facts = { trend: { label: 'Ferritin', words: 'On 3 Oct', range: '12' } };
  const c = drop.goalChatOf(st, g, facts);
  assert.match(c.text, /^Iron is up next: it starts when BP and cholesterol is done\./);
  assert.ok(!c.questions.includes('What could I do this week?'));
  assert.equal(c.answers['Can I start it now?'], 'It starts when BP and cholesterol is done. What you do for Movement helps it too.');
  const done = drop.goalChatOf(st, { id: 'iron', name: 'Iron', state: 'done', doneOn: '2026-10-10' });
  assert.match(done.text, /^Iron is done: .*read-only/);
  assert.deepEqual(done.questions, []);
});
