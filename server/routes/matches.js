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

  const topMatches = matches.sort((a, b) => b.score - a.score).slice(0, MAX_MATCHES);
  return topMatches.sort((a, b) => a.score - b.score);
}

async function getUnreadChatIds(userId) {
  const chatsSnapshot = await runFirestore(() => (
    db.collection('chats').where('users', 'array-contains', userId).get()
  ));

  const unreadChatIds = await Promise.all(chatsSnapshot.docs.map(async doc => {
    const chat = doc.data();
    const readBy = chat.readBy || [];
    let lastSenderId = chat.lastSenderId;

    // Older chats predate lastSenderId. Read their latest message so those
    // conversations can still receive an unread indicator.
    if (!lastSenderId) {
      const latestMessages = await runFirestore(() => (
        doc.ref.collection('messages').orderBy('createdAt', 'desc').limit(1).get()
      ));
      lastSenderId = latestMessages.docs[0]?.data().senderId;
    }

    return lastSenderId && lastSenderId !== userId && !readBy.includes(userId)
      ? doc.id
      : null;
  }));

  return new Set(unreadChatIds.filter(Boolean));
}

async function saveMatches(userId, matches) {
  await runFirestore(() => Promise.all(matches.map(match => (
    db.collection('matches').doc(match.matchId).set({
      users: [userId, match.userId],
      score: match.score,
      embeddingScore: match.embeddingScore,
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

    // Prepare profile data
    const profileData = {
      embedding: userEmbedding,
      categoryDistribution,
      onboarded: true,
      youtubeData: {
        likedVideoCount: likedVideos.length,
        subscriptionCount: subscriptions.length,
        topCategories: Object.keys(categoryDistribution)
          .sort((a, b) => categoryDistribution[b] - categoryDistribution[a])
          .slice(0, 5),
        // Save a stripped down list of up to 100 liked videos for the Activity Publisher
        savedLikedVideos: likedVideos.slice(0, 100).map(v => ({
          id: v.id,
          title: v.snippet?.title || 'Unknown Title',
          channelTitle: v.snippet?.channelTitle || 'Unknown Creator',
          thumbnailUrl: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || null
        }))
      }
    };

    // 6. Store the profile before matching so the user is eligible for every
    // later user's top-ten results.
    await runFirestore(() => (
      db.collection('users').doc(userId).set(profileData, { merge: true })
    ));

    console.log('Finding top matches...');
    const matches = await findTopMatches(userId, profileData);
    await saveMatches(userId, matches);
    console.log(`Generated ${matches.length} top matches`);

    res.json({ matches, profileData });

  } catch (error) {
    console.error('Error computing matches:', error);
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'Failed to compute matches. Check the Render logs for the underlying error.'
    });
  }
});

router.get('/:userId/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;

    if (!db) {
      return firestoreUnavailable(res);
    }

    const [userDoc, otherUserDoc] = await Promise.all([
      runFirestore(() => db.collection('users').doc(userId).get()),
      runFirestore(() => db.collection('users').doc(otherUserId).get())
    ]);

    if (!userDoc.exists || !otherUserDoc.exists || !userDoc.data().onboarded || !otherUserDoc.data().onboarded) {
      return res.status(404).json({ error: 'A match score is not available for this member.' });
    }

    return res.json({
      match: {
        matchId: getMatchId(userId, otherUserId),
        userId: otherUserId,
        ...computeMatchScore(userDoc.data(), otherUserDoc.data())
      }
    });
  } catch (error) {
    console.error('Error fetching match score:', error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'Could not calculate this match score.'
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
    const [matches, unreadChatIds] = await Promise.all([
      findTopMatches(userId, userDoc.data()),
      getUnreadChatIds(userId)
    ]);
    res.json({
      matches: matches.map(match => ({
        ...match,
        hasUnreadMessages: unreadChatIds.has(match.matchId)
      }))
    });

  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(error.status || 500).json({
      error: error.status ? error.message : 'Failed to fetch matches. Check the Render logs for the underlying error.'
    });
  }
});

module.exports = router;
