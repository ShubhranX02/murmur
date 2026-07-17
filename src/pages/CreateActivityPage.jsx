import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './CreateActivityPage.css';

function CreateActivityPage() {
  const { user, storeYouTubeToken, updateUser } = useAuth();
  const navigate = useNavigate();
  
  const savedVideos = user?.youtubeData?.savedLikedVideos || [];
  
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [participantLimit, setParticipantLimit] = useState('2');
  const [timeLimit, setTimeLimit] = useState('24');
  const [audience, setAudience] = useState('matches');
  const [isAudienceMenuOpen, setIsAudienceMenuOpen] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  useEffect(() => {
    if (googleClientId) return;
    const loadGoogleClientId = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/google-client-id`);
        if (response.ok) {
          const { clientId } = await response.json();
          if (clientId) setGoogleClientId(clientId);
        }
      } catch (err) {
        console.error('Unable to load Google sign-in configuration', err);
      }
    };
    loadGoogleClientId();
  }, [googleClientId]);

  const handleConnectYouTube = () => {
    if (!window.google || !googleClientId) {
      setSyncError("Google API not loaded. Please refresh the page.");
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: async (response) => {
        if (response.access_token) {
          try {
            await storeYouTubeToken(response.access_token);
            startSync(response.access_token);
          } catch (err) {
            setSyncError("Failed to store YouTube token.");
          }
        }
      },
      error_callback: (err) => {
        setSyncError("YouTube connection was cancelled or failed.");
      }
    });
    
    tokenClient.requestAccessToken();
  };

  const startSync = async (accessToken) => {
    setIsSyncing(true);
    setSyncError(null);
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    try {
      const fetchRes = await fetch(`${apiUrl}/api/youtube/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (!fetchRes.ok) throw new Error('Failed to fetch YouTube data');
      const fetchData = await fetchRes.json();
      
      const matchRes = await fetch(`${apiUrl}/api/matches/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          likedVideos: fetchData.likedVideos,
          subscriptions: fetchData.subscriptions
        })
      });
      
      if (!matchRes.ok) throw new Error('Failed to save videos to profile');
      const matchData = await matchRes.json();
      
      if (matchData.profileData) {
        updateUser({ ...matchData.profileData, onboarded: true, requiresYouTubeRefresh: false });
      }
      setIsSyncing(false);
    } catch (err) {
      setSyncError(err.message || 'An error occurred during sync');
      setIsSyncing(false);
    }
  };

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
          participantLimit: parseInt(participantLimit, 10),
          expiresInHours: parseInt(timeLimit, 10),
          audience
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
          <button className="btn-secondary refresh-conversation-youtube" onClick={handleConnectYouTube} disabled={isSyncing}>
            {isSyncing ? 'Refreshing YouTube…' : 'Refresh YouTube data'}
          </button>
        </div>
        {syncError && <div className="text-danger conversation-sync-error" role="alert">{syncError}</div>}
        
        {savedVideos.length === 0 ? (
          <div className="no-videos-message">
            <p>You don't have any saved liked videos yet.</p>
            <p className="text-muted mt-16" style={{marginBottom: '24px'}}>Since this is a new feature, you need to sync your videos from YouTube.</p>
            
            <button 
              className="btn-primary" 
              style={{background: '#ff0000', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', margin: '0 auto'}}
              onClick={handleConnectYouTube}
              disabled={isSyncing}
            >
              <span className="icon-yt">▶</span> {isSyncing ? 'Refreshing YouTube…' : 'Refresh YouTube data'}
            </button>
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
                <label>2. Number of people</label>
                <select value={participantLimit} onChange={e => setParticipantLimit(e.target.value)} className="glass-input">
                  <option value="2">2 People</option>
                  <option value="3">3 People</option>
                  <option value="4">4 People</option>
                  <option value="5">5 People</option>
                  <option value="6">6 People</option>
                  <option value="8">8 People</option>
                  <option value="10">10 People</option>
                  <option value="15">15 People</option>
                  <option value="20">20 People</option>
                  <option value="25">25 People</option>
                  <option value="30">30 People</option>
                </select>
                <small className="form-help">Including you; maximum 30 people</small>
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

              <div className="form-group audience-form-group">
                <label id="audience-label">4. Who can participate</label>
                <div className="audience-dropdown">
                  <button type="button" className="audience-dropdown-trigger glass-input" onClick={() => setIsAudienceMenuOpen(open => !open)} aria-haspopup="listbox" aria-expanded={isAudienceMenuOpen} aria-labelledby="audience-label">
                    <span>{audience === 'public' ? 'Public' : 'Matches Only'}</span><small>{audience === 'public' ? 'Anyone who discovers this conversation' : 'Only your matches can join'}</small>
                  </button>
                  {isAudienceMenuOpen && (
                    <div className="audience-dropdown-menu" role="listbox" aria-label="Who can participate">
                      <button type="button" role="option" aria-selected={audience === 'public'} onClick={() => { setAudience('public'); setIsAudienceMenuOpen(false); }}><span>Public</span><small>Anyone who discovers this conversation</small></button>
                      <button type="button" role="option" aria-selected={audience === 'matches'} onClick={() => { setAudience('matches'); setIsAudienceMenuOpen(false); }}><span>Matches Only</span><small>Only your matches can join</small></button>
                    </div>
                  )}
                </div>
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
