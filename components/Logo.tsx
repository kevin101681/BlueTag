
import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'header';
  showText?: boolean; // Kept for API compatibility, though text is now integral
  className?: string;
}

export const BlueTagLogo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  // Dimension Configuration
  const config = {
    sm: { w: 40, h: 40 },
    md: { w: 60, h: 60 },
    header: { w: 96, h: 96 },
    lg: { w: 100, h: 100 },
    xl: { w: 160, h: 160 }
  }[size];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg 
          width={config.w} 
          height={config.h} 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm"
      >
          {/* Group for Tape Graphic: Vertically centered (Shifted up slightly for tighter fit) */}
          {/* Shifted X to 7.5 to better center the tape horizontally relative to text at 50 */}
          <g transform="translate(7.5, -6) scale(0.85)">
              {/* Tape Shape - Fixed Blue #60a5fa (Brand Color) */}
              <path 
                  d="M5 25 
                     L74 25 
                     L74 42 
                     L93 42
                     L92 52 L96 62 L92 72 L95 80
                     L5 80 
                     L8 71 L4 62 L8 53 L4 44 L8 35 
                     Z" 
                  className="fill-[#60a5fa]"
              />
              
              {/* Peeled Corner - Fixed Darker Blue #3b82f6 */}
              <path 
                  d="M74 25 L93 42 L74 42 Z" 
                  className="fill-[#3b82f6]" 
              />
              
              {/* Shadow */}
              <path 
                  d="M74 42 L93 42 L74 45 Z" 
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
              />
          </g>

          {/* Integrated Text Label - Fixed Blue #60a5fa / White (Dark Mode) */}
          <text 
              x="50" 
              y="88" 
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
