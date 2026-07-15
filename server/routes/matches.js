const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { batchEmbed, createUserEmbedding, computeMatchScore } = require('../services/embedding');
const { buildVideoText } = require('../services/youtube');

router.post('/compute', async (req, res) => {
  try {
    const { userId, likedVideos, subscriptions } = req.body;
    
    if (!userId || !likedVideos || !subscriptions) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    console.log(`Computing profile for user ${userId}...`);

    // 1. Generate text for each video
    const videoTexts = likedVideos.map(buildVideoText);
    
    // 2. Generate embeddings for videos
    console.log(`Generating embeddings for ${videoTexts.length} videos...`);
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

    // 6. Store user profile
    if (db) {
      await db.collection('users').doc(userId).set(profileData, { merge: true });
    }

    // 7. Fetch other users and compute matches
    let matches = [];
    if (db) {
      console.log('Fetching other users to compute matches...');
      const usersSnapshot = await db.collection('users').where('onboarded', '==', true).get();
      
      const matchPromises = [];

      usersSnapshot.forEach(doc => {
        const otherUserId = doc.id;
        if (otherUserId === userId) return;

        const otherUser = doc.data();
        
        // Ensure other user has embedding
        if (!otherUser.embedding || otherUser.embedding.length === 0) return;

        // 8. Compute score
        const matchResult = computeMatchScore(profileData, otherUser);
        
        // 9. Store match
        const sortedIds = [userId, otherUserId].sort();
        const matchId = sortedIds.join('_');
        
        const matchDoc = {
          users: [userId, otherUserId],
          score: matchResult.score,
          embeddingScore: matchResult.embeddingScore,
          subscriptionScore: matchResult.subscriptionScore,
          categoryScore: matchResult.categoryScore,
          createdAt: new Date()
        };

        matchPromises.push(db.collection('matches').doc(matchId).set(matchDoc));
        
        matches.push({
          matchId,
          userId: otherUserId,
          displayName: otherUser.displayName,
          photoURL: otherUser.photoURL,
          ...matchResult
        });
      });

      await Promise.all(matchPromises);
      console.log(`Generated ${matches.length} matches`);
    }

    // Sort matches descending by score
    matches.sort((a, b) => b.score - a.score);

    res.json({ matches });

  } catch (error) {
    console.error('Error computing matches:', error);
    res.status(500).json({ error: 'Failed to compute matches' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!db) {
      return res.json({ matches: [] });
    }

    const matchesSnapshot = await db.collection('matches')
      .where('users', 'array-contains', userId)
      .get();

    const matches = [];
    const userFetchPromises = [];

    matchesSnapshot.forEach(doc => {
      const data = doc.data();
      const otherUserId = data.users.find(id => id !== userId);
      
      if (otherUserId) {
        // Fetch other user's profile
        const promise = db.collection('users').doc(otherUserId).get().then(userDoc => {
          if (userDoc.exists) {
            const userData = userDoc.data();
            matches.push({
              matchId: doc.id,
              userId: otherUserId,
              displayName: userData.displayName,
              photoURL: userData.photoURL,
              score: data.score,
              embeddingScore: data.embeddingScore,
              subscriptionScore: data.subscriptionScore,
              categoryScore: data.categoryScore,
              createdAt: data.createdAt
            });
          }
        });
        userFetchPromises.push(promise);
      }
    });

    await Promise.all(userFetchPromises);
    
    matches.sort((a, b) => b.score - a.score);
    
    res.json({ matches });

  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

module.exports = router;
