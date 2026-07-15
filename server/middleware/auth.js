function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  let userId = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // Very basic JWT parsing for extraction (NOT secure for production, just for dev/demo)
      // In production, you would verify this token against Google or Firebase Auth
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        userId = payload.sub || payload.user_id;
      }
    } catch (e) {
      console.warn('Failed to parse bearer token, falling back to headers', e);
    }
  }
  
  if (!userId) {
    // Fallback for development/testing
    userId = req.headers['x-user-id'];
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.userId = userId;
  next();
}

module.exports = { authenticate };
