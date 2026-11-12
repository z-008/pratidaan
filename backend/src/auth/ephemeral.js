/** Accounts that never touch Azure storage: local dev bypass and guest browsers. */
const { authDisabled } = require('./policy');

function isGuest(user) {
  return Boolean(user && (user.guest || String(user.sub || '').startsWith('guest-')));
}

function isEphemeral(user) {
  return authDisabled() || !user || user.local || user.sub === 'local' || isGuest(user);
}

module.exports = { isGuest, isEphemeral };
