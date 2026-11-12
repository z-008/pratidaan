/** Per-account Azure document containing profile, sign-ins, preferences and bookings. */

const blobs = require('./blobStore');

const locks = new Map();

function safeId(value) {
  return Buffer.from(String(value)).toString('base64url');
}

function key(sub) {
  return `users/${safeId(sub)}.json`;
}

async function read(sub) {
  return blobs.readJson(key(sub));
}

async function update(sub, updater) {
  const previous = locks.get(sub) || Promise.resolve();
  const current = previous.then(async () => {
    const existing = await read(sub) || { sub, profile: null, signIns: [], preferences: null, appointments: [] };
    const next = await updater(structuredClone(existing));
    await blobs.writeJson(key(sub), next);
    return next;
  });
  locks.set(sub, current.catch(() => undefined));
  try {
    return await current;
  } finally {
    if (locks.get(sub) === current) locks.delete(sub);
  }
}

async function remove(sub) {
  return blobs.deleteJson(key(sub));
}

module.exports = { read, update, remove, status: blobs.status };
