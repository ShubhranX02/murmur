const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// Simple in-memory token store for development
// In production, encrypt this and store in a proper database linked to the session
const tokenStore = new Map();

// A Google OAuth client ID is public by design and is needed by the browser to
// start the Google Identity and YouTube permission flows. Keeping its source of
// truth on the API avoids requiring a second, separately deployed Vercel value.
router.get('/google-client-id', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(503).json({ error: 'Google sign-in is not configured.' });
  }

  res.json({ clientId });
});

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'No credential provided' });
    }

    // Very basic JWT parsing (NOT for production validation)
    // Production should use google-auth-library to verify the ID token
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid credential format' });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const { sub, name, email, picture } = payload;

    if (!sub) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    let userObj = {
      id: sub,
      displayName: name,
      email: email,
      photoURL: picture,
      onboarded: false
    };

    try {
      if (db) {
        const userRef = db.collection('users').doc(sub);
        const doc = await userRef.get();
        
        const updateData = {
          displayName: name,
          email: email,
          photoURL: picture,
          updatedAt: new Date()
        };

        if (!doc.exists) {
          updateData.onboarded = false;
          updateData.createdAt = new Date();
        } else {
          const docData = doc.data();
          userObj = { ...docData, ...userObj }; // merge Firestore data
          userObj.onboarded = docData.onboarded || false;
        }

        await userRef.set(updateData, { merge: true });
      }
    } catch (dbError) {
      console.warn('Firestore not configured or failed, proceeding with in-memory user', dbError);
    }

    res.json({ user: userObj });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/youtube-token', (req, res) => {
  const { accessToken, userId } = req.body;
  if (!accessToken || !userId) {
    return res.status(400).json({ error: 'Missing token or userId' });
  }
  
  tokenStore.set(userId, accessToken);
  res.json({ success: true });
});

module.exports = { router, tokenStore };
