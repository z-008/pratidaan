const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

let server;
let base;
let previous;

test.before(async () => {
  previous = { auth: process.env.AUTH_DISABLED, secret: process.env.SESSION_SECRET, node: process.env.NODE_ENV };
  process.env.AUTH_DISABLED = 'false';
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SECRET = 'guest-test-secret';
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}/api/auth`;
});

test.after(() => {
  server.close();
  process.env.AUTH_DISABLED = previous.auth;
  process.env.SESSION_SECRET = previous.secret;
  process.env.NODE_ENV = previous.node;
});

async function post(path, body, cookie) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body || {}),
  });
  return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie') };
}

async function get(path, cookie) {
  const res = await fetch(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: res.status, body: await res.json() };
}

test('guest sign-in sets a cookie and /me returns guest', async () => {
  const res = await post('/guest');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.guest, true);
  assert.match(res.body.data.sub, /^guest-/);
  const cookie = res.cookie.split(';')[0];
  const me = await get('/me', cookie);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.guest, true);
  const data = await get('/data', cookie);
  assert.equal(data.body.data.guest, true);
  assert.equal(data.body.data.signIns, 0);
});

test('guest is blocked when AUTH_DISABLED is on', async () => {
  process.env.AUTH_DISABLED = 'true';
  const res = await post('/guest');
  assert.equal(res.status, 400);
  process.env.AUTH_DISABLED = 'false';
});
