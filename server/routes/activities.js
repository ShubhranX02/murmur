const express = require('express');
const router = express.Router();
const { db, FieldValue } = require('../config/firebase');

router.post('/create', async (req, res) => {
  try {
    const { publisherId, video, limit, expiresInHours } = req.body;
    
    if (!publisherId || !video || !limit || !expiresInHours) {
      return res.status(400).json({ error: 'Missing required activity fields' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(expiresInHours, 10));

    // Fetch publisher details for denormalization
    const publisherDoc = await db.collection('users').doc(publisherId).get();
    const publisherName = publisherDoc.exists ? publisherDoc.data().displayName : 'Unknown Publisher';

    const activityData = {
      publisherId,
      publisherName,
      video, // { id, title, channelTitle, thumbnailUrl }
      limit: parseInt(limit, 10),
      expiresAt: expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      participants: [publisherId], // Publisher is always in the room
    };

    const docRef = await db.collection('activities').add(activityData);
    
    res.json({ success: true, activityId: docRef.id });

  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

// Get activities for a user's matches
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // First, find the user's matches from the database
    // We look in 'matches' collection where the user is one of the pair
    const matchesSnapshot = await db.collection('matches')
      .where('users', 'array-contains', userId)
      .get();
      
    // Collect all match user IDs
    const matchIds = new Set();
    matchesSnapshot.forEach(doc => {
      const { users } = doc.data();
      const otherId = users.find(id => id !== userId);
      if (otherId) matchIds.add(otherId);
    });

    // Also include the user's own activities so they can see/manage them
    matchIds.add(userId);

    const validPublisherIds = Array.from(matchIds);
    
    if (validPublisherIds.length === 0) {
      return res.json({ activities: [] });
    }

    // Firestore 'in' queries are limited to 10 items.
    // If a user has > 10 matches (currently MAX_MATCHES is 10 + self = 11),
    // we need to chunk the queries.
    const chunkArray = (arr, size) => 
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      );
      
    const chunks = chunkArray(validPublisherIds, 10);
    const now = new Date();
    
    let allActivities = [];
    
    for (const chunk of chunks) {
      const activitiesSnapshot = await db.collection('activities')
        .where('publisherId', 'in', chunk)
        .get();
        
      activitiesSnapshot.forEach(doc => {
        const data = doc.data();
        const expiresAtDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
        
        if (expiresAtDate > now) {
          allActivities.push({
            id: doc.id,
            ...data,
            expiresAt: expiresAtDate.toISOString(),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date(data.createdAt || Date.now()).toISOString()
          });
        }
      });
    }

    // Sort all by recency (newest first)
    allActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ activities: allActivities });

  } catch (error) {
    // If the index is missing, Firestore will throw an error with a URL to create it.
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities. Check Firestore indexes.' });
  }
});

router.post('/:activityId/join', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const activityRef = db.collection('activities').doc(activityId);
    
    // Use a transaction to safely check limit and join
    const result = await db.runTransaction(async (t) => {
      const doc = await t.get(activityRef);
      if (!doc.exists) {
        throw new Error('Activity not found');
      }

      const data = doc.data();
      const participants = data.participants || [];
      
      // Check expiration
      if (data.expiresAt.toDate() < new Date()) {
        throw new Error('This conversation has expired');
      }

      // Check if already joined
      if (participants.includes(userId)) {
        return { success: true, message: 'Already joined' };
      }

      // Limit excludes the publisher.
      // E.g., Limit 2 means 1 publisher + 2 participants = 3 max users in the room.
      if (participants.length >= data.limit + 1) {
        throw new Error('This conversation has reached its participant limit');
      }

      t.update(activityRef, {
        participants: FieldValue.arrayUnion(userId)
      });

      return { success: true, message: 'Joined successfully' };
    });

    res.json(result);

  } catch (error) {
    console.error('Error joining activity:', error);
    res.status(400).json({ error: error.message || 'Failed to join activity' });
  }
});

// Re-use chat logic for activity chats
router.post('/:activityId/send', async (req, res) => {
  try {
    const { activityId } = req.params;
    const { senderId, text } = req.body;
    
    if (!senderId || !text) {
      return res.status(400).json({ error: 'Missing required chat fields' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const messageData = {
      senderId,
      text,
      createdAt: FieldValue.serverTimestamp()
    };

    const activityRef = db.collection('activities').doc(activityId);
    
    // Write message to subcollection
    await activityRef.collection('messages').add(messageData);

    // Update parent doc
    await activityRef.set({
      lastMessage: text,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastSenderId: senderId,
    }, { merge: true });

    res.json({ success: true });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/:activityId/messages', async (req, res) => {
  try {
    const { activityId } = req.params;
    
    if (!db) {
      return res.json({ messages: [] });
    }

    const messagesSnapshot = await db.collection('activities')
      .doc(activityId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();

    const messages = [];
    messagesSnapshot.forEach(doc => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      });
    });

    res.json({ messages });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.get('/:activityId/details', async (req, res) => {
  try {
    const { activityId } = req.params;
    if (!db) return res.status(503).json({ error: 'DB not configured' });

    const doc = await db.collection('activities').doc(activityId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    const data = doc.data();
    
    // Fetch participant profiles for display
    let participantsProfiles = [];
    if (data.participants && data.participants.length > 0) {
      const profiles = await Promise.all(
        data.participants.map(async (pid) => {
          const uDoc = await db.collection('users').doc(pid).get();
          if (uDoc.exists) {
            return {
              id: uDoc.id,
              displayName: uDoc.data().displayName,
              photoURL: uDoc.data().photoURL
            };
          }
          return null;
        })
      );
      participantsProfiles = profiles.filter(Boolean);
    }

    res.json({
      activity: {
        id: doc.id,
        ...data,
        expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate().toISOString() : new Date(data.expiresAt).toISOString(),
        participantsProfiles
      }
    });

  } catch (error) {
    console.error('Error fetching activity details:', error);
    res.status(500).json({ error: 'Failed to fetch details' });
  }
});


module.exports = router;
