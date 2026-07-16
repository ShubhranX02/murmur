import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ChatBubble from './ChatBubble';
import './ChatPanel.css';

function ChatPanel({ match }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const chatId = match && user ? [user.id, match.userId].sort().join('_') : null;

  useEffect(() => {
    setMessages([]);
    setInputText('');
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          fetch(`${apiUrl}/api/chat/${chatId}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
          }).catch(error => console.error('Failed to mark chat as read:', error));
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [apiUrl, chatId, user]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!chatId || !inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);
    setMessages(current => [...current, {
      id: Date.now().toString(),
      senderId: user.id,
      text,
      createdAt: new Date().toISOString()
    }]);

    try {
      const response = await fetch(`${apiUrl}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, senderId: user.id, text })
      });
      if (!response.ok) throw new Error('Failed to send message');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (!match) {
    return (
      <section className="conversation-pane empty-conversation" aria-live="polite">
        <div className="empty-conversation-content">
          <span className="empty-conversation-icon">💬</span>
          <h2>Click on any chat to message</h2>
          <p>Select a match from the left to start a conversation.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="conversation-pane">
      <header className="conversation-header">
        <img className="conversation-avatar" src={match.photoURL || '/default-avatar.png'} alt={match.displayName} />
        <div>
          <h2>{match.displayName}</h2>
          <span>{match.score}% Match</span>
        </div>
      </header>

      <div className="conversation-messages">
        {messages.length === 0 ? (
          <div className="conversation-empty-state">Say hi to {match.displayName}! You both share a great YouTube taste.</div>
        ) : messages.map(message => (
          <ChatBubble key={message.id} message={message} isSent={message.senderId === user.id} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="conversation-input-area">
        <form onSubmit={handleSend} className="conversation-form">
          <input
            className="conversation-input"
            type="text"
            value={inputText}
            onChange={event => setInputText(event.target.value)}
            placeholder={`Message ${match.displayName}...`}
            autoComplete="off"
          />
          <button type="submit" className="conversation-send" disabled={!inputText.trim() || isSending} aria-label="Send message">➤</button>
        </form>
      </div>
    </section>
  );
}

export default ChatPanel;
