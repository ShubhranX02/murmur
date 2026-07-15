import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatBubble from '../components/ChatBubble';
import './ChatPage.css';

function ChatPage() {
  const { matchId } = useParams(); // This is actually the other user's ID
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const partnerName = searchParams.get('partner') || 'Match';
  const partnerPhoto = searchParams.get('photo');
  const matchScore = searchParams.get('score');

  // Compute the shared chatId
  const chatId = user ? [user.id, matchId].sort().join('_') : null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!chatId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chat/${chatId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };

    fetchMessages();
    
    // Simple polling for new messages (since we don't have Firestore client SDK setup)
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);

  }, [chatId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    // Optimistically add message
    const tempMsg = {
      id: Date.now().toString(),
      senderId: user.id,
      text: textToSend,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          senderId: user.id,
          text: textToSend
        })
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      // In a real app, handle failure (e.g. show red exclamation mark)
    } finally {
      setIsSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="chat-page animate-fade-in">
      <div className="chat-container">
        
        {/* Chat Header */}
        <div className="chat-header glass">
          <button className="back-btn" onClick={() => navigate('/matches')}>
            ←
          </button>
          
          <div className="chat-partner-info">
            <div className="partner-avatar">
              <img src={partnerPhoto || '/default-avatar.png'} alt={partnerName} />
            </div>
            <div className="partner-details">
              <h2>{partnerName}</h2>
              {matchScore && <span className="score-badge">{matchScore}% Match</span>}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="empty-chat text-muted text-center mt-24">
              <span style={{fontSize: '40px', display: 'block', marginBottom: '16px'}}>👋</span>
              Say hi to {partnerName}! You both share a great YouTube taste.
            </div>
          ) : (
            messages.map((msg) => (
              <ChatBubble 
                key={msg.id} 
                message={msg} 
                isSent={msg.senderId === user.id} 
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area glass">
          <form onSubmit={handleSend} className="chat-form">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message ${partnerName}...`}
              className="chat-input"
              autoComplete="off"
            />
            <button 
              type="submit" 
              className="send-btn"
              disabled={!inputText.trim() || isSending}
            >
              ➤
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default ChatPage;
