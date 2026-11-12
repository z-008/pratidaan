const { authDisabled } = require('./policy');
const { readRequest } = require('./session');

function requireAuth(req, res, next) {
  if (authDisabled()) {
    req.user = { sub: 'local', email: 'local-dev', name: 'Local development', picture: '', local: true };
    return next();
  }
  const user = readRequest(req);
  if (!user) return res.status(401).json({ success: false, error: 'Sign in with Google' });
  req.user = user;
  next();
}

module.exports = { requireAuth };
