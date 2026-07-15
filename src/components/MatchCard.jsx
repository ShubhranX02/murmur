import { useNavigate } from 'react-router-dom';
import PercentageRing from './PercentageRing';
import './MatchCard.css';

function MatchCard({ match, delay = '0s' }) {
  const navigate = useNavigate();
  
  return (
    <div 
      className="match-card glass animate-fade-in-up" 
      style={{ animationDelay: delay }}
    >
      <div className="match-card-header">
        <div className="match-avatar-container">
          <img 
            src={match.photoURL || '/default-avatar.png'} 
            alt={match.displayName} 
            className="match-avatar"
          />
        </div>
        <h3 className="match-name">{match.displayName}</h3>
      </div>
      
      <div className="match-score-section">
        <PercentageRing percentage={match.score} size={110} />
      </div>
      
      <div className="match-details">
        <div className="detail-row">
          <span>Content Vibe</span>
          <span>{match.embeddingScore}%</span>
        </div>
        <div className="detail-row">
          <span>Subscriptions</span>
          <span>{match.subscriptionScore}%</span>
        </div>
        <div className="detail-row">
          <span>Categories</span>
          <span>{match.categoryScore}%</span>
        </div>
      </div>
      
      <button 
        className="btn-primary start-chat-btn"
        onClick={() => navigate(`/chat/${match.userId}?partner=${encodeURIComponent(match.displayName)}&photo=${encodeURIComponent(match.photoURL || '')}&score=${match.score}`)}
      >
        <span className="icon">💬</span> Start Chat
      </button>
    </div>
  );
}

export default MatchCard;
