const express = require('express');
const router = express.Router();
const { db, firebaseInitError } = require('../config/firebase');
const { batchEmbed, createUserEmbedding, computeMatchScore, cosineSimilarity, skewMatchScore, MATCH_SCORE_SCALE_VERSION } = require('../services/embedding');
const { buildVideoText } = require('../services/youtube');

const MAX_PROFILE_VIDEOS = 50;
const CATEGORY_CANDIDATE_LIMIT = 25;
const INITIAL_MATCH_LIMIT = 5;
const MATCH_DELIVERIES = 'matchDeliveries';

function firestoreUnavailable(res) {
  const setupHint = firebaseInitError ? ' Firebase Admin credentials are missing or invalid.' : '';
  return res.status(503).json({ error: `Firestore is unavailable.${setupHint} Add the Firebase service-account credential to the Render backend and make sure Firestore Database is created.` });
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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function categoryScore(userA, userB) {
  const categoriesA = userA.categoryDistribution || {};
  const categoriesB = userB.categoryDistribution || {};
  const categoryIds = new Set([...Object.keys(categoriesA), ...Object.keys(categoriesB)]);
  const vectorA = [];
  const vectorB = [];
  categoryIds.forEach(id => {
    vectorA.push(categoriesA[id] || 0);
    vectorB.push(categoriesB[id] || 0);
  });
  return Math.round(Math.max(0, Math.min(1, cosineSimilarity(vectorA, vectorB))) * 100);
}

function matchPriority(user, candidate) {
  const sameLocation = Boolean(
    user.profileDetails?.location?.id &&
    user.profileDetails.location.id === candidate.profileDetails?.location?.id
  );
  const ageDifference = Math.abs(Number(user.profileDetails?.age) - Number(candidate.profileDetails?.age));
  const withinPreferredAgeRange = Number.isFinite(ageDifference) && ageDifference <= 5;

  // Location is the first gate, then the preferred +/- five-year age range.
  return (sameLocation ? 0 : 2) + (withinPreferredAgeRange ? 0 : 1);
}

function isEligibleProfile(profile) {
  return Boolean(profile?.onboarded && profile?.detailsComplete && Array.isArray(profile.embedding) && profile.embedding.length);
}

async function findTopMatches(userId, userProfile) {
  const usersSnapshot = await runFirestore(() => db.collection('users').where('onboarded', '==', true).get());
  const candidates = [];

  usersSnapshot.forEach(doc => {
    if (doc.id === userId) return;
    const otherUser = doc.data();
    if (!isEligibleProfile(otherUser)) return;

    candidates.push({
      userId: doc.id,
      profile: otherUser,
      priority: matchPriority(userProfile, otherUser),
      categoryScore: categoryScore(userProfile, otherUser)
    });
  });

  // Category similarity is deliberately the inexpensive first pass. Only the
  // top 25 location/age-prioritised candidates receive vector scoring.
  const shortlisted = candidates
    .sort((a, b) => a.priority - b.priority || b.categoryScore - a.categoryScore)
    .slice(0, CATEGORY_CANDIDATE_LIMIT);

  return shortlisted
    .map(candidate => ({
      matchId: getMatchId(userId, candidate.userId),
      userId: candidate.userId,
      displayName: candidate.profile.displayName || 'Murmur member',
      photoURL: candidate.profile.photoURL || null,
      priority: candidate.priority,
      ...computeMatchScore(userProfile, candidate.profile)
    }))
    .sort((a, b) => a.priority - b.priority || b.score - a.score);
}

async function saveMatches(userId, matches) {
  await runFirestore(() => Promise.all(matches.map(match => (
    db.collection('matches').doc(match.matchId).set({
      users: [userId, match.userId],
      score: match.score,
      rawScore: match.rawScore,
      scoreScaleVersion: match.scoreScaleVersion,
      embeddingScore: match.embeddingScore,
      categoryScore: match.categoryScore,
      updatedAt: new Date()
    }, { merge: true })
  ))));
}

function deliveryId(userId, otherUserId) {
  return `${userId}_${otherUserId}`;
}

async function getDeliveries(userId) {
  const snapshot = await runFirestore(() => db.collection(MATCH_DELIVERIES).where('userId', '==', userId).get());
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function deliverMatches(userId, matches, { initial = false } = {}) {
  const deliveredAt = new Date();
  const deliveredDate = todayKey();
  await runFirestore(() => Promise.all(matches.map(match => (
    db.collection(MATCH_DELIVERIES).doc(deliveryId(userId, match.userId)).set({
      userId,
      otherUserId: match.userId,
      matchId: match.matchId,
      displayName: match.displayName,
      photoURL: match.photoURL,
      score: match.score,
      rawScore: match.rawScore,
      scoreScaleVersion: match.scoreScaleVersion,
      embeddingScore: match.embeddingScore,
      categoryScore: match.categoryScore,
      deliveredAt,
      deliveredDate,
      initial
    }, { merge: true })
  ))));
}

async function ensureDailyMatch(userId, userProfile) {
  if (userProfile.lastMatchDeliveryDate === todayKey()) return;

  const [candidates, deliveries] = await Promise.all([
    findTopMatches(userId, userProfile),
    getDeliveries(userId)
  ]);
  const deliveredUserIds = new Set(deliveries.map(delivery => delivery.otherUserId));
  const nextMatch = candidates.find(candidate => !deliveredUserIds.has(candidate.userId));
  if (!nextMatch) return;

  await saveMatches(userId, [nextMatch]);
  await deliverMatches(userId, [nextMatch]);
  await runFirestore(() => db.collection('users').doc(userId).set({ lastMatchDeliveryDate: todayKey() }, { merge: true }));
}

async function ensureInitialMatches(userId, userProfile) {
  if (userProfile.initialMatchesDelivered) return;
  const candidates = await findTopMatches(userId, userProfile);
  const initialMatches = candidates.slice(0, INITIAL_MATCH_LIMIT);
  await saveMatches(userId, initialMatches);
  await deliverMatches(userId, initialMatches, { initial: true });
  await runFirestore(() => db.collection('users').doc(userId).set({ initialMatchesDelivered: true, lastMatchDeliveryDate: todayKey() }, { merge: true }));
}

async function getChatStatuses(userId) {
  const snapshot = await runFirestore(() => db.collection('chats').where('users', 'array-contains', userId).get());
  const statuses = new Map();

  snapshot.forEach(doc => {
    const chat = doc.data();
    const readBy = chat.readBy || [];
    statuses.set(doc.id, {
      hasStartedConversation: Boolean(chat.lastMessage),
      hasUnreadMessages: Boolean(chat.lastSenderId && chat.lastSenderId !== userId && !readBy.includes(userId))
    });
  });

  return statuses;
}

async function listDeliveredMatches(userId) {
  const [deliveries, chatStatuses] = await Promise.all([getDeliveries(userId), getChatStatuses(userId)]);
  const today = todayKey();
  return deliveries
    .map(delivery => ({
      ...delivery,
      // Delivery records created before score-scale version 2 stored the old
      // raw score. Transform them at read time so existing matches immediately
      // receive the new presentation scale without a migration.
      score: delivery.scoreScaleVersion === MATCH_SCORE_SCALE_VERSION
        ? delivery.score
        : skewMatchScore(delivery.score),
      // The client treats userId as the matched member. Keep the recipient
      // separately so profile and chat links never route back to themselves.
      recipientUserId: delivery.userId,
      userId: delivery.otherUserId,
      hasUnreadMessages: chatStatuses.get(delivery.matchId)?.hasUnreadMessages || false,
      hasStartedConversation: chatStatuses.get(delivery.matchId)?.hasStartedConversation || false,
      deliveredToday: delivery.deliveredDate === today
    }))
    .sort((a, b) => (b.deliveredAt?.toDate?.() || new Date(0)) - (a.deliveredAt?.toDate?.() || new Date(0)));
}

router.post('/compute', async (req, res) => {
  try {
    const { userId, likedVideos, subscriptions } = req.body;
    if (!userId || !likedVideos || !subscriptions) return res.status(400).json({ error: 'Missing required data' });
    if (!db) return firestoreUnavailable(res);

    const userRef = db.collection('users').doc(userId);
    const existingUserDoc = await runFirestore(() => userRef.get());
    const existingUser = existingUserDoc.exists ? existingUserDoc.data() : {};
    const profileVideos = likedVideos.slice(0, MAX_PROFILE_VIDEOS);
    const videoEmbeddings = await batchEmbed(profileVideos.map(buildVideoText));
    const categoryDistribution = {};
    let categoryCount = 0;
    likedVideos.forEach(video => {
      const categoryId = video.snippet?.categoryId;
      if (!categoryId) return;
      categoryDistribution[categoryId] = (categoryDistribution[categoryId] || 0) + 1;
      categoryCount++;
    });
    if (categoryCount) Object.keys(categoryDistribution).forEach(id => { categoryDistribution[id] /= categoryCount; });

    const profileData = {
      embedding: createUserEmbedding(videoEmbeddings),
      categoryDistribution,
      onboarded: true,
      youtubeData: {
        likedVideoCount: likedVideos.length,
        subscriptionCount: subscriptions.length,
        topCategories: Object.keys(categoryDistribution).sort((a, b) => categoryDistribution[b] - categoryDistribution[a]).slice(0, 5),
        lastUpdatedAt: new Date(),
        savedLikedVideos: likedVideos.slice(0, 100).map(video => ({
          id: video.id,
          title: video.snippet?.title || 'Unknown Title',
          channelTitle: video.snippet?.channelTitle || 'Unknown Creator',
          thumbnailUrl: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || null,
          categoryId: video.snippet?.categoryId || null
        }))
      },
      youtubeRefreshSkipped: false,
      updatedAt: new Date()
    };
    await runFirestore(() => userRef.set(profileData, { merge: true }));

    const completeProfile = { ...existingUser, ...profileData };
    const candidates = isEligibleProfile(completeProfile) ? await findTopMatches(userId, completeProfile) : [];
    await saveMatches(userId, candidates);

    let deliveredMatches = [];
    if (!existingUser.initialMatchesDelivered) {
      deliveredMatches = candidates.slice(0, INITIAL_MATCH_LIMIT);
      await deliverMatches(userId, deliveredMatches, { initial: true });
      await runFirestore(() => userRef.set({ initialMatchesDelivered: true, lastMatchDeliveryDate: todayKey() }, { merge: true }));
    }

    res.json({ matches: deliveredMatches, profileData, candidateCount: candidates.length });
  } catch (error) {
    console.error('Error computing matches:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to compute matches. Check the Render logs for the underlying error.' });
  }
});

router.get('/:userId/:otherUserId', async (req, res) => {
  try {
    const { userId, otherUserId } = req.params;
    if (!db) return firestoreUnavailable(res);
    const [userDoc, otherUserDoc] = await Promise.all([db.collection('users').doc(userId).get(), db.collection('users').doc(otherUserId).get()]);
    if (!userDoc.exists || !otherUserDoc.exists || !isEligibleProfile(userDoc.data()) || !isEligibleProfile(otherUserDoc.data())) {
      return res.status(404).json({ error: 'A match score is not available for this member.' });
    }
    const matchId = getMatchId(userId, otherUserId);
    const deliveryDoc = await db.collection(MATCH_DELIVERIES).doc(deliveryId(userId, otherUserId)).get();
    return res.json({ match: { matchId, userId: otherUserId, isMatched: deliveryDoc.exists, ...computeMatchScore(userDoc.data(), otherUserDoc.data()) } });
  } catch (error) {
    console.error('Error fetching match score:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not calculate this match score.' });
  }
});

// Lets a member add an eligible profile they discovered to their own Matches list.
router.post('/add', async (req, res) => {
  try {
    const { userId, otherUserId } = req.body;
    if (!userId || !otherUserId || userId === otherUserId) {
      return res.status(400).json({ error: 'Choose another member to add to your matches.' });
    }
    if (!db) return firestoreUnavailable(res);

    const [userDoc, otherUserDoc] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('users').doc(otherUserId).get()
    ]);
    if (!userDoc.exists || !otherUserDoc.exists || !isEligibleProfile(userDoc.data()) || !isEligibleProfile(otherUserDoc.data())) {
      return res.status(404).json({ error: 'This member is not available to add yet.' });
    }

    const otherUser = otherUserDoc.data();
    const match = {
      matchId: getMatchId(userId, otherUserId),
      userId: otherUserId,
      displayName: otherUser.displayName || 'Murmur member',
      photoURL: otherUser.photoURL || null,
      ...computeMatchScore(userDoc.data(), otherUser)
    };
    await saveMatches(userId, [match]);
    await deliverMatches(userId, [match]);
    return res.status(201).json({ match: { ...match, isMatched: true } });
  } catch (error) {
    console.error('Error adding match:', error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not add this member to your matches.' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!db) return firestoreUnavailable(res);
    const userDoc = await runFirestore(() => db.collection('users').doc(userId).get());
    if (!userDoc.exists || !isEligibleProfile(userDoc.data())) return res.json({ matches: [], totalMatches: 0 });

    if (!userDoc.data().initialMatchesDelivered) {
      await ensureInitialMatches(userId, userDoc.data());
    } else {
      await ensureDailyMatch(userId, userDoc.data());
    }
    const matches = await listDeliveredMatches(userId);
    res.json({ matches, totalMatches: matches.length });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to fetch matches. Check the Render logs for the underlying error.' });
  }
});

module.exports = router;
