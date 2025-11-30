
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'header';
  showText?: boolean; // Kept for API compatibility
  className?: string;
  style?: React.CSSProperties;
}

export const BlueTagLogo: React.FC<LogoProps> = ({ size = 'md', className = '', style }) => {
  // Dimension Configuration
  const config = {
    sm: { w: 40, h: 40, p: 2, r: 'rounded-lg' },
    md: { w: 54, h: 54, p: 3, r: 'rounded-2xl' }, // Resized to match buttons
    header: { w: 96, h: 96, p: 4, r: 'rounded-3xl' },
    lg: { w: 100, h: 100, p: 5, r: 'rounded-3xl' },
    xl: { w: 160, h: 160, p: 8, r: 'rounded-[32px]' }
  }[size];

  // We set width/height on the container div, allowing override via className/style.
  // The padding is also applied to the container.
  // The SVG fills the container minus padding.
  
  return (
    <div 
        className={`flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 ${config.r} ${className}`} 
        style={{ 
            width: config.w, 
            height: config.h, 
            padding: config.p,
            ...style 
        }}
    >
      <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
      >
          {/* Group for Tape Graphic: Vertically centered */}
          <g transform="translate(7.5, -11) scale(0.85)">
              {/* Tape Shape with Serrated Edges */}
              <path 
                  d="M 5 25 
                     L 80 25 
                     L 80 40 
                     L 95 40 
                     L 92 45 L 95 50
                     L 92 55 L 95 60
                     L 92 65 L 95 70
                     L 92 75 L 95 80
                     L 5 80 
                     L 8 75 L 5 70
                     L 8 65 L 5 60
                     L 8 55 L 5 50
                     L 8 45 L 5 40
                     L 8 35 L 5 30
                     L 8 25 L 5 25
                     Z" 
                  className="fill-[#60a5fa]"
              />
              
              {/* Peeled Corner - Top Right */}
              <path 
                  d="M80 25 L95 40 L80 40 Z" 
                  className="fill-[#3b82f6]" 
              />
              
              {/* Shadow for Peel */}
              <path 
                  d="M80 40 L95 40 L80 43 Z" 
                  fill="#000000" 
                  opacity="0.2"
              />
              
              {/* Checkmark */}
              <path 
                  d="M38 53 L48 63 L62 45" 
                  stroke="white" 
                  strokeWidth="6" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  fill="none"
              />
          </g>

          {/* Integrated Text Label */}
          <text 
              x="50" 
              y="84" 
              textAnchor="middle" 
              fontFamily='"Google Sans Flex", "Outfit", sans-serif' 
              fontWeight="800" 
              fontSize="22"
              className="fill-[#60a5fa] dark:fill-white"
              style={{ letterSpacing: '-0.02em' }}
          >
              BlueTag
          </text>
      </svg>
    </div>
  );
};
