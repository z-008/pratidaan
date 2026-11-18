/**
 * Between donations: the facade the wellbeing routes and Drop's tools use.
 * One call for Home's tile and the Progress screen, the marker drawer, Connected
 * apps, the Food profile, Week plans and the demo's "Simulate a rough week".
 * Every function works on one Persona's Drop state; nothing here changes the
 * existing Cards, Goals, score, eligibility or cover.
 */

const store = require('../data/store');
const drop = require('./drop');
const signals = require('./signals');
const bands = require('./bands');
const careLevel = require('./careLevel');
const cycle = require('./cycle');
const links = require('./links');
const foodCoach = require('./foodCoach');
const weekPlan = require('./weekPlan');
const routine = require('./routine');
const habits = require('./habits');
const coaching = require('./coaching');
const integrations = require('../integrations');
const junction = require('../integrations/junction');
const ref = require('../data/reference');
const { addDays, weekStart } = require('./dates');

const state = (donorId) => drop._state(donorId);
const MARKER_FOCUS = { bp: 'bp', hb: 'iron', ferritin: 'iron', hba1c: 'sugar', ldl: 'lipids', tg: 'lipids', hdl: 'lipids' };

function connectionsView(st) {
  return signals.ensure(st).connections.map((c) => ({ id: c.id, provider: c.provider, label: c.label, kind: c.kind, mode: c.mode, consentedTypes: c.consentedTypes, writeBack: c.writeBack, connectedOn: c.connectedOn, lastSync: c.lastSync, dataTypes: integrations.PROVIDERS[c.provider].dataTypes }));
}

/** Everything Home's Between donations tile and the Progress screen need. */
function summary(donorId) {
  const st = state(donorId);
  const donor = store.getDonor(donorId);
  const w = signals.ensure(st);
  return {
    active: signals.active(st),
    newUser: Boolean(donor.newUser),
    cycle: cycle.current(donorId),
    focus: cycle.focus(st),
    bands: donor.newUser ? [] : bands.rows(donorId),
    careLevels: careLevel.all(donorId, st).map(({ marker, label, level, coaching: c, doctor, rule }) => ({ marker, label, level, coaching: c, doctor, rule })),
    connections: connectionsView(st),
    weekPlan: weekPlan.view(st),
    day: w.day,
    foodProfile: w.foodProfile ? { ...w.foodProfile, isDefault: false } : null,
    reports: cycle.reports(st),
    habits: donor.newUser ? [] : habits.view(st),
    goalSignals: donor.newUser ? [] : habits.goals(st),
    readiness: donor.newUser ? null : habits.readiness(st),
    unseenReport: signals.active(st) ? cycle.unseenReport(st) : null,
    week: {
      steps: signals.has(st, 'steps') ? Math.round(signals.average(st, 'steps', store.today(), 7).value || 0) : null,
      sleepHours: signals.has(st, 'sleep_min') ? Math.round(((signals.average(st, 'sleep_min', store.today(), 7).value || 0) / 60) * 10) / 10 : null,
      activeMinutes: signals.has(st, 'active_min') ? Math.round((signals.average(st, 'active_min', store.today(), 7).value || 0) * 7) : null,
      ironMg: signals.has(st, 'iron_mg') ? Math.round((signals.average(st, 'iron_mg', store.today(), 7).value || 0) * 10) / 10 : null,
    },
  };
}

/** The Progress drawer for one marker: its history with linked signals, the care level, foods and explanation. */
function marker(donorId, m) {
  const st = state(donorId);
  const def = ref.bands().markers[m];
  if (!def) throw new Error(`No marker ${m}`);
  const focusKey = MARKER_FOCUS[m];
  const food = ['iron', 'bp', 'sugar', 'lipids'].includes(focusKey) ? foodCoach.suggest(st, focusKey) : null;
  return {
    marker: m, label: def.label, unit: def.unit, bands: def.bands.map(({ id, label, source }) => ({ id, label, source })),
    row: bands.rows(donorId).find((r) => r.marker === m) || null,
    history: links.history(st, m),
    signalLabels: Object.fromEntries(Object.entries(ref.markerSignals().signals).map(([k, v]) => [k, v.label])),
    food,
  };
}

/** One day of a signal over the last N days, for Progress charts. */
function signalSeries(donorId, signal, days = 56) {
  const st = state(donorId);
  const today = store.today();
  return { signal, label: ref.markerSignals().signals[signal]?.label || signal, points: signals.daily(st, signal, addDays(today, -(days - 1)), today).map(({ date, value, app, mode }) => ({ date, value, app, mode })) };
}

async function connect(donorId, providerId, opts = {}) {
  const st = state(donorId);
  const p = integrations.provider(providerId);
  if (p.mode === 'sandbox') {
    if (!junction.configured()) throw new Error('The Junction sandbox is not configured on this server (JUNCTION_API_KEY). Use the demo apps instead.');
    const { userId } = await junction.connect(donorId);
    const conn = signals.connect(st, providerId, { ...opts, extra: { junctionUserId: userId } });
    const list = await junction.sync(userId, addDays(store.today(), -27), store.today());
    signals.ingest(st, conn.id, list);
    drop._log(donorId, `Connected ${p.label}: ${list.length} values from the Junction sandbox API.`);
    return conn;
  }
  const conn = signals.connect(st, providerId, opts);
  drop._log(donorId, `Connected ${p.label} (demo): ${conn.consentedTypes.join(', ')}.`);
  return conn;
}

async function sync(donorId, connId) {
  const st = state(donorId);
  const conn = signals.ensure(st).connections.find((c) => c.id === connId);
  if (!conn) throw new Error('That app is not connected');
  if (conn.mode === 'sandbox') signals.ingest(st, conn.id, await junction.sync(conn.junctionUserId, addDays(store.today(), -27), store.today()));
  conn.lastSync = store.today();
  return conn;
}

function updateConnection(donorId, connId, body) { return signals.update(state(donorId), connId, body); }

function disconnect(donorId, connId) {
  const st = state(donorId);
  const conn = signals.ensure(st).connections.find((c) => c.id === connId);
  signals.disconnect(st, connId);
  if (conn) drop._log(donorId, `Disconnected ${conn.label}; its data was deleted.`);
}

/** Opens a Week plan Card for one Habit (a Card the Donor asked for: outside the budget). */
function offerWeekPlan(donorId, habit) {
  const st = state(donorId);
  const { items, note } = weekPlan.suggest(st, habit);
  const card = drop._pushCard(donorId, 'weekplan', 'offer', { habit, items, note });
  drop._log(donorId, `Offered a ${habit} Week plan from the chat or Habits (outside the budget).`);
  return { cardId: card.id, view: drop.view(donorId) };
}

/**
 * Demo: the next 7 days become a rough week (fewer steps, short sleep, habits skipped, and the barrier from the
 * Persona's storyline as their habit app's skip note), then the clock runs until Drop offers a lighter week (max 8 days).
 */
function roughWeek(donorId) {
  const st = state(donorId);
  if (!signals.active(st)) throw new Error('Connect an app or make a Week plan first: Drop needs something to notice');
  const w = signals.ensure(st);
  const today = store.today();
  const s = require('../integrations/demo').storyline(donorId);
  const from = addDays(today, 1);
  w.overlays.push({ from, to: addDays(today, 7), ...s.rough });
  if (w.connections.some((c) => c.kind === 'habit') && w.weekPlan) {
    for (let i = 1; i <= 7; i += 1) for (const item of w.weekPlan.items) if (i % 2) w.barriers.push({ date: addDays(today, i), code: s.rough.barrier, itemId: item.id, source: 'app' });
  }
  const before = st.cards.filter((c) => c.type === 'comeback').length;
  for (let i = 0; i < 4 * 8; i += 1) {
    store.stepClock();
    if (st.cards.filter((c) => c.type === 'comeback').length > before) break;
  }
  return store.clock();
}

/** Everything kept for this Persona between donations, for Download my data. */
function exportData(donorId) {
  const st = state(donorId);
  const w = signals.ensure(st);
  const today = store.today();
  const from = addDays(today, -89);
  const data = {};
  for (const s of ['steps', 'active_min', 'sleep_min', 'rhr_bpm', 'iron_mg', 'water_ml']) {
    const list = signals.daily(st, s, from, today);
    if (list.length) data[s] = list.map(({ date, value, app }) => ({ date, value, app }));
  }
  return {
    exportedOn: today, donorId, note: 'Demo data: synthetic Persona, demo apps.',
    connections: connectionsView(st), signals: data, weekPlan: w.weekPlan, planLog: w.planLog, yourDay: w.day,
    foodProfile: w.foodProfile, barriers: w.barriers, adjustments: w.adjustments,
  };
}

function deleteSignals(donorId) {
  const st = state(donorId);
  for (const c of [...signals.ensure(st).connections]) signals.disconnect(st, c.id);
  signals.ensure(st).overlays = [];
}

function deleteHabitData(donorId) {
  const st = state(donorId);
  const w = signals.ensure(st);
  w.weekPlan = null; w.planLog = {}; w.barriers = []; w.adjustments = []; w.day = null;
}

module.exports = {
  state, summary, marker, signalSeries, connect, sync, updateConnection, disconnect, offerWeekPlan, roughWeek, exportData, deleteSignals, deleteHabitData,
  foodCoach, weekPlan, cycle, coaching, routine, careLevel, signals, habits, weekStart,
};

/** One donation's lab panel as a FHIR R4 Bundle (DiagnosticReport + Observations, LOINC-coded), for Download as FHIR. */
function fhirBundle(donorId, visitId) {
  const visit = store.getDonations(donorId).find((v) => v.id === visitId);
  if (!visit) throw new Error('No such donation');
  const obs = store.getObservations(donorId).filter((o) => o.visitId === visitId);
  if (!obs.length) throw new Error('No results for that donation yet');
  const patient = { reference: `Patient/${donorId}` };
  const observations = obs.map((o) => ({
    resourceType: 'Observation', id: o.id, status: 'final', subject: patient, effectiveDateTime: o.date,
    code: { coding: [{ system: 'http://loinc.org', code: o.code, display: o.name }], text: o.name },
    valueQuantity: { value: o.value, unit: o.unit, system: 'http://unitsofmeasure.org' },
    ...(o.low !== null && o.low !== undefined ? { referenceRange: [{ low: { value: o.low, unit: o.unit }, ...(o.high ? { high: { value: o.high, unit: o.unit } } : {}) }] } : {}),
  }));
  const report = {
    resourceType: 'DiagnosticReport', id: `DR-${visitId}`, status: 'final', subject: patient, effectiveDateTime: visit.date,
    code: { text: 'Blood donation free health check (lab panel)' }, result: observations.map((o) => ({ reference: `Observation/${o.id}` })),
    conclusion: 'Synthetic demo data from Pratidaan. Not a medical record.',
  };
  return { resourceType: 'Bundle', type: 'collection', timestamp: `${store.today()}T00:00:00Z`, entry: [report, ...observations].map((resource) => ({ resource })) };
}

module.exports.fhirBundle = fhirBundle;
