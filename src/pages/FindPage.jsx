import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORY_MAP } from '../config/categories';
import LoadingSpinner from '../components/LoadingSpinner';
import './FindPage.css';

const CATEGORY_COLOURS = ['#ffb703', '#fb8500', '#e76f51', '#e9c46a', '#f4a261', '#ef476f', '#d65db1', '#9b5de5', '#5e60ce', '#4895ef', '#00b4d8', '#06d6a0', '#80ed99', '#b8f2e6', '#caffbf', '#ffd6a5'];

function FindPage() {
  const { user, isAuthenticated, isOnboarded } = useAuth();
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [hasSelectedCategory, setHasSelectedCategory] = useState(false);
  const [search, setSearch] = useState('');
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const categories = useMemo(() => [
    { id: 'all', name: 'All Conversations', colour: CATEGORY_COLOURS[0] },
    ...Object.entries(CATEGORY_MAP).map(([id, name], index) => ({ id, name, colour: CATEGORY_COLOURS[index + 1] }))
  ], []);
  const isShowingResults = hasSelectedCategory || Boolean(search.trim());
  const selectedCategoryName = categories.find(category => category.id === selectedCategory)?.name || 'All Conversations';
  const requestedCategory = search.trim() ? 'all' : selectedCategory;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
    } else if (!isOnboarded || !user?.detailsComplete) {
      navigate('/onboarding', { replace: true });
    }
  }, [isAuthenticated, isOnboarded, navigate, user?.detailsComplete]);

  useEffect(() => {
    if (!user?.id || !isShowingResults) return undefined;

    const controller = new AbortController();
    const loadDiscoverResults = async () => {
      setIsLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ userId: user.id, categoryId: requestedCategory });
        if (search.trim()) params.set('q', search.trim());
        const response = await fetch(`${apiUrl}/api/activities/discover?${params.toString()}`, { signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not load conversations.');
        setActivities(data.activities || []);
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Could not load conversations.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    const timer = window.setTimeout(loadDiscoverResults, search.trim() ? 250 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiUrl, search, requestedCategory, user?.id, isShowingResults]);

  const selectCategory = categoryId => {
    setSelectedCategory(categoryId);
    setHasSelectedCategory(true);
  };

  const joinConversation = async activityId => {
    setJoiningId(activityId);
    try {
      const response = await fetch(`${apiUrl}/api/activities/${activityId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not join this conversation.');
      navigate(`/activity/${activityId}`);
    } catch (joinError) {
      setError(joinError.message || 'Could not join this conversation.');
      setJoiningId(null);
    }
  };

  if (!isAuthenticated || !isOnboarded || !user?.detailsComplete) return null;

  return (
    <div className="discover-page animate-fade-in-up">
      <header className="discover-header">
        <h1>Discover</h1>
        <p>Find live conversations around the videos and topics you care about.</p>
        <label className="discover-search-field">
          <span>Search conversations by video title</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search for a video title" autoComplete="off" />
        </label>
      </header>

      <section className="discover-category-grid" aria-label="Conversation categories">
        {categories.map(category => (
          <button key={category.id} type="button" className={`discover-category-card ${selectedCategory === category.id && hasSelectedCategory ? 'is-selected' : ''}`} style={{ '--category-colour': category.colour }} onClick={() => selectCategory(category.id)}>
            {category.name}
          </button>
        ))}
      </section>

      {isShowingResults && (
        <section className="discover-results" aria-live="polite">
          <div className="discover-results-heading">
            <h2>{search.trim() ? `Results for “${search.trim()}”` : selectedCategoryName}</h2>
            <span>Newest first</span>
          </div>
          {isLoading ? <div className="discover-loading"><LoadingSpinner /></div> : error ? <div className="discover-error glass" role="alert">{error}</div> : activities.length === 0 ? <div className="discover-empty glass">No joinable conversations found yet.</div> : (
            <div className="discover-conversation-list">
              {activities.map(activity => {
                const participantLimit = activity.participantLimit || activity.limit + 1;
                return (
                  <article className="discover-conversation-item glass" key={activity.id}>
                    {activity.video?.thumbnailUrl ? <img className="discover-video-thumbnail" src={activity.video.thumbnailUrl} alt="" /> : <div className="discover-video-placeholder">▶</div>}
                    <div className="discover-conversation-details">
                      <h3 title={activity.video?.title}>{activity.video?.title || 'Untitled video'}</h3>
                      <p>{activity.video?.channelTitle || 'Unknown creator'}</p>
                      <div><span>{activity.publisherName || 'Murmur member'}</span><span>{activity.participants?.length || 1} / {participantLimit} people</span><span>{activity.audience === 'public' ? 'Public' : 'Matches Only'}</span></div>
                    </div>
                    <button type="button" className="btn-primary discover-join-button" onClick={() => joinConversation(activity.id)} disabled={joiningId === activity.id}>{joiningId === activity.id ? 'Joining…' : 'Join'}</button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default FindPage;
