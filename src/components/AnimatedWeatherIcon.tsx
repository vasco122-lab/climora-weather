import React, { useId } from 'react';
import type { WeatherVisualType } from '../services/weatherService';

interface AnimatedWeatherIconProps {
  visual: WeatherVisualType;
  size?: number;
  className?: string;
}

export const AnimatedWeatherIcon: React.FC<AnimatedWeatherIconProps> = ({
  visual,
  size = 64,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `climora-grad-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--chroma-c1)">
            <animate
              attributeName="stop-color"
              values="#22d3ee;#a855f7;#ec4899;#f59e0b;#10b981;#22d3ee"
              dur="8s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="50%" stopColor="var(--chroma-c2)">
            <animate
              attributeName="stop-color"
              values="#a855f7;#ec4899;#f59e0b;#10b981;#22d3ee;#a855f7"
              dur="8s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="var(--chroma-c4)">
            <animate
              attributeName="stop-color"
              values="#f59e0b;#10b981;#22d3ee;#a855f7;#ec4899;#f59e0b"
              dur="8s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>
      </defs>

      {visual === 'sun' && (
        <g>
          <g className="animate-slow-rotate" style={{ transformOrigin: '32px 32px' }}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <line
                key={angle}
                x1="32"
                y1="7"
                x2="32"
                y2="13"
                stroke={`url(#${gradId})`}
                strokeWidth="3"
                strokeLinecap="round"
                transform={`rotate(${angle} 32 32)`}
              />
            ))}
          </g>
          <circle
            cx="32"
            cy="32"
            r="13"
            fill={`url(#${gradId})`}
            fillOpacity="0.22"
            stroke={`url(#${gradId})`}
            strokeWidth="2.8"
          />
        </g>
      )}

      {visual === 'partly-cloudy' && (
        <g className="animate-weather-float">
          <circle
            cx="24"
            cy="24"
            r="9"
            fill={`url(#${gradId})`}
            fillOpacity="0.25"
            stroke={`url(#${gradId})`}
            strokeWidth="2.5"
          />
          <path
            d="M20 45h24a8 8 0 0 0 1.2-15.9A11 11 0 0 0 24 27a9 9 0 0 0-4 18Z"
            fill="#0b1224"
            fillOpacity="0.88"
            stroke={`url(#${gradId})`}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
        </g>
      )}

      {visual === 'cloudy' && (
        <g className="animate-weather-float">
          <path
            d="M18 46h28a9 9 0 0 0 1.4-17.9A12 12 0 0 0 24 24a10 10 0 0 0-6 22Z"
            fill={`url(#${gradId})`}
            fillOpacity="0.16"
            stroke={`url(#${gradId})`}
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
        </g>
      )}

      {visual === 'fog' && (
        <g className="animate-weather-float">
          <path
            d="M17 34h30a7 7 0 0 0 1-13.9A10 10 0 0 0 28 17a8 8 0 0 0-11 17Z"
            fill={`url(#${gradId})`}
            fillOpacity="0.16"
            stroke={`url(#${gradId})`}
            strokeWidth="2.5"
          />
          <line x1="14" y1="42" x2="50" y2="42" stroke={`url(#${gradId})`} strokeWidth="2.8" strokeLinecap="round" />
          <line x1="19" y1="49" x2="45" y2="49" stroke={`url(#${gradId})`} strokeWidth="2.8" strokeLinecap="round" />
        </g>
      )}

      {visual === 'rain' && (
        <g>
          <path
            d="M17 37h29a8 8 0 0 0 1.2-15.9A11 11 0 0 0 25 18a9 9 0 0 0-8 19Z"
            fill={`url(#${gradId})`}
            fillOpacity="0.18"
            stroke={`url(#${gradId})`}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          {[22, 32, 42].map((x, i) => (
            <line
              key={x}
              x1={x}
              y1="42"
              x2={x - 2}
              y2="50"
              stroke={`url(#${gradId})`}
              strokeWidth="2.6"
              strokeLinecap="round"
              className="animate-rain-drop"
              style={{ animationDelay: `${i * 0.35}s` }}
            />
          ))}
        </g>
      )}

      {visual === 'snow' && (
        <g>
          <path
            d="M17 36h29a8 8 0 0 0 1.2-15.9A11 11 0 0 0 25 17a9 9 0 0 0-8 19Z"
            fill={`url(#${gradId})`}
            fillOpacity="0.18"
            stroke={`url(#${gradId})`}
            strokeWidth="2.6"
          />
          {[22, 32, 42].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy="46"
              r="2.4"
              fill={`url(#${gradId})`}
              className="animate-rain-drop"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
        </g>
      )}

      {visual === 'storm' && (
        <g>
          <path
            d="M17 36h29a8 8 0 0 0 1.2-15.9A11 11 0 0 0 25 17a9 9 0 0 0-8 19Z"
            fill={`url(#${gradId})`}
            fillOpacity="0.2"
            stroke={`url(#${gradId})`}
            strokeWidth="2.6"
          />
          <polygon
            points="33,37 26,47 32,47 29,57 39,44 33,44"
            fill={`url(#${gradId})`}
            className="animate-bolt-pulse"
          />
        </g>
      )}
    </svg>
  );
};
