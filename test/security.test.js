const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SESSION_JWT_SECRET = 'test-only-session-secret-with-at-least-32-characters';
process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const { createSession, verifySession } = require('../server/services/session');
const { encryptToken, decryptToken } = require('../server/services/tokenVault');
const { authenticate } = require('../server/middleware/auth');

test('signed sessions identify only the signed-in member', () => {
  const token = createSession('member-123');
  assert.equal(verifySession(token), 'member-123');
  assert.throws(() => verifySession(`${token}tampered`));
});

test('YouTube tokens are encrypted at rest and decrypt only with the service key', () => {
  const secret = 'youtube-access-token-for-test-only';
  const encrypted = encryptToken(secret);
  assert.notEqual(encrypted.ciphertext, secret);
  assert.equal(decryptToken(encrypted), secret);
});

test('protected routes reject requests without a signed session', () => {
  let statusCode = null;
  let response = null;
  let nextCalled = false;
  authenticate(
    { headers: {} },
    { status: code => ({ json: payload => { statusCode = code; response = payload; } }) },
    () => { nextCalled = true; }
  );
  assert.equal(nextCalled, false);
  assert.equal(statusCode, 401);
  assert.equal(response.error, 'Sign in is required.');
});
