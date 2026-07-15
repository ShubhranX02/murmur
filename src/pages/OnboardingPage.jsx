import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import './OnboardingPage.css';

function OnboardingPage() {
  const { user, isOnboarded, signInWithGoogle, storeYouTubeToken, setOnboarded } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [step, setStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0); // 0: auth, 1: fetching, 2: analyzing, 3: matching
  const [stats, setStats] = useState({ liked: 0, subs: 0 });
  const [matchCount, setMatchCount] = useState(0);
  const [error, setError] = useState(null);
  const [googleClientId, setGoogleClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || null);

  useEffect(() => {
    if (isOnboarded) {
      navigate('/matches', { replace: true });
    }
  }, [isOnboarded, navigate]);

  useEffect(() => {
    if (googleClientId) return;

    const loadGoogleClientId = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/auth/google-client-id`);
        if (!response.ok) throw new Error('Google sign-in is not configured.');

        const { clientId } = await response.json();
        if (!clientId) throw new Error('Google sign-in is not configured.');
        setGoogleClientId(clientId);
      } catch (err) {
        console.error('Unable to load Google sign-in configuration', err);
        setError('Google sign-in is not configured yet. Please try again later.');
      }
    };

    loadGoogleClientId();
  }, [apiUrl, googleClientId]);

  useEffect(() => {
    if (user || !googleClientId || !googleButtonRef.current) return;

    let cancelled = false;
    let interval;

    const renderGoogleButton = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return false;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            setError(null);
            await signInWithGoogle(response.credential);
          } catch (err) {
            console.error('Sign in failed', err);
            setError('Google sign-in failed. Please try again.');
          }
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 300,
      });
      return true;
    };

    if (!renderGoogleButton()) {
      interval = setInterval(() => {
        if (renderGoogleButton()) clearInterval(interval);
      }, 100);
    }

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [googleClientId, user, signInWithGoogle]);

  const handleConnectYouTube = () => {
    if (!window.google) {
      setError("Google API not loaded. Please refresh the page.");
      return;
    }

    if (!googleClientId) {
      setError('Google sign-in is not configured yet. Please try again later.');
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: async (response) => {
        if (response.access_token) {
          try {
            await storeYouTubeToken(response.access_token);
            setStep(1);
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
      const fetchRes = await fetch(`${apiUrl}/api/youtube/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      if (!fetchRes.ok) {
        const errorData = await fetchRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch YouTube data');
      }
      const fetchData = await fetchRes.json();
      
      setStats({
        liked: fetchData.stats.likedCount,
        subs: fetchData.stats.subscriptionCount
      });
      
      setAnalysisStage(2);
      
      // 2. Compute Matches
      const matchRes = await fetch(`${apiUrl}/api/matches/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          likedVideos: fetchData.likedVideos,
          subscriptions: fetchData.subscriptions
        })
      });
      
      if (!matchRes.ok) {
        const errorData = await matchRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to compute matches');
      }
      const matchData = await matchRes.json();
      
      setAnalysisStage(3);
      setMatchCount(matchData.matches?.length || 0);
      
      setTimeout(() => {
        setOnboarded();
        setStep(2);
        setIsAnalyzing(false);
      }, 1500);

    } catch (err) {
      setError(err.message || 'An error occurred during analysis');
      setIsAnalyzing(false);
      setStep(0); // Return to the welcome screen so they can retry
    }
  };

  return (
    <div className="onboarding-page animate-fade-in">
      <div className="onboarding-container glass">
        {!user ? (
          <div className="onboarding-step step-signin animate-fade-in-up">
            <div className="welcome-icon">👋</div>
            <h2>Welcome to murmur</h2>
            <p className="subtitle">Sign in with Google to start finding people who share your YouTube taste.</p>
            {error && <div className="error-message">{error}</div>}
            <div ref={googleButtonRef} className="google-signin-button" />
          </div>
        ) : step === 0 && (
          <div className="onboarding-step step-welcome animate-fade-in-up">
            <div className="user-avatar-lg">
              <img src={user?.photoURL || '/default-avatar.png'} alt="Profile" />
            </div>
            <h2>Welcome, {user?.displayName?.split(' ')[0]}!</h2>
            <p className="subtitle">Connect YouTube to find people who share your taste.</p>
            
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
            
            {error && <div className="error-message">{error}</div>}

            <button className="btn-primary btn-youtube" onClick={handleConnectYouTube}>
              <span className="icon-yt">▶</span> Connect YouTube
            </button>
          </div>
        )}

        {step === 1 && (
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

        {step === 2 && (
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

        {user && (
          <div className="step-indicators">
            {[0, 1, 2].map(i => (
              <div key={i} className={`step-dot ${step === i ? 'active' : ''} ${step > i ? 'completed' : ''}`}></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingPage;
