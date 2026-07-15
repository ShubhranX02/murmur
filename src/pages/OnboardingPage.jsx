import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import './OnboardingPage.css';

function OnboardingPage() {
  const { user, storeYouTubeToken, setOnboarded } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0); // 0: auth, 1: fetching, 2: analyzing, 3: matching
  const [stats, setStats] = useState({ liked: 0, subs: 0 });
  const [matchCount, setMatchCount] = useState(0);
  const [error, setError] = useState(null);

  const handleConnectYouTube = () => {
    if (!window.google) {
      setError("Google API not loaded. Please refresh the page.");
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id',
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: async (response) => {
        if (response.access_token) {
          try {
            await storeYouTubeToken(response.access_token);
            setStep(2);
            startAnalysis(response.access_token);
          } catch (err) {
            setError("Failed to connect YouTube.");
            console.error(err);
          }
        }
      },
      error_callback: (err) => {
        setError("YouTube connection was cancelled or failed.");
        console.error(err);
      }
    });
    
    tokenClient.requestAccessToken();
  };

  const startAnalysis = async (accessToken) => {
    setIsAnalyzing(true);
    setAnalysisStage(1);
    
    try {
      // 1. Fetch YouTube Data
      const fetchRes = await fetch('http://localhost:3001/api/youtube/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (!fetchRes.ok) throw new Error('Failed to fetch YouTube data');
      const fetchData = await fetchRes.json();
      
      setStats({
        liked: fetchData.stats.likedCount,
        subs: fetchData.stats.subscriptionCount
      });
      
      setAnalysisStage(2);
      
      // 2. Compute Matches
      const matchRes = await fetch('http://localhost:3001/api/matches/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          likedVideos: fetchData.likedVideos,
          subscriptions: fetchData.subscriptions
        })
      });
      
      if (!matchRes.ok) throw new Error('Failed to compute matches');
      const matchData = await matchRes.json();
      
      setAnalysisStage(3);
      setMatchCount(matchData.matches?.length || 0);
      
      setTimeout(() => {
        setOnboarded();
        setStep(3);
        setIsAnalyzing(false);
      }, 1500);

    } catch (err) {
      setError(err.message || 'An error occurred during analysis');
      setIsAnalyzing(false);
      setStep(1); // Go back so they can retry
    }
  };

  return (
    <div className="onboarding-page animate-fade-in">
      <div className="onboarding-container glass">
        
        {step === 0 && (
          <div className="onboarding-step step-welcome animate-fade-in-up">
            <div className="user-avatar-lg">
              <img src={user?.photoURL || '/default-avatar.png'} alt="Profile" />
            </div>
            <h2>Welcome, {user?.displayName?.split(' ')[0]}!</h2>
            <p className="subtitle">Let's connect your YouTube to find your people.</p>
            
            <div className="info-cards">
              <div className="info-card">
                <span className="icon">🎬</span>
                <div>
                  <h4>Liked Videos</h4>
                  <p>We'll see what content resonates with you</p>
                </div>
              </div>
              <div className="info-card">
                <span className="icon">📺</span>
                <div>
                  <h4>Subscriptions</h4>
                  <p>We'll check which creators you follow</p>
                </div>
              </div>
            </div>
            
            <button className="btn-primary" onClick={() => setStep(1)}>
              Continue
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step step-connect animate-fade-in-up">
            <div className="youtube-icon-lg">▶</div>
            <h2>Connect Your YouTube</h2>
            <p className="subtitle">
              Grant read-only access to your YouTube profile. We can only view — never modify — your data.
            </p>
            
            {error && <div className="error-message">{error}</div>}
            
            <button className="btn-primary btn-youtube" onClick={handleConnectYouTube}>
              <span className="icon-yt">▶</span> Connect YouTube
            </button>
            <button className="btn-secondary mt-16" onClick={() => setStep(0)}>
              Back
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step step-analyze animate-fade-in-up">
            <h2>Analyzing your taste</h2>
            <p className="subtitle">This might take a moment. We're doing heavy lifting with AI.</p>
            
            <div className="analysis-progress">
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${(analysisStage / 3) * 100}%` }}
                ></div>
              </div>
              
              <div className="stage-list">
                <div className={`stage-item ${analysisStage >= 1 ? 'active' : ''}`}>
                  {analysisStage > 1 ? <span className="check">✓</span> : (analysisStage === 1 ? <LoadingSpinner size="small" /> : <span className="dot"></span>)}
                  <span className="text">Fetching liked videos & subscriptions</span>
                </div>
                {stats.liked > 0 && (
                  <div className="stats-pill animate-fade-in">Found {stats.liked} likes, {stats.subs} subs</div>
                )}
                
                <div className={`stage-item ${analysisStage >= 2 ? 'active' : ''}`}>
                  {analysisStage > 2 ? <span className="check">✓</span> : (analysisStage === 2 ? <LoadingSpinner size="small" /> : <span className="dot"></span>)}
                  <span className="text">Computing AI taste profile</span>
                </div>
                
                <div className={`stage-item ${analysisStage >= 3 ? 'active' : ''}`}>
                  {analysisStage > 3 ? <span className="check">✓</span> : (analysisStage === 3 ? <LoadingSpinner size="small" /> : <span className="dot"></span>)}
                  <span className="text">Finding your matches</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step step-complete animate-fade-in-up">
            <div className="celebration-emoji">🎉</div>
            <h2>You're all set!</h2>
            <p className="subtitle">We analyzed your unique taste and found potential connections.</p>
            
            <div className="match-count-card">
              <span className="number">{matchCount}</span>
              <span className="label">Matches Found</span>
            </div>
            
            <button className="btn-primary" onClick={() => navigate('/matches')}>
              View Your Matches
            </button>
          </div>
        )}

        {/* Step Indicators */}
        <div className="step-indicators">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`step-dot ${step === i ? 'active' : ''} ${step > i ? 'completed' : ''}`}></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default OnboardingPage;
