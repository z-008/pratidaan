/** HttpOnly session cookie. It expires after one day and is not renewed by use. */
const crypto = require('crypto');
const { SESSION_MS } = require('./policy');

const COOKIE = 'tracedrop_session';

function secret() {
  const value = process.env.SESSION_SECRET
    || (process.env.NODE_ENV !== 'production' ? 'tracedrop-local-dev-only' : '');
  if (!value) throw new Error('SESSION_SECRET is not set');
  return value;
}

function publicUser(payload) {
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture || '',
    expiresAt: payload.exp,
    guest: Boolean(payload.guest),
    local: Boolean(payload.local),
  };
}

function sign(user, now = Date.now()) {
  const payload = {
    sub: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture || '',
    guest: Boolean(user.guest),
    local: Boolean(user.local),
    iat: now,
    exp: now + SESSION_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return { token: `${body}.${sig}`, user: publicUser(payload) };
}

function verify(token, now = Date.now()) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  let expected;
  try { expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url'); }
  catch { return null; }
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch { return null; }
  if (!payload || !payload.sub || !payload.exp || payload.exp <= now) return null;
  if (!payload.email && !payload.guest) return null;
  return publicUser(payload);
}

function readCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === COOKIE) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return '';
}

function readRequest(req, now = Date.now()) {
  return verify(readCookie(req), now);
}

function setCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`);
}

function clearCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

module.exports = { sign, verify, readRequest, setCookie, clearCookie, COOKIE };
