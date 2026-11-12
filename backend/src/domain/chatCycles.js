/**
 * Demo-cycle chat history per signed-in account (guest sub or Google sub) and persona.
 * One "cycle" runs from timeline start until Reset. Past cycles are read-only archives.
 * Vertex Agent Engine Sessions mirror when configured (see agentPlatform.js).
 */

const store = require('../data/store');
const drop = require('./drop');

/** @type {Map<string, { id: string, label: string; startedOn: string; endedOn: string; chats: Record<string, { turns: object[], history: object[] | null }>, dropEarlier: object[] }[]>} */
const pastByScope = new Map();

/** @type {Map<string, Record<string, { turns: object[], history: object[] | null }>>} */
const currentByScope = new Map();

/** One seeded archive per account+persona so judges see Past Cycles before the first Reset. */
const demoPastSeeded = new Set();

function accountSub(user) {
  if (!user) return 'anonymous';
  if (user.local || user.sub === 'local') return 'local';
  return String(user.sub || 'anonymous');
}

/** Stable key: one browser session / Google account × demo persona. */
function scopeKey(user, donorId) {
  return `${accountSub(user)}|${donorId}`;
}

function donorFromScope(scope) {
  const i = scope.indexOf('|');
  return i >= 0 ? scope.slice(i + 1) : scope;
}

function cycleId() {
  return store.clock().start || store.today();
}

function cycleLabel(id) {
  const d = new Date(`${id}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function chatKey(chat) {
  return typeof chat === 'string' && chat ? chat.slice(0, 40) : 'general';
}

function ensureCurrent(scope) {
  if (!currentByScope.has(scope)) currentByScope.set(scope, {});
  return currentByScope.get(scope);
}

function recordTurn(user, donorId, chat, { userText, assistantText, history }) {
  const scope = scopeKey(user, donorId);
  const key = chatKey(chat);
  const bucket = ensureCurrent(scope);
  if (!bucket[key]) bucket[key] = { turns: [], history: null };
  const entry = bucket[key];
  entry.turns.push({ at: store.today(), user: userText, assistant: assistantText });
  if (history) entry.history = history;
  entry.turns = entry.turns.slice(-40);
  return entry;
}

function activeChat(user, donorId, chat) {
  const scope = scopeKey(user, donorId);
  const key = chatKey(chat);
  const bucket = currentByScope.get(scope);
  if (!bucket || !bucket[key]) return { cycleId: cycleId(), turns: [], history: null };
  return { cycleId: cycleId(), turns: bucket[key].turns, history: bucket[key].history };
}

function seedDemoPastIfEmpty(user, donorId) {
  const scope = scopeKey(user, donorId);
  if (demoPastSeeded.has(scope) || (pastByScope.get(scope) || []).length) return;
  const donor = store.getDonor(donorId);
  if (!donor || donor.newUser) return;
  demoPastSeeded.add(scope);
  const start = store.clock().start || store.today();
  const endedOn = addDaysUtc(start, -14);
  const first = String(donor.name || '').split(' ')[0] || 'there';
  const list = [{
    id: `seed-${donorId}-${start}`,
    label: 'Earlier demo cycle (sample)',
    startedOn: addDaysUtc(start, -28),
    endedOn,
    chats: {
      general: {
        turns: [
          { at: endedOn, user: 'Where did my blood go?', assistant: `${first}, your components reached patients in cancer care and trauma settings — open My impact for the journey.` },
          { at: endedOn, user: 'When can I donate again?', assistant: 'I can check your eligibility from your last visit — ask anytime in this cycle.' },
        ],
        history: null,
      },
    },
    dropEarlier: [],
  }];
  pastByScope.set(scope, list);
}

function addDaysUtc(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function currentCycle(user, donorId) {
  seedDemoPastIfEmpty(user, donorId);
  const scope = scopeKey(user, donorId);
  const bucket = currentByScope.get(scope) || {};
  const chats = {};
  for (const [key, entry] of Object.entries(bucket)) {
    if (entry.turns.length) chats[key] = { turns: entry.turns, history: entry.history };
  }
  return { cycleId: cycleId(), label: 'This cycle', startedOn: cycleId(), chats };
}

function listPast(user, donorId) {
  seedDemoPastIfEmpty(user, donorId);
  const scope = scopeKey(user, donorId);
  return (pastByScope.get(scope) || []).map((c) => ({
    id: c.id,
    label: c.label,
    startedOn: c.startedOn,
    endedOn: c.endedOn,
    chatCount: Object.keys(c.chats).length,
    dropCount: c.dropEarlier.length,
  }));
}

function getPast(user, donorId, id) {
  const scope = scopeKey(user, donorId);
  const c = (pastByScope.get(scope) || []).find((x) => x.id === id);
  if (!c) return null;
  return c;
}

/** Session id for Vertex Agent Engine (account × persona). */
function agentSessionUserId(user, donorId) {
  return scopeKey(user, donorId);
}

/** Call before store.resetDemo() clears Drop state. */
function archiveCurrentCycle() {
  const endedOn = store.today();
  const id = cycleId();
  const label = `Cycle from ${cycleLabel(id)}`;
  for (const [scope, chats] of currentByScope.entries()) {
    const donorId = donorFromScope(scope);
    const hasChat = Object.values(chats).some((c) => c.turns.length);
    let dropEarlier = [];
    try {
      dropEarlier = drop.view(donorId).earlier;
    } catch {
      dropEarlier = [];
    }
    if (!hasChat && !dropEarlier.length) continue;
    const list = pastByScope.get(scope) || [];
    list.unshift({
      id: `${id}-${endedOn}-${scope.replace(/\|/g, '-')}`,
      label,
      startedOn: id,
      endedOn,
      chats: JSON.parse(JSON.stringify(chats)),
      dropEarlier: JSON.parse(JSON.stringify(dropEarlier)),
    });
    pastByScope.set(scope, list.slice(0, 12));
  }
  currentByScope.clear();
}

/** @internal test isolation */
function resetState() {
  pastByScope.clear();
  currentByScope.clear();
  demoPastSeeded.clear();
}

module.exports = {
  scopeKey,
  accountSub,
  agentSessionUserId,
  recordTurn,
  activeChat,
  currentCycle,
  listPast,
  getPast,
  archiveCurrentCycle,
  cycleId,
  seedDemoPastIfEmpty,
  resetState,
};
