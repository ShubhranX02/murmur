import './ChatBubble.css';

function ChatBubble({ message, isSent, senderPhoto, showAvatar, onDoubleClick }) {
  // Format time (e.g. 14:30)
  const timeString = new Date(message.createdAt).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`chat-bubble-wrapper ${isSent ? 'sent' : 'received'}`}>
      {/* Left Avatar for Received Messages */}
      {!isSent && (
        <div className="bubble-avatar-container left">
          {showAvatar ? (
            <img src={senderPhoto || '/default-avatar.png'} className="bubble-avatar" alt="" />
          ) : (
            <div className="bubble-avatar-placeholder" />
          )}
        </div>
      )}

      {/* Message bubble itself */}
      <div 
        className={`chat-bubble ${isSent ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
        onDoubleClick={onDoubleClick}
      >
        <p className="message-text">
          {message.pinned && <span className="pinned-icon" title="Pinned message">📌 </span>}
          {message.text}
        </p>
        <div className="message-meta-row">
          {message.edited && <span className="edited-label">edited</span>}
          <span className="message-time">{timeString}</span>
        </div>
      </div>

      {/* Right Avatar for Sent Messages */}
      {isSent && (
        <div className="bubble-avatar-container right">
          {showAvatar ? (
            <img src={senderPhoto || '/default-avatar.png'} className="bubble-avatar" alt="" />
          ) : (
            <div className="bubble-avatar-placeholder" />
          )}
        </div>
      )}
    </div>
  );
}

export default ChatBubble;
