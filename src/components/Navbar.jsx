import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/api';
import { APP_VERSION } from '../config/appVersion';
import './Navbar.css';

function Navbar() {
  const { isAuthenticated, isOnboarded, user } = useAuth();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (!isSearchOpen) return undefined;

    searchInputRef.current?.focus();
    const closeOnEscape = event => {
      if (event.key === 'Escape' && !isSearching) setIsSearchOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isSearchOpen, isSearching]);

  const openSearch = () => {
    setUserId('');
    setSearchError('');
    setIsSearchOpen(true);
  };

  const handleSearch = async event => {
    event.preventDefault();
    const query = userId.trim();
    if (!query) {
      setSearchError('No such user exists');
      return;
    }

    setSearchError('');
    setIsSearching(true);
    try {
      const response = await apiFetch(`${apiUrl}/api/auth/profile/${encodeURIComponent(query)}`);
      if (!response.ok) {
        setSearchError('No such user exists');
        return;
      }
      setIsSearchOpen(false);
      navigate(`/profile/${encodeURIComponent(query)}`);
    } catch {
      setSearchError('No such user exists');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          murmur
        </Link>

        <div className="navbar-actions">
          <span className="app-version" aria-label={`Murmur version ${APP_VERSION}`}>
            v{APP_VERSION}
          </span>

          {isAuthenticated && (
            <div className="navbar-links">
              {isOnboarded && user?.detailsComplete && (
                <button
                  type="button"
                  className="nav-search-button"
                  onClick={openSearch}
                  aria-label="Search members by ID"
                  title="Search members"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
                </button>
              )}
              <NavLink
                to="/algorithm"
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              >
                The Algorithm
              </NavLink>
              <NavLink
                to="/find"
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              >
                Discover
              </NavLink>
              <NavLink
                to="/activity" 
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              >
                Conversations
              </NavLink>
              <NavLink 
                to="/matches" 
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              >
                Matches
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              >
                Dashboard
              </NavLink>
              {user?.photoURL && <span className="nav-divider" />}
              {user?.photoURL && (
                <Link to="/profile" className="nav-avatar" aria-label="Open your profile">
                  <img src={user.photoURL} alt={user.displayName} />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {isSearchOpen && (
        <div className="member-search-backdrop" onClick={() => !isSearching && setIsSearchOpen(false)}>
          <form className="member-search-modal glass" onSubmit={handleSearch} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="member-search-title">
            <div className="member-search-heading">
              <div><h2 id="member-search-title">Search members</h2><p>Enter a Murmur user ID to open their profile.</p></div>
              <button type="button" className="member-search-close" onClick={() => setIsSearchOpen(false)} aria-label="Close search" disabled={isSearching}>×</button>
            </div>
            <label className="member-search-field">
              Search by User ID
              <input ref={searchInputRef} value={userId} onChange={event => setUserId(event.target.value)} placeholder="Enter a Murmur user ID" autoComplete="off" aria-describedby={searchError ? 'member-search-error' : undefined} />
            </label>
            {searchError && <p className="member-search-error" id="member-search-error" role="alert">{searchError}</p>}
            <button type="submit" className="btn-primary" disabled={isSearching}>{isSearching ? 'Searching…' : 'Search'}</button>
          </form>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
