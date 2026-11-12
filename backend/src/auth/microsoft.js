/** Validate Microsoft Entra ID tokens without storing a client secret. */

const crypto = require('crypto');

let keys = { at: 0, values: [] };

function decodePart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

async function signingKeys() {
  if (keys.values.length && Date.now() - keys.at < 6 * 60 * 60 * 1000) return keys.values;
  const response = await fetch('https://login.microsoftonline.com/common/discovery/v2.0/keys', { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Microsoft signing keys HTTP ${response.status}`);
  const body = await response.json();
  keys = { at: Date.now(), values: body.keys || [] };
  return keys.values;
}

function profile(payload) {
  const tenant = payload.tid;
  const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
  if (!tenant || payload.iss !== issuer) throw new Error('Microsoft identity issuer was rejected');
  const email = payload.preferred_username || payload.email || payload.unique_name;
  if (!email) throw new Error('A verified Microsoft account email is required');
  return {
    sub: `${tenant}:${payload.oid || payload.sub}`,
    email: String(email).toLowerCase(),
    name: payload.name || email,
    picture: '',
  };
}

async function verifyMicrosoftCredential(credential) {
  const clientId = process.env.AZURE_CLIENT_ID;
  if (!clientId) {
    const error = new Error('Microsoft sign-in is not configured');
    error.status = 500;
    throw error;
  }
  if (!credential || typeof credential !== 'string' || credential.split('.').length !== 3) {
    const error = new Error('Sign in with a Microsoft account');
    error.status = 401;
    throw error;
  }
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = credential.split('.');
    const header = decodePart(encodedHeader);
    const payload = decodePart(encodedPayload);
    if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported Microsoft token signature');
    const key = (await signingKeys()).find((candidate) => candidate.kid === header.kid);
    if (!key) throw new Error('Microsoft signing key was not found');
    const verified = crypto.verify('RSA-SHA256', Buffer.from(`${encodedHeader}.${encodedPayload}`),
      crypto.createPublicKey({ key, format: 'jwk' }), Buffer.from(encodedSignature, 'base64url'));
    if (!verified) throw new Error('Microsoft token signature was rejected');
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now || payload.nbf && payload.nbf > now + 60) throw new Error('Microsoft token has expired');
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(clientId)) throw new Error('Microsoft token audience was rejected');
    return profile(payload);
  } catch (cause) {
    const error = new Error(cause.message || 'Microsoft sign-in was rejected');
    error.status = 401;
    throw error;
  }
}

module.exports = { verifyMicrosoftCredential, profile };
