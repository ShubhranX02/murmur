import './LoadingSpinner.css';

function LoadingSpinner({ size = 'medium', text }) {
  return (
    <div className={`spinner-container ${size}`}>
      <div className="spinner"></div>
      {text && <div className="spinner-text">{text}</div>}
    </div>
  );
}

export default LoadingSpinner;
