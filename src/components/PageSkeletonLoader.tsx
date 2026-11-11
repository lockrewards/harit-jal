import React from 'react';
import { HaritJalLoader } from './ui/HaritJalLoader';

interface PageSkeletonLoaderProps {
  path?: string | null;
}

export const PageSkeletonLoader: React.FC<PageSkeletonLoaderProps> = ({ path = '/' }) => {
  const normalized = (path || '/').toLowerCase().replace(/\/+$/, '') || '/';

  // 1. BESPOKE GALLERY SKELETON
  if (normalized === '/collections' || normalized === '/gallery') {
    return (
      <div className="pt-20 sm:pt-24 pb-14 min-h-screen bg-[#F8F3E9] font-manrope">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <div className="w-44 h-7 rounded-full skeleton-shimmer mx-auto" />
            <div className="w-80 max-w-full h-10 rounded-2xl skeleton-shimmer mx-auto" />
            <div className="w-96 max-w-full h-4 rounded-xl skeleton-shimmer mx-auto" />
          </div>

          {/* Filter Tabs Skeleton */}
          <div className="flex justify-center gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-24 h-8 rounded-full skeleton-shimmer" />
            ))}
          </div>

          {/* 3x2 Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 p-5 space-y-4 shadow-xs">
                <div className="h-52 rounded-2xl skeleton-shimmer" />
                <div className="space-y-2">
                  <div className="w-24 h-4 rounded-md skeleton-shimmer" />
                  <div className="w-48 h-6 rounded-lg skeleton-shimmer" />
                  <div className="w-full h-3 rounded-md skeleton-shimmer" />
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-[#C99B42]/15">
                  <div className="w-20 h-5 rounded-md skeleton-shimmer" />
                  <div className="w-28 h-9 rounded-full skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. CONTACT & CONSULTATION SKELETON
  if (normalized === '/contact' || normalized === '/book-a-call') {
    return (
      <div className="pt-20 sm:pt-24 pb-14 min-h-screen bg-[#F8F3E9] font-manrope">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <div className="w-52 h-7 rounded-full skeleton-shimmer mx-auto" />
            <div className="w-96 max-w-full h-10 rounded-2xl skeleton-shimmer mx-auto" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 h-[420px] rounded-3xl bg-[#102C47]/85 p-6 space-y-4 skeleton-shimmer opacity-80" />
            <div className="lg:col-span-7 rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 p-6 space-y-4 shadow-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
                <div className="h-10 rounded-xl skeleton-shimmer" />
              </div>
              <div className="h-10 rounded-xl skeleton-shimmer" />
              <div className="h-20 rounded-xl skeleton-shimmer" />
              <div className="h-12 rounded-full skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. COMPLIANCE & STANDARDS SKELETON
  if (normalized === '/compliance' || normalized === '/standards') {
    return (
      <div className="pt-20 sm:pt-24 pb-14 min-h-screen bg-[#F8F3E9] font-manrope">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <div className="w-48 h-7 rounded-full skeleton-shimmer mx-auto" />
            <div className="w-96 max-w-full h-10 rounded-2xl skeleton-shimmer mx-auto" />
          </div>

          <div className="flex justify-center gap-2 flex-wrap">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-36 h-9 rounded-full skeleton-shimmer" />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 p-5 space-y-3 shadow-xs">
                <div className="w-24 h-5 rounded-md skeleton-shimmer" />
                <div className="w-40 h-6 rounded-lg skeleton-shimmer" />
                <div className="space-y-1.5 pt-2">
                  <div className="w-full h-3 rounded-md skeleton-shimmer" />
                  <div className="w-5/6 h-3 rounded-md skeleton-shimmer" />
                  <div className="w-2/3 h-3 rounded-md skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 5. DEFAULT / HOMEPAGE SKELETON
  return (
    <div className="pt-20 sm:pt-22 pb-14 min-h-screen bg-[#F8F3E9] font-manrope">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Hero Section Skeleton */}
        <div className="min-h-[460px] sm:min-h-[520px] rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 p-6 sm:p-10 flex flex-col justify-center space-y-4 relative overflow-hidden shadow-xs">
          <div className="w-48 h-7 rounded-full skeleton-shimmer" />
          <div className="space-y-2">
            <div className="w-4/5 sm:w-3/5 h-10 sm:h-12 rounded-2xl skeleton-shimmer" />
            <div className="w-3/5 sm:w-2/5 h-10 sm:h-12 rounded-2xl skeleton-shimmer" />
          </div>
          <div className="space-y-2 pt-1 max-w-xl">
            <div className="w-full h-4 rounded-xl skeleton-shimmer" />
            <div className="w-3/4 h-4 rounded-xl skeleton-shimmer" />
          </div>
          <div className="pt-3 flex flex-wrap gap-3">
            <div className="w-48 h-12 rounded-full skeleton-shimmer" />
            <div className="w-44 h-12 rounded-full skeleton-shimmer" />
          </div>
          <div className="pt-4 flex flex-wrap gap-2">
            <div className="w-32 h-7 rounded-full skeleton-shimmer" />
            <div className="w-32 h-7 rounded-full skeleton-shimmer" />
            <div className="w-32 h-7 rounded-full skeleton-shimmer" />
          </div>
        </div>

        {/* Section 2: Cards Skeleton */}
        <div className="space-y-5">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="w-36 h-6 rounded-full skeleton-shimmer mx-auto" />
            <div className="w-72 h-8 rounded-xl skeleton-shimmer mx-auto" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-56 rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 p-5 space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-full skeleton-shimmer mx-auto" />
                <div className="w-32 h-5 rounded-lg skeleton-shimmer mx-auto" />
                <div className="space-y-1.5 pt-2">
                  <div className="w-full h-3 rounded-md skeleton-shimmer" />
                  <div className="w-4/5 h-3 rounded-md skeleton-shimmer mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

/**
 * Glowing Golden Liquid Progress Bar at the top of viewport during page transition
 */
export const TopLiquidProgressBar: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-[3px] z-[9999] pointer-events-none overflow-hidden bg-[#102C47]/20"
      aria-hidden="true"
    >
      <div 
        className="h-full w-full bg-gradient-to-r from-[#C99B42] via-[#FFF9EF] to-[#C99B42] shadow-[0_0_12px_#C99B42] animate-liquid-bar"
      />
    </div>
  );
};

/**
 * Universal Brand Loading Screen with the animated Harit Jal circular ring & water ripples
 */
export const PageLoadingScreen: React.FC<{ message?: string; subMessage?: string }> = ({
  message = 'Loading Harit Jal...',
  subMessage,
}) => {
  return (
    <div className="pt-24 pb-16 min-h-[60vh] flex items-center justify-center font-manrope">
      <HaritJalLoader size="lg" message={message} subMessage={subMessage} variant="inline" />
    </div>
  );
};

