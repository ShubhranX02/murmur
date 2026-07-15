import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LandingPage.css';

function LandingPage() {
  const { isAuthenticated, isOnboarded, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(isOnboarded ? '/matches' : '/onboarding');
      return;
    }

    const initGoogle = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          // Make sure VITE_GOOGLE_CLIENT_ID is set in your .env
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id-for-dev', 
          callback: async (response) => {
            try {
              await signInWithGoogle(response.credential);
              navigate('/onboarding');
            } catch (error) {
              console.error('Sign in failed', error);
            }
          },
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'pill', width: 300 }
        );
      }
    };

    if (window.google) {
      initGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          initGoogle();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isOnboarded, navigate, signInWithGoogle]);

  return (
    <div className="landing-page">
      <div className="ambient-background">
        <div className="circle circle-1 animate-float" style={{ animationDelay: '0s' }}></div>
        <div className="circle circle-2 animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="circle circle-3 animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="circle circle-4 animate-float" style={{ animationDelay: '3s' }}></div>
        <div className="circle circle-5 animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title animate-fade-in-up" style={{ animationDelay: '0s' }}>murmur</h1>
          <div className="hero-divider animate-fade-in-up" style={{ animationDelay: '0.2s' }}></div>
          <h2 className="hero-subtitle animate-fade-in-up" style={{ animationDelay: '0.4s' }}>connect through what you watch</h2>
          <p className="hero-description animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            Discover people who share your passions through your YouTube feed. No bios, no swiping — just genuine connections built on what you actually love.
          </p>
          
          <div className="signin-container animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            <div id="google-signin-btn"></div>
            <p className="privacy-note">
              <span className="lock-icon">🔒</span> Your data stays private. We only read your likes & subscriptions.
            </p>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-grid">
          <div className="feature-card glass animate-fade-in-up" style={{ animationDelay: '1s' }}>
            <div className="feature-icon">🎬</div>
            <h3>YouTube Powered</h3>
            <p>We analyze your liked videos and subscriptions to understand your unique taste.</p>
          </div>
          
          <div className="feature-card glass animate-fade-in-up" style={{ animationDelay: '1.2s' }}>
            <div className="feature-icon">🤝</div>
            <h3>Smart Matching</h3>
            <p>Our AI computes a compatibility score based on your shared interests and viewing patterns.</p>
          </div>
          
          <div className="feature-card glass animate-fade-in-up" style={{ animationDelay: '1.4s' }}>
            <div className="feature-icon">💬</div>
            <h3>Real Conversations</h3>
            <p>Connect and chat with people who truly get your vibe.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
