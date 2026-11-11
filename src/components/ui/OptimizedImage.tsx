import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  containerClassName?: string;
  aspectRatio?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  fallbackSrc = '/images/brand/harit-jal-logo-mark.png',
  containerClassName = '',
  aspectRatio,
  className = '',
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  return (
    <div className={`relative overflow-hidden ${aspectRatio || ''} ${containerClassName}`}>
      {/* 1. Shimmer Skeleton Placeholder while loading */}
      {!isLoaded && !hasError && (
        <div 
          aria-hidden="true"
          className="absolute inset-0 skeleton-shimmer flex items-center justify-center bg-[#F8F3E9]"
        >
          <div className="w-8 h-8 rounded-full border border-[#C99B42]/30 flex items-center justify-center opacity-40">
            <img 
              src="/images/brand/harit-jal-logo-mark.png" 
              alt="Harit Jal Shimmer" 
              className="w-5 h-5 object-contain" 
            />
          </div>
        </div>
      )}

      {/* 2. Error Fallback State if the image fails */}
      {hasError ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#F8F3E9] text-[#77766F] text-center border border-[#C99B42]/20 rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-[#FFF9EF] border border-[#C99B42]/40 flex items-center justify-center mb-2 shadow-2xs">
            <img 
              src={fallbackSrc} 
              alt="Harit Jal Fallback" 
              className="w-6 h-6 object-contain" 
            />
          </div>
          <span className="text-[11px] font-semibold text-[#102C47]">{alt || 'Product Image'}</span>
          <span className="text-[9.5px] text-[#77766F]/70 flex items-center gap-1 mt-0.5">
            <ImageOff className="w-3 h-3" />
            <span>Image currently offline</span>
          </span>
        </div>
      ) : (
        /* 3. Actual Image with smooth fade-in */
        <img
          {...props}
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={handleError}
          className={`${className} transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};

