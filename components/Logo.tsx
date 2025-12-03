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
    sm: { w: 40, h: 40, r: 'rounded-lg' },
    md: { w: 54, h: 54, r: 'rounded-2xl' },
    header: { w: 96, h: 96, r: 'rounded-3xl' },
    lg: { w: 100, h: 100, r: 'rounded-3xl' },
    xl: { w: 160, h: 160, r: 'rounded-[32px]' }
  }[size];

  return (
    <img
      src="/logo.png"
      alt="BlueTag Logo"
      className={`${config.r} ${className}`}
      style={{
        width: config.w,
        height: config.h,
        objectFit: 'contain',
        ...style
      }}
    />
  );
};
