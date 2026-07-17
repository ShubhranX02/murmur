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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    
    if (!isOnboarded || !user?.detailsComplete) {
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

  const activeMatch = matches.find(match => match.userId === matchId);

  // Automatically expand sidebar if there is no active match selected
  useEffect(() => {
    if (!activeMatch) {
      setIsSidebarCollapsed(false);
    }
  }, [activeMatch]);

  if (loading) {
    return (
      <div className="matches-page-loading">
        <LoadingSpinner size="large" text="Loading your matches..." />
      </div>
    );
  }

  const selectMatch = (match) => {
    navigate(`/matches/${match.userId}`);
  };

  const handleMatchAction = (action, targetMatch) => {
    if (action === 'Delete chat') {
      setMatches(prev => prev.filter(m => m.userId !== targetMatch.userId));
      if (matchId === targetMatch.userId) navigate('/matches');
    } else if (action === 'Pin chat') {
      setMatches(prev => prev.map(m => m.userId === targetMatch.userId ? { ...m, isPinned: !m.isPinned } : m));
    } else if (action === 'Mark as unread') {
      setMatches(prev => prev.map(m => m.userId === targetMatch.userId ? { ...m, hasUnreadMessages: !m.hasUnreadMessages } : m));
    } else if (action === 'Block') {
      alert(`${targetMatch.displayName} has been blocked.`);
      setMatches(prev => prev.filter(m => m.userId !== targetMatch.userId));
      if (matchId === targetMatch.userId) navigate('/matches');
    } else if (action === 'Report') {
      alert(`Report filed for ${targetMatch.displayName}.`);
    } else if (action === 'Mute notifications') {
      setMatches(prev => prev.map(m => m.userId === targetMatch.userId ? { ...m, isMuted: !m.isMuted } : m));
    }
  };

  const activeMatches = matches;

  // Sort matches: pinned first, then by score descending
  const sortedMatches = [...activeMatches].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.score - a.score;
  });

  return (
    <div className="matches-page">
      {error && (
        <div className="error-card glass animate-fade-in">
          {error}
        </div>
      )}

      {activeMatches.length === 0 && !error ? (
        <div className="empty-state glass animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="empty-icon">🏜️</div>
          <h3>No matches yet</h3>
          <p>We're still growing the Murmur community. Check back soon for new connections!</p>
        </div>
      ) : (
        <div className={`chat-workspace animate-fade-in ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <aside className="matches-sidebar">
            <div className="matches-sidebar-header">
              <div>
                <h1>Chats</h1>
              </div>
              <div className="sidebar-header-actions">
                {activeMatch && (
                  <button 
                    type="button" 
                    className="sidebar-toggle" 
                    onClick={() => setIsSidebarCollapsed(true)} 
                    aria-label="Collapse chats"
                  >
                    ‹
                  </button>
                )}
              </div>
            </div>
            <div className="matches-list" aria-label="Your matches">
              {sortedMatches.map((match, index) => (
                <MatchCard
                  key={match.matchId}
                  match={match}
                  delay={`${index * 0.05}s`}
                  onSelect={selectMatch}
                  isSelected={match.userId === matchId}
                  onAction={handleMatchAction}
                />
              ))}
            </div>
          </aside>
          <ChatPanel 
            match={activeMatch} 
            isSidebarCollapsed={isSidebarCollapsed} 
            onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)} 
          />
        </div>
      )}
    </div>
  );
}

export default MatchesPage;
