/**
 * Between-donation API: the Progress screen, Connected apps, Food profile, Week
 * plans, Your day, Cycle reports and "Why this?". Scoped to one donor like every
 * other route; the rules live in domain/ (wellbeing.js is the entry point).
 * Live accounts (Habitify, Microsoft To Do): the key or token arrives in
 * X-Connector-Token on each request and is never stored or logged.
 */

const express = require('express');
const store = require('../data/store');
const drop = require('../domain/drop');
const wellbeing = require('../domain/wellbeing');
const integrations = require('../integrations');
const habitify = require('../integrations/habitify');
const msTodo = require('../integrations/msTodo');

const router = express.Router({ mergeParams: true });
const { foodCoach, weekPlan, cycle, coaching, state } = wellbeing;

const ok = (res, data) => res.json({ success: true, data });

router.use((req, res, next) => {
  if (!store.getDonor(req.params.donorId)) return res.status(404).json({ success: false, error: `Donor ${req.params.donorId} not found` });
  return next();
});

/** Rule violations and connector failures come back as 400 with the reason, like Drop's routes. */
const act = (fn) => async (req, res) => {
  try {
    ok(res, await fn(req.params.donorId, req));
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
const token = (req) => String(req.get('X-Connector-Token') || '').trim();
const withViews = (donorId) => ({ summary: wellbeing.summary(donorId), drop: drop.view(donorId) });

router.get('/', act((donorId) => wellbeing.summary(donorId)));
router.get('/marker/:marker', act((donorId, req) => wellbeing.marker(donorId, req.params.marker)));
router.get('/signals/:signal', act((donorId, req) => wellbeing.signalSeries(donorId, req.params.signal, Math.min(366, Number(req.query.days) || 56))));

/* Connected apps */
router.get('/apps', act((donorId) => ({ ...integrations.catalogue(), connections: wellbeing.summary(donorId).connections })));
router.post('/apps', act(async (donorId, req) => { await wellbeing.connect(donorId, String(req.body.provider || ''), { consentedTypes: req.body.consentedTypes, writeBack: req.body.writeBack }); return withViews(donorId); }));
router.patch('/apps/:connId', act((donorId, req) => { wellbeing.updateConnection(donorId, req.params.connId, req.body || {}); return withViews(donorId); }));
router.post('/apps/:connId/sync', act(async (donorId, req) => { await wellbeing.sync(donorId, req.params.connId); return withViews(donorId); }));
router.delete('/apps/:connId', act((donorId, req) => { wellbeing.disconnect(donorId, req.params.connId); return withViews(donorId); }));

/* Live accounts: shown to this session only, nothing stored */
router.post('/live/habitify', act((donorId, req) => habitify.habits(token(req), store.today())));
router.post('/live/habitify/log', act((donorId, req) => habitify.addLog(token(req), String(req.body.habitId || ''), store.today())));
router.post('/live/todo/plan', act((donorId, req) => {
  const plan = weekPlan.view(state(donorId));
  if (!plan || !plan.items.length) throw new Error('Save a Week plan first');
  return msTodo.addPlan(token(req), plan.items.filter((i) => !i.setAside), store.today());
}));
router.get('/live/todo/completed', act((donorId, req) => msTodo.completed(token(req))));

/* Food profile and foods */
router.get('/food-profile', act((donorId) => ({ profile: foodCoach.profile(state(donorId)), fields: foodCoach.FIELDS })));
router.put('/food-profile', act((donorId, req) => { foodCoach.setProfile(state(donorId), req.body || {}); drop._log(donorId, 'Food profile saved (chosen by you; never shared).'); return withViews(donorId); }));
router.delete('/food-profile', act((donorId) => { foodCoach.clearProfile(state(donorId)); return withViews(donorId); }));
router.get('/plan', act((donorId) => wellbeing.improvements.plan(state(donorId))));
router.post('/plan/add-to-week', act((donorId) => { wellbeing.addPlanToWeek(donorId); return withViews(donorId); }));
router.get('/foods', act((donorId, req) => foodCoach.suggest(state(donorId), String(req.query.marker || 'iron'), { maxCost: Number(req.query.maxCost) || undefined })));

/* Week plans and Your day */
router.post('/week-plan/offer', act((donorId, req) => wellbeing.offerWeekPlan(donorId, String(req.body.habit || 'movement'))));
router.post('/week-plan/simplify', act((donorId) => { const r = weekPlan.simplify(state(donorId)); drop._log(donorId, `Simplify my plan: kept one item smaller, set ${r.setAside.length} aside.`); return withViews(donorId); }));
router.post('/week-plan/items/:itemId/bring-back', act((donorId, req) => { weekPlan.bringBack(state(donorId), req.params.itemId); return withViews(donorId); }));
router.post('/week-plan/items/:itemId/log', act((donorId, req) => {
  const s = req.body.state === 'skipped' ? 'skipped' : 'done';
  weekPlan.log(state(donorId), req.params.itemId, store.today(), s, req.body.barrier);
  return withViews(donorId);
}));
router.delete('/week-plan', act((donorId) => { weekPlan.remove(state(donorId)); return withViews(donorId); }));
router.post('/day', act((donorId, req) => { weekPlan.setDay(state(donorId), String(req.body.time || '21:00')); return withViews(donorId); }));
router.delete('/day', act((donorId) => { weekPlan.clearDay(state(donorId)); return withViews(donorId); }));

/* Cycle reports and explanations */
router.get('/cycle-reports', act((donorId) => cycle.reports(state(donorId))));
router.get('/cycle-reports/:visitId', act((donorId, req) => cycle.report(state(donorId), req.params.visitId)));
router.post('/cycle-reports/:visitId/seen', act((donorId, req) => {
  const seen = wellbeing.signals.ensure(state(donorId)).reportsSeen;
  if (!seen.includes(req.params.visitId)) seen.push(req.params.visitId);
  return wellbeing.summary(donorId);
}));
router.get('/explain/:recId', act((donorId, req) => coaching.explanationFor(state(donorId), req.params.recId)));

/* Your data */
router.get('/export', act((donorId) => wellbeing.exportData(donorId)));
router.get('/fhir/:visitId', act((donorId, req) => wellbeing.fhirBundle(donorId, req.params.visitId)));
router.delete('/signals', act((donorId) => { wellbeing.deleteSignals(donorId); drop._log(donorId, 'Deleted all connected-app data.'); return withViews(donorId); }));
router.delete('/habit-data', act((donorId) => { wellbeing.deleteHabitData(donorId); drop._log(donorId, 'Deleted Week plans, Your day and barriers.'); return withViews(donorId); }));

module.exports = router;
