
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
    sm: { w: 40, h: 40, p: 4, r: 'rounded-lg' },
    md: { w: 54, h: 54, p: 6, r: 'rounded-2xl' }, 
    header: { w: 96, h: 96, p: 10, r: 'rounded-3xl' },
    lg: { w: 100, h: 100, p: 12, r: 'rounded-3xl' },
    xl: { w: 160, h: 160, p: 20, r: 'rounded-[32px]' }
  }[size];

  return (
    <div 
        className={`flex items-center justify-center bg-slate-300 dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 ${config.r} ${className}`} 
        style={{ 
            width: config.w, 
            height: config.h, 
            padding: config.p,
            ...style 
        }}
    >
      <img 
        src="/logo.png" 
        alt="BlueTag" 
        className="w-full h-full object-contain"
      />
    </div>
  );
};
