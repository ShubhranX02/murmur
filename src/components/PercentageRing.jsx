import { useState, useEffect } from 'react';
import './PercentageRing.css';

function PercentageRing({ percentage, size = 120, strokeWidth = 8 }) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    // Animate the ring
    const timer = setTimeout(() => {
      const targetOffset = circumference - (percentage / 100) * circumference;
      setOffset(targetOffset);
    }, 100);

    // Animate the counter
    const duration = 1500; // ms
    const fps = 60;
    const steps = duration / (1000 / fps);
    const increment = percentage / steps;
    let current = 0;
    
    const interval = setInterval(() => {
      current += increment;
      if (current >= percentage) {
        setDisplayPercent(percentage);
        clearInterval(interval);
      } else {
        setDisplayPercent(Math.floor(current));
      }
    }, 1000 / fps);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [percentage, circumference]);

  return (
    <div className="percentage-ring-wrapper" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="percentage-ring-svg">
        <defs>
          <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary-light)" />
            <stop offset="100%" stopColor="var(--primary)" />
          </linearGradient>
        </defs>
        
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
        />
        
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#primaryGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="percentage-ring-progress"
        />
      </svg>
      
      <div className="percentage-ring-content">
        <span className="percentage-value">{displayPercent}</span>
        <span className="percentage-symbol">%</span>
      </div>
    </div>
  );
}

export default PercentageRing;
