import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Footer from '../components/Footer';
import './LandingPage.css';

function LandingPage() {
  const { isAuthenticated, isOnboarded, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate(isOnboarded && user?.detailsComplete ? '/dashboard' : '/onboarding');
  }, [isAuthenticated, isOnboarded, navigate, user?.detailsComplete]);

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
          <h1 className="hero-title animate-fade-in-up" style={{ animationDelay: '0s' }}>Murmur</h1>
          <div className="hero-divider animate-fade-in-up" style={{ animationDelay: '0.2s' }}></div>
          <h2 className="hero-subtitle animate-fade-in-up" style={{ animationDelay: '0.4s' }}>connect through what you watch</h2>
          <p className="hero-description animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            Murmur is a social application designed to help you meet people with similar interests. We request read-only access to your YouTube liked videos and subscriptions strictly to generate an AI-powered compatibility score with other members. No bios, no swiping — just genuine connections built on what you actually love.
          </p>
          
          <div className="signin-container animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            <button className="btn-primary" onClick={() => navigate('/onboarding')}>
              Get Started
            </button>
            <p className="privacy-note">
              <span className="lock-icon">🔒</span> Sign in and connect YouTube in the next step.
            </p>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-grid">
          <div className="feature-card glass animate-fade-in-up" style={{ animationDelay: '1s' }}>
            <div className="feature-icon">🎬</div>
            <h3>How We Use Your Data</h3>
            <p>We securely read your YouTube liked videos and subscriptions to calculate a private taste profile. This data is used solely for matching and is never made public.</p>
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

      <Footer />
    </div>
  );
}

export default LandingPage;
