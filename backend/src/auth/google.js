const { OAuth2Client } = require('google-auth-library');
const { acceptGoogleProfile } = require('./googleProfile');

async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const error = new Error('Google sign-in is not configured');
    error.status = 500;
    throw error;
  }
  if (!credential || typeof credential !== 'string') {
    const error = new Error('Sign in with a Google account');
    error.status = 401;
    throw error;
  }
  const client = new OAuth2Client(clientId);
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
  } catch {
    const error = new Error('Google sign-in was rejected');
    error.status = 401;
    throw error;
  }
  return acceptGoogleProfile(ticket.getPayload());
}

module.exports = { verifyGoogleCredential };
