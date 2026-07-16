import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './CreateActivityPage.css';

function CreateActivityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const savedVideos = user?.youtubeData?.savedLikedVideos || [];
  
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [limit, setLimit] = useState('2');
  const [timeLimit, setTimeLimit] = useState('24');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredVideos = useMemo(() => {
    if (!search.trim()) return savedVideos;
    return savedVideos.filter(v => 
      v.title.toLowerCase().includes(search.toLowerCase()) || 
      v.channelTitle.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, savedVideos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVideo) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/activities/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publisherId: user.id,
          video: selectedVideo,
          limit: parseInt(limit, 10),
          expiresInHours: parseInt(timeLimit, 10)
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create conversation');
      
      navigate(`/activity/${data.activityId}`);
    } catch (err) {
      alert(err.message);
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="create-activity-page animate-fade-in-up">
      <div className="create-activity-container glass">
        <div className="create-header">
          <button className="btn-secondary back-btn" onClick={() => navigate(-1)}>← Back</button>
          <h2>Start a Conversation</h2>
        </div>
        
        {savedVideos.length === 0 ? (
          <div className="no-videos-message">
            <p>You don't have any saved liked videos yet.</p>
            <p className="text-muted mt-16">Since this is a new feature, you might need to reconnect YouTube to sync your videos!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="create-form">
            <div className="form-group">
              <label>1. Select a Liked Video</label>
              <input 
                type="text" 
                className="glass-input video-search-input"
                placeholder="Search your liked videos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              
              <div className="video-selection-list">
                {filteredVideos.length === 0 ? (
                  <p className="text-muted text-center" style={{padding: '20px'}}>No videos found.</p>
                ) : (
                  filteredVideos.map(video => (
                    <div 
                      key={video.id} 
                      className={`video-select-item glass ${selectedVideo?.id === video.id ? 'selected' : ''}`}
                      onClick={() => setSelectedVideo(video)}
                    >
                      <img src={video.thumbnailUrl} alt="" className="video-thumb-sm" />
                      <div className="video-info-sm">
                        <h4>{video.title}</h4>
                        <p>{video.channelTitle}</p>
                      </div>
                      {selectedVideo?.id === video.id && <span className="check-icon">✓</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>2. Participant Limit</label>
                <select value={limit} onChange={e => setLimit(e.target.value)} className="glass-input">
                  <option value="1">1 Person</option>
                  <option value="2">2 People</option>
                  <option value="3">3 People</option>
                  <option value="5">5 People</option>
                  <option value="10">10 People</option>
                </select>
                <small className="form-help">Excluding yourself</small>
              </div>
              
              <div className="form-group">
                <label>3. Time Limit</label>
                <select value={timeLimit} onChange={e => setTimeLimit(e.target.value)} className="glass-input">
                  <option value="3">3 hours</option>
                  <option value="6">6 hours</option>
                  <option value="12">12 hours</option>
                  <option value="24">1 day</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                </select>
                <small className="form-help">Room will automatically expire</small>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="btn-primary create-submit-btn" 
              disabled={!selectedVideo || isSubmitting}
            >
              {isSubmitting ? 'Starting...' : 'Publish Conversation'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default CreateActivityPage;
