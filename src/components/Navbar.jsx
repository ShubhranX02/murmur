import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { APP_VERSION } from '../config/appVersion';
import './Navbar.css';

function Navbar() {
  const { isAuthenticated, user } = useAuth();

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
                Activities
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
    </nav>
  );
}

export default Navbar;
