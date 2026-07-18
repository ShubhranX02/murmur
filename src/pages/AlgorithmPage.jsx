import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import algorithmIcon from '../../assets/algorithm.svg';
import configurationIcon from '../../assets/configuration.svg';
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
          <div className="algorithm-placeholder-content">
            <img src={algorithmIcon} alt="Algorithm network" className="algorithm-icon" />
            <h3>Your Content Vibe</h3>
            <p>We analyze your 50 most recent liked videos to capture your current interests and viewing patterns. By identifying recurring themes, creators, and content styles, we build a dynamic snapshot of what you&apos;re actively enjoying right now.</p>
          </div>
        </div>
        <div className="algorithm-column right glass">
          <div className="algorithm-placeholder-content">
            <img src={configurationIcon} alt="Configuration controls" className="configuration-icon" />
            <h3>Category Compatibility</h3>
            <p>We analyze the distribution of YouTube categories in your liked videos and subscriptions, correlating your vibe across standard genres like Music, Gaming, Tech, and more to calculate a multi-dimensional affinity score.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlgorithmPage;
