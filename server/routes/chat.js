const express = require('express');
const router = express.Router();
const { db, FieldValue } = require('../config/firebase');

function serialiseChatTimestamp(value) {
  return value?.toDate ? value.toDate().toISOString() : null;
}

router.post('/groups', async (req, res) => {
  try {
    const { creatorId, name, memberIds = [] } = req.body;
    const groupName = String(name || '').trim();
    const requestedMemberIds = Array.isArray(memberIds) ? memberIds : [];
    const selectedMemberIds = [...new Set(requestedMemberIds)]
      .filter(memberId => typeof memberId === 'string' && memberId && memberId !== creatorId);

    if (typeof creatorId !== 'string' || !creatorId || !groupName) {
      return res.status(400).json({ error: 'Enter a name for your group.' });
    }
    if (groupName.length > 80) {
      return res.status(400).json({ error: 'Keep the group name to 80 characters or fewer.' });
    }
    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // A group can only include people the creator has already matched with.
    const deliveries = await db.collection('matchDeliveries').where('userId', '==', creatorId).get();
    const matchedUserIds = new Set(deliveries.docs.map(doc => doc.data().otherUserId));
    if (selectedMemberIds.some(memberId => !matchedUserIds.has(memberId))) {
      return res.status(400).json({ error: 'Groups can only include your matches.' });
    }

    const groupRef = db.collection('chats').doc();
    const users = [creatorId, ...selectedMemberIds];
    await groupRef.set({
      users,
      isGroup: true,
      groupName,
      createdBy: creatorId,
      createdAt: FieldValue.serverTimestamp(),
      lastMessage: '',
      lastMessageAt: FieldValue.serverTimestamp(),
      lastSenderId: null,
      readBy: [creatorId]
    });

    return res.status(201).json({
      group: {
        chatId: groupRef.id,
        matchId: groupRef.id,
        isGroup: true,
        displayName: groupName,
        memberCount: users.length,
        hasStartedConversation: false,
        hasUnreadMessages: false
      }
    });
  } catch (error) {
    console.error('Error creating group chat:', error);
    return res.status(500).json({ error: 'Could not create the group chat.' });
  }
});

router.get('/groups/:userId', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' });

    const snapshot = await db.collection('chats').where('users', 'array-contains', req.params.userId).get();
    const groups = snapshot.docs
      .filter(doc => doc.data().isGroup)
      .map(doc => {
        const group = doc.data();
        const readBy = group.readBy || [];
        return {
          chatId: doc.id,
          matchId: doc.id,
          isGroup: true,
          displayName: group.groupName || 'Untitled group',
          memberCount: (group.users || []).length,
          hasStartedConversation: Boolean(group.lastMessage),
          hasUnreadMessages: Boolean(group.lastSenderId && group.lastSenderId !== req.params.userId && !readBy.includes(req.params.userId)),
          lastMessageAt: serialiseChatTimestamp(group.lastMessageAt || group.createdAt)
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

    return res.json({ groups });
  } catch (error) {
    console.error('Error loading group chats:', error);
    return res.status(500).json({ error: 'Could not load group chats.' });
  }
});

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

    const chatRef = db.collection('chats').doc(chatId);
    const existingChat = await chatRef.get();
    const users = existingChat.exists && existingChat.data().isGroup
      ? existingChat.data().users || []
      : chatId.split('_');

    if (existingChat.exists && existingChat.data().isGroup && !users.includes(senderId)) {
      return res.status(403).json({ error: 'You are not a member of this group.' });
    }
    
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
