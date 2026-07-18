import './ChatBubble.css';

function ChatBubble({ message, isSent, senderPhoto, showAvatar, onDoubleClick, onRetry }) {
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
        {message.replyTo && (
          <div className="message-reply-reference">
            <span>{message.replyTo.senderId === message.senderId ? 'Replying to yourself' : 'In reply to'}</span>
            <p>{message.replyTo.text}</p>
          </div>
        )}
        <p className="message-text">
          {message.pinned && <span className="pinned-icon" title="Pinned message">📌 </span>}
          {message.text}
        </p>
        <div className="message-meta-row">
          {message.edited && <span className="edited-label">edited</span>}
          {message.deliveryState === 'sending' && <span className="delivery-state">Sending</span>}
          {message.deliveryState === 'sent' && <span className="delivery-state">Sent</span>}
          {message.deliveryState === 'failed' && <button type="button" className="message-retry" onClick={event => { event.stopPropagation(); onRetry?.(); }}>Not sent · Retry</button>}
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
