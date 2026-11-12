/**
 * Vertex AI Agent Engine Sessions + Memory Bank (when configured), with a local
 * session log for judges and offline dev. Set AGENT_ENGINE_NAME to the full
 * reasoningEngine resource (projects/.../locations/.../reasoningEngines/...).
 */

const { GoogleAuth } = require('google-auth-library');
const store = require('../data/store');
const ENGINE = process.env.AGENT_ENGINE_NAME || '';
const LOCATION = process.env.AGENT_ENGINE_LOCATION || 'us-central1';

/** @type {Map<string, string>} donorId -> session resource name */
const vertexSessions = new Map();
/** @type {Map<string, number>} donorId -> last Memory Bank sync ms */
const memorySyncAt = new Map();
const MEMORY_DEBOUNCE_MS = 5 * 60 * 1000;

let lastSessionError = null;
let lastMemoryError = null;

function status() {
  return {
    agentRuntime: ENGINE ? 'vertex-reasoning-engine' : 'custom-runAgent-on-vertex-gemini',
    sessions: ENGINE ? 'vertex-agent-engine-sessions' : 'in-app-chatCycles',
    memoryBank: ENGINE ? 'vertex-agent-engine-memory-bank' : 'drop-memory-and-firestore-preferences',
    engineConfigured: Boolean(ENGINE),
    engineLocation: ENGINE ? LOCATION : null,
    lastSessionError,
    lastMemoryError,
  };
}

async function token() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  return res.token;
}

function sessionNameFromCreateBody(body) {
  if (body.response?.name?.includes('/sessions/')) return body.response.name;
  if (body.name?.includes('/sessions/')) return body.name;
  return null;
}

async function ensureVertexSession(donorId) {
  if (!ENGINE || vertexSessions.has(donorId)) return vertexSessions.get(donorId) || null;
  try {
    const accessToken = await token();
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${ENGINE}/sessions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: donorId, displayName: `pratidaan-${donorId}` }),
    });
    if (!res.ok) throw new Error(await res.text());
    const body = await res.json();
    const name = sessionNameFromCreateBody(body);
    if (name) vertexSessions.set(donorId, name);
    return name || null;
  } catch (e) {
    lastSessionError = e.message;
    console.warn('Agent Engine session create failed:', e.message);
    return null;
  }
}

async function appendEvent(donorId, { role, text }) {
  const sessionName = await ensureVertexSession(donorId);
  if (!sessionName) return;
  try {
    const accessToken = await token();
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${sessionName}:appendEvent`;
    const contentRole = role === 'assistant' ? 'model' : 'user';
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: contentRole,
        invocationId: `pratidaan-${donorId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        content: { role: contentRole, parts: [{ text: String(text).slice(0, 4000) }] },
      }),
    });
    if (!res.ok) throw new Error(await res.text());
  } catch (e) {
    lastSessionError = e.message;
    console.warn('Agent Engine appendEvent failed:', e.message);
  }
}

/** Debounced Memory Bank sync from Drop “remember” lines — does not block chat. */
async function syncMemoryFromDrop(donorId, memoryTexts) {
  if (!ENGINE || !memoryTexts.length) return;
  const now = Date.now();
  if (now - (memorySyncAt.get(donorId) || 0) < MEMORY_DEBOUNCE_MS) return;
  memorySyncAt.set(donorId, now);
  const sessionName = await ensureVertexSession(donorId);
  try {
    const accessToken = await token();
    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/${ENGINE}/memories:generate`;
    const scope = { user_id: donorId };
    const body = sessionName
      ? { vertexSessionSource: { session: sessionName }, scope }
      : {
          scope,
          directContentsSource: {
            events: memoryTexts.slice(-8).map((t) => ({
              content: { role: 'user', parts: [{ text: t }] },
            })),
          },
        };
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    lastMemoryError = null;
  } catch (e) {
    lastMemoryError = e.message;
    console.warn('Memory Bank generateMemories failed:', e.message);
  }
}

function onDemoReset() {
  vertexSessions.clear();
  memorySyncAt.clear();
}

module.exports = {
  status,
  appendEvent,
  syncMemoryFromDrop,
  onDemoReset,
};
