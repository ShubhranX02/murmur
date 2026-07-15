import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MatchCard from '../components/MatchCard';
import LoadingSpinner from '../components/LoadingSpinner';
import './MatchesPage.css';

function MatchesPage() {
  const { user, isAuthenticated, isOnboarded } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    if (!isOnboarded) {
      navigate('/onboarding');
      return;
    }

    const fetchMatches = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/matches/${user.id}`);
        if (!res.ok) throw new Error('Failed to fetch matches');
        const data = await res.json();
        setMatches(data.matches || []);
      } catch (err) {
        console.error('Error fetching matches:', err);
        setError('Could not load your matches. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
    const interval = setInterval(fetchMatches, 10000);
    return () => clearInterval(interval);
  }, [user, isAuthenticated, isOnboarded, navigate]);

  if (loading) {
    return (
      <div className="matches-page-loading">
        <LoadingSpinner size="large" text="Loading your matches..." />
      </div>
    );
  }

  return (
    <div className="matches-page">
      <div className="matches-header animate-fade-in-up">
        <div className="header-content">
          <h1>Your Matches</h1>
          <div className="match-badge">{matches.length}</div>
        </div>
        <p className="subtitle">Based on your unique YouTube taste profile</p>
      </div>

      {error && (
        <div className="error-card glass animate-fade-in">
          {error}
        </div>
      )}

      {matches.length === 0 && !error ? (
        <div className="empty-state glass animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="empty-icon">🏜️</div>
          <h3>No matches yet</h3>
          <p>We're still growing the Murmur community. Check back soon for new connections!</p>
        </div>
      ) : (
        <div className="matches-list">
          {[...matches].sort((a, b) => a.score - b.score).map((match, index) => (
            <MatchCard 
              key={match.matchId} 
              match={match} 
              delay={`${index * 0.1}s`} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MatchesPage;
