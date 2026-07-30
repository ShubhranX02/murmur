import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-links">
          <Link to="/terms">Terms & Conditions</Link>
          <span className="footer-divider">•</span>
          <Link to="/privacy">Privacy Policy</Link>
        </div>
        <div className="footer-copyright">
          © {new Date().getFullYear()} Murmur. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default Footer;
