import React, { useState } from 'react';
import { ArrowRight, Droplets } from 'lucide-react';
import { soundPlayer } from '../services/sound';

interface GalleryProps {
  onSelectDesignForBooking: (restaurantName: string, size: string) => void;
}

const GALLERY_ITEMS = [
  {
    id: 'karan-dhaba',
    title: 'Karan The Dhaba Special Edition',
    subtitle: 'Murthal Highway Dining, Haryana',
    category: 'dhaba',
    bottleType: '500ml Dine-In Cylinder',
    material: 'BPA-Free Food Grade PET',
    capColor: 'Champagne Gold',
    finish: 'Heritage Amber Foil with Paratha Motif',
    description: 'Custom bottled exclusively for Karan The Dhaba. High-turnover highway dining tables with tamper-proof seal and authentic hospitality branding.',
    accentColor: '#C99B43',
    tablePlacement: 'Engineered for high-turnover casual & highway tables',
    isSample: true,
  },
  {
    id: 'royal-darbar',
    title: 'The Royal Darbar & Banquets',
    subtitle: 'Palace Road, Jaipur',
    category: 'luxury',
    bottleType: '750ml Heavy Glass Decanter',
    material: 'Ultra-Clear Flint Glass',
    capColor: 'Royal Gold Metal Cap',
    finish: 'Golden Embossed Crest & Luxury Seal',
    description: 'Tailored for opulent wedding feasts and VIP banquets. Adds five-star grandeur to banquet tables in heavy crystal flint glass.',
    accentColor: '#C99B43',
    tablePlacement: 'Custom wedding setups & VIP corporate banquets',
    isSample: true,
  },
  {
    id: 'cafe-terra',
    title: 'Cafe Terra Artisanal Kitchen',
    subtitle: 'Bandra West, Mumbai',
    category: 'cafe',
    bottleType: '250ml Pocket Grab-and-Go',
    material: 'Recycled Food-Grade rPET',
    capColor: 'Deep Navy Cap',
    finish: 'Minimalist Scandinavian Layout with Dynamic QR',
    description: 'Compact 250ml bottles with a scannable QR code on the back label that links guests directly to your digital seasonal menu.',
    accentColor: '#102B46',
    tablePlacement: 'Espresso counters, patio brunch & takeaway bags',
    isSample: true,
  },
  {
    id: 'amber-room',
    title: 'The Amber Room Fine Dining',
    subtitle: 'Indiranagar, Bengaluru',
    category: 'luxury',
    bottleType: '500ml Frosted Silhouette',
    material: 'Frosted Satin Finish',
    capColor: 'Olive Green Cap',
    finish: 'Champagne Gold Foil & Typography',
    description: 'Pristine mineral balance (pH 7.2) tailored to complement continental and progressive Indian culinary wine and food pairings.',
    accentColor: '#455C22',
    tablePlacement: 'Sommelier tasting tables & chef counter dinners',
    isSample: true,
  },
  {
    id: 'haveli-heritage',
    title: 'Pind Haveli Resort & Dhaba',
    subtitle: 'Jalandhar Bypass, Punjab',
    category: 'dhaba',
    bottleType: '1000ml Family Banquet Bottle',
    material: 'Virgin Food-Grade PET',
    capColor: 'Olive Green Cap',
    finish: 'Devanagari & Gurmukhi Dual Script',
    description: 'Large-format 1-litre bottles for family dining and outdoor verandah seating. Sturdy, tamper-proof, and responsibly recycled.',
    accentColor: '#455C22',
    tablePlacement: 'Family feast tables & highway weekend diners',
    isSample: true,
  },
  {
    id: 'grand-sapphire',
    title: 'Grand Sapphire Ballroom',
    subtitle: 'Aerocity, New Delhi',
    category: 'luxury',
    bottleType: '750ml Returnable Glass',
    material: '100% Recyclable Flint Glass',
    capColor: 'Polished Silver Cap',
    finish: 'Frosted Watermark Monogram',
    description: 'Zero-waste hospitality initiative for corporate conferences, summit delegations, and gala receptions.',
    accentColor: '#102B46',
    tablePlacement: 'Conference boardroom tables & executive lounges',
    isSample: true,
  },
];

export const Gallery: React.FC<GalleryProps> = ({ onSelectDesignForBooking }) => {
  const [filter, setFilter] = useState<'all' | 'dhaba' | 'luxury' | 'cafe'>('all');

  const filteredItems = filter === 'all' ? GALLERY_ITEMS : GALLERY_ITEMS.filter((item) => item.category === filter);

  return (
    <section id="gallery-section" className="relative py-14 md:py-18 bg-[#F8F3E9] text-[#102B46] overflow-hidden border-t border-[#C99B43]/20">
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B43]/40 text-[#455C22] text-xs font-bold mb-3 shadow-sm">
            <Droplets className="w-3.5 h-3.5 text-[#455C22]" />
            <span className="font-manrope">BESPOKE CONCEPT PORTFOLIO</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-playfair text-[#102B46] tracking-tight">
            Bottle Designs Crafted For <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B43]">
              India's Dhabas, Cafes & Fine Dining.
            </span>
          </h2>
          <p className="mt-3 text-[#77766F] text-sm sm:text-base leading-relaxed font-manrope">
            Every bottle sample below illustrates how bespoke branding elevates guest dining tables. Custom bottles are supplied exclusively to each partner establishment without cross-distribution.
          </p>

          {/* Filter Pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'all', label: 'All Collections (6)' },
              { id: 'dhaba', label: '🍛 Dhabas & Highway Dining' },
              { id: 'luxury', label: '👑 Luxury Glass & Banquets' },
              { id: 'cafe', label: '☕ Cafes & Artisanal' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setFilter(f.id as typeof filter);
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  filter === f.id
                    ? 'btn-gold-luxury shadow-md'
                    : 'bg-[#FFF9EF] text-[#102B46] hover:bg-[#F8F3E9] border border-[#C99B43]/30'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/30 p-5 sm:p-6 flex flex-col justify-between hover:border-[#C99B43] hover:shadow-xl transition-all group duration-300 transform hover:-translate-y-1"
            >
              <div>
                {/* Visual Bottle Graphic Card */}
                <div className="relative w-full h-52 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20 flex items-center justify-center p-4 overflow-hidden mb-4 group-hover:border-[#C99B43]/50 transition">
                  
                  {/* Subtle radial warmth */}
                  <div className="absolute inset-0 bg-radial from-[#C99B43]/10 via-transparent to-transparent opacity-50" />

                  {/* Stylized Bottle Illustration */}
                  <div className="relative flex flex-col items-center">
                    <div 
                      className="w-7 h-3.5 rounded-t-md shadow-sm border border-[#102B46]/20"
                      style={{ backgroundColor: item.accentColor }}
                    />
                    <div className="w-5 h-6 bg-white/60 backdrop-blur-sm border-x border-[#102B46]/10" />
                    <div className="w-18 h-7 bg-white/70 backdrop-blur-sm rounded-t-xl border-t border-x border-[#102B46]/15" />
                    <div className="relative w-18 h-24 bg-white/80 backdrop-blur-sm border border-[#102B46]/20 rounded-b-xl flex flex-col items-center justify-center p-1 shadow-inner overflow-hidden">
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-[#455C22]/10 backdrop-blur-sm" />
                      
                      <div 
                        className="relative z-10 w-full py-1 px-1 rounded text-center shadow-sm border border-[#C99B43]/40"
                        style={{ backgroundColor: '#102B46' }}
                      >
                        <div className="text-[6.5px] font-extrabold text-[#C99B43] uppercase tracking-tighter truncate">
                          HARIT JAL
                        </div>
                        <div className="text-[8px] font-bold text-[#FFF9EF] leading-tight uppercase truncate">
                          {item.title.split(' ')[0]} {item.title.split(' ')[1] || ''}
                        </div>
                        <div className="text-[6px] text-[#E0BA6E] font-medium truncate">
                          BIS & FSSAI STANDARD
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 border border-[#C99B43]/30 text-[10px] font-bold text-[#102B46]">
                    {item.bottleType}
                  </div>
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#455C22] text-[#FFF9EF] text-[9.5px] font-bold tracking-wider uppercase">
                    DEMO CONCEPT
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-bold font-playfair text-lg text-[#102B46] group-hover:text-[#C99B43] transition-colors">
                      {item.title}
                    </h3>
                  </div>

                  <div className="text-xs text-[#455C22] font-semibold">
                    📍 {item.subtitle}
                  </div>

                  <p className="text-xs text-[#77766F] leading-relaxed pt-1">
                    {item.description}
                  </p>

                  <div className="pt-2 text-[11px] text-[#102B46]/80 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C99B43]" />
                    <span>{item.tablePlacement}</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-4 border-t border-[#C99B43]/20 flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#77766F] uppercase">
                  {item.material}
                </span>

                <button
                  onClick={() => {
                    soundPlayer.playBubblePop();
                    onSelectDesignForBooking(item.title, item.bottleType);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-[#102B46] text-[#FFF9EF] text-xs font-bold hover:bg-[#183C60] transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Request Similar Concept</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

    </section>
  );
};
