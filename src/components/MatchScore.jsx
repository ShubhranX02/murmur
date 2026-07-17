import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './MatchScore.css';

const tooltipText = 'Your Match Score - an indicator of how much your tastes match. It is calculated with the help of your YouTube data and The Algorithm';

function MatchScore({ score, className = '' }) {
  const tooltipId = useId();
  const scoreRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);

  const positionTooltip = useCallback(() => {
    const scoreElement = scoreRef.current;
    if (!scoreElement) return;

    const rect = scoreElement.getBoundingClientRect();
    const tooltipHalfWidth = Math.min(140, window.innerWidth * 0.375);
    setTooltipPosition({
      top: rect.bottom + 12,
      left: Math.min(Math.max(rect.left + rect.width / 2, tooltipHalfWidth), window.innerWidth - tooltipHalfWidth)
    });
  }, []);

  useEffect(() => {
    if (!tooltipPosition) return undefined;
    window.addEventListener('resize', positionTooltip);
    window.addEventListener('scroll', positionTooltip, true);
    return () => {
      window.removeEventListener('resize', positionTooltip);
      window.removeEventListener('scroll', positionTooltip, true);
    };
  }, [positionTooltip, tooltipPosition]);

  if (!Number.isFinite(score)) return null;

  return (
    <>
      <span
        ref={scoreRef}
        className={`match-score-info ${className}`.trim()}
        tabIndex="0"
        aria-describedby={tooltipPosition ? tooltipId : undefined}
        aria-label={`${score}% Match. ${tooltipText}`}
        onPointerEnter={positionTooltip}
        onPointerLeave={() => setTooltipPosition(null)}
        onFocus={positionTooltip}
        onBlur={() => setTooltipPosition(null)}
      >
        <span className="match-score-info-value">{score}% Match</span>
      </span>
      {tooltipPosition && createPortal(
        <span id={tooltipId} className="match-score-info-tooltip" role="tooltip" style={tooltipPosition}>
          {tooltipText}
        </span>,
        document.body
      )}
    </>
  );
}

export default MatchScore;
