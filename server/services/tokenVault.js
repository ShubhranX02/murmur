const crypto = require('crypto');

let developmentKey = null;

function getEncryptionKey() {
  const configuredKey = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
  if (configuredKey) {
    const key = Buffer.from(configuredKey, 'base64');
    if (key.length === 32) return key;
    throw new Error('YOUTUBE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('YOUTUBE_TOKEN_ENCRYPTION_KEY must be configured in production.');
  }
  developmentKey ||= crypto.randomBytes(32);
  return developmentKey;
}

function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    storedAt: new Date()
  };
}

function decryptToken(record) {
  if (!record?.iv || !record?.authTag || !record?.ciphertext) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encryptToken, decryptToken };
