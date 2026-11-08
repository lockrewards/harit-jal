import React from 'react';
import { PhoneCall, ShieldCheck, CheckCircle2, Recycle, PenLine, Truck, ArrowRight, Images, Utensils } from 'lucide-react';
import { soundPlayer } from '../services/sound';

interface HeroProps {
  onOpenBookingModal: () => void;
  onNavigateToCustomizer: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onOpenBookingModal,
  onNavigateToCustomizer,
}) => {
  return (
    <section 
      id="hero-section" 
      className="relative min-h-[760px] md:h-[820px] lg:h-[860px] xl:h-[900px] w-full flex flex-col justify-between overflow-hidden bg-[#F8F3E9]"
    >
      
      {/* 
        1. UPLOADED LUXURY RESTAURANT BACKGROUND IMAGE
        Full viewport edge-to-edge background with sculpted spiral glass bottle, crystal glass,
        flowers on marble table on the right, and warm cream interior on the left.
      */}
      <div 
        className="absolute inset-0 bg-cover bg-no-repeat pointer-events-none select-none"
        style={{
          backgroundImage: `url('/hero-luxury-cream-bg.jpg')`,
          backgroundPosition: 'right center',
        }}
      />

      {/* 
        2. SUBTLE READABILITY OVERLAY ON LEFT SIDE
        Ensures high contrast for text on mobile and desktop without hiding the photo.
      */}
      <div 
        className="absolute inset-0 pointer-events-none md:w-[65%] bg-gradient-to-r from-[#FFF9EF]/90 via-[#FFF9EF]/65 to-transparent hidden md:block"
      />
      <div 
        className="absolute inset-0 pointer-events-none md:hidden bg-gradient-to-b from-[#FFF9EF]/95 via-[#FFF9EF]/85 to-[#FFF9EF]/30"
      />

      {/* 
        3. MAIN HERO CONTENT (Left ~55%)
        Leaves the right side unobstructed for the realistic glass bottle and crystal tumbler.
      */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-28 sm:pt-32 pb-8 sm:pb-10 my-auto z-10">
        
        <div className="max-w-2xl lg:max-w-3xl space-y-5 sm:space-y-6">
          
          {/* Small pill-shaped Tagline below navigation */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFF9EF]/90 border border-[#C99B43]/50 text-[#102B46] text-xs sm:text-[13px] font-manrope shadow-sm backdrop-blur-md">
            <Utensils className="w-3.5 h-3.5 text-[#C99B43]" />
            <span className="font-bold text-[#455C22] font-devanagari">हर बूंद में शुद्धता, आपकी अपनी पहचान</span>
            <span className="text-[#C99B43]/60">|</span>
            <span className="text-[#77766F] text-[11px] sm:text-xs font-semibold">Exclusively for Restaurants & Hotels</span>
          </div>

          {/* Main Headline - 2 Lines on Desktop (Playfair Display 64-74px) */}
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[66px] xl:text-[72px] font-bold font-playfair tracking-tight leading-[1.14]">
              <span className="text-[#102B46] block whitespace-nowrap">
                Water Bottles Branded In
              </span>
              <span className="font-playfair italic text-[#C99B43] relative inline-block mt-1 sm:mt-2">
                Your Restaurant's Name.
                {/* Champagne gold curved flourish swash */}
                <svg 
                  className="absolute -bottom-2 sm:-bottom-3 left-0 w-full h-3 sm:h-3.5 overflow-visible pointer-events-none" 
                  viewBox="0 0 320 20" 
                  fill="none" 
                  preserveAspectRatio="none"
                >
                  <path 
                    d="M2 13 C90 22, 210 15, 316 4" 
                    stroke="#C99B43" 
                    strokeWidth="2.4" 
                    strokeLinecap="round" 
                    opacity="0.95"
                  />
                  <path 
                    d="M25 16 C120 22, 230 17, 305 7" 
                    stroke="#E0BA6E" 
                    strokeWidth="1.2" 
                    strokeLinecap="round" 
                    opacity="0.9"
                  />
                </svg>
              </span>
            </h1>

            {/* Hindi Tagline beneath the headline (24–28px) */}
            <div className="mt-4 sm:mt-5 flex items-center gap-2.5 text-xl sm:text-2xl lg:text-[26px] font-semibold">
              <span className="text-[#455C22] font-devanagari font-bold">हरित जल</span>
              <span className="text-[#C99B43]/70 font-light">|</span>
              <span className="text-[#102B46] italic font-playfair font-semibold">
                “आपकी पहचान, हर बूंद में शुद्धता”
              </span>
            </div>
          </div>

          {/* Brand Description (Manrope 17–19px) */}
          <p className="text-[16px] sm:text-[17.5px] lg:text-[18.5px] text-[#2C3E50] max-w-xl leading-relaxed font-manrope font-normal">
            Stop serving generic, unbranded water bottles. When <strong className="text-[#102B46] font-bold">Karan The Dhaba</strong> or your hotel serves Harit Jal, every guest holds a bespoke bottle crafted exclusively for your establishment — 100% compliant with FSSAI, BIS IS:14543, and eco-recycling norms.
          </p>

          {/* Two Horizontal CTA Buttons (Manrope 16–17px) */}
          <div className="pt-2 sm:pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* CTA 1: Gold Gradient Pill */}
            <button
              onClick={() => {
                soundPlayer.playSuccessChime();
                onOpenBookingModal();
              }}
              className="btn-gold-luxury px-8 py-4 rounded-full text-[16px] sm:text-[16.5px] font-bold flex items-center justify-center gap-3 group shadow-xl active:scale-95 cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-[#102B46] group-hover:rotate-12 transition-transform" />
              <span>Book a Free Consultation Call</span>
              <ArrowRight className="w-4 h-4 text-[#102B46] group-hover:translate-x-1 transition-transform" />
            </button>

            {/* CTA 2: Olive Outline Pill */}
            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                onNavigateToCustomizer();
              }}
              className="btn-olive-outline px-7 py-4 rounded-full text-[16px] sm:text-[16.5px] font-bold flex items-center justify-center gap-2.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Images className="w-4 h-4 text-[#455C22]" />
              <span>View More Images &amp; Bottle Gallery</span>
              <ArrowRight className="w-4 h-4 text-[#C99B43]" />
            </button>
          </div>

        </div>

      </div>

      {/* 
        4. COMPACT BOTTOM TRUST STRIP
        Positioned along the bottom organic navy/gold wave curve of the visual layout.
      */}
      <div className="w-full bg-[#102B46]/95 border-t border-[#C99B43]/30 backdrop-blur-md relative z-10 shadow-lg text-[#FFF9EF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-[#C99B43]/20">
            
            {/* 1. FSSAI Compliant */}
            <div className="flex items-center gap-3 px-3 py-1 sm:px-4">
              <div className="w-7 h-7 rounded-lg bg-[#455C22]/30 border border-[#C99B43]/40 flex items-center justify-center text-[#C99B43] shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight">
                <div className="font-bold text-xs sm:text-[13px] text-[#FFF9EF] font-manrope">FSSAI Compliant</div>
                <div className="text-[10px] text-[#E0BA6E]">Food-safe & assured</div>
              </div>
            </div>

            {/* 2. BIS IS:14543 */}
            <div className="flex items-center gap-3 px-3 py-1 sm:px-4 pt-2 md:pt-1">
              <div className="w-7 h-7 rounded-lg bg-[#455C22]/30 border border-[#C99B43]/40 flex items-center justify-center text-[#C99B43] shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight">
                <div className="font-bold text-xs sm:text-[13px] text-[#FFF9EF] font-manrope">BIS IS:14543</div>
                <div className="text-[10px] text-[#E0BA6E]">Quality standard</div>
              </div>
            </div>

            {/* 3. Eco-Friendly */}
            <div className="flex items-center gap-3 px-3 py-1 sm:px-4 pt-2 md:pt-1">
              <div className="w-7 h-7 rounded-lg bg-[#455C22]/30 border border-[#C99B43]/40 flex items-center justify-center text-[#C99B43] shrink-0">
                <Recycle className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight">
                <div className="font-bold text-xs sm:text-[13px] text-[#FFF9EF] font-manrope">Eco-Friendly</div>
                <div className="text-[10px] text-[#E0BA6E]">Responsibly recyclable</div>
              </div>
            </div>

            {/* 4. Fully Customizable */}
            <div className="flex items-center gap-3 px-3 py-1 sm:px-4 pt-2 md:pt-1">
              <div className="w-7 h-7 rounded-lg bg-[#455C22]/30 border border-[#C99B43]/40 flex items-center justify-center text-[#C99B43] shrink-0">
                <PenLine className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight">
                <div className="font-bold text-xs sm:text-[13px] text-[#FFF9EF] font-manrope">Fully Customizable</div>
                <div className="text-[10px] text-[#E0BA6E]">Your brand, our bottle</div>
              </div>
            </div>

            {/* 5. Pan-India Supply */}
            <div className="flex items-center gap-3 px-3 py-1 sm:px-4 pt-2 md:pt-1">
              <div className="w-7 h-7 rounded-lg bg-[#455C22]/30 border border-[#C99B43]/40 flex items-center justify-center text-[#C99B43] shrink-0">
                <Truck className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight">
                <div className="font-bold text-xs sm:text-[13px] text-[#FFF9EF] font-manrope">Pan-India Supply</div>
                <div className="text-[10px] text-[#E0BA6E]">Reliable & on-time</div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </section>
  );
};
