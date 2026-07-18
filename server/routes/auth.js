const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const { z } = require('zod');
const { db } = require('../config/firebase');
const indiaXyCities = require('../../src/data/indiaXyCities.json');
const { createSession } = require('../services/session');
const { encryptToken } = require('../services/tokenVault');
const { authenticate } = require('../middleware/auth');

const PROFILE_GENDERS = new Set(['Male', 'Female', 'Other']);
const YOUTUBE_DATA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const googleClient = new OAuth2Client();
const credentialSchema = z.object({ credential: z.string().min(20).max(10000) });
const tokenSchema = z.object({ accessToken: z.string().min(20).max(10000) });

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
    onboarded: Boolean(data.onboarded),
    // These aggregate taste insights are intentionally shareable on member
    // profiles. Raw liked videos, subscriptions, email, and embeddings stay private.
    youtubeData: {
      likedVideoCount: Number(data.youtubeData?.likedVideoCount) || 0
    },
    categoryDistribution: data.categoryDistribution || {}
  };
}

function getSessionUser(userId, data) {
  return {
    id: userId,
    displayName: data.displayName || 'Murmur member',
    photoURL: data.photoURL || null,
    onboarded: Boolean(data.onboarded),
    detailsComplete: Boolean(data.detailsComplete),
    profileDetails: data.profileDetails || null,
    youtubeData: serialiseYoutubeData(data.youtubeData),
    categoryDistribution: data.categoryDistribution || {},
    youtubeRefreshSkipped: Boolean(data.youtubeRefreshSkipped),
    requiresYouTubeRefresh: needsYoutubeRefresh(data) && !data.youtubeRefreshSkipped
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
    const parsed = credentialSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'A valid Google credential is required.' });
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: 'Google sign-in is not configured.' });

    const ticket = await googleClient.verifyIdToken({ idToken: parsed.data.credential, audience: clientId });
    const payload = ticket.getPayload();
    const { sub, name, email, picture, email_verified: emailVerified } = payload || {};

    if (!sub || !email || !emailVerified) return res.status(401).json({ error: 'Google could not verify this account.' });

    if (!db) return profileUnavailable(res);
    const userRef = db.collection('users').doc(sub);
    const doc = await userRef.get();
    const updateData = {
      displayName: name,
      email,
      photoURL: picture,
      updatedAt: new Date()
    };

    const existingUser = doc.exists ? doc.data() : {};
    if (!doc.exists) {
      updateData.onboarded = false;
      updateData.detailsComplete = false;
      updateData.createdAt = new Date();
    }

    await userRef.set(updateData, { merge: true });
    const user = getSessionUser(sub, { ...existingUser, ...updateData });
    res.json({ user, sessionToken: createSession(sub) });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Public profile data intentionally excludes email, embeddings, and YouTube data.
router.get('/profile/:userId', authenticate, async (req, res) => {
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

router.patch('/profile/:userId', authenticate, async (req, res) => {
  try {
    if (!db) return profileUnavailable(res);
    if (req.params.userId !== req.auth.userId) return res.status(403).json({ error: 'You can only edit your own profile.' });

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

// A returning member can keep using Murmur with their last saved taste profile
// when they choose not to refresh YouTube after the seven-day reminder.
router.post('/youtube-refresh/skip', authenticate, async (req, res) => {
  try {
    if (!db) return profileUnavailable(res);

    const userRef = db.collection('users').doc(req.auth.userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'This profile could not be found.' });

    await userRef.set({ youtubeRefreshSkipped: true, updatedAt: new Date() }, { merge: true });
    return res.json({ success: true, user: { youtubeRefreshSkipped: true, requiresYouTubeRefresh: false } });
  } catch (error) {
    console.error('YouTube refresh skip error:', error);
    return res.status(500).json({ error: 'Could not continue without refreshing YouTube.' });
  }
});

router.post('/youtube-token', authenticate, async (req, res) => {
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'A valid YouTube access token is required.' });
  if (!db) return profileUnavailable(res);

  try {
    await db.collection('users').doc(req.auth.userId).set({
      youtubeAccessToken: encryptToken(parsed.data.accessToken),
      updatedAt: new Date()
    }, { merge: true });
    return res.json({ success: true });
  } catch (error) {
    console.error('YouTube token storage error:', error);
    return res.status(500).json({ error: 'Could not securely store the YouTube connection.' });
  }
});

module.exports = { router };
