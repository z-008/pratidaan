/** Who signed in. Firestore free tier: one user row and one event per sign-in. */
let db;

function firestore() {
  if (!db) {
    const { Firestore } = require('@google-cloud/firestore');
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    db = new Firestore(projectId ? { projectId } : {});
  }
  return db;
}

async function recordSignIn(user, req) {
  const store = firestore();
  const now = new Date().toISOString();
  const ref = store.collection('users').doc(user.sub);
  await store.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : {};
    tx.set(ref, {
      email: user.email,
      name: user.name,
      picture: user.picture || '',
      firstSeen: prev.firstSeen || now,
      lastSeen: now,
      signInCount: Number(prev.signInCount || 0) + 1,
    }, { merge: true }); // keep booking preferences and anything else saved on the account
  });
  await store.collection('accessEvents').add({
    sub: user.sub,
    email: user.email,
    name: user.name,
    at: now,
    userAgent: String((req.headers && req.headers['user-agent']) || '').slice(0, 300),
  });
}

module.exports = { recordSignIn };
