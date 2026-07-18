const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { decryptToken } = require('../services/tokenVault');
const { authenticate } = require('../middleware/auth');
const { fetchLikedVideos, fetchSubscriptions } = require('../services/youtube');

router.post('/fetch', authenticate, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' });
    const userDoc = await db.collection('users').doc(req.auth.userId).get();
    const accessToken = decryptToken(userDoc.data()?.youtubeAccessToken);
    if (!accessToken) {
      return res.status(401).json({ error: 'Your YouTube connection has expired. Please reconnect YouTube.' });
    }

    console.log(`Fetching YouTube data for authenticated user ${req.auth.userId}.`);
    
    const [likedVideos, subscriptions] = await Promise.all([
      fetchLikedVideos(accessToken),
      fetchSubscriptions(accessToken)
    ]);

    console.log(`Fetched ${likedVideos.length} liked videos and ${subscriptions.length} subscriptions`);

    res.json({
      likedVideos,
      subscriptions,
      stats: {
        likedCount: likedVideos.length,
        subscriptionCount: subscriptions.length
      }
    });

  } catch (error) {
    console.error('Error in /api/youtube/fetch:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube data' });
  }
});

module.exports = router;
