import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import './ActivityFeedPage.css';

function ActivityFeedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
      return;
    }

    const fetchActivities = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/activities?userId=${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch activities');
        
        const data = await res.json();
        setActivities(data.activities || []);
      } catch (err) {
        console.error(err);
        setError('Could not load activity feed.');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [user, navigate]);

  const handleJoin = async (activityId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/activities/${activityId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join chat');
      
      navigate(`/activity/${activityId}`);
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="activity-page animate-fade-in-up">
      <div className="activity-header">
        <div>
          <h1>Conversations</h1>
          <p className="activity-subheading">
            Here you can see the conversations started by your matches and the conversations you joined from <Link to="/find">Discover</Link>
          </p>
        </div>
        <button className="btn-primary start-convo-btn" onClick={() => navigate('/activity/create')}>
          <span className="plus-icon">+</span> Start Conversation
        </button>
      </div>

      <div className="activity-feed">
        {loading ? (
          <div className="activity-loading"><LoadingSpinner /></div>
        ) : error ? (
          <div className="activity-error glass">{error}</div>
        ) : activities.length === 0 ? (
          <div className="activity-empty glass">
            <p>There are no ongoing conversations. Start one!</p>
          </div>
        ) : (
          <div className="activity-grid">
            {activities.map((act) => {
              const participantLimit = act.participantLimit || act.limit + 1;
              const isFull = act.participants?.length >= participantLimit;
              const hasJoined = act.participants?.includes(user.id);
              
              return (
                <div 
                  key={act.id} 
                  className={`activity-card glass ${isFull && !hasJoined ? 'full' : ''}`} 
                  onClick={() => (!isFull || hasJoined) && handleJoin(act.id)}
                >
                  <div className="activity-thumbnail">
                    {act.video.thumbnailUrl ? (
                      <img src={act.video.thumbnailUrl} alt={act.video.title} />
                    ) : (
                      <div className="thumbnail-placeholder">▶</div>
                    )}
                  </div>
                  <div className="activity-details">
                    <h3 className="activity-video-title" title={act.video.title}>{act.video.title}</h3>
                    <p className="activity-video-channel">{act.video.channelTitle}</p>
                    <div className="activity-meta">
                      <span className="activity-publisher">Started by {act.publisherId === user.id ? 'You' : act.publisherName}</span>
                      <span className={`activity-participants ${isFull ? 'text-danger' : ''}`}>
                        {act.participants?.length || 1} / {participantLimit} Joined
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityFeedPage;
