
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
      <img 
        src="/dark.png" 
        alt="BlueTag" 
        className="w-full h-full object-contain block dark:hidden" 
      />
      <img 
        src="/light.png" 
        alt="BlueTag" 
        className="w-full h-full object-contain hidden dark:block" 
      />
    </div>
  );
};
