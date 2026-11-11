import React from 'react';

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  variant?: 'gold' | 'navy' | 'olive' | 'white' | 'danger' | 'ghost';
  spinnerPosition?: 'left' | 'right';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading = false,
  loadingText,
  variant = 'gold',
  spinnerPosition = 'left',
  leftIcon,
  rightIcon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  // Base variant classes matching Harit Jal luxury theme
  const variantStyles = {
    gold: 'btn-gold-luxury text-[#102C47]',
    navy: 'btn-navy-luxury text-[#FFF9EF]',
    olive: 'btn-olive-outline',
    white: 'bg-white hover:bg-[#F8F5EC] text-[#102C47] border border-[#C99B42]/40 shadow-xs',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-md',
    ghost: 'bg-transparent hover:bg-[#102C47]/5 text-[#102C47]',
  }[variant];

  // Micro rotating Navy/Gold loading ring for buttons
  const miniSpinner = (
    <svg 
      className="animate-harit-spin shrink-0 w-4 h-4" 
      viewBox="0 0 40 40" 
      aria-hidden="true"
    >
      <circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="3.5"
      />
      <circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeDasharray="65 35"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <button
      {...props}
      disabled={isLoading || disabled}
      aria-busy={isLoading}
      className={`relative inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 cursor-pointer ${variantStyles} ${
        isLoading ? 'cursor-not-allowed opacity-80 pointer-events-none' : 'active:scale-[0.98]'
      } ${className}`}
    >
      {/* Loading state */}
      {isLoading ? (
        <>
          {spinnerPosition === 'left' && miniSpinner}
          <span className="truncate">
            {loadingText || children}
          </span>
          {spinnerPosition === 'right' && miniSpinner}
        </>
      ) : (
        /* Normal state */
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

