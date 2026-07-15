const express = require('express');
const router = express.Router();
const { tokenStore } = require('./auth');
const { fetchLikedVideos, fetchSubscriptions } = require('../services/youtube');

router.post('/fetch', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const accessToken = tokenStore.get(userId);
    if (!accessToken) {
      return res.status(401).json({ error: 'YouTube access token not found. Please connect YouTube first.' });
    }

    console.log(`Fetching YouTube data for user ${userId}...`);
    
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
