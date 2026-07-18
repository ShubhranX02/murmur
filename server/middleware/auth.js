const { verifySession } = require('../services/session');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in is required.' });
  }

  try {
    const userId = verifySession(authHeader.slice(7));
    req.auth = { userId };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

module.exports = { authenticate };
