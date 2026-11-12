/**
 * Donor API. Every route is scoped to one donor; responses use
 * { success, data } and never include recipient identities or other donors'
 * health data.
 */

const express = require('express');
const store = require('../data/store');
const health = require('../domain/health');
const cover = require('../domain/cover');
const impact = require('../domain/impact');
const { badges } = require('../domain/badges');
const community = require('../domain/community');
const donation = require('../domain/donation');
const booking = require('../booking/service');
const settings = require('../auth/userSettings');
const llm = require('../ai/llm');
const copilot = require('../ai/copilot');
const labReader = require('../ai/labReader');
const concerns = require('../domain/concerns');
const insights = require('../ai/insights');
const intro = require('../domain/intro');
const chatCycles = require('../domain/chatCycles');
const { componentStory } = require('../domain/story');

const router = express.Router();

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, status, error) => res.status(status).json({ success: false, error });

/** Run an AI feature; if AI is unavailable, use the deterministic fallback. */
async function withFallback(res, aiFn, fallbackFn) {
  try {
    return ok(res, await aiFn());
  } catch (error) {
    if (error instanceof llm.LLMUnavailable && fallbackFn) {
      return ok(res, { ...(await fallbackFn()), aiUnavailable: error.message });
    }
    console.error(error);
    return fail(res, error instanceof llm.LLMUnavailable ? 503 : 400, error.message);
  }
}

router.get('/', (req, res) => {
  // The New donor (a new user with no records) comes first; the rest are the demo Personas
  const personas = ['D-NEW', 'D-001', 'D-002', 'D-003', 'D-017', 'D-050', 'D-033'];
  ok(res, personas.map((id) => {
    const d = store.getDonor(id);
    return { id, name: d.name, bloodGroup: d.bloodGroup, language: d.language, newUser: Boolean(d.newUser) };
  }));
});

router.param('donorId', (req, res, next, donorId) => {
  req.donor = store.getDonor(donorId);
  if (!req.donor) return fail(res, 404, `Donor ${donorId} not found`);
  return next();
});

/** Everything the home screen needs in one call. */
router.get('/:donorId/overview', (req, res) => {
  const id = req.donor.id;
  const visits = store.getDonations(id);
  const journeys = impact.donorJourneys(id);
  const scores = health.scoreHistory(id);
  const currentScore = health.currentScore(id);
  const c = cover.evaluate(id);
  ok(res, {
    donor: { ...req.donor, policyId: undefined },
    today: store.today(),
    donations: { completed: visits.filter((v) => v.status === 'completed').length, deferred: visits.filter((v) => v.status === 'deferred').length,
      firstDate: visits.length ? visits[0].date : null, litres: Number((visits.filter((v) => v.status === 'completed').reduce((s, v) => s + v.volumeMl, 0) / 1000).toFixed(2)) },
    impact: impact.summarise(journeys),
    latestJourney: journeys.filter((j) => j.recipient).slice(-1)[0] || null,
    health: { score: currentScore?.score ?? null, previousScore: scores.length > 1 ? scores[scores.length - 2].score : null,
      findings: health.findings(id).map(({ id: fid, title, severity, detail }) => ({ id: fid, title, severity, detail })) },
    eligibility: health.eligibility(id),
    // null until an insurer is linked (the New donor)
    cover: c.linked ? { base: c.baseCover, current: c.currentCover, eligible: c.eligibleCover, next: c.nextStep, pointsToNext: c.pointsToNextStep, blockedBy: c.blockedBy } : null,
    communities: community.forDonor(id).map(({ id: cid, name, kind, memberCount, notCounted, totals }) => ({ id: cid, name, kind, memberCount, notCounted, totals })),
    ai: llm.status(),
    badges: badges(id),
    newBadges: require('../domain/drop').newBadges(id).map((b) => b.id),
  });
});

router.get('/:donorId/donations', (req, res) => ok(res, store.getDonations(req.donor.id).map((v) => ({
  ...v, centre: store.centre(v.centreId).name, confidentialFollowUp: undefined,
}))));

router.get('/:donorId/impact', (req, res) => {
  const journeys = impact.donorJourneys(req.donor.id);
  ok(res, { summary: impact.summarise(journeys), journeys, components: impact.COMPONENTS, k: impact.K_ANON, badges: badges(req.donor.id), newBadges: require('../domain/drop').newBadges(req.donor.id).map((b) => b.id) });
});

router.get('/:donorId/stakeholders', (req, res) => ok(res, impact.stakeholders(req.donor.id)));

router.get('/:donorId/health', (req, res) => {
  const id = req.donor.id;
  const labs = health.labSeries(id);
  ok(res, {
    findings: health.findings(id),
    scores: health.scoreHistory(id),
    currentScore: health.currentScore(id),
    vitals: health.vitalsSeries(id),
    labs: Object.fromEntries(Object.entries(labs).map(([k, list]) => [k, list.map(({ id, date, value, unit, low, high, name, source }) => ({ id, date, value, unit, low, high, name, source }))])),
    eligibility: health.eligibility(id),
    // No height or weight on record yet (the New donor): no BMI
    bmi: req.donor.heightCm && health.vitalsSeries(id).length ? Number(health.bmi(req.donor, health.vitalsSeries(id).slice(-1)[0].weightKg || 60).toFixed(1)) : null,
  });
});

// demo: in the demo no insurer receives anything, and the Cover page says so
router.get('/:donorId/cover', (req, res) => ok(res, { ...cover.evaluate(req.donor.id), demo: require('./demo').enabled() }));
router.get('/:donorId/cover/simulate', (req, res) => {
  try {
    ok(res, cover.simulate(req.donor.id, Number(req.query.score)));
  } catch (error) {
    fail(res, 400, error.message);
  }
});

router.get('/:donorId/communities', (req, res) => ok(res, community.forDonor(req.donor.id)));

// The donor's Choices (CONTEXT.md): read here, changed with PATCH from any screen
router.get('/:donorId/consent', (req, res) => ok(res, req.donor.consent));

router.patch('/:donorId/consent', (req, res) => {
  const allowed = ['shareHealthWithInsurer', 'showOnLeaderboard', 'includeInCommunityStats'];
  for (const key of allowed) if (typeof req.body[key] === 'boolean') req.donor.consent[key] = req.body[key];
  ok(res, req.donor.consent);
});

// ---- Donation flow
router.get('/:donorId/slots', (req, res) => ok(res, donation.slots(req.donor.id)));
router.post('/:donorId/booking/recommend', async (req, res) => {
  try {
    const body = req.body || {};
    ok(res, await booking.availability(req.user, req.donor.id, body.preferences, body.accessToken));
  } catch (error) {
    fail(res, error.status || 400, error.message);
  }
});
router.post('/:donorId/appointments', async (req, res) => {
  try {
    ok(res, await booking.confirm(req.user, req.donor, req.body || {}));
  } catch (error) {
    fail(res, error.status || 400, error.message);
  }
});
router.post('/:donorId/appointments/:appointmentId/cancel', async (req, res) => {
  try {
    ok(res, await booking.cancel(req.user, req.donor.id, req.params.appointmentId, req.body && req.body.accessToken));
  } catch (error) {
    fail(res, error.status || 400, error.message);
  }
});
router.get('/:donorId/appointments', async (req, res) => {
  try {
    const rows = await settings.listAppointments(req.user, req.donor.id);
    store.session.appointments.set(req.donor.id, rows);
    ok(res, rows.map(booking.withCheckIn));
  } catch (error) {
    fail(res, error.status || 400, error.message);
  }
});
router.post('/:donorId/appointments/:appointmentId/checkin', async (req, res) => {
  try {
    // A donor-triggered demo simulation, not staff authentication or proof of
    // a scanned pass. Resolve only this account's appointments before writing.
    const rows = await settings.listAppointments(req.user, req.donor.id);
    const appointment = rows.find((a) => a.id === req.params.appointmentId);
    if (!appointment) return fail(res, 400, 'Appointment not found');
    const prepared = donation.prepareCheckIn(req.donor.id, appointment.id, req.body, [appointment]);
    await settings.saveAppointment(req.user, { ...appointment, status: prepared.status });
    ok(res, donation.applyCheckIn(req.donor.id, appointment.id, prepared));
  } catch (error) {
    fail(res, error.status || 400, error.message);
  }
});

// ---- GenAI / agentic features
router.get('/:donorId/chat/active', (req, res) => {
  const chat = typeof req.query.chat === 'string' ? req.query.chat.slice(0, 40) : 'general';
  ok(res, chatCycles.activeChat(req.user, req.donor.id, chat));
});

router.get('/:donorId/chat/current-cycle', (req, res) => {
  ok(res, chatCycles.currentCycle(req.user, req.donor.id));
});

router.get('/:donorId/chat/cycles', (req, res) => {
  ok(res, { cycles: chatCycles.listPast(req.user, req.donor.id) });
});

router.get('/:donorId/chat/cycles/:cycleId', (req, res) => {
  const c = chatCycles.getPast(req.user, req.donor.id, req.params.cycleId);
  if (!c) return fail(res, 404, 'Cycle not found');
  ok(res, c);
});

router.post('/:donorId/copilot', async (req, res) => {
  const { message, history, chat } = req.body;
  if (!message || typeof message !== 'string') return fail(res, 400, 'message is required');
  const userName = req.user && !req.user.local && !req.user.guest ? req.user.name : null;
  const id = req.donor.id;
  // A question asked during the Intro is kept with it ("Intro · finished … · the questions you asked")
  const keep = (reply) => { intro.noteQuestion(id, message, reply && reply.reply); return reply; };
  return withFallback(res, async () => keep(await copilot.chat({ user: req.user, donorId: id, history, message: message.slice(0, 2000), userName, chat: typeof chat === 'string' ? chat.slice(0, 40) : 'general' })), () => keep(copilot.fallback(id, message)));
});

router.post('/:donorId/labs/extract', (req, res) => {
  const { text, image } = req.body;
  if (!text && !image) return fail(res, 400, 'Provide report text or an image');
  return withFallback(res, () => labReader.extract({ donorId: req.donor.id, text, image }), null);
});

router.post('/:donorId/labs/save', (req, res) => {
  try {
    ok(res, labReader.save(req.donor.id, req.body));
  } catch (error) {
    fail(res, 400, error.message);
  }
});

/** Values read from lab report photos (the photos are not kept); a Drop reading's own value is listed with the readings. */
function uploadedValues(donorId) {
  const fromReadings = new Set(require('../domain/drop').view(donorId).readings.map((r) => r.observationId).filter(Boolean));
  return store.getObservations(donorId).filter((o) => o.source === 'uploaded_report' && !fromReadings.has(o.id))
    .map(({ id, name, value, unit, date, labId }) => ({ id, name, value, unit, date, lab: labId }));
}
router.get('/:donorId/labs/uploaded', (req, res) => ok(res, uploadedValues(req.donor.id)));
router.delete('/:donorId/labs/:observationId', (req, res) => {
  if (!uploadedValues(req.donor.id).some((o) => o.id === req.params.observationId)) return fail(res, 404, 'No value read from a lab report with that id');
  store.removeObservation(req.donor.id, req.params.observationId);
  return ok(res, uploadedValues(req.donor.id));
});

router.get('/:donorId/impact/:componentId/story', (req, res) => {
  const story = componentStory(req.donor.id, req.params.componentId);
  return story ? ok(res, story) : fail(res, 404, 'This unit has no Story');
});

router.get('/:donorId/concerns', (req, res) => ok(res, concerns.list(req.donor.id)));
router.post('/:donorId/concerns', (req, res) => {
  try {
    ok(res, concerns.raise(req.donor.id, req.body || {}));
  } catch (error) {
    fail(res, 400, error.message);
  }
});
router.post('/:donorId/concerns/:concernId/:action(escalate|resolve)', (req, res) => {
  try {
    ok(res, concerns[req.params.action](req.donor.id, req.params.concernId));
  } catch (error) {
    fail(res, 400, error.message);
  }
});

router.get('/:donorId/insights', (req, res) => withFallback(res, () => insights.forDonor(req.donor.id), () => insights.fallback(req.donor.id)));

module.exports = router;
