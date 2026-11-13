import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { getImageVariants } from '../../data/imageManifest';

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  containerClassName?: string;
  aspectRatio?: string;
  priority?: boolean;
  sizes?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  fallbackSrc = '/images/brand/harit-jal-logo-mark.png',
  containerClassName = '',
  aspectRatio,
  priority = false,
  sizes,
  className = '',
  width,
  height,
  loading,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const variants = getImageVariants(src);
  const defaultSizes = sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

  const resolvedWidth = width || variants?.width;
  const resolvedHeight = height || variants?.height;

  return (
    <div className={`relative overflow-hidden ${aspectRatio || ''} ${containerClassName}`}>
      {/* 1. Shimmer Skeleton Placeholder while loading */}
      {!isLoaded && !hasError && (
        <div 
          aria-hidden="true"
          className="absolute inset-0 skeleton-shimmer flex items-center justify-center bg-[#F8F3E9] z-10 pointer-events-none"
        >
          <div className="w-8 h-8 rounded-full border border-[#C99B42]/30 flex items-center justify-center opacity-40">
            <img 
              src="/images/brand/harit-jal-logo-mark.png" 
              alt="Harit Jal Shimmer" 
              className="w-5 h-5 object-contain" 
              width={20}
              height={20}
              loading="eager"
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
              width={24}
              height={24}
            />
          </div>
          <span className="text-[11px] font-semibold text-[#102C47]">{alt || 'Product Image'}</span>
          <span className="text-[9.5px] text-[#77766F]/70 flex items-center gap-1 mt-0.5">
            <ImageOff className="w-3 h-3" />
            <span>Image currently offline</span>
          </span>
        </div>
      ) : variants ? (
        /* 3. High-Performance Picture Element with AVIF, WebP, and Responsive Srcset */
        <picture className="w-full h-full block">
          {/* Preference 1: AVIF (Highest compression & preservation) */}
          <source
            type="image/avif"
            srcSet={variants.avif.srcset}
            sizes={defaultSizes}
          />
          {/* Preference 2: WebP (Universal modern support) */}
          <source
            type="image/webp"
            srcSet={variants.webp.srcset}
            sizes={defaultSizes}
          />
          {/* Fallback 3: Original PNG/JPG */}
          <img
            {...props}
            src={src}
            alt={alt}
            width={resolvedWidth}
            height={resolvedHeight}
            loading={priority ? 'eager' : (loading || 'lazy')}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setIsLoaded(true)}
            onError={handleError}
            className={`${className} transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </picture>
      ) : (
        /* Fallback for un-manifested or SVG images */
        <img
          {...props}
          src={src}
          alt={alt}
          width={resolvedWidth}
          height={resolvedHeight}
          loading={priority ? 'eager' : (loading || 'lazy')}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
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
