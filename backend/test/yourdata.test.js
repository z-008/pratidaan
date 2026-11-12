/**
 * "Your data": reading what is kept and deleting it, on the local path (sign-in off,
 * everything in the server's memory). The Firestore deletes run only on the live site.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const store = require('../src/data/store');
const drop = require('../src/domain/drop');
const settings = require('../src/auth/userSettings');
const { browserName } = require('../src/auth/accountData');

const user = { sub: 'local', email: 'local-dev', name: 'Local development', local: true };
let base;
let server;
let previous;

test.before(async () => {
  previous = process.env.AUTH_DISABLED;
  process.env.AUTH_DISABLED = 'true';
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use((req, res, next) => { req.user = user; next(); });
  app.use('/api/donors/:donorId/drop', require('../src/routes/drop'));
  app.use('/api/donors', require('../src/routes/donors'));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => { server.close(); process.env.AUTH_DISABLED = previous; });
test.beforeEach(async () => {
  store.resetDemo();
  await settings.savePreferences(user, null);
});

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie') };
}

/** A booking the local account made, as booking would save it. */
async function book(donorId, date, status = 'booked') {
  const appointment = { id: `APT-test-${date}`, sub: 'local', donorId, centreId: 'BC-02', centre: 'Test centre', district: 'Bengaluru Urban', date, time: '09:30', status, eventId: null };
  await settings.saveAppointment(user, appointment);
  if (status === 'booked') drop.recordBooking(donorId, appointment);
  return appointment;
}

test('reads what the account keeps: profile, no sign-in history locally, and every booking', async () => {
  await book('D-NEW', '2026-10-17');
  await book('D-001', '2026-09-01', 'completed');
  const { status, body } = await call('GET', '/auth/data');
  assert.equal(status, 200);
  assert.equal(body.data.local, true);
  assert.equal(body.data.signIns, 0);
  assert.deepEqual(body.data.bookings.map((b) => b.id), ['APT-test-2026-10-17', 'APT-test-2026-09-01']);
});

test('deletes donation preferences and sign-in history', async () => {
  await settings.savePreferences(user, { days: ['sat'], timeWindows: ['morning'] });
  assert.equal((await call('DELETE', '/auth/preferences')).status, 200);
  assert.equal(await settings.getPreferences(user), null);
  const signins = await call('DELETE', '/auth/signins');
  assert.equal(signins.status, 200);
  assert.equal(signins.body.data.deleted, 0, 'nothing kept with sign-in off');
});

test('deletes a booking, cancelling an upcoming one first', async () => {
  await book('D-NEW', '2026-10-17');
  assert.equal(drop.view('D-NEW').bookings.length, 1);
  const res = await call('DELETE', '/auth/bookings/APT-test-2026-10-17', {});
  assert.equal(res.status, 200);
  assert.equal(drop.view('D-NEW').bookings.length, 0, 'no longer "coming up" on Home');
  assert.deepEqual((await call('GET', '/auth/data')).body.data.bookings, []);
  assert.equal((await call('DELETE', '/auth/bookings/APT-nope', {})).status, 404);
});

test('deletes a value read from a lab report, but not a result from the blood centre', async () => {
  store.addObservations('D-NEW', [{ id: 'OBS-up-1', donorId: 'D-NEW', key: 'ldl', name: 'LDL cholesterol', value: 131, unit: 'mg/dL', date: '2026-10-08', source: 'uploaded_report', labId: 'Test lab' }]);
  const listed = await call('GET', '/donors/D-NEW/labs/uploaded');
  assert.deepEqual(listed.body.data.map((o) => o.id), ['OBS-up-1']);
  const res = await call('DELETE', '/donors/D-NEW/labs/OBS-up-1');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
  assert.equal((await call('DELETE', '/donors/D-001/labs/OBS-D-001-V4-hb')).status, 404, "the blood centre's results stay");
});

test('Delete my account clears the in-memory copies and the sign-in cookie', async () => {
  await settings.savePreferences(user, { days: ['sat'] });
  await book('D-NEW', '2026-10-17');
  await book('D-001', '2026-09-01', 'completed');
  const res = await call('DELETE', '/auth/account', { removeCalendar: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.bookings, 2);
  assert.equal(res.body.data.local, true);
  assert.match(res.cookie, /tracedrop_session=;.*Max-Age=0/);
  assert.equal(await settings.getPreferences(user), null);
  assert.deepEqual(await settings.allAppointments(user), []);
  assert.equal(drop.view('D-NEW').bookings.length, 0);
});

test('the last browser is named plainly', () => {
  assert.equal(browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36'), 'Chrome on Mac');
  assert.equal(browserName('Mozilla/5.0 (Linux; Android 14) Firefox/130.0'), 'Firefox on Android');
});
