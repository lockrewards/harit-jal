import React from 'react';
import { ArrowRight, PhoneCall, ShieldCheck, CheckCircle2, Truck, Award, Images } from 'lucide-react';
import { soundPlayer } from '../services/sound';
import { useRouter } from '../router/useRouter';
import { PRODUCT_COLLECTIONS } from '../data/products';

interface HomePageProps {
  onOpenBookingModal: () => void;
  onSelectProductForCustomizer: (productId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenBookingModal,
  onSelectProductForCustomizer: _onSelectProductForCustomizer,
}) => {
  const { navigate } = useRouter();

  // Featured 3 designs for Home
  const featuredBottles = PRODUCT_COLLECTIONS.slice(0, 3);

  return (
    <div className="flex flex-col w-full font-manrope">
      
      {/* 1. HERO SECTION */}
      <section 
        className="relative min-h-[640px] sm:min-h-[680px] md:h-[740px] lg:h-[780px] w-full flex flex-col justify-between overflow-hidden bg-[#F8F3E9]"
      >
        {/* Full-bleed uploaded background */}
        <div 
          className="absolute inset-0 bg-cover bg-no-repeat pointer-events-none select-none"
          style={{
            backgroundImage: `url('/hero-luxury-cream-bg.jpg')`,
            backgroundPosition: 'right center',
          }}
        />

        {/* Subtle readability gradient on left */}
        <div 
          className="absolute inset-0 pointer-events-none md:w-[62%] bg-gradient-to-r from-[#FFF9EF]/92 via-[#FFF9EF]/70 to-transparent hidden md:block"
        />
        <div 
          className="absolute inset-0 pointer-events-none md:hidden bg-gradient-to-b from-[#FFF9EF]/95 via-[#FFF9EF]/85 to-[#FFF9EF]/30"
        />

        {/* Content on left */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-20 sm:pt-24 pb-6 sm:pb-8 my-auto z-10">
          <div className="max-w-2xl lg:max-w-3xl space-y-3.5 sm:space-y-4">
            {/* Main Headline */}
            <div>
              <h1 className="text-3xl sm:text-5xl md:text-[54px] lg:text-[60px] font-bold font-playfair tracking-tight leading-[1.12]">
                <span className="text-[#102C47] block md:whitespace-nowrap">
                  Water Bottles Branded In
                </span>
                <span className="font-playfair italic text-[#C99B42] relative inline-block mt-0.5 sm:mt-1">
                  Your Restaurant's Name.
                  {/* Gold flourish */}
                  <svg 
                    className="absolute -bottom-2 sm:-bottom-2.5 left-0 w-full h-3 overflow-visible pointer-events-none" 
                    viewBox="0 0 320 20" 
                    fill="none" 
                    preserveAspectRatio="none"
                  >
                    <path 
                      d="M2 13 C90 22, 210 15, 316 4" 
                      stroke="#C99B42" 
                      strokeWidth="2.2" 
                      strokeLinecap="round" 
                      opacity="0.9"
                    />
                  </svg>
                </span>
              </h1>

              {/* Hindi Tagline */}
              <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2 text-base sm:text-lg lg:text-xl font-semibold">
                <span className="text-[#52652D] font-devanagari font-bold">हरित जल</span>
                <span className="text-[#C99B42]/70 font-light">|</span>
                <span className="text-[#102C47] italic font-playfair">
                  “हर बूंद में शुद्धता, आपकी अपनी पहचान”
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-[14.5px] sm:text-[16px] text-[#2C3E50] max-w-xl leading-relaxed font-normal">
              Stop serving generic, unbranded water bottles. When your establishment serves Harit Jal, every guest holds a bespoke bottle crafted exclusively for your dining tables — 100% compliant with FSSAI, BIS IS:14543, and eco-recycling norms.
            </p>

            {/* CTA Buttons */}
            <div className="pt-2 sm:pt-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Primary CTA */}
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  navigate('/gallery');
                }}
                className="btn-gold-luxury px-6 sm:px-7 py-3 rounded-full text-[14.5px] sm:text-[15.5px] font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
              >
                <span>Explore Bottle Designs</span>
                <ArrowRight className="w-4 h-4 text-[#102C47]" />
              </button>

              {/* Secondary CTA */}
              <button
                onClick={() => {
                  soundPlayer.playSuccessChime();
                  onOpenBookingModal();
                }}
                className="btn-navy-outline px-5 sm:px-6 py-3 rounded-full text-[14.5px] sm:text-[15.5px] font-bold flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4 text-[#102C47]" />
                <span>Book a Free Consultation</span>
              </button>
            </div>

          </div>
        </div>

        {/* Compact Bottom Trust Strip along navy/gold wave */}
        <div className="w-full bg-[#102C47]/95 border-t border-[#C99B42]/30 backdrop-blur-md relative z-10 shadow-sm text-[#FFF9EF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-0 md:divide-x divide-[#C99B42]/20">
              
              <div className="flex items-center gap-2.5 px-3 py-1">
                <ShieldCheck className="w-4 h-4 text-[#C99B42] shrink-0" />
                <div className="leading-tight">
                  <div className="font-bold text-xs sm:text-[13px] text-[#FFF9EF]">FSSAI Compliant</div>
                  <div className="text-[10px] text-[#C99B42]">Food-safe assured</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 px-3 py-1 pt-1.5 md:pt-1">
                <CheckCircle2 className="w-4 h-4 text-[#C99B42] shrink-0" />
                <div className="leading-tight">
                  <div className="font-bold text-xs sm:text-[13px] text-[#FFF9EF]">BIS IS:14543</div>
                  <div className="text-[10px] text-[#C99B42]">Quality standard</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 px-3 py-1 pt-1.5 md:pt-1">
                <Award className="w-4 h-4 text-[#C99B42] shrink-0" />
                <div className="leading-tight">
                  <div className="font-bold text-xs sm:text-[13px] text-[#FFF9EF]">100% Recyclable</div>
                  <div className="text-[10px] text-[#C99B42]">CPCB EPR circularity</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 px-3 py-1 pt-1.5 md:pt-1">
                <Truck className="w-4 h-4 text-[#C99B42] shrink-0" />
                <div className="leading-tight">
                  <div className="font-bold text-xs sm:text-[13px] text-[#FFF9EF]">Pan-India Supply</div>
                  <div className="text-[10px] text-[#C99B42]">Direct cellar delivery</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* 2. BRAND BENEFITS SECTION: WHY HARIT JAL (Updated to Match Reference Design) */}
      <section className="relative pt-12 md:pt-16 pb-12 md:pb-14 bg-gradient-to-b from-[#FDFBF7] via-[#FFF9EF] to-[#F8F3E9] text-[#102C47] overflow-hidden">
        {/* Subtle decorative golden guilloche wave background */}
        <div className="absolute inset-0 pointer-events-none opacity-30 -z-0 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 1440 600" fill="none" preserveAspectRatio="none">
            <path d="M-100,500 C200,300 400,600 720,400 C1040,200 1200,500 1540,350" stroke="#C99B42" strokeWidth="0.8" opacity="0.25" />
            <path d="M-100,480 C200,280 400,580 720,380 C1040,180 1200,480 1540,330" stroke="#C99B42" strokeWidth="0.8" opacity="0.2" />
            <path d="M-100,460 C200,260 400,560 720,360 C1040,160 1200,460 1540,310" stroke="#C99B42" strokeWidth="0.8" opacity="0.15" />
          </svg>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
            {/* Top Pill with 2 Golden Leaves */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-[#C99B42]/40 shadow-xs mb-3 text-[11px] font-bold tracking-widest text-[#102C47] uppercase font-manrope">
              {/* Left golden leaf */}
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#C99B42] fill-[#C99B42]" stroke="none">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/>
              </svg>
              <span>WHY HARIT JAL</span>
              {/* Right golden leaf */}
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#C99B42] fill-[#C99B42] transform scale-x-[-1]" stroke="none">
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/>
              </svg>
            </div>

            {/* Main Heading with Golden Italic Flourish */}
            <h2 className="text-3xl sm:text-4xl md:text-[44px] lg:text-[46px] font-bold font-playfair text-[#102C47] tracking-tight leading-tight">
              The Bespoke Dining{' '}
              <span className="relative inline-block font-playfair italic font-medium text-[#C99B42]">
                Difference
                {/* Elegant Flourish Underline Swoosh */}
                <svg
                  className="absolute -bottom-2 sm:-bottom-2.5 left-0 w-[115%] h-3 sm:h-4 overflow-visible pointer-events-none"
                  viewBox="0 0 220 18"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M 2,12 C 50,18 130,16 215,3"
                    stroke="#C99B42"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 40,15 C 100,18 160,15 210,7"
                    stroke="#C99B42"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                </svg>
              </span>
            </h2>

            {/* Subtitle */}
            <p className="mt-3.5 text-xs sm:text-sm md:text-[14.5px] text-[#555A60] leading-relaxed max-w-2xl mx-auto">
              A complete branded hydration solution that elevates your dining experience, strengthens your identity, and leaves a lasting impression.
            </p>
          </div>

          {/* 4 Luxury Benefit Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-6 pt-4">
            
            {/* Benefit 1: Personalized Branding */}
            <div className="relative pt-12 pb-7 px-5 rounded-[26px] bg-[#FFFDF9] border border-[#E2BF7D] shadow-[0_8px_25px_rgba(201,155,66,0.08)] hover:shadow-[0_16px_36px_rgba(201,155,66,0.16)] hover:-translate-y-1 transition-all duration-300 text-center flex flex-col items-center group">
              {/* Dark Navy Arch Accent behind the circular badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#102C47] rounded-t-full pointer-events-none" />

              {/* Circular Floating Icon Badge */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#FFFDF9] border-2 border-[#E2BF7D] shadow-[0_4px_14px_rgba(16,44,71,0.12)] flex items-center justify-center z-10 group-hover:scale-105 group-hover:border-[#C99B42] transition-transform duration-300">
                <svg viewBox="0 0 40 40" className="w-6.5 h-6.5" fill="none">
                  <path 
                    d="M 12 28 C 12 28, 14 23, 20 17 L 27 10 C 28.5 8.5, 31 8.5, 32.5 10 C 34 11.5, 34 14, 32.5 15.5 L 25.5 22.5 C 19.5 28.5, 15 30.5, 15 30.5 L 12 28 Z" 
                    stroke="#C99B42" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                  <circle cx="23" cy="19" r="1.5" fill="#C99B42" />
                  <line x1="22" y1="20" x2="12.5" y2="29.5" stroke="#C99B42" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="28" y1="14" x2="31" y2="17" stroke="#C99B42" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>

              <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47] mb-2">
                Personalized Branding
              </h3>
              <p className="text-xs text-[#555A60] leading-relaxed">
                Your restaurant emblem, bespoke typography, matching colors, and optional QR menus on every bottle.
              </p>
            </div>

            {/* Benefit 2: Premium Bottle Quality */}
            <div className="relative pt-12 pb-7 px-5 rounded-[26px] bg-[#FFFDF9] border border-[#E2BF7D] shadow-[0_8px_25px_rgba(201,155,66,0.08)] hover:shadow-[0_16px_36px_rgba(201,155,66,0.16)] hover:-translate-y-1 transition-all duration-300 text-center flex flex-col items-center group">
              {/* Dark Navy Arch Accent behind the circular badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#102C47] rounded-t-full pointer-events-none" />

              {/* Circular Floating Icon Badge */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#FFFDF9] border-2 border-[#E2BF7D] shadow-[0_4px_14px_rgba(16,44,71,0.12)] flex items-center justify-center z-10 group-hover:scale-105 group-hover:border-[#C99B42] transition-transform duration-300">
                <svg viewBox="0 0 40 40" className="w-6.5 h-6.5" fill="none">
                  <path 
                    d="M 20 6 L 31 10 C 31 22, 26 29, 20 34 C 14 29, 9 22, 9 10 L 20 6 Z" 
                    stroke="#C99B42" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                  <path 
                    d="M 20 14 C 20 14, 15 20, 15 23 C 15 25.8, 17.2 28, 20 28 C 22.8 28, 25 25.8, 25 23 C 25 20, 20 14, 20 14 Z" 
                    stroke="#C99B42" 
                    strokeWidth="1.8" 
                    fill="none" 
                  />
                </svg>
              </div>

              <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47] mb-2">
                Premium Bottle Quality
              </h3>
              <p className="text-xs text-[#555A60] leading-relaxed">
                Ultra-clear flint glass decanters and food-grade recyclable rPET cylinders with leakproof, tamper-evident metallic caps.
              </p>
            </div>

            {/* Benefit 3: Reliable Supply */}
            <div className="relative pt-12 pb-7 px-5 rounded-[26px] bg-[#FFFDF9] border border-[#E2BF7D] shadow-[0_8px_25px_rgba(201,155,66,0.08)] hover:shadow-[0_16px_36px_rgba(201,155,66,0.16)] hover:-translate-y-1 transition-all duration-300 text-center flex flex-col items-center group">
              {/* Dark Navy Arch Accent behind the circular badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#102C47] rounded-t-full pointer-events-none" />

              {/* Circular Floating Icon Badge */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#FFFDF9] border-2 border-[#E2BF7D] shadow-[0_4px_14px_rgba(16,44,71,0.12)] flex items-center justify-center z-10 group-hover:scale-105 group-hover:border-[#C99B42] transition-transform duration-300">
                <svg viewBox="0 0 40 40" className="w-6.5 h-6.5" fill="none">
                  <line x1="6" y1="15" x2="10" y2="15" stroke="#C99B42" strokeWidth="2" strokeLinecap="round" />
                  <line x1="4" y1="19" x2="9" y2="19" stroke="#C99B42" strokeWidth="2" strokeLinecap="round" />
                  <line x1="6" y1="23" x2="10" y2="23" stroke="#C99B42" strokeWidth="2" strokeLinecap="round" />
                  <rect x="12" y="11" width="14" height="15" rx="1.5" stroke="#C99B42" strokeWidth="2" />
                  <path d="M 26 16 H 31 L 34 20 V 26 H 26" stroke="#C99B42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="17" cy="27" r="2.5" stroke="#C99B42" strokeWidth="2" fill="#FFFDF9" />
                  <circle cx="29" cy="27" r="2.5" stroke="#C99B42" strokeWidth="2" fill="#FFFDF9" />
                </svg>
              </div>

              <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47] mb-2">
                Reliable Supply
              </h3>
              <p className="text-xs text-[#555A60] leading-relaxed">
                Automated weekly replenishments delivered directly to your cellar or bar, ensuring you never run out.
              </p>
            </div>

            {/* Benefit 4: Restaurant Exclusivity */}
            <div className="relative pt-12 pb-7 px-5 rounded-[26px] bg-[#FFFDF9] border border-[#E2BF7D] shadow-[0_8px_25px_rgba(201,155,66,0.08)] hover:shadow-[0_16px_36px_rgba(201,155,66,0.16)] hover:-translate-y-1 transition-all duration-300 text-center flex flex-col items-center group">
              {/* Dark Navy Arch Accent behind the circular badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#102C47] rounded-t-full pointer-events-none" />

              {/* Circular Floating Icon Badge */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-[#FFFDF9] border-2 border-[#E2BF7D] shadow-[0_4px_14px_rgba(16,44,71,0.12)] flex items-center justify-center z-10 group-hover:scale-105 group-hover:border-[#C99B42] transition-transform duration-300">
                <svg viewBox="0 0 40 40" className="w-6.5 h-6.5" fill="none">
                  <circle cx="20" cy="11.5" r="1.5" stroke="#C99B42" strokeWidth="2" />
                  <path d="M 10 25 C 10 17.5, 14.5 13, 20 13 C 25.5 13, 30 17.5, 30 25 Z" stroke="#C99B42" strokeWidth="2" strokeLinecap="round" />
                  <line x1="7" y1="26" x2="33" y2="26" stroke="#C99B42" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>

              <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47] mb-2">
                Restaurant Exclusivity
              </h3>
              <p className="text-xs text-[#555A60] leading-relaxed">
                Your custom bottles are supplied exclusively to your establishment. We never cross-sell or share your brand identity.
              </p>
            </div>

          </div>

          {/* Photorealistic Luxury Water Droplet & Ripple Centerpiece */}
          <div className="relative flex flex-col items-center justify-center -mt-2 sm:-mt-4 mb-2 select-none pointer-events-none">
            <div className="relative w-full max-w-xl sm:max-w-2xl h-44 sm:h-52 md:h-60 overflow-hidden flex items-center justify-center">
              <img
                src="/images/decorations/luxury-water-droplet-ripple.png"
                alt="Pristine Water Droplet and Concentric Liquid Ripples"
                className="w-full h-full object-contain filter drop-shadow-[0_4px_24px_rgba(201,155,66,0.18)] mix-blend-multiply select-none"
              />
            </div>
          </div>

        </div>

        {/* Bottom Wave Graphic - Royal Navy with Champagne Gold Edge */}
        <div className="w-full overflow-hidden leading-none select-none pointer-events-none -mb-1 mt-4">
          <svg
            className="relative block w-full h-8 sm:h-12 text-[#102C47]"
            viewBox="0 0 1440 60"
            preserveAspectRatio="none"
          >
            {/* Gold Wave Ribbon Trim */}
            <path
              d="M0,28 C360,2 720,44 1080,14 C1260,2 1380,32 1440,26"
              stroke="#C99B42"
              strokeWidth="2.5"
              fill="none"
            />
            {/* Deep Navy Wave */}
            <path
              d="M0,60 C360,10 720,50 1080,20 C1260,5 1380,35 1440,30 L1440,60 L0,60 Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </section>

      {/* 3. FEATURED BOTTLE COLLECTIONS (Only 3 designs on Home) */}
      <section className="py-12 md:py-16 bg-[#FFF9EF] text-[#102C47] border-t border-[#C99B42]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-8 md:mb-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#52652D] block mb-1.5">
                CURATED PORTFOLIO
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-playfair text-[#102C47]">
                Featured Bottle Collections
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#77766F] max-w-xl">
                Explore a preview of our bespoke glass and PET bottles crafted for luxury dining, highway resorts, and specialty cafes.
              </p>
            </div>

            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                navigate('/gallery');
              }}
              className="btn-gold-luxury self-start md:self-auto px-5 py-2 rounded-full text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>Explore Bottle Gallery</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#102C47]" />
            </button>
          </div>

          {/* 3-Column Image-Led Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {featuredBottles.map((bottle) => (
              <div
                key={bottle.id}
                className="group rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/25 overflow-hidden shadow-xs hover:border-[#C99B42] hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Photo Container */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    <img
                      src={bottle.image}
                      alt={bottle.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#102C47]/90 text-[#FFF9EF] text-[10px] font-bold backdrop-blur-xs">
                      {bottle.sizeLabel}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 sm:p-4.5 space-y-1.5">
                    <div className="text-[10.5px] font-semibold text-[#52652D] uppercase tracking-wider">
                      {bottle.subtitle}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47] group-hover:text-[#C99B42] transition-colors">
                      {bottle.title}
                    </h3>
                    <p className="text-xs text-[#77766F] leading-relaxed line-clamp-2">
                      {bottle.description}
                    </p>
                  </div>
                </div>

                {/* Card Footer Button */}
                <div className="p-4 sm:p-4.5 pt-0">
                  <button
                    onClick={() => {
                      soundPlayer.playWaterDrop();
                      navigate('/gallery');
                    }}
                    className="w-full py-2.5 rounded-full bg-[#102C47] text-[#FFF9EF] text-xs font-bold hover:bg-[#183C60] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Images className="w-3.5 h-3.5 text-[#C99B42]" />
                    <span>View More Images</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 4. HOW IT WORKS (Concise 4 Steps on Home) */}
      <section className="py-12 md:py-16 bg-[#F8F3E9] text-[#102C47] border-t border-[#C99B42]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-8 md:mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[#52652D] block mb-1.5">
              SEAMLESS ONBOARDING
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-playfair text-[#102C47]">
              How Harit Jal Works
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#77766F]">
              From your initial consultation to weekly scheduled deliveries at your dining tables.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            
            {/* Step 1 */}
            <div className="p-4.5 sm:p-5 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/20 shadow-xs relative">
              <span className="text-2xl sm:text-3xl font-extrabold font-playfair text-[#C99B42]/40 block mb-2">01</span>
              <h3 className="text-sm sm:text-base font-bold font-playfair text-[#102C47] mb-1">Enquiry</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Connect with our team to discuss your restaurant style, dining table turnover, and ideal bottle volume.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4.5 sm:p-5 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/20 shadow-xs relative">
              <span className="text-2xl sm:text-3xl font-extrabold font-playfair text-[#C99B42]/40 block mb-2">02</span>
              <h3 className="text-sm sm:text-base font-bold font-playfair text-[#102C47] mb-1">Design Selection</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Select bottle material (glass or rPET), cap color, and review digital bespoke label proofs with your logo.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4.5 sm:p-5 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/20 shadow-xs relative">
              <span className="text-2xl sm:text-3xl font-extrabold font-playfair text-[#C99B42]/40 block mb-2">03</span>
              <h3 className="text-sm sm:text-base font-bold font-playfair text-[#102C47] mb-1">Approval</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Receive and inspect physical sample bottles at your restaurant before placing bulk production orders.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-4.5 sm:p-5 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/20 shadow-xs relative">
              <span className="text-2xl sm:text-3xl font-extrabold font-playfair text-[#C99B42]/40 block mb-2">04</span>
              <h3 className="text-sm sm:text-base font-bold font-playfair text-[#102C47] mb-1">Delivery</h3>
              <p className="text-xs text-[#77766F] leading-relaxed">
                Automated recurring deliveries direct to your cellar, with empty bottle collection for certified recycling.
              </p>
            </div>

          </div>

          <div className="mt-6 sm:mt-8 text-center">
            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                navigate('/how-it-works');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#102C47] hover:text-[#C99B42] transition cursor-pointer"
            >
              <span>Explore Complete 6-Stage Supply Journey Roadmap</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C99B42]" />
            </button>
          </div>

        </div>
      </section>

      {/* 5. FINAL CTA BANNER */}
      <section className="py-12 md:py-14 bg-[#102C47] text-[#FFF9EF] relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C99B42]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#52652D]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9EF]/10 border border-[#C99B42]/40 text-[#C99B42] text-[11px] sm:text-xs font-bold tracking-wider">
            <span>BESPOKE HOSPITALITY DINING</span>
          </div>

          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold font-playfair text-[#FFF9EF] leading-tight">
            Give Every Table Your <br className="hidden sm:inline" />
            <span className="italic text-[#C99B42]">Brand Identity.</span>
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-[#FFF9EF]/80 max-w-xl mx-auto leading-relaxed">
            Join forward-thinking restaurants, dhabas, and hotels serving bespoke water bottles. Request physical samples with your logo today.
          </p>

          <div className="pt-2 sm:pt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                soundPlayer.playSuccessChime();
                onOpenBookingModal();
              }}
              className="btn-gold-luxury px-6 sm:px-7 py-3 rounded-full font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <PhoneCall className="w-4 h-4 text-[#102C47]" />
              <span>Book a Consultation Call</span>
            </button>

            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                navigate('/contact');
              }}
              className="px-5 sm:px-6 py-3 rounded-full border border-[#FFF9EF]/40 text-[#FFF9EF] hover:bg-[#FFF9EF]/10 font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              <span>Submit Online Enquiry</span>
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};

