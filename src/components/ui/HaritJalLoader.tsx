import React from 'react';
import { createPortal } from 'react-dom';

export interface HaritJalLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  subMessage?: string;
  variant?: 'fullscreen' | 'overlay' | 'inline' | 'minimal';
  showLogo?: boolean;
  showRipples?: boolean;
  showBrandName?: boolean;
  className?: string;
}

export const HaritJalLoader: React.FC<HaritJalLoaderProps> = ({
  size = 'md',
  message = 'Loading...',
  subMessage,
  variant = 'inline',
  showLogo = true,
  showRipples = true,
  showBrandName = true,
  className = '',
}) => {
  // Dimension presets based on size
  const config = {
    xs: {
      ringSize: 24,
      strokeWidth: 3,
      emblemSize: 14,
      titleSize: 'text-xs',
      msgSize: 'text-[10px]',
      gap: 'gap-1',
      rippleWidth: 32,
    },
    sm: {
      ringSize: 64,
      strokeWidth: 4,
      emblemSize: 34,
      titleSize: 'text-sm',
      msgSize: 'text-xs',
      gap: 'gap-2',
      rippleWidth: 76,
    },
    md: {
      ringSize: 96,
      strokeWidth: 4.5,
      emblemSize: 52,
      titleSize: 'text-base sm:text-lg',
      msgSize: 'text-xs sm:text-sm',
      gap: 'gap-2.5',
      rippleWidth: 110,
    },
    lg: {
      ringSize: 124,
      strokeWidth: 5,
      emblemSize: 68,
      titleSize: 'text-lg sm:text-xl',
      msgSize: 'text-sm sm:text-base',
      gap: 'gap-3',
      rippleWidth: 142,
    },
    xl: {
      ringSize: 148,
      strokeWidth: 5.5,
      emblemSize: 80,
      titleSize: 'text-xl sm:text-2xl',
      msgSize: 'text-base sm:text-lg',
      gap: 'gap-3.5',
      rippleWidth: 170,
    },
  }[size];

  // Minimal variant: Compact horizontal row (e.g. for small inline badges)
  if (variant === 'minimal') {
    return (
      <div 
        role="status" 
        aria-live="polite"
        className={`inline-flex items-center gap-2.5 text-[#102C47] font-manrope ${className}`}
      >
        <svg 
          className="animate-harit-spin shrink-0 text-[#102C47]" 
          width={config.ringSize} 
          height={config.ringSize} 
          viewBox="0 0 50 50"
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            strokeDasharray="80 50"
            strokeLinecap="round"
            className="text-[#102C47]"
          />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="#C99B42"
            strokeWidth={config.strokeWidth}
            strokeDasharray="25 105"
            strokeDashoffset="-70"
            strokeLinecap="round"
          />
        </svg>
        {message && (
          <span className={`font-semibold ${config.msgSize} text-[#102C47] animate-text-pulse`}>
            {message}
          </span>
        )}
      </div>
    );
  }

  // Master Loader Body (emblem + rotating gradient ring + water ripples + brand typography)
  const loaderCore = (
    <div className={`flex flex-col items-center justify-center text-center select-none ${config.gap}`}>
      
      {/* Visual Center Piece: Emblem inside rotating gradient ring & ripples */}
      <div className="relative flex items-center justify-center" style={{ width: config.ringSize, height: config.ringSize }}>
        
        {/* 1. Subtle Water Ripple Animation beneath the logo */}
        {showRipples && size !== 'xs' && (
          <div 
            aria-hidden="true" 
            className="absolute -bottom-2 pointer-events-none flex items-center justify-center overflow-visible"
            style={{ width: config.rippleWidth, height: 28 }}
          >
            <div className="absolute inset-0 rounded-full border border-sky-400/40 bg-sky-200/10 animate-water-ripple-1" />
            <div className="absolute inset-0 rounded-full border border-[#C99B42]/35 bg-[#C99B42]/5 animate-water-ripple-2" />
            <div className="absolute inset-0 rounded-full border border-sky-500/25 animate-water-ripple-3" />
          </div>
        )}

        {/* 2. Rotating Navy / Gold Circular Loading Ring */}
        <svg 
          className="absolute inset-0 w-full h-full animate-harit-spin drop-shadow-xs" 
          viewBox="0 0 100 100"
          style={{ willChange: 'transform' }}
        >
          <defs>
            {/* Smooth transition from Deep Navy (#102C47) to Champagne Gold (#C99B42) to Light Gold (#E0BA6E) */}
            <linearGradient id="haritRingGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#102C47" stopOpacity="0.15" />
              <stop offset="30%" stopColor="#102C47" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#1B4D7E" stopOpacity="1" />
              <stop offset="90%" stopColor="#C99B42" stopOpacity="1" />
              <stop offset="100%" stopColor="#E0BA6E" stopOpacity="1" />
            </linearGradient>
            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track (soft transparent guide ring) */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#102C47"
            strokeOpacity="0.08"
            strokeWidth={config.strokeWidth}
          />

          {/* Active Gradient Arc */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="url(#haritRingGradient)"
            strokeWidth={config.strokeWidth}
            strokeDasharray="200 70"
            strokeLinecap="round"
          />

          {/* Glowing Golden Leading Dot at the tip of the rotating ring */}
          <circle
            cx="79"
            cy="21"
            r={config.strokeWidth * 0.9}
            fill="#E0BA6E"
            filter="url(#goldGlow)"
          />
        </svg>

        {/* 3. Water-drop and green-leaf brand emblem in center */}
        {showLogo && (
          <div 
            className="relative z-10 flex items-center justify-center rounded-full bg-white/90 p-1 shadow-xs animate-emblem-float"
            style={{ width: config.emblemSize, height: config.emblemSize }}
          >
            <img
              src="/images/brand/harit-jal-logo-mark.png"
              alt="Harit Jal™"
              className="w-full h-full object-contain filter drop-shadow-2xs"
            />
          </div>
        )}
      </div>

      {/* 4. Brand Typography & Status Message */}
      {(showBrandName || message) && (
        <div className="space-y-1 mt-1">
          {showBrandName && (
            <h3 className={`font-playfair font-bold text-[#102C47] tracking-tight leading-tight ${config.titleSize}`}>
              Harit Jal<span className="text-[0.65em] font-sans font-semibold text-[#C99B42] align-top ml-0.5">™</span>
            </h3>
          )}

          {message && (
            <p className={`font-manrope font-medium text-[#77766F] tracking-wide animate-text-pulse ${config.msgSize}`}>
              {message}
            </p>
          )}

          {subMessage && (
            <p className="font-manrope text-[11px] sm:text-xs text-[#77766F]/80 max-w-xs mx-auto">
              {subMessage}
            </p>
          )}
        </div>
      )}

    </div>
  );

  // Wrapper based on requested variant
  if (variant === 'fullscreen') {
    const fullscreenContent = (
      <div 
        role="status" 
        aria-live="polite"
        className={`fixed inset-0 top-0 left-0 w-screen h-screen min-h-[100dvh] z-[99999] flex flex-col items-center justify-center p-6 bg-[#FFF9EF]/98 backdrop-blur-md font-manrope ${className}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="w-full max-w-md mx-auto my-auto flex flex-col items-center justify-center py-8">
          {loaderCore}
        </div>
      </div>
    );

    if (typeof document !== 'undefined' && document.body) {
      return createPortal(fullscreenContent, document.body);
    }
    return fullscreenContent;
  }

  if (variant === 'overlay') {
    return (
      <div 
        role="status" 
        aria-live="polite"
        className={`absolute inset-0 z-30 flex items-center justify-center p-4 bg-[#FFF9EF]/88 backdrop-blur-[2px] rounded-2xl animate-fadeIn ${className}`}
      >
        {loaderCore}
      </div>
    );
  }

  // Default: inline
  return (
    <div 
      role="status" 
      aria-live="polite"
      className={`py-8 sm:py-12 flex flex-col items-center justify-center ${className}`}
    >
      {loaderCore}
    </div>
  );
};

