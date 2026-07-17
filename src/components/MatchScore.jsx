import { useId } from 'react';
import './MatchScore.css';

const tooltipText = 'Your Match Score - an indicator of how much your tastes match. It is calculated with the help of your YouTube data and The Algorithm';

function MatchScore({ score, className = '' }) {
  const tooltipId = useId();
  if (!Number.isFinite(score)) return null;

  return (
    <span
      className={`match-score-info ${className}`.trim()}
      tabIndex="0"
      aria-describedby={tooltipId}
    >
      <span className="match-score-info-value">{score}% Match</span>
      <span id={tooltipId} className="match-score-info-tooltip" role="tooltip">{tooltipText}</span>
    </span>
  );
}

export default MatchScore;
