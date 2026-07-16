import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ChatBubble from './ChatBubble';
import './ChatPanel.css';

function ChatPanel({ match, isSidebarCollapsed, onToggleSidebar }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messageMenu, setMessageMenu] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const messagesEndRef = useRef(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const chatId = match && user ? [user.id, match.userId].sort().join('_') : null;

  useEffect(() => { setMessages([]); setInputText(''); setEditingId(null); setReplyTo(null); }, [chatId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!chatId || !user) return undefined;
    const fetchMessages = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/chat/${chatId}/messages`);
        if (!res.ok) return;
        const data = await res.json();
        const nextMessages = data.messages || [];
        setMessages(nextMessages);
        if (nextMessages.some(message => message.senderId !== user.id)) {
          fetch(`${apiUrl}/api/chat/${chatId}/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }).catch(console.error);
        }
      } catch (error) { console.error('Failed to fetch messages:', error); }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [apiUrl, chatId, user]);

  const handleSend = async event => {
    event.preventDefault();
    const text = inputText.trim();
    if (!chatId || !text || isSending) return;
    if (editingId) {
      setMessages(current => current.map(message => message.id === editingId ? { ...message, text, edited: true } : message));
      setInputText(''); setEditingId(null); return;
    }
    const optimisticMessage = { id: Date.now().toString(), senderId: user.id, text, createdAt: new Date().toISOString(), replyTo: replyTo ? { id: replyTo.id, text: replyTo.text } : null };
    setInputText(''); setIsSending(true); setReplyTo(null); setMessages(current => [...current, optimisticMessage]);
    try {
      const response = await fetch(`${apiUrl}/api/chat/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, senderId: user.id, text }) });
      if (!response.ok) throw new Error('Failed to send message');
    } catch (error) { console.error('Failed to send message:', error); } finally { setIsSending(false); }
  };

  const handleMessageAction = async (action, message) => {
    setMessageMenu(null);
    if (action === 'Copy') await navigator.clipboard?.writeText(message.text);
    if (action === 'Delete') setMessages(current => current.filter(item => item.id !== message.id));
    if (action === 'Reply') setReplyTo(message);
    if (action === 'Edit') { setEditingId(message.id); setInputText(message.text); }
    if (action === 'Pin') setMessages(current => current.map(item => item.id === message.id ? { ...item, pinned: !item.pinned } : item));
  };

  if (!match) return <section className="conversation-pane empty-conversation"><div className="empty-conversation-content"><span className="empty-conversation-icon">💬</span><h2>Click on any chat to message</h2><p>Select a match from the left to start a conversation.</p></div></section>;

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
        <img className="conversation-avatar" src={match.photoURL || '/default-avatar.png'} alt={match.displayName} />
        <div>
          <h2>{match.displayName}</h2>
          <span>{match.score}% Match</span>
        </div>
      </header>
      <div className="conversation-messages">
        {messages.length === 0 ? <div className="conversation-empty-state">Say hi to {match.displayName}! You both share a great YouTube taste.</div> : messages.map((message, index) => (
          <ChatBubble key={message.id} message={message} isSent={message.senderId === user.id} senderPhoto={message.senderId === user.id ? user.photoURL : match.photoURL} showAvatar={index === 0 || messages[index - 1].senderId !== message.senderId} onDoubleClick={() => setMessageMenu(message)} />
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
        {replyTo && <div className="reply-preview">Replying to: {replyTo.text}<button type="button" onClick={() => setReplyTo(null)}>×</button></div>}
        {editingId && <div className="reply-preview">Editing message<button type="button" onClick={() => { setEditingId(null); setInputText(''); }}>×</button></div>}
        <form onSubmit={handleSend} className="conversation-form"><input className="conversation-input" type="text" value={inputText} onChange={event => setInputText(event.target.value)} placeholder={editingId ? 'Edit your message...' : `Message ${match.displayName}...`} autoComplete="off" /><button type="submit" className="conversation-send" disabled={!inputText.trim() || isSending} aria-label="Send message">➤</button></form>
      </div>
    </section>
  );
}

export default ChatPanel;
