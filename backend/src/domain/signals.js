/**
 * Signals: what the Donor's connected apps recorded, one value per signal per
 * day (CONTEXT.md: Signal, Connection). The only way data comes in, so consent
 * is checked here: a data type the Donor didn't allow is never read.
 *
 * Kept inside the Persona's Drop state (st.wb), so a demo Reset clears it and
 * Drop's Undo covers it. Live accounts never write here (integrations/index.js).
 */

const store = require('../data/store');
const demo = require('../integrations/demo');
const { PROVIDERS, provider } = require('../integrations');
const { range, addDays } = require('./dates');

// When two sources give the same signal for a day, the first in this list wins
const PRECEDENCE = ['you', 'device', 'app'];
const sourceOf = (p) => (p.kind === 'wearable' ? 'device' : 'app');

/** The between-donation part of a Persona's Drop state, created on first use. */
function ensure(st) {
  if (!st.wb) {
    st.wb = {
      connections: [], overlays: [], synced: {}, weekPlan: null, planLog: {}, day: null, foodProfile: null,
      barriers: [], adjustments: [], coachSent: {}, keys: {}, reportsSeen: [], redFlags: [], aiSummaries: true, seq: 1, foodSeen: {},
    };
  }
  return st.wb;
}

/** True once the Donor has used any between-donation feature; until then nothing new reaches their Cards. */
function active(st) {
  const w = ensure(st);
  return Boolean(w.connections.length || w.weekPlan || w.foodProfile || w.day);
}

const nextId = (st, prefix) => `${prefix}-${ensure(st).seq++}`;

function connect(st, providerId, { consentedTypes, writeBack = false, extra = {} } = {}) {
  const p = provider(providerId);
  if (p.mode === 'live') throw new Error(`${p.label} connects from this browser; nothing is stored for it`);
  const w = ensure(st);
  const types = (consentedTypes || p.dataTypes).filter((t) => p.dataTypes.includes(t));
  const existing = w.connections.find((c) => c.provider === providerId);
  const conn = existing || { id: `cn-${providerId}`, provider: providerId };
  Object.assign(conn, { label: p.label, kind: p.kind, mode: p.mode, status: 'connected', consentedTypes: types, writeBack: Boolean(writeBack && p.canWrite), connectedOn: store.today(), lastSync: store.today(), ...extra });
  if (!existing) w.connections.push(conn);
  return conn;
}

function update(st, connId, { consentedTypes, writeBack }) {
  const conn = ensure(st).connections.find((c) => c.id === connId);
  if (!conn) throw new Error('That app is not connected');
  const p = PROVIDERS[conn.provider];
  if (consentedTypes) {
    conn.consentedTypes = consentedTypes.filter((t) => p.dataTypes.includes(t));
    // Data a Donor stops sharing is deleted, not just hidden
    for (const t of Object.keys(ensure(st).synced[connId] || {})) if (!conn.consentedTypes.includes(t)) delete ensure(st).synced[connId][t];
  }
  if (writeBack !== undefined) conn.writeBack = Boolean(writeBack && p.canWrite);
  return conn;
}

/** Disconnect & delete: the connection and everything read through it. */
function disconnect(st, connId) {
  const w = ensure(st);
  w.connections = w.connections.filter((c) => c.id !== connId);
  delete w.synced[connId];
  if (w.weekPlan) w.weekPlan.items.forEach((i) => { if (i.sync && i.sync.connectionId === connId) i.sync = null; });
}

/** Signals a sandbox connector synced: [{ date, signal, value }], dropped unless consented. */
function ingest(st, connId, list) {
  const conn = ensure(st).connections.find((c) => c.id === connId);
  if (!conn) throw new Error('That app is not connected');
  const box = (ensure(st).synced[connId] = ensure(st).synced[connId] || {});
  let kept = 0;
  for (const s of list) {
    if (!conn.consentedTypes.includes(s.signal)) continue;
    (box[s.signal] = box[s.signal] || {})[s.date] = s.value;
    kept += 1;
  }
  conn.lastSync = store.today();
  return kept;
}

function connectionsFor(st, signal) {
  return ensure(st).connections.filter((c) => c.status === 'connected' && c.consentedTypes.includes(signal))
    .sort((a, b) => PRECEDENCE.indexOf(sourceOf(PROVIDERS[a.provider])) - PRECEDENCE.indexOf(sourceOf(PROVIDERS[b.provider])));
}

const activityMinutes = () => require('./drop').activityMinutes; // drop.js loads this module, so look it up when used

/** One day's value from the best source, or null. */
function valueOn(st, signal, date) {
  for (const c of connectionsFor(st, signal)) {
    const v = c.mode === 'sandbox'
      ? ensure(st).synced[c.id]?.[signal]?.[date] ?? null
      : demo.value(st.donorId, signal, date, { overlays: ensure(st).overlays, activityMinutes: activityMinutes() });
    if (v !== null && v !== undefined) return { date, value: v, source: sourceOf(PROVIDERS[c.provider]), app: c.label, mode: c.mode };
  }
  return null;
}

/** Daily values from `from` to `to` (inclusive), skipping days with no data. */
function daily(st, signal, from, to) {
  if (!connectionsFor(st, signal).length) return [];
  return range(from, to > store.today() ? store.today() : to).map((d) => valueOn(st, signal, d)).filter(Boolean);
}

/** A habit-app tick for one Week plan item on one day (demo habit apps), or null with no habit app. */
function habitDone(st, item, date) {
  const conn = item.sync && ensure(st).connections.find((c) => c.id === item.sync.connectionId && c.consentedTypes.includes('habit_done'));
  if (!conn) return null;
  if (date < (item.sync.since || '0000')) return null;
  return demo.value(st.donorId, 'habit_done', date, { overlays: ensure(st).overlays, ref: item.id });
}

const mean = (list) => (list.length ? list.reduce((s, x) => s + x.value, 0) / list.length : null);

/** Average of a signal over the `days` days ending `to`. */
function average(st, signal, to, days) {
  const list = daily(st, signal, addDays(to, -(days - 1)), to);
  return { value: mean(list), days: list.length, app: list[0]?.app || null };
}

function has(st, signal) { return connectionsFor(st, signal).length > 0; }

/** Which apps the Donor has connected, for Drop's explanations. */
const appsFor = (st, signal) => connectionsFor(st, signal).map((c) => c.label + (c.mode === 'demo' ? ' (demo)' : c.mode === 'sandbox' ? ' (sandbox)' : ''));

/** The Donor's Goals from their Drop state (safe while Drop is still creating that state). */
const goals = (st) => require('./goals').sync(st.goals, st.donorId);

module.exports = { goals, ensure, active, nextId, connect, update, disconnect, ingest, daily, valueOn, habitDone, average, mean, has, appsFor, PRECEDENCE };
