/** Sign-in audit records stored in the account's private Azure Blob document. */

const users = require('../azure/userRepository');

async function recordSignIn(user, req) {
  const now = new Date().toISOString();
  await users.update(user.sub, (doc) => {
    const previous = doc.profile || {};
    doc.profile = {
      email: user.email,
      name: user.name,
      picture: user.picture || '',
      firstSeen: previous.firstSeen || now,
      lastSeen: now,
      signInCount: Number(previous.signInCount || 0) + 1,
    };
    doc.signIns = [{ at: now, userAgent: String((req.headers && req.headers['user-agent']) || '').slice(0, 300) }, ...(doc.signIns || [])].slice(0, 100);
    return doc;
  });
}

module.exports = { recordSignIn };
