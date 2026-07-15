const express = require('express');
const router = express.Router();
const { db, FieldValue } = require('../config/firebase');

router.post('/send', async (req, res) => {
  try {
    const { chatId, senderId, text } = req.body;
    
    if (!chatId || !senderId || !text) {
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

    // Extract users from chatId (e.g., "id1_id2")
    const users = chatId.split('_');

    const chatRef = db.collection('chats').doc(chatId);
    
    // Write message to subcollection
    await chatRef.collection('messages').add(messageData);

    // Update parent doc
    await chatRef.set({
      users,
      lastMessage: text,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastSenderId: senderId,
      readBy: [senderId]
    }, { merge: true });

    res.json({ success: true });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/:chatId/read', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    await db.collection('chats').doc(chatId).set({
      readBy: FieldValue.arrayUnion(userId)
    }, { merge: true });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking chat as read:', error);
    res.status(500).json({ error: 'Failed to mark chat as read' });
  }
});

router.get('/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    if (!db) {
      return res.json({ messages: [] });
    }

    const messagesSnapshot = await db.collection('chats')
      .doc(chatId)
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

module.exports = router;
