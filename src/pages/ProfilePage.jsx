import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CategoryRingChart from '../components/CategoryRingChart';
import LoadingSpinner from '../components/LoadingSpinner';
import IndiaLocationPicker from '../components/IndiaLocationPicker';
import MatchScore from '../components/MatchScore';
import './ProfilePage.css';

const emptyDetails = {
  location: null,
  age: '',
  gender: '',
  description: ''
};

function toFormDetails(details) {
  return {
    location: details?.location?.id ? details.location : null,
    age: details?.age || '',
    gender: details?.gender || '',
    description: details?.description || ''
  };
}

function ProfilePage() {
  const { user, signOut, updateUser } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const targetUserId = userId || user?.id;
  const isOwnProfile = Boolean(user && targetUserId === user.id);
  const [profile, setProfile] = useState(null);
  const [formDetails, setFormDetails] = useState(emptyDetails);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [matchScore, setMatchScore] = useState(null);
  const [isMatched, setIsMatched] = useState(false);
  const [isAddingMatch, setIsAddingMatch] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true });
      return;
    }

    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      setError(null);
      setMatchScore(null);
      setIsMatched(false);
      try {
        const response = await fetch(`${apiUrl}/api/auth/profile/${targetUserId}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load this profile.');
        if (!active) return;
        setProfile(data.profile);
        setFormDetails(toFormDetails(data.profile.profileDetails));

        if (!isOwnProfile) {
          try {
            const scoreResponse = await fetch(`${apiUrl}/api/matches/${user.id}/${targetUserId}`);
            const scoreData = await scoreResponse.json().catch(() => ({}));
            if (active && scoreResponse.ok) {
              setMatchScore(scoreData.match?.score ?? null);
              setIsMatched(Boolean(scoreData.match?.isMatched));
            }
          } catch (scoreError) {
            console.warn('Could not load match score', scoreError);
          }
        }
      } catch (fetchError) {
        // The signed-in user can still edit their cached profile if a refresh
        // happens while the server is temporarily unavailable.
        if (active && isOwnProfile) {
          const fallback = {
            id: user.id,
            displayName: user.displayName,
            photoURL: user.photoURL,
            profileDetails: user.profileDetails || null,
            onboarded: user.onboarded,
            youtubeData: user.youtubeData || null,
            categoryDistribution: user.categoryDistribution || {}
          };
          setProfile(fallback);
          setFormDetails(toFormDetails(fallback.profileDetails));
          setError('Showing your saved profile while the latest version loads.');
        } else if (active) {
          setError(fetchError.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();
    return () => { active = false; };
  }, [apiUrl, isOwnProfile, navigate, targetUserId, user]);

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  const updateDetail = (field, value) => {
    setFormDetails(current => ({ ...current, [field]: value }));
  };

  const handleSave = async event => {
    event.preventDefault();
    const wordCount = formDetails.description.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 100) {
      setError('Keep your description to 100 words or fewer.');
      return;
    }
    if (!formDetails.location?.id) {
      setError('Choose your city from the available Class X or Class Y locations.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/auth/profile/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileDetails: formDetails })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save your profile.');

      setProfile(data.profile);
      setFormDetails(toFormDetails(data.profile.profileDetails));
      updateUser({ profileDetails: data.profile.profileDetails, detailsComplete: true });
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError.message || 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMatch = async () => {
    setIsAddingMatch(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/matches/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, otherUserId: profile.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not add this member to your matches.');
      setMatchScore(data.match?.score ?? matchScore);
      setIsMatched(true);
    } catch (addError) {
      setError(addError.message || 'Could not add this member to your matches.');
    } finally {
      setIsAddingMatch(false);
    }
  };

  if (!user || loading) {
    return <div className="profile-loading"><LoadingSpinner size="large" text="Loading profile..." /></div>;
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="profile-status-card glass">{error || 'This profile could not be found.'}</div>
      </div>
    );
  }

  const viewedYoutubeData = profile.youtubeData || (isOwnProfile ? user.youtubeData : null);
  const viewedCategoryDistribution = profile.categoryDistribution || (isOwnProfile ? user.categoryDistribution : null);
  const location = profile.profileDetails?.location;
  const descriptionWords = formDetails.description.trim() ? formDetails.description.trim().split(/\s+/).length : 0;

  return (
    <div className="profile-page animate-fade-in-up">
      <div className="profile-container">
        {error && <div className="profile-notice">{error}</div>}
        <div className="profile-header glass">
          <div className="profile-avatar-wrapper">
            <img src={profile.photoURL || '/default-avatar.png'} alt={profile.displayName} className="profile-avatar" />
          </div>
          <h1>{profile.displayName}</h1>
          {isOwnProfile && <p className="profile-email">{user.email}</p>}
          {!isOwnProfile && <p className="profile-relationship">Murmur member</p>}
          <p className="profile-member-id">Member ID: {profile.id}</p>
          {!isOwnProfile && <MatchScore score={matchScore} className="match-score-info--profile" />}
          {!isOwnProfile && (
            isMatched ? (
              <button className="btn-primary profile-message-button" onClick={() => navigate(`/matches/${profile.id}`)}>Message</button>
            ) : (
              <button className="btn-primary profile-message-button" onClick={handleAddMatch} disabled={isAddingMatch}>
                {isAddingMatch ? 'Adding…' : 'Add to matches'}
              </button>
            )
          )}
        </div>

        <section className="profile-details-section glass">
          <div className="profile-section-heading">
            <div>
              <h2>About</h2>
              <p>{isOwnProfile ? 'Share the details you want your matches to see.' : `A little about ${profile.displayName}.`}</p>
            </div>
            {isOwnProfile && !isEditing && (
              <button className="btn-secondary profile-edit-button" onClick={() => setIsEditing(true)}>Edit details</button>
            )}
          </div>

          {isEditing ? (
            <form className="profile-edit-form" onSubmit={handleSave}>
              <div className="profile-form-row">
                <label>City in India<IndiaLocationPicker location={formDetails.location} onChange={location => updateDetail('location', location)} /></label>
              </div>
              <div className="profile-form-row">
                <label>Age<input type="number" min="13" max="120" value={formDetails.age} onChange={event => updateDetail('age', event.target.value)} required /></label>
                <label>Gender<select value={formDetails.gender} onChange={event => updateDetail('gender', event.target.value)} required><option value="" disabled>Select one</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
              </div>
              <label>Description (optional) <span>{descriptionWords}/100 words</span><textarea value={formDetails.description} onChange={event => updateDetail('description', event.target.value)} rows="5" /></label>
              <div className="profile-form-actions">
                <button type="button" className="btn-secondary" onClick={() => { setFormDetails(toFormDetails(profile.profileDetails)); setIsEditing(false); }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save details'}</button>
              </div>
            </form>
          ) : profile.profileDetails ? (
            <div className="profile-details-content">
              <dl className="profile-facts">
                <div><dt>Location</dt><dd>{[location?.city, location?.state, location?.country].filter(Boolean).join(', ')}</dd></div>
                <div><dt>Age</dt><dd>{profile.profileDetails.age}</dd></div>
                <div><dt>Gender</dt><dd>{profile.profileDetails.gender}</dd></div>
              </dl>
              {profile.profileDetails.description && <p className="profile-description">{profile.profileDetails.description}</p>}
            </div>
          ) : (
            <p className="profile-empty-details">{isOwnProfile ? 'Add your details so your matches can get to know you.' : 'This member has not added profile details yet.'}</p>
          )}
        </section>

        {profile.onboarded ? (
          <>
            <div className="stats-grid">
              <div className="stat-card glass"><span className="stat-icon">🎬</span><span className="stat-value">{viewedYoutubeData?.likedVideoCount || 0}</span><span className="stat-label">Liked Videos Analyzed</span></div>
              <div className="stat-card glass"><span className="stat-icon">📺</span><span className="stat-value">{Object.keys(viewedCategoryDistribution || {}).length}</span><span className="stat-label">Categories Analysed</span></div>
            </div>
            <div className="categories-section glass">
              <h3>{isOwnProfile ? 'Your Categories' : `${profile.displayName}'s Categories`}</h3>
              <CategoryRingChart distribution={viewedCategoryDistribution} />
            </div>
          </>
        ) : isOwnProfile ? (
          <div className="glass padding-24 text-center mt-24"><p className="text-muted">You haven't connected your YouTube account yet.</p><button className="btn-primary mt-16" onClick={() => navigate('/onboarding')}>Connect YouTube Now</button></div>
        ) : null}

        {isOwnProfile && <div className="profile-actions"><button className="btn-secondary signout-btn" onClick={handleSignOut}>Sign Out</button></div>}
      </div>
    </div>
  );
}

export default ProfilePage;
