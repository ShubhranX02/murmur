import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './DashboardPage.css';

function AlgorithmPage() {
  const { user, isAuthenticated, isOnboarded } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
    } else if (!isOnboarded || !user?.detailsComplete) {
      navigate('/onboarding', { replace: true });
    }
  }, [isAuthenticated, isOnboarded, navigate, user?.detailsComplete]);

  if (!isAuthenticated || !isOnboarded || !user?.detailsComplete) return null;

  return (
    <div className="algorithm-page animate-fade-in-up">
      <h1>The Algorithm</h1>
      <div className="algorithm-container">
        <div className="algorithm-column left glass">
          <div className="algorithm-design-wrapper">
            <img 
              src="/heart_glowing.png" 
              alt="Glow Heart Design" 
              className="algorithm-heart-image" 
            />
            <div className="algorithm-subscript-wrapper">
              <img 
                src="/recent_likes_text.png" 
                alt="YouTube match explanation" 
                className="algorithm-text-image" 
              />
            </div>
          </div>
        </div>
        <div className="algorithm-column right glass">
          <div className="algorithm-placeholder-content">
            <div className="algorithm-glow-icon">⚡</div>
            <h3>Category Compatibility</h3>
            <p>We analyze the distribution of YouTube categories in your liked videos and subscriptions, correlating your vibe across standard genres like Music, Gaming, Tech, and more to calculate a multi-dimensional affinity score.</p>
            <div className="algorithm-coming-soon-badge">Coming Soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlgorithmPage;
