/** Azure-backed agent session and memory log used by the custom tool-calling loop. */

const blobs = require('../azure/blobStore');

const memorySyncAt = new Map();
const touched = new Set();
const MEMORY_DEBOUNCE_MS = 5 * 60 * 1000;
let lastSessionError = null;
let lastMemoryError = null;

function status() {
  const storage = blobs.status();
  return {
    agentRuntime: 'custom-tool-agent-on-azure-openai',
    sessions: storage.provider === 'azure-blob-storage' ? 'azure-blob-session-log' : 'in-app-chatCycles',
    memoryBank: storage.provider === 'azure-blob-storage' ? 'azure-blob-user-memory' : 'in-app-drop-memory',
    storage,
    lastSessionError,
    lastMemoryError,
  };
}

function key(kind, donorId) {
  return `agents/${kind}/${Buffer.from(String(donorId)).toString('base64url')}.json`;
}

async function appendEvent(donorId, { role, text }) {
  const name = key('sessions', donorId);
  touched.add(name);
  try {
    const current = await blobs.readJson(name) || { donorId, events: [] };
    current.events.push({ role: role === 'assistant' ? 'assistant' : 'user', text: String(text).slice(0, 4000), at: new Date().toISOString() });
    current.events = current.events.slice(-100);
    await blobs.writeJson(name, current);
    lastSessionError = null;
  } catch (error) {
    lastSessionError = error.message;
    console.warn('Azure agent session append failed:', error.message);
  }
}

async function syncMemoryFromDrop(donorId, memoryTexts) {
  if (!memoryTexts.length) return;
  const now = Date.now();
  if (now - (memorySyncAt.get(donorId) || 0) < MEMORY_DEBOUNCE_MS) return;
  memorySyncAt.set(donorId, now);
  const name = key('memory', donorId);
  touched.add(name);
  try {
    await blobs.writeJson(name, { donorId, memories: memoryTexts.slice(-50), updatedAt: new Date().toISOString() });
    lastMemoryError = null;
  } catch (error) {
    lastMemoryError = error.message;
    console.warn('Azure agent memory sync failed:', error.message);
  }
}

function onDemoReset() {
  memorySyncAt.clear();
  for (const name of touched) blobs.deleteJson(name).catch(() => undefined);
  touched.clear();
}

module.exports = { status, appendEvent, syncMemoryFromDrop, onDemoReset };
