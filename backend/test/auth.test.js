const test = require('node:test');
const assert = require('node:assert/strict');

const { authDisabled, SESSION_MS } = require('../src/auth/policy');
const { sign, verify } = require('../src/auth/session');
const { profile } = require('../src/auth/microsoft');

test('local auth bypass is ignored in production', () => {
  const previous = { node: process.env.NODE_ENV, flag: process.env.AUTH_DISABLED };
  process.env.NODE_ENV = 'production';
  process.env.AUTH_DISABLED = 'true';
  assert.equal(authDisabled(), false);
  process.env.NODE_ENV = 'development';
  process.env.AUTH_DISABLED = 'true';
  assert.equal(authDisabled(), true);
  process.env.AUTH_DISABLED = 'no';
  assert.equal(authDisabled(), false);
  process.env.NODE_ENV = previous.node;
  process.env.AUTH_DISABLED = previous.flag;
});

test('a session lasts one day and then must be signed in again', () => {
  process.env.SESSION_SECRET = 'test-secret';
  const now = Date.parse('2026-10-11T10:00:00Z');
  const issued = sign({ sub: '1', email: 'a@gmail.com', name: 'A' }, now);
  assert.equal(SESSION_MS, 24 * 60 * 60 * 1000);
  assert.equal(verify(issued.token, now + SESSION_MS - 1).email, 'a@gmail.com');
  assert.equal(verify(issued.token, now + SESSION_MS), null);
});

test('a guest session is signed and verified without Azure account fields', () => {
  process.env.SESSION_SECRET = 'test-secret';
  const now = Date.parse('2026-10-11T10:00:00Z');
  const issued = sign({ sub: 'guest-abc', email: 'guest@tracedrop.app', name: 'Guest', guest: true }, now);
  const user = verify(issued.token, now);
  assert.equal(user.guest, true);
  assert.equal(user.name, 'Guest');
});

test('a tampered session cookie is rejected', () => {
  process.env.SESSION_SECRET = 'test-secret';
  const issued = sign({ sub: '1', email: 'a@gmail.com', name: 'A' }, Date.now());
  const [body] = issued.token.split('.');
  assert.equal(verify(`${body}.not-the-signature`), null);
});

test('only a Microsoft token from its tenant issuer is accepted', () => {
  const good = profile({ tid: 'tenant-1', iss: 'https://login.microsoftonline.com/tenant-1/v2.0', oid: '9', preferred_username: 'a@example.com', name: 'A' });
  assert.equal(good.email, 'a@example.com');
  assert.equal(good.sub, 'tenant-1:9');
  assert.throws(() => profile({ tid: 'tenant-1', iss: 'https://example.com', oid: '9', preferred_username: 'a@example.com' }), /issuer/);
  assert.throws(() => profile({ tid: 'tenant-1', iss: 'https://login.microsoftonline.com/tenant-1/v2.0', oid: '9' }), /email/);
});
