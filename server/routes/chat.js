const express = require('express');
const router = express.Router();
const { db, FieldValue } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

function serialiseChatTimestamp(value) {
  return value?.toDate ? value.toDate().toISOString() : null;
}

function serialiseMessage(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: serialiseChatTimestamp(data.createdAt) || new Date().toISOString()
  };
}

async function getAuthorizedChat(chatId, userId) {
  const chatRef = db.collection('chats').doc(chatId);
  const chatDoc = await chatRef.get();
  if (chatDoc.exists && chatDoc.data().isGroup) {
    return (chatDoc.data().users || []).includes(userId) ? { chatRef, chatDoc, users: chatDoc.data().users } : null;
  }

  const users = chatId.split('_');
  if (users.length !== 2 || !users.includes(userId)) return null;
  const matchDoc = await db.collection('matches').doc(chatId).get();
  if (!matchDoc.exists || !(matchDoc.data().users || []).every(id => users.includes(id))) return null;
  return { chatRef, chatDoc, users };
}

router.post('/groups', async (req, res) => {
  try {
    const { name, memberIds = [] } = req.body;
    const creatorId = req.auth.userId;
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
    if (req.params.userId !== req.auth.userId) return res.status(403).json({ error: 'You can only view your own groups.' });
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
    const { chatId, text, replyTo, clientMessageId } = req.body;
    const senderId = req.auth.userId;
    const messageText = typeof text === 'string' ? text.trim() : '';
    const safeClientMessageId = typeof clientMessageId === 'string' && clientMessageId.length <= 128
      ? clientMessageId
      : null;
    
    if (typeof chatId !== 'string' || !messageText) {
      return res.status(400).json({ error: 'Missing required chat fields' });
    }
    if (messageText.length > 4000) {
      return res.status(400).json({ error: 'Messages must be 4,000 characters or fewer.' });
    }

    if (!db) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const replyContext = replyTo && typeof replyTo === 'object' && typeof replyTo.id === 'string' && typeof replyTo.text === 'string'
      ? {
        id: replyTo.id,
        text: replyTo.text.slice(0, 4000),
        ...(typeof replyTo.senderId === 'string' ? { senderId: replyTo.senderId } : {})
      }
      : null;

    const messageData = {
      senderId,
      text: messageText,
      createdAt: FieldValue.serverTimestamp()
    };
    if (replyContext) messageData.replyTo = replyContext;

    const authorizedChat = await getAuthorizedChat(chatId, senderId);
    if (!authorizedChat) return res.status(403).json({ error: 'You cannot send messages in this chat.' });
    const { chatRef, users } = authorizedChat;

    // A retried request keeps the original client ID, making delivery safe when
    // a browser loses the first server response after the message was written.
    if (safeClientMessageId) {
      const existingMessage = await chatRef.collection('messages')
        .where('clientMessageId', '==', safeClientMessageId)
        .limit(1)
        .get();
      if (!existingMessage.empty) {
        return res.json({ success: true, message: serialiseMessage(existingMessage.docs[0]) });
      }
    }

    if (safeClientMessageId) messageData.clientMessageId = safeClientMessageId;
    
    // Write message to subcollection
    const messageRef = await chatRef.collection('messages').add(messageData);

    // Update parent doc
    await chatRef.set({
      users,
      lastMessage: messageText,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastSenderId: senderId,
      readBy: [senderId]
    }, { merge: true });

    res.json({
      success: true,
      message: {
        id: messageRef.id,
        senderId,
        text: messageText,
        createdAt: new Date().toISOString(),
        ...(safeClientMessageId ? { clientMessageId: safeClientMessageId } : {}),
        ...(replyContext ? { replyTo: replyContext } : {})
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/:chatId/read', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.auth.userId;

    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const authorizedChat = await getAuthorizedChat(chatId, userId);
    if (!authorizedChat) return res.status(403).json({ error: 'You cannot access this chat.' });
    await authorizedChat.chatRef.set({
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

    const authorizedChat = await getAuthorizedChat(chatId, req.auth.userId);
    if (!authorizedChat) return res.status(403).json({ error: 'You cannot access this chat.' });
    const messagesSnapshot = await authorizedChat.chatRef
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();

    const messages = messagesSnapshot.docs.map(serialiseMessage);

    res.json({ messages });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
