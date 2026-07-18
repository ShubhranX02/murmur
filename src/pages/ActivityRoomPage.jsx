import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import ChatBubble from '../components/ChatBubble';
import LoadingSpinner from '../components/LoadingSpinner';
import './ActivityRoomPage.css';

function ActivityRoomPage() {
  const { activityId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activity, setActivity] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
      return;
    }

    const fetchDetailsAndMessages = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        
        // Fetch activity details
        const detailsRes = await apiFetch(`${apiUrl}/api/activities/${activityId}/details`);
        if (!detailsRes.ok) {
          if (detailsRes.status === 404) {
             navigate('/activity', { replace: true });
             return;
          }
          throw new Error('Failed to fetch activity details');
        }
        const detailsData = await detailsRes.json();
        
        // Validate access
        if (!detailsData.activity.participants?.includes(user.id)) {
          alert('You are not a participant in this conversation.');
          navigate('/activity', { replace: true });
          return;
        }
        
        setActivity(detailsData.activity);

        // Fetch messages
        const msgsRes = await apiFetch(`${apiUrl}/api/activities/${activityId}/messages`);
        if (msgsRes.ok) {
          const msgsData = await msgsRes.json();
          setMessages(msgsData.messages || []);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetailsAndMessages();
    
    // Poll for new messages every 3 seconds
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/activities/${activityId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (e) {
        // Silent polling error
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activityId, user, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText(''); // optimistic clear

    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/activities/${activityId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend })
      });

      if (!res.ok) throw new Error('Failed to send message');
      
      // Fetch immediately to show the new message
      const msgsRes = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/activities/${activityId}/messages`);
      if (msgsRes.ok) {
        const msgsData = await msgsRes.json();
        setMessages(msgsData.messages || []);
      }
    } catch (err) {
      alert(err.message);
      setInputText(textToSend); // revert on failure
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure that you want to end this conversation?")) return;
    
    try {
      const res = await apiFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/activities/${activityId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to end conversation');
      }
      
      navigate('/activity', { replace: true });
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user) return null;
  
  if (loading) {
    return <div className="activity-room-loading"><LoadingSpinner /></div>;
  }
  
  if (error) {
    return (
      <div className="activity-room-page animate-fade-in">
        <div className="activity-room-workspace" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column'}}>
           <p className="text-danger" style={{marginBottom: '16px'}}>{error}</p>
           <button className="btn-secondary" onClick={() => navigate('/activity')}>Go Back</button>
        </div>
      </div>
    );
  }
  
  if (!activity) return null;

  return (
    <div className="activity-room-page animate-fade-in">
      <div className="activity-room-workspace">
        
        {/* Header containing Video details and Participants */}
        <header className="room-header glass">
          <button className="btn-icon back-btn" onClick={() => navigate('/activity')} aria-label="Go back">
            ←
          </button>
          
          <div className="room-video-info">
            <div className="room-thumbnail">
              {activity.video.thumbnailUrl ? (
                <img src={activity.video.thumbnailUrl} alt={activity.video.title} />
              ) : (
                <span className="placeholder">▶</span>
              )}
            </div>
            <div className="room-video-text">
              <h2 title={activity.video.title}>{activity.video.title}</h2>
              <p>{activity.video.channelTitle}</p>
            </div>
          </div>
          
          <div className="room-participants">
            {activity.participantsProfiles?.map(p => (
              <img 
                key={p.id} 
                src={p.photoURL || '/default-avatar.png'} 
                alt={p.displayName} 
                className="participant-avatar"
                title={p.displayName}
              />
            ))}
          </div>
        </header>

        {/* Chat Feed */}
        <div className="room-messages-container">
          <div className="room-messages-list">
            {messages.length === 0 ? (
              <div className="empty-chat-message">
                <p>Chat room opened!</p>
                <p className="text-muted">Say hi to everyone.</p>
              </div>
            ) : (
              messages.map(msg => {
                const senderProfile = activity.participantsProfiles?.find(p => p.id === msg.senderId);
                return (
                  <ChatBubble 
                    key={msg.id} 
                    message={msg} 
                    isSent={msg.senderId === user.id} 
                    senderName={senderProfile?.displayName || 'Unknown'}
                  />
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="room-input-form glass" onSubmit={handleSend}>
            {user.id === activity.publisherId && (
              <button 
                type="button" 
                className="btn-icon delete-activity-btn" 
                onClick={handleDelete}
                title="End Conversation"
              >
                🗑️
              </button>
            )}
            <input 
              type="text" 
              placeholder="Type a message..." 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="chat-input"
            />
            <button type="submit" className="btn-primary send-btn" disabled={!inputText.trim()}>
              Send
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default ActivityRoomPage;
