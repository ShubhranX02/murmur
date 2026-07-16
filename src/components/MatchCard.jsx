import { useState } from 'react';
import './MatchCard.css';

function MatchCard({ match, delay = '0s', onSelect, isSelected = false, onAction }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openChat = () => {
    onSelect?.(match);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openChat();
    }
  };

  const preventChatOpen = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleAction = (event, action) => {
    preventChatOpen(event);
    setMenuOpen(false);
    onAction?.(action, match);
  };
  
  return (
    <article
      className={`match-list-item glass animate-fade-in-up ${match.hasUnreadMessages ? 'has-unread' : ''} ${isSelected ? 'is-selected' : ''}`}
      style={{ animationDelay: delay }}
      role="button"
      tabIndex="0"
      aria-label={`Open chat with ${match.displayName}, ${match.score}% match`}
      onClick={openChat}
      onKeyDown={handleKeyDown}
    >
      <div className="match-avatar-container">
        <img
          src={match.photoURL || '/default-avatar.png'}
          alt={match.displayName}
          className="match-avatar"
        />
        {match.hasUnreadMessages && <span className="unread-dot" aria-label="New message" />}
      </div>

      <div className="match-menu-wrapper" onClick={preventChatOpen} onKeyDown={preventChatOpen}>
        <button
          type="button"
          className="match-menu-trigger"
          aria-label={`More options for ${match.displayName}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)}
        >
          ⋮
        </button>
        {menuOpen && (
          <div className="match-actions-menu" role="menu">
            {['Block', 'Report', 'Delete chat', 'Pin chat', 'Mute notifications', 'Mark as unread', 'Archive'].map(action => (
              <button 
                key={action} 
                type="button" 
                role="menuitem" 
                onClick={event => handleAction(event, action)}
              >
                {action === 'Pin chat' && match.isPinned ? 'Unpin chat' : action === 'Mute notifications' && match.isMuted ? 'Unmute notifications' : action}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="match-person">
        <h3 className="match-name">
          {match.isPinned && <span className="pin-icon" title="Pinned chat">📌 </span>}
          {match.displayName}
          {match.isMuted && <span className="mute-icon" title="Muted notifications"> 🔕</span>}
        </h3>
        {match.hasUnreadMessages && <span className="new-message-label">New message</span>}
      </div>
      
      <div className="match-score-wrapper">
        <span
          className="match-score"
          tabIndex="0"
          aria-label={`${match.score}% match. Focus or hover for score details.`}
          onClick={preventChatOpen}
          onKeyDown={preventChatOpen}
        >
          {match.score}%
        </span>
        <div className="match-score-tooltip" role="tooltip">
          <div><span>Content vibe</span><strong>{match.embeddingScore}%</strong></div>
          <div><span>Categories</span><strong>{match.categoryScore}%</strong></div>
        </div>
      </div>
      
    </article>
  );
}

export default MatchCard;
