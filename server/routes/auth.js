const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const indiaXyCities = require('../../src/data/indiaXyCities.json');

// Simple in-memory token store for development
// In production, encrypt this and store in a proper database linked to the session
const tokenStore = new Map();

const PROFILE_GENDERS = new Set(['Male', 'Female', 'Other']);
const YOUTUBE_DATA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function needsYoutubeRefresh(user) {
  const lastUpdatedAt = toDate(user?.youtubeData?.lastUpdatedAt);
  return !lastUpdatedAt || Date.now() - lastUpdatedAt.getTime() >= YOUTUBE_DATA_MAX_AGE_MS;
}

function serialiseYoutubeData(youtubeData) {
  if (!youtubeData) return youtubeData;
  const lastUpdatedAt = toDate(youtubeData.lastUpdatedAt);
  return { ...youtubeData, lastUpdatedAt: lastUpdatedAt?.toISOString() || null };
}

function profileUnavailable(res) {
  return res.status(503).json({
    error: 'Profiles are unavailable because Firestore is not configured.'
  });
}

function getPublicProfile(userId, data) {
  return {
    id: userId,
    displayName: data.displayName || 'Murmur member',
    photoURL: data.photoURL || null,
    profileDetails: data.profileDetails || null,
    onboarded: Boolean(data.onboarded)
  };
}

function normalizeProfileDetails(details = {}) {
  const location = indiaXyCities.find(item => item.id === details.location?.id);
  const age = Number(details.age);
  const gender = String(details.gender || '').trim();
  const description = String(details.description || '').trim();
  const descriptionWords = description ? description.split(/\s+/).filter(Boolean) : [];

  if (!location) {
    throw new Error('Choose a city from the available Class X or Class Y locations.');
  }
  if (!Number.isInteger(age) || age < 13 || age > 120) {
    throw new Error('Enter an age between 13 and 120.');
  }
  if (!PROFILE_GENDERS.has(gender)) {
    throw new Error('Choose Male, Female, or Other.');
  }
  if (descriptionWords.length > 100) {
    throw new Error('Keep your description to 100 words or fewer.');
  }

  return {
    location: {
      id: location.id,
      city: location.city,
      state: location.state,
      country: location.country,
      tier: location.tier
    },
    age,
    gender,
    description
  };
}

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
      onboarded: false,
      detailsComplete: false
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
          updateData.detailsComplete = false;
          updateData.createdAt = new Date();
        } else {
          const docData = doc.data();
          userObj = { ...docData, ...userObj }; // merge Firestore data
          userObj.onboarded = docData.onboarded || false;
          userObj.detailsComplete = docData.detailsComplete || false;
          userObj.youtubeData = serialiseYoutubeData(docData.youtubeData);
          userObj.requiresYouTubeRefresh = needsYoutubeRefresh(docData);
        }

        await userRef.set(updateData, { merge: true });
      }
    } catch (dbError) {
      console.warn('Firestore not configured or failed, proceeding with in-memory user', dbError);
    }

    userObj.requiresYouTubeRefresh = userObj.requiresYouTubeRefresh ?? needsYoutubeRefresh(userObj);
    userObj.youtubeData = serialiseYoutubeData(userObj.youtubeData);

    res.json({ user: userObj });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Public profile data intentionally excludes email, embeddings, and YouTube data.
router.get('/profile/:userId', async (req, res) => {
  try {
    if (!db) return profileUnavailable(res);

    const userDoc = await db.collection('users').doc(req.params.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'This profile could not be found.' });
    }

    return res.json({ profile: getPublicProfile(userDoc.id, userDoc.data()) });
  } catch (error) {
    console.error('Profile lookup error:', error);
    return res.status(500).json({ error: 'Could not load this profile.' });
  }
});

router.patch('/profile/:userId', async (req, res) => {
  try {
    if (!db) return profileUnavailable(res);

    let profileDetails;
    try {
      profileDetails = normalizeProfileDetails(req.body?.profileDetails);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    const userRef = db.collection('users').doc(req.params.userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'This profile could not be found.' });
    }

    await userRef.set({
      profileDetails,
      detailsComplete: true,
      updatedAt: new Date()
    }, { merge: true });

    const updatedProfile = { ...userDoc.data(), profileDetails, detailsComplete: true };
    return res.json({ profile: getPublicProfile(userDoc.id, updatedProfile) });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Could not save your profile details.' });
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
