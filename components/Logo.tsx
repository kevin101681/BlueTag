import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'header';
  showText?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const BlueTagLogo: React.FC<LogoProps> = ({ size = 'md', className = '', style }) => {
  const config = {
    sm: { w: 40, h: 40, p: 4, r: 'rounded-lg' },
    md: { w: 54, h: 54, p: 6, r: 'rounded-2xl' }, 
    header: { w: 96, h: 96, p: 10, r: 'rounded-3xl' },
    lg: { w: 100, h: 100, p: 12, r: 'rounded-3xl' },
    xl: { w: 160, h: 160, p: 20, r: 'rounded-[32px]' }
  }[size];

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
        className="w-full h-full overflow-visible"
        style={{ color: 'rgb(var(--color-primary))' }}
      >
        <defs>
            <filter id="peelShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
                <feOffset dx="1" dy="1" result="offsetblur" />
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.3" />
                </feComponentTransfer>
                <feMerge> 
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" /> 
                </feMerge>
            </filter>
        </defs>

        <g transform="rotate(-6, 50, 45)">
            {/* Main Tape Body */}
            {/* Cut starts higher up at 10, 20 to shorten the left side distance */}
            <path 
                d="
                   M 10 10 
                   L 90 10 
                   L 90 12 L 92 14 L 90 16 L 92 18 L 90 20 L 92 22 L 90 24 L 92 26 L 90 28 L 92 30 L 90 32 L 92 34 L 90 36 L 92 38 L 90 40 L 92 42 L 90 44 L 92 46 L 90 48 L 92 50 L 90 52 L 92 54 L 90 56 L 92 58 L 90 60
                   L 55 60
                   Q 48 60 42 54
                   L 10 20
                   L 12 18 L 10 16 L 12 14 L 10 12 L 10 10
                   Z
                " 
                fill="currentColor" 
            />

            {/* Peeling Flap (Shadow) */}
            {/* Starts at 10, 20. Serrations trend down. */}
            <path 
                d="
                   M 10 20
                   L 14 23 L 16 25
                   L 20 24 L 22 26
                   L 26 25 L 28 27
                   Q 33 26 36 32
                   C 38 45 48 60 55 60
                   L 10 20
                   Z
                " 
                fill="black" 
                fillOpacity="0.2"
                filter="url(#peelShadow)"
            />

            {/* Peeling Flap (Sticky Underside) */}
            <path 
                d="
                   M 10 20
                   L 14 23 L 16 25
                   L 20 24 L 22 26
                   L 26 25 L 28 27
                   Q 33 26 36 32
                   C 38 45 48 60 55 60
                   L 10 20
                   Z
                " 
                fill="white" 
                fillOpacity="0.3"
            />
            
            {/* Flap Border */}
            <path 
                d="
                   M 10 20
                   L 14 23 L 16 25
                   L 20 24 L 22 26
                   L 26 25 L 28 27
                   Q 33 26 36 32
                   C 38 45 48 60 55 60
                   L 10 20
                " 
                fill="none" 
                stroke="rgba(0,0,0,0.1)" 
                strokeWidth="0.5"
            />

            {/* Text */}
            <text 
                x="50" 
                y="85" 
                textAnchor="middle" 
                fill="white" 
                fontSize="22" 
                fontWeight="bold" 
                fontFamily="sans-serif"
                transform="scale(1, 1.15)"
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                textLength="80"
                lengthAdjust="spacingAndGlyphs"
            >
                BlueTag
            </text>
        </g>
      </svg>
    </div>
  );
};