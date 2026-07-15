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
              to="/matches" 
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            >
              Matches
            </NavLink>
            <NavLink 
              to="/profile" 
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            >
              Profile
            </NavLink>
            
            {user?.photoURL && (
              <div className="nav-avatar">
                <img src={user.photoURL} alt={user.displayName} />
              </div>
            )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
