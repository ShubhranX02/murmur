import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatBubble from './ChatBubble';
import MatchScore from './MatchScore';
import './ChatPanel.css';

function ChatPanel({ match, isSidebarCollapsed, onToggleSidebar }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [serverMessages, setServerMessages] = useState([]);
  const [pendingMessages, setPendingMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [messageMenu, setMessageMenu] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const messagesEndRef = useRef(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const isGroup = Boolean(match?.isGroup);
  const matchedUserId = match?.otherUserId || match?.userId;
  const chatId = isGroup
    ? match.chatId
    : matchedUserId && user ? [user.id, matchedUserId].sort().join('_') : null;

  const messages = useMemo(() => {
    const deliveredClientIds = new Set(serverMessages.map(message => message.clientMessageId).filter(Boolean));
    const visiblePending = pendingMessages.filter(message => !deliveredClientIds.has(message.clientMessageId));
    return [...serverMessages, ...visiblePending]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [pendingMessages, serverMessages]);

  useEffect(() => { setServerMessages([]); setPendingMessages([]); setInputText(''); setEditingId(null); setReplyTo(null); }, [chatId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!chatId || !user) return undefined;
    const fetchMessages = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/chat/${chatId}/messages`);
        if (!res.ok) return;
        const data = await res.json();
        const nextMessages = data.messages || [];
        setServerMessages(nextMessages);
        if (nextMessages.some(message => message.senderId !== user.id)) {
          fetch(`${apiUrl}/api/chat/${chatId}/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }).catch(console.error);
        }
      } catch (error) { console.error('Failed to fetch messages:', error); }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [apiUrl, chatId, user]);

  const deliverMessage = async optimisticMessage => {
    try {
      const response = await fetch(`${apiUrl}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          senderId: user.id,
          text: optimisticMessage.text,
          replyTo: optimisticMessage.replyTo,
          clientMessageId: optimisticMessage.clientMessageId
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to send message');
      setPendingMessages(current => current.map(message => message.clientMessageId === optimisticMessage.clientMessageId
        ? { ...message, deliveryState: 'sent' }
        : message));
    } catch (error) {
      console.error('Failed to send message:', error);
      setPendingMessages(current => current.map(message => message.clientMessageId === optimisticMessage.clientMessageId
        ? { ...message, deliveryState: 'failed' }
        : message));
    }
  };

  const handleSend = event => {
    event.preventDefault();
    const text = inputText.trim();
    if (!chatId || !text) return;
    if (editingId) {
      setServerMessages(current => current.map(message => message.id === editingId ? { ...message, text, edited: true } : message));
      setInputText(''); setEditingId(null); return;
    }
    const replyContext = replyTo ? {
      id: replyTo.id,
      text: replyTo.text,
      senderId: replyTo.senderId
    } : null;
    const clientMessageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage = {
      id: `pending-${clientMessageId}`,
      clientMessageId,
      senderId: user.id,
      text,
      createdAt: new Date().toISOString(),
      replyTo: replyContext,
      deliveryState: 'sending'
    };
    setInputText(''); setReplyTo(null);
    setPendingMessages(current => [...current, optimisticMessage]);
    void deliverMessage(optimisticMessage);
  };

  const retryMessage = message => {
    const retryingMessage = { ...message, deliveryState: 'sending' };
    setPendingMessages(current => current.map(item => item.clientMessageId === message.clientMessageId ? retryingMessage : item));
    void deliverMessage(retryingMessage);
  };

  const handleMessageAction = async (action, message) => {
    setMessageMenu(null);
    if (action === 'Copy') await navigator.clipboard?.writeText(message.text);
    if (action === 'Delete') setServerMessages(current => current.filter(item => item.id !== message.id));
    if (action === 'Reply') setReplyTo(message);
    if (action === 'Edit') { setEditingId(message.id); setInputText(message.text); }
    if (action === 'Pin') setServerMessages(current => current.map(item => item.id === message.id ? { ...item, pinned: !item.pinned } : item));
  };

  if (!match) return <section className="conversation-pane empty-conversation"><div className="empty-conversation-content"><span className="empty-conversation-icon">💬</span><h2>Click on any chat to message</h2><p>Select a match or group from the left to start a conversation.</p></div></section>;

  return (
    <section className="conversation-pane">
      <header className="conversation-header">
        <button 
          type="button" 
          className="sidebar-toggle-in-header" 
          onClick={onToggleSidebar}
          aria-label={isSidebarCollapsed ? "Expand chats" : "Collapse chats"}
          title={isSidebarCollapsed ? "Expand chats" : "Collapse chats"}
        >
          {isSidebarCollapsed ? '☰' : '◀'}
        </button>
        {isGroup ? (
          <div className="conversation-group-heading">
            <span className="conversation-group-icon" aria-hidden="true">👥</span>
            <div><h2>{match.displayName}</h2><p>{match.memberCount} member{match.memberCount === 1 ? '' : 's'}</p></div>
          </div>
        ) : (
          <>
            <button type="button" className="conversation-profile-link" onClick={() => navigate(`/profile/${matchedUserId}`)} aria-label={`View ${match.displayName}'s profile`}>
              <img className="conversation-avatar" src={match.photoURL || '/default-avatar.png'} alt={match.displayName} />
            </button>
            <button type="button" className="conversation-profile-name" onClick={() => navigate(`/profile/${matchedUserId}`)}>
              <h2>{match.displayName}</h2>
            </button>
            <MatchScore score={match.score} className="match-score-info--header" />
          </>
        )}
      </header>
      <div className="conversation-messages">
        {messages.length === 0 ? <div className="conversation-empty-state">{isGroup ? `Start the conversation in ${match.displayName}.` : `Say hi to ${match.displayName}! You both share a great YouTube taste.`}</div> : messages.map((message, index) => (
          <ChatBubble key={message.id} message={message} isSent={message.senderId === user.id} senderPhoto={message.senderId === user.id ? user.photoURL : match.photoURL} showAvatar={index === 0 || messages[index - 1].senderId !== message.senderId} onDoubleClick={() => setMessageMenu(message)} onRetry={message.deliveryState === 'failed' ? () => retryMessage(message) : undefined} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      {messageMenu && (
        <div className="message-menu-backdrop" onClick={() => setMessageMenu(null)}>
          <div className="message-actions-menu glass" role="menu" onClick={e => e.stopPropagation()}>
            <div className="message-menu-header">Message Options</div>
            {(messageMenu.senderId === user.id 
              ? ['Delete', 'Copy', 'Reply', 'Pin', ...(Date.now() - new Date(messageMenu.createdAt).getTime() <= 600000 ? ['Edit'] : [])] 
              : ['Copy', 'Reply']
            ).map(action => (
              <button 
                key={action} 
                type="button" 
                role="menuitem" 
                className="menu-item" 
                onClick={() => handleMessageAction(action, messageMenu)}
              >
                {action === 'Pin' && messageMenu.pinned ? 'Unpin' : action}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="conversation-input-area">
        {replyTo && <div className="reply-preview"><div><span>Replying to {replyTo.senderId === user.id ? 'yourself' : match.displayName}</span><p>{replyTo.text}</p></div><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">×</button></div>}
        {editingId && <div className="reply-preview"><div><span>Editing message</span><p>Update your message before sending.</p></div><button type="button" onClick={() => { setEditingId(null); setInputText(''); }} aria-label="Cancel edit">×</button></div>}
        <form onSubmit={handleSend} className="conversation-form"><input className="conversation-input" type="text" value={inputText} onChange={event => setInputText(event.target.value)} placeholder={editingId ? 'Edit your message...' : replyTo ? 'Write a reply...' : `Message ${match.displayName}...`} autoComplete="off" /><button type="submit" className="conversation-send" disabled={!inputText.trim()} aria-label="Send message">➤</button></form>
      </div>
    </section>
  );
}

export default ChatPanel;
