/**
 * Junction (formerly Vital) sandbox: a real wearable-aggregator API that returns
 * generated data from "demo connections" (Fitbit, Oura, Apple HealthKit), so the
 * integration can be shown working without a physical device. Server-side key
 * only (JUNCTION_API_KEY); nothing here runs without it.
 * Docs: https://docs.junction.com (sandbox: api.sandbox.<region>.junction.com).
 */

const BASE = () => process.env.JUNCTION_BASE_URL || `https://api.sandbox.${process.env.JUNCTION_REGION || 'us'}.junction.com`;

function configured() { return Boolean(process.env.JUNCTION_API_KEY); }

async function call(method, path, body) {
  if (!configured()) throw new Error('The Junction sandbox is not configured (JUNCTION_API_KEY).');
  const response = await fetch(`${BASE()}${path}`, {
    method,
    headers: { 'X-Vital-API-Key': process.env.JUNCTION_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Junction ${response.status}: ${data.detail || data.message || 'request failed'}`);
  return data;
}

/** Create a sandbox user and a demo Fitbit connection for this Persona. */
async function connect(donorId) {
  const user = await call('POST', '/v2/user', { client_user_id: `pratidaan-${donorId}-${Date.now().toString(36)}` });
  const userId = user.user_id || user.id;
  await call('POST', '/v2/link/connect/demo', { user_id: userId, provider: 'fitbit' });
  return { userId };
}

/** Daily steps, active minutes and sleep for a date range, as Signals. */
async function sync(userId, from, to) {
  const q = `start_date=${from}&end_date=${to}`;
  const [activity, sleep] = await Promise.all([
    call('GET', `/v2/summary/activity/${userId}?${q}`).catch(() => ({ activity: [] })),
    call('GET', `/v2/summary/sleep/${userId}?${q}`).catch(() => ({ sleep: [] })),
  ]);
  const out = [];
  for (const a of activity.activity || []) {
    const date = String(a.calendar_date || a.date || '').slice(0, 10);
    if (!date) continue;
    if (Number.isFinite(a.steps)) out.push({ date, signal: 'steps', value: Math.round(a.steps) });
    const active = (a.medium || 0) + (a.high || 0);
    if (active) out.push({ date, signal: 'active_min', value: Math.round(active / 60) });
  }
  for (const s of sleep.sleep || []) {
    const date = String(s.calendar_date || s.date || '').slice(0, 10);
    if (date && Number.isFinite(s.total)) out.push({ date, signal: 'sleep_min', value: Math.round(s.total / 60) });
  }
  return out;
}

module.exports = { configured, connect, sync };
