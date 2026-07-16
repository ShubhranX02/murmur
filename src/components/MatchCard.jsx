import './MatchCard.css';

function MatchCard({ match, delay = '0s', onSelect, isSelected = false }) {
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

      <div className="match-person">
        <h3 className="match-name">{match.displayName}</h3>
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
          <div><span>Subscriptions</span><strong>{match.subscriptionScore}%</strong></div>
          <div><span>Categories</span><strong>{match.categoryScore}%</strong></div>
        </div>
      </div>
      
    </article>
  );
}

export default MatchCard;
