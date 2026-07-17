import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './DashboardPage.css';

function DashboardPage() {
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
        {Array.from({ length: 4 }, (_, index) => <section className="dashboard-card glass" key={index} />)}
      </div>
    </div>
  );
}

export default DashboardPage;
