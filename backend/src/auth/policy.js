/** One-day sessions. Local bypass never applies on Cloud Run. */
const SESSION_MS = 24 * 60 * 60 * 1000;

function authDisabled() {
  if (process.env.NODE_ENV === 'production') return false;
  return ['1', 'true', 'yes'].includes(String(process.env.AUTH_DISABLED || '').trim().toLowerCase());
}

module.exports = { SESSION_MS, authDisabled };
