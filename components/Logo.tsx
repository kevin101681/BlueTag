
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
    sm: { w: 40, h: 40, p: 8, r: 'rounded-lg' },
    md: { w: 54, h: 54, p: 12, r: 'rounded-2xl' }, 
    header: { w: 96, h: 96, p: 20, r: 'rounded-3xl' },
    lg: { w: 100, h: 100, p: 24, r: 'rounded-3xl' },
    xl: { w: 160, h: 160, p: 40, r: 'rounded-[32px]' }
  }[size];

  // We set width/height on the container div, allowing override via className/style.
  // The padding is also applied to the container.
  
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
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className="w-full h-full text-primary"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <circle cx="7" cy="7" r="2" fill="white" />
      </svg>
    </div>
  );
};
