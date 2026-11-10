import React from 'react';
import { Waves, Droplets } from 'lucide-react';
import { soundPlayer } from '../services/sound';

export const NatureWaterShowcase: React.FC = () => {
  const toggleSound = () => {
    soundPlayer.playWaterDrop();
  };

  return (
    <section className="relative py-14 md:py-18 bg-[#F8F3E9] text-[#102B46] overflow-hidden border-t border-[#C99B43]/20">
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B43]/40 text-[#455C22] text-xs font-bold mb-3 shadow-sm">
            <Droplets className="w-3.5 h-3.5 text-[#455C22]" />
            <span className="font-manrope">NATURAL AQUIFER PURITY</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-playfair text-[#102B46] tracking-tight">
            Pristine Deep-Aquifer Hydration, <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B43]">
              Bottled For Exceptional Dining.
            </span>
          </h2>
          <p className="mt-3 text-[#77766F] text-sm sm:text-base leading-relaxed font-manrope">
            Great cuisine deserves water that complements subtle spices and flavors. Our water is carefully purified to achieve balanced minerality (pH 7.0–7.4), creating a crisp, natural mouthfeel that refreshes the palate.
          </p>
        </div>

        {/* Video / Visual Nature Showcase Container */}
        <div className="relative rounded-3xl overflow-hidden bg-[#FFF9EF] border border-[#C99B43]/35 p-2 sm:p-4 shadow-lg mb-8">
          
          <div className="relative w-full h-[320px] sm:h-[400px] md:h-[440px] rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
            
            {/* Cinematic High Definition Video Stream Loop */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-85 scale-105 filter saturate-125"
              poster="https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=1600&q=80"
            >
              <source
                src="https://assets.mixkit.co/videos/preview/mixkit-transparent-water-of-a-stream-in-the-forest-42861-large.mp4"
                type="video/mp4"
              />
            </video>

            {/* Subtle Gradient Overlays in Deep Navy */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#102B46]/90 via-transparent to-[#102B46]/40" />

            {/* Overlay Watermark inside Video container */}
            <div className="absolute top-4 left-6 flex items-center gap-2 pointer-events-none">
              <span className="w-2.5 h-2.5 rounded-full bg-[#455C22] animate-ping" />
              <span className="text-xs font-mono font-bold text-[#FFF9EF] tracking-wider uppercase drop-shadow">
                HARIT JAL SOURCE SIMULATION • 100% PURE
              </span>
            </div>

            {/* Center Content Overlay */}
            <div className="relative z-10 text-center max-w-xl mx-auto px-4">
              <div className="w-12 h-12 rounded-full bg-[#FFF9EF]/90 backdrop-blur-md border border-[#C99B43]/60 flex items-center justify-center mx-auto mb-3 text-[#102B46] shadow-md">
                <Waves className="w-6 h-6 text-[#102B46] animate-pulse" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold font-playfair text-[#FFF9EF] drop-shadow-md">
                Every Drop Tells A Story Of Nature.
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-[#FFF9EF]/90 drop-shadow font-manrope">
                Natural alluvial filtration touchlessly bottled in cleanroom standards for your guests.
              </p>
            </div>

            {/* Bottom Live Water Metrics Bar */}
            <div className="absolute bottom-4 inset-x-4 sm:inset-x-8 p-3 sm:p-3.5 rounded-xl bg-[#FFF9EF]/95 backdrop-blur-md border border-[#C99B43]/40 flex flex-wrap items-center justify-between gap-3 text-xs font-manrope shadow-md text-[#102B46]">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[10px] text-[#77766F] block font-mono">PURITY PROTOCOL</span>
                  <span className="font-bold text-[#455C22] text-sm">Multi-Stage Filtered</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#77766F] block font-mono">NATURAL TDS</span>
                  <span className="font-bold text-[#C99B43] text-sm">120 - 150 PPM</span>
                </div>
                <div className="hidden sm:block">
                  <span className="text-[10px] text-[#77766F] block font-mono">PH BALANCE</span>
                  <span className="font-bold text-[#102B46] text-sm">7.0 - 7.4 Balanced</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSound}
                  className="px-3 py-1.5 rounded-full bg-[#102B46] text-[#FFF9EF] text-xs font-semibold hover:bg-[#183C60] transition cursor-pointer"
                >
                  💧 Sound Effect
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

    </section>
  );
};
