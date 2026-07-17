import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './DashboardPage.css';

function FindPage() {
  const { user, isAuthenticated, isOnboarded } = useAuth();
  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true });
    } else if (!isOnboarded || !user?.detailsComplete) {
      navigate('/onboarding', { replace: true });
    }
  }, [isAuthenticated, isOnboarded, navigate, user?.detailsComplete]);

  const handleSubmit = async event => {
    event.preventDefault();
    const query = userId.trim();
    if (!query) {
      setError('No such user exists');
      return;
    }

    setError('');
    setIsSearching(true);
    try {
      const response = await fetch(`${apiUrl}/api/auth/profile/${encodeURIComponent(query)}`);
      if (!response.ok) {
        setError('No such user exists');
        return;
      }
      navigate(`/profile/${encodeURIComponent(query)}`);
    } catch {
      setError('No such user exists');
    } finally {
      setIsSearching(false);
    }
  };

  if (!isAuthenticated || !isOnboarded || !user?.detailsComplete) return null;

  return (
    <div className="find-page animate-fade-in-up">
      <h1>Discover</h1>
      <form className="find-form" onSubmit={handleSubmit}>
        <label>
          Search by User ID
          <input
            value={userId}
            onChange={event => setUserId(event.target.value)}
            placeholder="Enter a Murmur user ID"
            autoComplete="off"
            aria-describedby={error ? 'find-error' : undefined}
          />
        </label>
      </form>
      {isSearching && <p className="find-error">Searching…</p>}
      {error && <p className="find-error" id="find-error" role="alert">{error}</p>}
    </div>
  );
}

export default FindPage;
