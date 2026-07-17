import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './DashboardPage.css';

function DashboardPage() {
  const { user, isAuthenticated, isOnboarded } = useAuth();
  const navigate = useNavigate();
  const [matchSummary, setMatchSummary] = useState({ totalMatches: 0, todayMatches: [] });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
    } else if (!isOnboarded || !user?.detailsComplete) {
      navigate('/onboarding', { replace: true });
    }
  }, [isAuthenticated, isOnboarded, navigate, user?.detailsComplete]);

  useEffect(() => {
    if (!user?.id || !isOnboarded) return;
    let active = true;
    const loadMatchSummary = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/matches/${user.id}`);
        const data = await response.json().catch(() => ({}));
        if (active && response.ok) {
          setMatchSummary({
            totalMatches: data.totalMatches || 0,
            todayMatches: (data.matches || []).filter(match => match.deliveredToday)
          });
        }
      } catch (error) {
        console.warn('Could not load dashboard match summary', error);
      }
    };
    loadMatchSummary();
    return () => { active = false; };
  }, [isOnboarded, user?.id]);

  if (!isAuthenticated || !isOnboarded || !user?.detailsComplete) return null;

  return (
    <div className="dashboard-page animate-fade-in-up">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
      </div>
      <div className="dashboard-grid" aria-label="Dashboard widgets">
        <section className="dashboard-card dashboard-welcome-card glass">
          <h2>Welcome to Murmur</h2>
          <p>Discover people who share your passions through your YouTube feed. No bios, no swiping — just genuine connections built on what you actually love.</p>
          <Link to="/algorithm" className="dashboard-algorithm-link">View The Algorithm</Link>
        </section>
        <section className="dashboard-card dashboard-match-details-card glass">
          <div className="dashboard-match-total">
            <span>Total matches</span>
            <strong>{matchSummary.totalMatches}</strong>
          </div>
          <div className="dashboard-daily-match">
            {matchSummary.todayMatches.length ? (
              <div className="dashboard-daily-avatars" aria-label="Today's new matches">
                {matchSummary.todayMatches.map(match => (
                  <img key={match.userId} src={match.photoURL || '/default-avatar.png'} alt={match.displayName} />
                ))}
              </div>
            ) : <p>Your next introduction will arrive when a new match is available.</p>}
            <Link to="/matches" className="dashboard-talk-link">Talk to your matches</Link>
          </div>
        </section>
        <Link to="/profile" className="dashboard-card dashboard-profile-card glass" aria-label="View your profile">
          <div className="dashboard-profile-summary">
            <img src={user.photoURL || '/default-avatar.png'} alt="" className="dashboard-profile-avatar" />
            <div>
              <span className="dashboard-profile-label">Your profile</span>
              <h2>{user.displayName}</h2>
              <p>{user.profileDetails?.location?.city || 'Your Murmur profile'}</p>
            </div>
          </div>
          <span className="dashboard-profile-link">View profile →</span>
        </Link>
        {Array.from({ length: 3 }, (_, index) => <section className="dashboard-card glass" key={index} />)}
      </div>
    </div>
  );
}

export default DashboardPage;
