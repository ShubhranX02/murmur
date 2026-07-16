import { useState } from 'react';
import { CATEGORY_MAP } from '../config/categories';
import './CategoryRingChart.css';

// Vibrant Murmur-compatible color palette
const COLORS = [
  '#E53935', // Red (YouTube brand color)
  '#8E24AA', // Purple
  '#3949AB', // Indigo
  '#039BE5', // Light Blue
  '#00ACC1', // Cyan
  '#43A047', // Green
  '#7CB342', // Light Green
  '#FDD835', // Yellow
  '#FB8C00', // Orange
  '#F4511E'  // Deep Orange
];

function CategoryRingChart({ distribution }) {
  const [hoveredSegment, setHoveredSegment] = useState(null);

  if (!distribution || Object.keys(distribution).length === 0) {
    return <p className="text-muted text-center mt-16">Not enough data to display your categories yet.</p>;
  }

  // Convert distribution object into a sorted array of segments
  const data = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1]) // Sort descending by proportion
    .map(([id, value], index) => ({
      id,
      name: CATEGORY_MAP[id] || `Category ${id}`,
      value, // proportion (0 to 1)
      percentage: Math.round(value * 100),
      color: COLORS[index % COLORS.length]
    }));

  const size = 260;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let currentOffset = 0;

  return (
    <div className="category-ring-chart-wrapper animate-fade-in">
      <div className="category-ring-chart-container">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background Ring Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="var(--glass-border)"
            strokeWidth={strokeWidth}
          />
          
          {/* Category Data Segments */}
          {data.map((segment) => {
            // Add a tiny artificial gap by slightly reducing the stroke length
            const rawStrokeLength = segment.value * circumference;
            const strokeLength = Math.max(0, rawStrokeLength - 2); 
            
            const strokeDasharray = `${strokeLength} ${circumference - strokeLength}`;
            const strokeDashoffset = -currentOffset;
            
            currentOffset += rawStrokeLength;

            return (
              <circle
                key={segment.id}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className={`chart-segment ${hoveredSegment && hoveredSegment.id !== segment.id ? 'dimmed' : ''}`}
                onMouseEnter={() => setHoveredSegment(segment)}
                onMouseLeave={() => setHoveredSegment(null)}
                // Rotate SVG by -90deg around center so the first segment starts at 12 o'clock
                transform={`rotate(-90 ${center} ${center})`}
              />
            );
          })}
        </svg>

        {/* Center Hover Content */}
        <div className="chart-center-content">
          {hoveredSegment ? (
            <div className="hover-data animate-fade-in">
              <span className="hover-percent" style={{ color: hoveredSegment.color }}>
                {hoveredSegment.percentage}%
              </span>
              <span className="hover-name">{hoveredSegment.name}</span>
            </div>
          ) : (
            <div className="hover-placeholder animate-fade-in">
              Hover over a segment
            </div>
          )}
        </div>
      </div>
      
      {/* Legend below the chart */}
      <div className="chart-legend">
        {data.map((segment) => (
          <div 
            key={segment.id} 
            className={`legend-item ${hoveredSegment && hoveredSegment.id === segment.id ? 'active' : ''} ${hoveredSegment && hoveredSegment.id !== segment.id ? 'dimmed' : ''}`}
            onMouseEnter={() => setHoveredSegment(segment)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            <span className="legend-dot" style={{ backgroundColor: segment.color }}></span>
            <span className="legend-name">{segment.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CategoryRingChart;
