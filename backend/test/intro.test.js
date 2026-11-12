/**
 * Drop's Intro (CONTEXT.md: Intro): who gets it, where its answers land,
 * skipping, replaying and the demo Reset. Sign-in is off, so donation
 * preferences go to the local in-memory store, as on a laptop.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const store = require('../src/data/store');
const drop = require('../src/domain/drop');
const intro = require('../src/domain/intro');
const settings = require('../src/auth/userSettings');

const user = { sub: 'local', email: 'local-dev', name: 'Local development', local: true };
const DEFAULTS = { shareHealthWithInsurer: false, showOnLeaderboard: true, includeInCommunityStats: true };

/** Walk the New donor through every step with the given answers. */
async function runThrough(answers = {}) {
  const go = (step, value) => intro.answer('D-NEW', step, value, { user });
  await go(1, answers.language || 'en');
  await go(2, 'next');
  await go(3, 'next');
  await go(4, 'next');
  await go(5, 'next');
  await go(6, answers.choices || DEFAULTS);
  await go(7, answers.donate || 'skip');
  return go(8, 'finish');
}

test.beforeEach(() => store.resetDemo());

test('the New donor starts new; every other Persona is done and cannot replay', () => {
  const fresh = intro.status('D-NEW');
  assert.equal(fresh.status, 'new');
  assert.equal(fresh.step, 1);
  assert.equal(fresh.stepId, 'language');
  assert.equal(fresh.canReplay, true);
  for (const id of ['D-001', 'D-002', 'D-003', 'D-017', 'D-050', 'D-033']) {
    const s = intro.status(id);
    assert.equal(s.status, 'done', id);
    assert.equal(s.canReplay, false, id);
    assert.throws(() => intro.replay(id), /Only the New donor/);
  }
});

test('eight steps, scripted in English, with an example journey and an example results card', () => {
  const steps = intro.steps();
  assert.equal(steps.length, 8);
  assert.deepEqual(steps.map((s) => s.id), ['language', 'hello', 'journey', 'health', 'data', 'choices', 'donate', 'done']);
  const journey = steps[2].pictureData;
  assert.equal(journey.label, 'Example');
  assert.equal(journey.date, '3 Oct');
  assert.equal(journey.parts.length, 3);
  assert.ok(journey.parts.some((p) => p.good), 'one part has reached a patient');
  assert.ok(journey.story.length >= 4);
  assert.doesNotMatch(JSON.stringify(journey), /Arjun/);
  const results = steps[3].pictureData;
  assert.equal(results.label, 'Example');
  assert.ok(results.rows.some((r) => r.value === '148/94' && r.status === 'A bit high'));
  assert.deepEqual(steps[7].buttons.map((b) => b.label), ['Book my first donation', 'Start using Pratidaan']);
});

test("language and Choices land on the donor and in Drop's view", async () => {
  await intro.answer('D-NEW', 1, 'hi', { user });
  assert.equal(drop.view('D-NEW').language, 'hi');
  assert.equal(drop.view('D-NEW').preferredLanguage, 'hi', "Home's switch offers English plus Hindi");
  assert.equal(drop.view('D-NEW').intro.status, 'running');
  assert.equal(drop.view('D-NEW').intro.step, 2);
  for (const step of [2, 3, 4, 5]) await intro.answer('D-NEW', step, 'next', { user });
  const { saved } = await intro.answer('D-NEW', 6, { ...DEFAULTS, shareHealthWithInsurer: true, showOnLeaderboard: false }, { user });
  assert.deepEqual(saved.sort(), ['shareHealthWithInsurer', 'showOnLeaderboard']);
  assert.deepEqual(store.getDonor('D-NEW').consent, { shareHealthWithInsurer: true, showOnLeaderboard: false, includeInCommunityStats: true });
  await assert.rejects(intro.answer('D-NEW', 3, 'next', { user }), /on step 7/);
});

test("the step 7 answer lands in the account's donation preferences", async () => {
  await settings.savePreferences(user, null);
  await runThrough({ donate: { days: 'saturday', time: 'morning', place: 'bengaluru' } });
  const prefs = await settings.getPreferences(user);
  assert.deepEqual(prefs.days, ['sat']);
  assert.deepEqual(prefs.timeWindows, ['morning']);
  assert.equal(prefs.location.label, 'Bengaluru Urban');
  assert.equal(prefs.onboardingComplete, true);
  const s = intro.status('D-NEW');
  assert.equal(s.status, 'done');
  assert.equal(s.finishedOn, store.today());
});

test('skip keeps the defaults (insurer off) and counts as skipped', async () => {
  await intro.answer('D-NEW', 1, 'en', { user });
  const s = intro.skip('D-NEW');
  assert.equal(s.status, 'skipped');
  assert.equal(s.finishedOn, store.today());
  assert.deepEqual(store.getDonor('D-NEW').consent, DEFAULTS);
  assert.throws(() => intro.skip('D-NEW'), /not running/);
});

test('replay starts at step 1 filled in, saves only what changes, and skipping it changes nothing', async () => {
  await settings.savePreferences(user, null);
  await runThrough({ language: 'hi', choices: { ...DEFAULTS, shareHealthWithInsurer: true }, donate: { days: 'weekdays', time: 'evening', place: 'mysuru' } });
  const finished = intro.status('D-NEW');
  intro.noteQuestion('D-NEW', 'not running, so not kept', 'x');
  assert.equal(finished.questions.length, 0);
  finished.questions.push({ q: 'asked the first time', a: 'kept', step: 3 }); // as if asked during the first run

  const r = intro.replay('D-NEW');
  assert.equal(r.status, 'running');
  assert.equal(r.step, 1);
  assert.equal(r.replay, true);
  const pre = await intro.prefill('D-NEW', user);
  assert.equal(pre.language, 'hi');
  assert.equal(pre.choices.shareHealthWithInsurer, true);
  assert.deepEqual(pre.donate, { days: 'weekdays', time: 'evening', place: 'mysuru' });

  const before = await settings.getPreferences(user);
  assert.deepEqual((await intro.answer('D-NEW', 1, 'hi', { user })).saved, [], 'same language: nothing saved');
  for (const step of [2, 3, 4, 5]) await intro.answer('D-NEW', step, 'next', { user });
  assert.deepEqual((await intro.answer('D-NEW', 6, { ...DEFAULTS, shareHealthWithInsurer: true }, { user })).saved, []);
  assert.deepEqual((await intro.answer('D-NEW', 7, { days: 'weekdays', time: 'evening', place: 'mysuru' }, { user })).saved, []);
  assert.equal(await settings.getPreferences(user), before, 'unchanged preferences are not written again');

  intro.noteQuestion('D-NEW', 'What is a Circle?', 'Your family, workplace or club.');
  const skipped = intro.skip('D-NEW');
  assert.equal(skipped.status, 'done', 'skipping a replay keeps it finished');
  assert.equal(skipped.finishedOn, finished.finishedOn);
  assert.deepEqual(skipped.questions.map((q) => q.q), ['asked the first time'], "the first run's questions come back");
  assert.equal(store.getDonor('D-NEW').consent.shareHealthWithInsurer, true, 'skipping a replay changes nothing');

  intro.replay('D-NEW');
  await intro.answer('D-NEW', 1, 'en', { user });
  assert.equal(drop.view('D-NEW').language, 'en', 'a changed answer is saved');
});

test('Reset makes the New donor new again, with their language and Choices back to the start', async () => {
  await runThrough({ language: 'ta', choices: { ...DEFAULTS, includeInCommunityStats: false } });
  assert.equal(intro.status('D-NEW').status, 'done');
  store.resetDemo();
  assert.equal(intro.status('D-NEW').status, 'new');
  assert.equal(store.getDonor('D-NEW').language, 'en');
  assert.deepEqual(store.getDonor('D-NEW').consent, DEFAULTS);
  assert.equal(drop.view('D-NEW').language, 'en');
});

test('questions asked during the Intro are kept with it', async () => {
  await intro.answer('D-NEW', 1, 'en', { user });
  intro.noteQuestion('D-NEW', "What's this?", 'Pratidaan follows your blood.');
  assert.deepEqual(intro.status('D-NEW').questions, [{ q: "What's this?", a: 'Pratidaan follows your blood.', step: 2 }]);
  assert.match(intro.explain('D-NEW'), /step 2 of 8, "What Pratidaan is"/);
  const { fallback } = require('../src/ai/copilot');
  assert.match(fallback('D-NEW', "what's this?").reply, /step 2 of 8/, 'with the AI off, "what\'s this?" gets the step');
});

test('the Intro routes: read, answer, skip, replay and finish', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = user; next(); });
  app.use('/api/donors/:donorId/intro', require('../src/routes/intro'));
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/donors`;
  const call = async (path, body) => {
    const res = await fetch(`${base}${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    return { status: res.status, body: await res.json() };
  };
  try {
    const read = await call('/D-NEW/intro');
    assert.equal(read.status, 200);
    assert.equal(read.body.data.steps.length, 8);
    assert.doesNotMatch(read.body.data.steps[7].text[0], /\{first\}/, 'no name with sign-in off');
    assert.equal((await call('/D-NEW/intro/answer', { step: 1, value: 'en' })).body.data.step, 2);
    assert.equal((await call('/D-NEW/intro/answer', { step: 5, value: 'next' })).status, 400);
    assert.equal((await call('/D-NEW/intro/finish', {})).status, 400, 'finish only from the last step');
    assert.equal((await call('/D-NEW/intro/skip', {})).body.data.status, 'skipped');
    assert.equal((await call('/D-NEW/intro/replay', {})).body.data.step, 1);
    assert.equal((await call('/D-001/intro/replay', {})).status, 400);
    assert.equal((await call('/D-999/intro')).status, 404);
  } finally {
    server.close();
  }
});

test('a translation is used only if every number and placeholder survives; without the AI the Intro stays in English', async () => {
  const introWriter = require('../src/ai/introWriter');
  assert.ok(introWriter.ok('Someone gave 450 ml on 3 Oct.', 'किसी ने 3 Oct को 450 ml दिया।'));
  assert.ok(!introWriter.ok('Someone gave 450 ml on 3 Oct.', 'किसी ने रक्त दिया।'), 'numbers dropped');
  assert.ok(!introWriter.ok('Carry on: {title}', 'जारी रखें'), 'placeholder dropped');
  const llm = require('../src/ai/llm');
  if (!llm.available()) {
    const r = await introWriter.translate('hi', ['Show me']);
    assert.deepEqual(r.texts, ['Show me']);
    assert.equal(r.fallback, true);
  }
  assert.deepEqual(await introWriter.translate('en', ['Show me']), { texts: ['Show me'], fallback: false });
});

test('asking Drop to switch language changes it mid-Intro, and the Intro carries on', async () => {
  const { fallback } = require('../src/ai/copilot');
  await intro.answer('D-NEW', 1, 'en', { user });
  const r = fallback('D-NEW', 'Please talk to me in Hindi');
  assert.match(r.reply, /Hindi/);
  assert.equal(r.actions[0].type, 'receipt');
  assert.equal(drop.view('D-NEW').language, 'hi');
  assert.equal(drop.view('D-NEW').preferredLanguage, 'hi');
  assert.equal(intro.status('D-NEW').step, 2, 'the Intro is still on its step');
  fallback('D-NEW', 'English please');
  assert.equal(drop.view('D-NEW').language, 'en');
  assert.equal(drop.view('D-NEW').preferredLanguage, 'hi', "Home's switch still offers Hindi");
});
