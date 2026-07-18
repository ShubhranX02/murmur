const express = require('express');
const router = express.Router();
const { db, FieldValue } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');

const MAX_PARTICIPANT_LIMIT = 30;

router.use(authenticate);

function toDate(value) {
  return value?.toDate ? value.toDate() : new Date(value);
}

function serialiseActivity(id, data) {
  const expiresAt = toDate(data.expiresAt);
  const createdAt = toDate(data.createdAt || Date.now());
  return {
    id,
    ...data,
    expiresAt: Number.isNaN(expiresAt.getTime()) ? null : expiresAt.toISOString(),
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString()
  };
}

function getParticipantLimit(activity) {
  // Older conversations stored `limit` as people in addition to the publisher.
  return Number.isInteger(activity.participantLimit)
    ? activity.participantLimit
    : Number(activity.limit || 0) + 1;
}

async function getMatchUserIds(userId) {
  const matchesSnapshot = await db.collection('matches').where('users', 'array-contains', userId).get();
  const matchIds = new Set();
  matchesSnapshot.forEach(doc => {
    const otherId = (doc.data().users || []).find(id => id !== userId);
    if (otherId) matchIds.add(otherId);
  });
  return matchIds;
}

router.post('/create', async (req, res) => {
  try {
    const { video, participantLimit, expiresInHours, audience = 'matches' } = req.body;
    const publisherId = req.auth.userId;
    const totalParticipantLimit = parseInt(participantLimit, 10);
    
    if (!publisherId || !video || !totalParticipantLimit || !expiresInHours) {
      return res.status(400).json({ error: 'Missing required activity fields' });
    }

    if (!video.id || !video.title || typeof video.id !== 'string' || typeof video.title !== 'string' || video.title.length > 200 || totalParticipantLimit < 2 || totalParticipantLimit > MAX_PARTICIPANT_LIMIT) {
      return res.status(400).json({ error: `Conversations must allow between 2 and ${MAX_PARTICIPANT_LIMIT} people.` });
    }
    const duration = parseInt(expiresInHours, 10);
    if (!Number.isInteger(duration) || duration < 1 || duration > 168) return res.status(400).json({ error: 'Choose a duration between 1 hour and 7 days.' });
    if (!['public', 'matches'].includes(audience)) {
      return res.status(400).json({ error: 'Choose who can participate in this conversation.' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + duration);

    // Fetch publisher details for denormalization
    const publisherDoc = await db.collection('users').doc(publisherId).get();
    const publisherName = publisherDoc.exists ? publisherDoc.data().displayName : 'Unknown Publisher';

    const activityData = {
      publisherId,
      publisherName,
      video, // { id, title, channelTitle, thumbnailUrl }
      // Retain the legacy limit field for old clients, but make new rooms use
      // an explicit total capacity that includes the publisher.
      limit: totalParticipantLimit - 1,
      participantLimit: totalParticipantLimit,
      audience,
      videoTitleLower: video.title.toLowerCase(),
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
    const userId = req.auth.userId;

    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const matchIds = await getMatchUserIds(userId);

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
    
    const activityById = new Map();
    
    for (const chunk of chunks) {
      const activitiesSnapshot = await db.collection('activities')
        .where('publisherId', 'in', chunk)
        .get();
        
      activitiesSnapshot.forEach(doc => {
        const data = doc.data();
        const expiresAtDate = toDate(data.expiresAt);
        
        if (expiresAtDate > now) {
          activityById.set(doc.id, serialiseActivity(doc.id, data));
        }
      });
    }

    // Conversations discovered and joined by the member must remain visible,
    // even when their creator is not one of the member's matches.
    const joinedSnapshot = await db.collection('activities').where('participants', 'array-contains', userId).get();
    joinedSnapshot.forEach(doc => {
      const data = doc.data();
      if (toDate(data.expiresAt) > now) activityById.set(doc.id, serialiseActivity(doc.id, data));
    });

    const allActivities = [...activityById.values()];

    // Sort all by recency (newest first)
    allActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ activities: allActivities });

  } catch (error) {
    // If the index is missing, Firestore will throw an error with a URL to create it.
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities. Check Firestore indexes.' });
  }
});

// Discover public, live conversations the member has not yet joined, filtered
// by YouTube category or video title. Firestore does not support portable
// case-insensitive substring search, so the MVP filters active rooms server-side.
router.get('/discover', async (req, res) => {
  try {
    const { categoryId, q = '' } = req.query;
    const userId = req.auth.userId;
    if (!db) return res.status(503).json({ error: 'Database not configured' });

    const snapshot = await db.collection('activities').get();
    const query = String(q).trim().toLowerCase();
    const selectedCategoryId = String(categoryId || 'all');
    const activities = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(activity => {
        const expiresAt = toDate(activity.expiresAt);
        const participants = activity.participants || [];
        return activity.audience === 'public'
          && !participants.includes(userId)
          && !Number.isNaN(expiresAt.getTime())
          && expiresAt > new Date()
          && participants.length < getParticipantLimit(activity);
      })
      .filter(activity => selectedCategoryId === 'all' || String(activity.video?.categoryId || '') === selectedCategoryId)
      .filter(activity => !query || String(activity.video?.title || '').toLowerCase().includes(query))
      .map(activity => serialiseActivity(activity.id, activity))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ activities });
  } catch (error) {
    console.error('Error discovering activities:', error);
    return res.status(500).json({ error: 'Could not load discover conversations.' });
  }
});

router.post('/:activityId/join', async (req, res) => {
  try {
    const { activityId } = req.params;
    const userId = req.auth.userId;
    
    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const matchIds = await getMatchUserIds(userId);
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

      if (data.audience !== 'public' && !matchIds.has(data.publisherId)) {
        throw new Error('Only matches of the creator can join this conversation');
      }

      if (participants.length >= getParticipantLimit(data)) {
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
    const { text } = req.body;
    const senderId = req.auth.userId;
    const messageText = String(text || '').trim();
    
    if (!senderId || !messageText) {
      return res.status(400).json({ error: 'Missing required chat fields' });
    }
    if (messageText.length > 4000) return res.status(400).json({ error: 'Messages must be 4,000 characters or fewer.' });

    if (!db) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const activityRef = db.collection('activities').doc(activityId);
    const activityDoc = await activityRef.get();
    if (!activityDoc.exists) return res.status(404).json({ error: 'Activity not found' });
    if (!(activityDoc.data().participants || []).includes(senderId)) {
      return res.status(403).json({ error: 'Join this conversation before sending a message.' });
    }

    const messageData = {
      senderId,
      text: messageText,
      createdAt: FieldValue.serverTimestamp()
    };
    
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

    const activityRef = db.collection('activities').doc(activityId);
    const activityDoc = await activityRef.get();
    if (!activityDoc.exists) return res.status(404).json({ error: 'Activity not found' });
    if (!(activityDoc.data().participants || []).includes(req.auth.userId)) return res.status(403).json({ error: 'Join this conversation before reading its messages.' });

    const messagesSnapshot = await activityRef
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
    if (!(data.participants || []).includes(req.auth.userId)) return res.status(403).json({ error: 'Join this conversation before viewing its details.' });
    
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

router.delete('/:activityId', async (req, res) => {
  try {
    const { activityId } = req.params;
    const userId = req.auth.userId;

    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const activityRef = db.collection('activities').doc(activityId);
    const doc = await activityRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    if (doc.data().publisherId !== userId) {
      return res.status(403).json({ error: 'Only the creator can delete this activity' });
    }

    // Delete the activity doc
    await activityRef.delete();
    
    // Note: We don't delete the messages subcollection to keep this simple (Firestore requires batch deletion or recursive delete, which is fine to skip for an MVP or let expire/cleanup separately).

    res.json({ success: true, message: 'Activity deleted' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

module.exports = router;
