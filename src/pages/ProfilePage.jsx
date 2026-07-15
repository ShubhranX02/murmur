import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css';

function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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
                <span className="stat-value">{user.youtubeData?.subscriptionCount || 0}</span>
                <span className="stat-label">Subscriptions Synced</span>
              </div>
            </div>

            <div className="categories-section glass">
              <h3>Your Top Vibe Categories</h3>
              {topCategories.length > 0 ? (
                <div className="categories-flex">
                  {topCategories.map((cat, index) => (
                    <div key={index} className="category-chip">
                      {cat}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted">Not enough data to determine top categories yet.</p>
              )}
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
