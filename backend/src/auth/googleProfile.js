/** Accept only a verified Google account. There is no password or other provider. */
function acceptGoogleProfile(payload) {
  const issuer = payload && payload.iss;
  if (issuer !== 'accounts.google.com' && issuer !== 'https://accounts.google.com') {
    const error = new Error('Sign in with a Google account');
    error.status = 401;
    throw error;
  }
  if (!payload.sub || !payload.email || payload.email_verified !== true) {
    const error = new Error('A verified Google email is required');
    error.status = 401;
    throw error;
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || '',
  };
}

module.exports = { acceptGoogleProfile };
