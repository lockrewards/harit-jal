import React, { useEffect } from 'react';
import { Home, Layers, Headphones, ArrowRight, MapPin, Mail, Phone } from 'lucide-react';
import { useRouter } from '../router/useRouter';
import { soundPlayer } from '../services/sound';

export const NotFoundPage: React.FC = () => {
  const { navigate } = useRouter();

  useEffect(() => {
    const originalTitle = document.title;
    document.title = '404: A Drop Off the Map | Harit Jal™';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => {
      document.title = originalTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-[#34443D] flex flex-col justify-between overflow-x-hidden selection:bg-[#C99A3C]/20 selection:text-[#064B35] relative font-manrope">
      
      {/* SCOPED ANIMATIONS */}
      <style>{`
        @keyframes subtleWaterBreath {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.008);
          }
        }
        .anim-water-surface {
          animation: subtleWaterBreath 6s ease-in-out infinite;
          transform-origin: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .anim-water-surface {
            animation: none !important;
          }
        }
      `}</style>

      {/* 
        MAIN 404 SECTION (EXACT HEADERLESS LAYOUT FROM APPROVED MOCKUP)
      */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-12 md:pt-14 pb-4 flex-1 flex flex-col items-center justify-center text-center">
        
        {/* TOP OUTLINED PILL WITH DECORATIVE GOLD LINES */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 w-full max-w-xs sm:max-w-sm mx-auto mb-3 sm:mb-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#C99A3C]/70" />
          <div className="px-3.5 py-1 rounded-full border border-[#C99A3C]/80 bg-[#FAF7EE] text-[10px] sm:text-[11px] font-bold tracking-[0.22em] text-[#064B35] uppercase whitespace-nowrap shadow-2xs">
            ERROR 404 / PAGE NOT FOUND
          </div>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#C99A3C]/70" />
        </div>

        {/* OVERSIZED "404" (Deep Forest Green "4", Champagne Gold "0", Deep Forest Green "4") */}
        <div 
          className="text-8xl sm:text-9xl md:text-[145px] lg:text-[160px] font-playfair font-bold tracking-tight leading-none select-none my-1 flex items-center justify-center"
          aria-label="404 Error"
        >
          <span className="text-[#064B35]">4</span>
          <span className="text-[#C99A3C] font-serif mx-0.5 sm:mx-1 inline-block">0</span>
          <span className="text-[#064B35]">4</span>
        </div>

        {/* BOTANICAL TWO-LEAF DIVIDER WITH THIN GOLD LINES */}
        <div className="flex items-center justify-center gap-3 my-2.5 sm:my-3 w-full max-w-xs mx-auto">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#C99A3C]/70" />
          <svg 
            className="w-8 h-5 text-[#8D9B7F] shrink-0" 
            viewBox="0 0 36 20" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Left Leaf with central vein */}
            <path d="M18 18 C16 13, 8 12, 7 6 C12 6, 17 11, 18 18 Z" />
            <path d="M11 10 C14 11.5, 16 14, 18 18" />
            {/* Right Leaf with central vein */}
            <path d="M18 18 C20 13, 28 12, 29 6 C24 6, 19 11, 18 18 Z" />
            <path d="M25 10 C22 11.5, 20 14, 18 18" />
          </svg>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#C99A3C]/70" />
        </div>

        {/* MAIN HEADING */}
        <h1 className="text-3xl sm:text-4xl md:text-[46px] font-bold font-playfair text-[#064B35] tracking-tight leading-tight mt-1 mb-2">
          A Drop Off the Map.
        </h1>

        {/* SUPPORTING DESCRIPTION (TWO LINES, CENTERED) */}
        <p className="text-xs sm:text-sm md:text-[15px] text-[#34443D] leading-relaxed max-w-lg mx-auto mb-6 sm:mb-7 font-normal">
          It seems this page has drifted away. But there&apos;s always<br className="hidden sm:inline" />
          {' '}a refreshing way back.
        </p>

        {/* ACTION BUTTONS (HORIZONTALLY ALIGNED) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto z-20">
          {/* PRIMARY BUTTON: RETURN HOME */}
          <button
            type="button"
            onClick={() => {
              soundPlayer.playWaterDrop();
              navigate('/');
            }}
            className="group w-full sm:w-auto px-6 py-3 rounded-full bg-[#064B35] hover:bg-[#043324] text-white text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer active:scale-98"
          >
            <Home className="w-4 h-4 text-white stroke-[1.75]" />
            <span>Return Home</span>
            <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
          </button>

          {/* SECONDARY BUTTON: EXPLORE OUR COLLECTION */}
          <button
            type="button"
            onClick={() => {
              soundPlayer.playBubblePop();
              navigate('/collections');
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-transparent hover:bg-white/60 border border-[#C99A3C] text-[#064B35] text-xs sm:text-sm font-semibold shadow-2xs hover:shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Layers className="w-4 h-4 text-[#064B35] stroke-[1.75]" />
            <span>Explore Our Collection</span>
          </button>
        </div>

        {/* 
          SIGNATURE WATER RIPPLE DESIGN & SILK-LIKE FLOWING WAVES
          Exact photorealistic artwork seamlessly blended with zero creases or visible boundaries
        */}
        <div className="w-full max-w-4xl mx-auto -mt-2 sm:-mt-3 my-2 sm:my-3 relative select-none">
          <img 
            src="/images/ripple-waves-404.webp"
            alt="Harit Jal Water Ripple and Wave"
            className="w-full h-auto max-h-[175px] sm:max-h-[195px] object-contain anim-water-surface mx-auto pointer-events-none mix-blend-multiply"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            }}
            loading="eager"
            draggable={false}
          />
        </div>

        {/* 
          QUICK NAVIGATION SECTION
          Three horizontally aligned navigation links separated by thin vertical gold lines
        */}
        <div className="w-full max-w-2xl mx-auto pt-1 pb-2">
          <nav 
            aria-label="Quick Navigation"
            className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 md:gap-8"
          >
            {/* ITEM 1: Discover Our Bottles */}
            <button
              type="button"
              onClick={() => {
                soundPlayer.playBubblePop();
                navigate('/gallery');
              }}
              className="group flex items-center gap-2 text-sm sm:text-[15px] font-bold font-playfair text-[#064B35] hover:text-[#C99A3C] transition-colors cursor-pointer"
            >
              {/* Bottle Outline Icon */}
              <svg 
                className="w-4 h-4 text-[#064B35] group-hover:text-[#C99A3C] shrink-0 transition-colors" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.75" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 2h6" />
                <path d="M10 2v3a2 2 0 0 1-.6 1.4L8 8a3 3 0 0 0-1 2.2V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V10.2a3 3 0 0 0-1-2.2L14.6 6.4A2 2 0 0 1 14 5V2" />
                <path d="M7 14h10" />
              </svg>
              <span>Discover Our Bottles</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#064B35] group-hover:text-[#C99A3C] group-hover:translate-x-1 transition-all" />
            </button>

            {/* Separator 1 */}
            <div className="hidden sm:block w-px h-5 bg-[#C99A3C]/50" aria-hidden="true" />

            {/* ITEM 2: Our Collections */}
            <button
              type="button"
              onClick={() => {
                soundPlayer.playBubblePop();
                navigate('/collections');
              }}
              className="group flex items-center gap-2 text-sm sm:text-[15px] font-bold font-playfair text-[#064B35] hover:text-[#C99A3C] transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#064B35] group-hover:text-[#C99A3C] shrink-0 transition-colors stroke-[1.75]" />
              <span>Our Collections</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#064B35] group-hover:text-[#C99A3C] group-hover:translate-x-1 transition-all" />
            </button>

            {/* Separator 2 */}
            <div className="hidden sm:block w-px h-5 bg-[#C99A3C]/50" aria-hidden="true" />

            {/* ITEM 3: Hospitality Desk */}
            <button
              type="button"
              onClick={() => {
                soundPlayer.playWaterDrop();
                navigate('/contact');
              }}
              className="group flex items-center gap-2 text-sm sm:text-[15px] font-bold font-playfair text-[#064B35] hover:text-[#C99A3C] transition-colors cursor-pointer"
            >
              <Headphones className="w-4 h-4 text-[#064B35] group-hover:text-[#C99A3C] shrink-0 transition-colors stroke-[1.75]" />
              <span>Hospitality Desk</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#064B35] group-hover:text-[#C99A3C] group-hover:translate-x-1 transition-all" />
            </button>
          </nav>
        </div>

      </main>

      {/* 
        FOOTER (EXACT SINGLE ROW WITH THIN GOLD TOP BORDER)
      */}
      <footer className="relative z-10 w-full border-t border-[#C99A3C]/40 bg-[#FAF7EE]">
        <div className="w-full max-w-6xl mx-auto py-3.5 px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between text-[11px] sm:text-xs text-[#34443D] gap-2.5 sm:gap-3 text-center md:text-left">
          
          {/* LEFT: Brand Identity with pipe divider */}
          <div className="flex items-center gap-2 font-playfair font-semibold text-[#064B35]">
            <span>Harit Jal™</span>
            <span className="text-[#C99A3C]/60">|</span>
            <span className="font-normal text-[#34443D]">Bespoke Dining Hydration</span>
          </div>

          {/* MIDDLE: Location */}
          <div className="flex items-center justify-center gap-1.5 text-[#34443D]">
            <MapPin className="w-3.5 h-3.5 text-[#064B35] shrink-0" />
            <span>Bettiah, Bihar, India</span>
          </div>

          {/* RIGHT: Email */}
          <div className="flex items-center justify-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#064B35] shrink-0" />
            <a 
              href="mailto:info@haritjal.in" 
              className="hover:text-[#064B35] transition-colors"
            >
              info@haritjal.in
            </a>
          </div>

          {/* FAR RIGHT: Phone */}
          <div className="flex items-center justify-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-[#064B35] shrink-0" />
            <a 
              href="tel:+916299293497" 
              className="hover:text-[#064B35] font-mono transition-colors"
            >
              +91 62992 93497
            </a>
          </div>

        </div>
      </footer>

    </div>
  );
};
