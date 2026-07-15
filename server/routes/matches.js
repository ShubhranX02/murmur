const express = require('express');
const router = express.Router();
const { db, firebaseInitError } = require('../config/firebase');
const { batchEmbed, createUserEmbedding, computeMatchScore } = require('../services/embedding');
const { buildVideoText } = require('../services/youtube');

const MAX_PROFILE_VIDEOS = 50;
const MAX_MATCHES = 10;

function firestoreUnavailable(res) {
  const setupHint = firebaseInitError
    ? ' Firebase Admin credentials are missing or invalid.'
    : '';

  return res.status(503).json({
    error: `Firestore is unavailable.${setupHint} Add the Firebase service-account credential to the Render backend and make sure Firestore Database is created.`
  });
}

async function runFirestore(operation) {
  try {
    return await operation();
  } catch (error) {
    console.error('Firestore operation failed:', error);
    const firestoreError = new Error('Firestore could not save or read your profile. Check the Render Firebase credential and confirm Firestore Database is enabled.');
    firestoreError.status = 503;
    throw firestoreError;
  }
}

function getMatchId(userId, otherUserId) {
  return [userId, otherUserId].sort().join('_');
}

async function findTopMatches(userId, userProfile) {
  const usersSnapshot = await runFirestore(() => (
    db.collection('users').where('onboarded', '==', true).get()
  ));
  const matches = [];

  usersSnapshot.forEach(doc => {
    const otherUserId = doc.id;
    if (otherUserId === userId) return;

    const otherUser = doc.data();
    const matchResult = computeMatchScore(userProfile, otherUser);

    matches.push({
      matchId: getMatchId(userId, otherUserId),
      userId: otherUserId,
      displayName: otherUser.displayName || 'Murmur member',
      photoURL: otherUser.photoURL || null,
      ...matchResult
    });
  });

  return matches.sort((a, b) => b.score - a.score).slice(0, MAX_MATCHES);
}

async function saveMatches(userId, matches) {
  await runFirestore(() => Promise.all(matches.map(match => (
    db.collection('matches').doc(match.matchId).set({
      users: [userId, match.userId],
      score: match.score,
      embeddingScore: match.embeddingScore,
      subscriptionScore: match.subscriptionScore,
      categoryScore: match.categoryScore,
      createdAt: new Date()
    })
  ))));
}

router.post('/compute', async (req, res) => {
  try {
    const { userId, likedVideos, subscriptions } = req.body;
    
    if (!userId || !likedVideos || !subscriptions) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    if (!db) {
      return firestoreUnavailable(res);
    }

    console.log(`Computing profile for user ${userId}...`);

    // 1. Generate text for the 50 most recent liked videos returned by
    // YouTube. This keeps the profile current and the Render request fast.
    const profileVideos = likedVideos.slice(0, MAX_PROFILE_VIDEOS);
    const videoTexts = profileVideos.map(buildVideoText);
    
    // 2. Generate embeddings for videos
    console.log(`Generating embeddings for ${videoTexts.length} of ${likedVideos.length} liked videos...`);
    const videoEmbeddings = await batchEmbed(videoTexts);
    
    // 3. Create user embedding
    const userEmbedding = createUserEmbedding(videoEmbeddings);

    // 4. Compute category distribution
    const categoryDistribution = {};
    let totalCategories = 0;
    likedVideos.forEach(v => {
      const catId = v.snippet?.categoryId;
      if (catId) {
        categoryDistribution[catId] = (categoryDistribution[catId] || 0) + 1;
        totalCategories++;
      }
    });
    // Normalize
    if (totalCategories > 0) {
      Object.keys(categoryDistribution).forEach(k => {
        categoryDistribution[k] = categoryDistribution[k] / totalCategories;
      });
    }

    // 5. Extract subscription IDs
    const subscriptionIds = subscriptions
      .map(s => s.snippet?.resourceId?.channelId)
      .filter(Boolean);

    // Prepare profile data
    const profileData = {
      embedding: userEmbedding,
      categoryDistribution,
      subscriptionIds,
      onboarded: true,
      youtubeData: {
        likedVideoCount: likedVideos.length,
        subscriptionCount: subscriptions.length,
        topCategories: Object.keys(categoryDistribution)
          .sort((a, b) => categoryDistribution[b] - categoryDistribution[a])
          .slice(0, 5)
      }
    };

    // 6. Store the profile before matching so the user is eligible for every
    // later user's top-ten results.
    await runFirestore(() => (
      db.collection('users').doc(userId).set(profileData, { merge: true })
    ));

    // 7. Score every other onboarded user. There is deliberately no minimum
    // percentage threshold: each user receives up to ten ranked matches.
    console.log('Finding top matches...');
    const matches = await findTopMatches(userId, profileData);
    await saveMatches(userId, matches);
    console.log(`Generated ${matches.length} top matches`);

    res.json({ matches });

  } catch (error) {
    console.error('Error computing matches:', error);
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'Failed to compute matches. Check the Render logs for the underlying error.'
    });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!db) {
      return firestoreUnavailable(res);
    }

    const userDoc = await runFirestore(() => db.collection('users').doc(userId).get());
    if (!userDoc.exists || !userDoc.data().onboarded) {
      return res.json({ matches: [] });
    }

    // Calculate from current profiles instead of relying on stale or missing
    // match documents. This also lets previously onboarded users see new users.
    const matches = await findTopMatches(userId, userDoc.data());
    res.json({ matches });

  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'Failed to fetch matches. Check the Render logs for the underlying error.'
    });
  }
});

module.exports = router;
