/**
 * Golden baseline: what the app said and did for every existing Persona before the between-donation
 * features (tag v1-baseline). golden.test.js checks the current build still does exactly this.
 *
 * It records the existing behaviour only: Drop's Cards of the existing kinds (type, state, timing, words),
 * its events, budget counters and its own log, the Weekly report's existing slides, Goals, findings, score,
 * eligibility, cover, Badges, impact, Drop's line on each screen, the Intro and the rule answers.
 * New Cards (Week plan, Your day, comeback, food, prep), their log lines and the slides they add after
 * a report's existing ones are new behaviour, so they are left out on both sides.
 *
 * Capture (only from a v1-baseline checkout):  GOLDEN_OUT=<path> node test/golden/snapshot.js --write
 */

const fs = require('fs');
const path = require('path');
const store = require('../../src/data/store');
const health = require('../../src/domain/health');
const drop = require('../../src/domain/drop');
const goals = require('../../src/domain/goals');
const cover = require('../../src/domain/cover');
const { badges } = require('../../src/domain/badges');
const impact = require('../../src/domain/impact');
const screenLines = require('../../src/domain/screenLines');
const intro = require('../../src/domain/intro');
const copilot = require('../../src/ai/copilot');

const PERSONAS = ['D-NEW', 'D-001', 'D-002', 'D-003', 'D-017', 'D-050', 'D-033'];
const NEW_TYPES = ['weekplan', 'day', 'comeback', 'food', 'prep'];
const FILE = path.join(__dirname, 'baseline.json');
// The clock script: a few hours, then days, then weeks
const SCRIPT = [1, 1, 1, 1, 4, 4, 4, 4, 4, 4, 28, 28, 28, 28];
const QUESTIONS = ['what are my results', 'how is my bp', 'when can i donate', 'what has my blood done', 'tell me about my cover', 'how is my iron'];

// Card and memory ids carry a per-boot prefix ("c1x9z-12"); keep only their order
function normalise(value) {
  const ids = new Map();
  return JSON.parse(JSON.stringify(value).replace(/\b([a-z]{1,2})[0-9a-z]{4}-(\d+)\b/g, (m, p) => {
    if (!ids.has(m)) ids.set(m, `${p}#${ids.size + 1}`);
    return ids.get(m);
  }));
}

function stop(donorId) {
  const v = drop.view(donorId);
  const st = drop._state(donorId);
  const donor = store.getDonor(donorId);
  const out = {
    clock: store.clock(),
    view: { language: v.language, memory: v.memory, plan: v.plan, goals: v.goals, keepAnEye: v.keepAnEye, readings: v.readings, bookings: v.bookings, donate: v.donate, budget: v.budget },
    cards: st.cards.filter((c) => !NEW_TYPES.includes(c.type)).map((c) => ({
      type: c.type, variant: c.variant, status: c.status, createdOn: c.createdOn, counted: Boolean(c.counted), urgent: Boolean(c.urgent),
      receipt: c.receipt || null, snoozes: c.snoozes || 0,
      // A report's opening line counts its slides ("My week, in 3 taps"); its existing slides are compared one by one below
      text: c.status === 'open' ? drop.words(st, c).text.replace(/, in \d+ taps?\./, ', in N taps.') : null,
      slides: c.type === 'report' ? c.data.slides.slice(0, c.data.slides.length - (c.data.extraSlides || 0)) : null,
    })),
    events: st.events.map((e) => ({ key: e.key, kind: e.kind, status: e.status, at: e.at })),
    sent: { day: st.sentByDay, week: st.sentByWeek },
    // "Weekly report sent: 3 slides" counts the added slides too; the slides themselves are compared above
    log: st.log.filter((l) => !l.wb).map((l) => `${l.at} ${l.text}`.replace(/report sent: \d+ slides/, 'report sent: N slides')),
  };
  if (!donor.newUser) {
    out.findings = health.findings(donorId);
    out.eligibility = health.eligibility(donorId);
    out.score = health.currentScore(donorId);
    out.keepAnEye = goals.keepAnEye(donorId);
    out.cover = cover.evaluate(donorId);
    out.badges = badges(donorId).map((b) => ({ id: b.id, earned: b.earned }));
    out.impact = impact.summarise(impact.donorJourneys(donorId));
  }
  out.lines = Object.keys(screenLines.SCREENS).map((s) => { try { return screenLines.line(donorId, s).text; } catch (e) { return `error: ${e.message}`; } });
  out.intro = intro.status(donorId);
  return out;
}

function capture() {
  const result = {};
  for (const donorId of PERSONAS) {
    store.resetDemo();
    const stops = [stop(donorId)];
    for (const parts of SCRIPT) {
      for (let i = 0; i < parts; i += 1) store.stepClock();
      stops.push(stop(donorId));
    }
    store.resetDemo();
    const next = [];
    for (let i = 0; i < 4; i += 1) next.push(drop.nextEvent(donorId));
    store.resetDemo();
    const answers = QUESTIONS.map((q) => { const r = copilot.fallback(donorId, q); return { q, reply: r.reply, actions: r.actions }; });
    result[donorId] = { stops, next, answers };
  }
  store.resetDemo();
  return normalise(result);
}

module.exports = { capture, FILE, PERSONAS, normalise, NEW_TYPES };

if (require.main === module && process.argv.includes('--write')) {
  const out = process.env.GOLDEN_OUT || FILE;
  fs.writeFileSync(out, JSON.stringify(capture(), null, 1));
  console.log(`Wrote ${out}`);
}
