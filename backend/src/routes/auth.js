const crypto = require('crypto');
const express = require('express');
const { authDisabled, SESSION_MS } = require('../auth/policy');
const session = require('../auth/session');
const { verifyGoogleCredential } = require('../auth/google');
const { recordSignIn } = require('../auth/accessLog');
const settings = require('../auth/userSettings');
const accountData = require('../auth/accountData');
const { turn, normalise } = require('../domain/bookingChat');

const router = express.Router();
const ok = (res, data) => res.json({ success: true, data });
const fail = (res, status, error) => res.status(status).json({ success: false, error });

function actor(req) {
  if (authDisabled()) return { sub: 'local', email: 'local-dev', name: 'Local development', local: true };
  return session.readRequest(req);
}

router.get('/config', (req, res) => ok(res, {
  authDisabled: authDisabled(),
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  sessionMinutes: SESSION_MS / 60000,
}));

router.get('/preferences', async (req, res) => {
  const user = actor(req);
  if (!user) return fail(res, 401, 'Sign in with Google');
  return ok(res, await settings.getPreferences(user));
});

router.put('/preferences', async (req, res) => {
  const user = actor(req);
  if (!user) return fail(res, 401, 'Sign in with Google');
  const { dateFrom, dateTo, ...preferences } = normalise(req.body || {});
  preferences.onboardingComplete = Boolean(req.body && req.body.onboardingComplete);
  preferences.onboardingSkipped = Boolean(req.body && req.body.onboardingSkipped);
  return ok(res, await settings.savePreferences(user, preferences));
});

router.delete('/preferences', async (req, res) => {
  const user = actor(req);
  if (!user) return fail(res, 401, 'Sign in with Google');
  await settings.deletePreferences(user);
  return ok(res, null);
});

/** Run a "Your data" read or delete for the signed-in account. */
const forAccount = (fn) => async (req, res) => {
  const user = actor(req);
  if (!user) return fail(res, 401, 'Sign in with Google');
  try {
    return ok(res, await fn(user, req, res));
  } catch (error) {
    console.error(`[your data] ${error.message}`);
    return fail(res, error.status || 400, error.message);
  }
};

// "Your data": what is kept with the Google account, and deleting it item by item or all at once
router.get('/data', forAccount((user) => accountData.read(user)));
router.delete('/signins', forAccount((user) => accountData.deleteSignIns(user)));
router.delete('/bookings/:bookingId', forAccount((user, req) => accountData.deleteBooking(user, req.params.bookingId, { accessToken: req.body && req.body.accessToken })));
router.delete('/account', forAccount(async (user, req, res) => {
  const result = await accountData.deleteAccount(user, { accessToken: req.body && req.body.accessToken, removeCalendar: Boolean(req.body && req.body.removeCalendar) });
  session.clearCookie(res);
  return result;
}));

router.post('/booking/turn', (req, res) => {
  if (!actor(req)) return fail(res, 401, 'Sign in with Google');
  return ok(res, turn(req.body && req.body.preferences, req.body && req.body.answer));
});

router.get('/me', (req, res) => {
  if (authDisabled()) {
    return ok(res, { email: 'local-dev', name: 'Local development', picture: '', expiresAt: null, local: true });
  }
  const user = session.readRequest(req);
  if (!user) return fail(res, 401, 'Sign in with Google');
  return ok(res, user);
});

router.post('/guest', (req, res) => {
  if (authDisabled()) return fail(res, 400, 'Sign-in is turned off for local development');
  const user = { sub: `guest-${crypto.randomUUID()}`, email: 'guest@tracedrop.app', name: 'Guest', picture: '', guest: true };
  const issued = session.sign(user);
  session.setCookie(res, issued.token);
  return ok(res, issued.user);
});

router.post('/google', async (req, res) => {
  if (authDisabled()) return fail(res, 400, 'Sign-in is turned off for local development');
  try {
    const user = await verifyGoogleCredential(req.body && req.body.credential);
    await recordSignIn(user, req);
    const issued = session.sign(user);
    session.setCookie(res, issued.token);
    return ok(res, issued.user);
  } catch (error) {
    console.error(`[auth] ${error.message}`);
    return fail(res, error.status || 401, error.message || 'Sign in with Google');
  }
});

router.post('/logout', (req, res) => {
  session.clearCookie(res);
  return ok(res, { signedOut: true });
});

module.exports = router;
