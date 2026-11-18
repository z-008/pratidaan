/**
 * Habitify, the Donor's own account (live). The API key is pasted in the page,
 * sent with each request in X-Connector-Token and never stored or logged here.
 * API: https://docs.habitify.me (v2 reads; v1 adds a log).
 */

const V2 = 'https://api.habitify.me/v2';
const V1 = 'https://api.habitify.me';

async function call(url, key, init = {}) {
  if (!key) throw new Error('Paste your Habitify API key first');
  const response = await fetch(url, {
    ...init,
    headers: { 'X-API-Key': key, Authorization: key, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Habitify ${response.status}: ${data.message || 'request failed'}`);
  return data;
}

/** The Donor's habits with how many of the last 7 days each was done. */
async function habits(key, today) {
  const list = await call(`${V2}/habits`, key);
  const items = list.data || list.habits || [];
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 864e5).toISOString().slice(0, 10);
  const withLogs = await Promise.all(items.slice(0, 12).map(async (h) => {
    const logs = await call(`${V2}/habits/${encodeURIComponent(h.id)}/logs?limit=50`, key).catch(() => ({ data: [] }));
    const days = new Set((logs.data || []).map((l) => String(l.date).slice(0, 10)).filter((d) => d >= from && d <= today));
    return { id: h.id, name: h.name || h.title, daysThisWeek: days.size };
  }));
  return withLogs;
}

/** Tick a habit for a date (v1 logs API). */
async function addLog(key, habitId, date, value = 1) {
  return call(`${V1}/logs/${encodeURIComponent(habitId)}`, key, { method: 'POST', body: JSON.stringify({ unit_type: 'rep', value, target_date: `${date}T12:00:00+05:30` }) });
}

module.exports = { habits, addLog };
