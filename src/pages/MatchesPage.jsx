import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MatchCard from '../components/MatchCard';
import ChatPanel from '../components/ChatPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import './MatchesPage.css';

function MatchesPage() {
  const { user, isAuthenticated, isOnboarded } = useAuth();
  const navigate = useNavigate();
  const { matchId } = useParams();
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

  const activeMatch = matches.find(match => match.userId === matchId);

  const selectMatch = (match) => {
    navigate(`/matches/${match.userId}`);
  };

  return (
    <div className="matches-page">
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
        <div className="chat-workspace animate-fade-in">
          <aside className="matches-sidebar">
            <div className="matches-sidebar-header">
              <div>
                <h1>Chats</h1>
                <p>People who share your YouTube taste</p>
              </div>
              <div className="match-badge" aria-label={`${matches.length} matches`}>{matches.length}</div>
            </div>
            <div className="matches-list" aria-label="Your matches">
              {[...matches].sort((a, b) => b.score - a.score).map((match, index) => (
                <MatchCard
                  key={match.matchId}
                  match={match}
                  delay={`${index * 0.05}s`}
                  onSelect={selectMatch}
                  isSelected={match.userId === matchId}
                />
              ))}
            </div>
          </aside>
          <ChatPanel match={activeMatch} />
        </div>
      )}
    </div>
  );
}

export default MatchesPage;
