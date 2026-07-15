import './ChatBubble.css';

function ChatBubble({ message, isSent }) {
  // Format time (e.g. 14:30)
  const timeString = new Date(message.createdAt).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={`chat-bubble-wrapper ${isSent ? 'sent' : 'received'}`}>
      <div className={`chat-bubble ${isSent ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
        <p className="message-text">{message.text}</p>
        <span className="message-time">{timeString}</span>
      </div>
    </div>
  );
}

export default ChatBubble;
