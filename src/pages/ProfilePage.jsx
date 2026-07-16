import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import CategoryRingChart from '../components/CategoryRingChart';
import './ProfilePage.css';

function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
    }
  }, [navigate, user]);

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  if (!user) return null;

  const topCategories = user.youtubeData?.topCategories || [];

  return (
    <div className="profile-page animate-fade-in-up">
      <div className="profile-container">
        
        <div className="profile-header glass">
          <div className="profile-avatar-wrapper">
            <img 
              src={user.photoURL || '/default-avatar.png'} 
              alt={user.displayName} 
              className="profile-avatar"
            />
          </div>
          <h1>{user.displayName}</h1>
          <p className="profile-email">{user.email}</p>
        </div>

        {user.onboarded ? (
          <>
            <div className="stats-grid">
              <div className="stat-card glass">
                <span className="stat-icon">🎬</span>
                <span className="stat-value">{user.youtubeData?.likedVideoCount || 0}</span>
                <span className="stat-label">Liked Videos Analyzed</span>
              </div>
              
              <div className="stat-card glass">
                <span className="stat-icon">📺</span>
                <span className="stat-value">{Object.keys(user.categoryDistribution || {}).length}</span>
                <span className="stat-label">Categories Analysed</span>
              </div>
            </div>

            <div className="categories-section glass">
              <h3>Your Categories</h3>
              <CategoryRingChart distribution={user.categoryDistribution} />
            </div>
          </>
        ) : (
          <div className="glass padding-24 text-center mt-24">
            <p className="text-muted">You haven't connected your YouTube account yet.</p>
            <button className="btn-primary mt-16" onClick={() => navigate('/onboarding')}>
              Connect YouTube Now
            </button>
          </div>
        )}

        <div className="profile-actions">
          <button className="btn-secondary signout-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}

export default ProfilePage;
