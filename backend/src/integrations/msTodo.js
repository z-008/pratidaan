/**
 * Microsoft To Do, the Donor's own account (live), through Microsoft Graph.
 * A separate consent from Calendar (scope Tasks.ReadWrite); the token stays in
 * the page and arrives per request, like the existing Calendar token.
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';
const LIST_NAME = 'Pratidaan';
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

async function call(token, method, path, body) {
  if (!token) throw new Error('Connect Microsoft To Do first');
  const response = await fetch(`${GRAPH}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Microsoft To Do ${response.status}: ${data.error?.message || 'request failed'}`);
  return data;
}

async function list(token) {
  const lists = await call(token, 'GET', '/me/todo/lists');
  return (lists.value || []).find((l) => l.displayName === LIST_NAME) || call(token, 'POST', '/me/todo/lists', { displayName: LIST_NAME });
}

/** Days of the week spread over a week for N sessions (3 → Mon, Wed, Fri). */
function spread(perWeek) {
  const plans = { 1: [1], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
  return (plans[Math.max(1, Math.min(7, perWeek || 7))]).map((d) => DAYS[d]);
}

/** Each Week plan item as a weekly recurring task in a "Pratidaan" list. */
async function addPlan(token, items, startDate) {
  const l = await list(token);
  const created = [];
  for (const item of items) {
    const task = await call(token, 'POST', `/me/todo/lists/${l.id}/tasks`, {
      title: item.text,
      body: { content: `From your Pratidaan Week plan${item.forText ? ` (${item.forText})` : ''}.`, contentType: 'text' },
      recurrence: { pattern: { type: 'weekly', interval: 1, daysOfWeek: spread(item.perWeek) }, range: { type: 'noEnd', startDate } },
    });
    created.push({ itemId: item.id, taskId: task.id, title: task.title });
  }
  return { list: l.displayName, created };
}

/** Tasks in the Pratidaan list completed in the last 7 days. */
async function completed(token) {
  const l = await list(token);
  const tasks = await call(token, 'GET', `/me/todo/lists/${l.id}/tasks?$filter=status eq 'completed'&$top=50`);
  return (tasks.value || []).map((t) => ({ title: t.title, completedOn: t.completedDateTime?.dateTime?.slice(0, 10) || null }));
}

module.exports = { addPlan, completed, spread };
