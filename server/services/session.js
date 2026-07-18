const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SESSION_TTL = '12h';
let developmentSecret = null;

function getSessionSecret() {
  const configuredSecret = process.env.SESSION_JWT_SECRET;
  if (configuredSecret && configuredSecret.length >= 32) return configuredSecret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_JWT_SECRET must be set to a random value of at least 32 characters in production.');
  }

  // A process-local development secret keeps local setup simple. It deliberately
  // invalidates all sessions when the server restarts and must never be used in production.
  developmentSecret ||= crypto.randomBytes(48).toString('base64url');
  return developmentSecret;
}

function createSession(userId) {
  return jwt.sign({ sub: userId, type: 'murmur-session' }, getSessionSecret(), {
    algorithm: 'HS256',
    expiresIn: SESSION_TTL,
    issuer: 'murmur-api',
    audience: 'murmur-web'
  });
}

function verifySession(token) {
  const payload = jwt.verify(token, getSessionSecret(), {
    algorithms: ['HS256'],
    issuer: 'murmur-api',
    audience: 'murmur-web'
  });

  if (payload.type !== 'murmur-session' || typeof payload.sub !== 'string' || !payload.sub) {
    throw new Error('Invalid session payload.');
  }

  return payload.sub;
}

module.exports = { createSession, verifySession, SESSION_TTL };
