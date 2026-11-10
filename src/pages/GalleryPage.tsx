import React, { useState, useEffect } from 'react';
import { 
  Search, Droplets, Maximize2, X, 
  ShieldCheck, Info, Recycle
} from 'lucide-react';
import { soundPlayer } from '../services/sound';
import { GalleryService, GalleryItem } from '../services/galleryService';

interface GalleryPageProps {
  onOpenBookingModalWithProduct: (productDetails: {
    restaurantName?: string;
    bottleSize?: '250ml' | '500ml' | '750ml_glass' | '1000ml';
    capColor?: string;
    labelTheme?: string;
  }) => void;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({ onOpenBookingModalWithProduct }) => {
  const [items, setItems] = useState<GalleryItem[]>(() => GalleryService.getPublicItems());
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<GalleryItem | null>(null);

  useEffect(() => {
    const update = () => {
      setItems(GalleryService.getPublicItems());
    };
    const unsubscribe = GalleryService.subscribe(update);
    return () => {
      unsubscribe();
    };
  }, []);

  const categories = [
    { id: 'all', label: 'All Collections' },
    { id: 'glass', label: 'Flint Glass' },
    { id: '500ml', label: '500ml Dine-In' },
    { id: '750ml_glass', label: '750ml Decanter' },
    { id: '250ml', label: '250ml Pocket' },
    { id: '1000ml', label: '1000ml Family' },
    { id: 'finedining', label: 'Fine Dining' },
    { id: 'banquet', label: 'Luxury Banquets' },
    { id: 'dhaba', label: 'Dhabas & Highway' },
    { id: 'cafe', label: 'Artisanal Cafes' },
  ];

  const filteredItems = items.filter((item) => {
    // Category match
    let matchesCategory = true;
    if (activeCategory !== 'all') {
      if (['250ml', '500ml', '750ml_glass', '1000ml'].includes(activeCategory)) {
        matchesCategory = item.size === activeCategory;
      } else {
        matchesCategory = item.category === activeCategory || (item.categories && item.categories.includes(activeCategory));
      }
    }

    // Search query match
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      matchesSearch = (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.sizeLabel.toLowerCase().includes(q) ||
        Boolean(item.badge && item.badge.toLowerCase().includes(q))
      );
    }

    return matchesCategory && matchesSearch;
  });

  const handleOrderSample = (item: GalleryItem) => {
    soundPlayer.playWaterDrop();
    onOpenBookingModalWithProduct({
      restaurantName: item.title,
      bottleSize: item.size,
      capColor: item.capColor,
      labelTheme: item.category,
    });
  };

  return (
    <div className="pt-20 sm:pt-24 pb-14 bg-[#F8F3E9] text-[#102C47] font-manrope min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B42]/40 text-[#52652D] text-xs font-bold shadow-xs">
            <Droplets className="w-3.5 h-3.5 text-[#52652D]" />
            <span>BESPOKE BOTTLE GALLERY &amp; CATALOGUE</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-bold font-playfair text-[#102C47] tracking-tight leading-tight">
            Exclusive Glass Bottle Silhouettes <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B42]">
              Crafted for India's Luxury Hospitality
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed max-w-2xl mx-auto">
            Discover our master collection of crystal-clear flint glass bottles, fluted carafes, and luxury decanters. Every silhouette is bottled with pure natural hydration, tailored exclusively for your establishment with tamper-proof metallic caps and custom crest artwork.
          </p>

          {/* Search Bar & Stats */}
          <div className="pt-2 max-w-md mx-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-[#77766F] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search by bottle name, decanter, size (500ml, 750ml)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] placeholder-[#77766F] focus:outline-none focus:ring-2 focus:ring-[#C99B42] shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveCategory(cat.id);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'btn-gold-luxury shadow-xs'
                    : 'bg-[#FFF9EF] text-[#102C47] hover:bg-white border border-[#C99B42]/30'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 overflow-hidden shadow-sm hover:border-[#C99B42] hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Full-Bleed Product Photograph Stage (Matching Home/Collections Visual Standard) */}
                <div 
                  className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 cursor-pointer"
                  onClick={() => {
                    soundPlayer.playBubblePop();
                    setSelectedPhotoModal(item);
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src.endsWith('.jpg')) {
                        target.src = target.src.replace(/\.jpg$/, '.png');
                      } else if (target.src.endsWith('.png')) {
                        target.src = target.src.replace(/\.png$/, '.jpg');
                      }
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Top-Left Size / Format Badge */}
                  <div className="absolute top-2.5 left-2.5 z-20 px-2.5 py-0.5 rounded-full bg-[#102C47]/90 text-[#FFF9EF] text-[10px] font-bold backdrop-blur-xs shadow-sm flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-[#C99B42]" />
                    <span>{item.sizeLabel}</span>
                  </div>

                  {/* Top-Right Category / Edition Badge */}
                  {item.badge && (
                    <div className="absolute top-2.5 right-2.5 z-20 px-2.5 py-0.5 rounded-full bg-[#52652D] text-[#FFF9EF] text-[9.5px] font-bold tracking-wider uppercase shadow-sm">
                      {item.badge}
                    </div>
                  )}

                  {/* Fullscreen Magnifier Overlay Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundPlayer.playBubblePop();
                      setSelectedPhotoModal(item);
                    }}
                    title="Inspect High-Res Photo"
                    className="absolute bottom-2.5 right-2.5 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-[#102C47] hover:text-[#C99B42] flex items-center justify-center shadow-md transition transform opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between text-[10.5px] text-[#52652D] font-bold uppercase tracking-wider">
                    <span>{item.subtitle}</span>
                    <span className="text-[#C99B42] font-mono">{item.material}</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47] group-hover:text-[#C99B42] transition-colors leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs text-[#77766F] leading-relaxed line-clamp-2">
                    {item.description}
                  </p>

                  {/* Pricing Breakdown & Delivery T&C */}
                  {(item.wholesaleRate || item.recommendedMRP) && (
                    <div className="pt-2 border-t border-[#C99B42]/20 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-[#77766F] block">Est. Wholesale Cost</span>
                          <span className="font-bold text-sm text-[#102C47]">
                            ₹{item.wholesaleRate || '14.0'}/unit
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#77766F] block">Recommended Menu MRP</span>
                          <span className="font-bold text-sm text-[#52652D]">
                            ₹{item.recommendedMRP || '40.0'}
                          </span>
                        </div>
                      </div>

                      {/* T&C Logistics & Freight Note */}
                      <div className="p-2 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/20 text-[10px] text-[#77766F] space-y-0.5 leading-tight">
                        <div className="flex items-center gap-1 font-bold text-[#52652D]">
                          <Info className="w-3 h-3 text-[#C99B42] shrink-0" />
                          <span>*T&amp;C Apply • Delivery Charges Extra</span>
                        </div>
                        <p className="text-[#77766F]">
                          Rates are indicative estimates. Delivery &amp; freight charges extra based on transit distance and volume (no fixed flat price).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty Search State */}
        {filteredItems.length === 0 && (
          <div className="p-12 text-center rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 space-y-3 max-w-lg mx-auto">
            <Droplets className="w-10 h-10 text-[#C99B42] mx-auto opacity-60" />
            <h4 className="font-bold text-base text-[#102C47] font-playfair">
              No Bottle Designs Matched Your Search
            </h4>
            <p className="text-xs text-[#77766F]">
              Try searching with another keyword (e.g. 500ml, carafe, decanter) or clear filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all');
                setSearchQuery('');
              }}
              className="btn-gold-luxury px-4 py-2 rounded-full text-xs font-bold shadow-xs cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Bottom Hospitality Guarantee Strip */}
        <div className="p-6 rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/35 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 text-center md:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#52652D]/10 text-[#52652D] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#52652D]" />
            </div>
            <div>
              <h5 className="font-bold text-xs text-[#102C47] font-playfair">
                100% Brand Exclusivity
              </h5>
              <p className="text-[11px] text-[#77766F]">
                Your bottles are supplied only to your restaurant, never cross-sold.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#C99B42]/15 text-[#C99B42] flex items-center justify-center shrink-0">
              <Droplets className="w-5 h-5 text-[#C99B42]" />
            </div>
            <div>
              <h5 className="font-bold text-xs text-[#102C47] font-playfair">
                Free Physical Samples
              </h5>
              <p className="text-[11px] text-[#77766F]">
                Delivered directly to your dining establishment for guest tableware testing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#52652D]/15 text-[#52652D] flex items-center justify-center shrink-0">
              <Recycle className="w-5 h-5 text-[#52652D]" />
            </div>
            <div>
              <h5 className="font-bold text-xs text-[#102C47] font-playfair">
                Glass &amp; Recyclable rPET
              </h5>
              <p className="text-[11px] text-[#77766F]">
                Choice of crystal flint glass and 100% recyclable food-grade rPET bottles.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* High-Resolution Photo Lightbox Modal */}
      {selectedPhotoModal && (
        <div 
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedPhotoModal(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedPhotoModal(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/20 hover:bg-white text-white hover:text-black flex items-center justify-center transition cursor-pointer"
            title="Close Lightbox"
          >
            <X className="w-5 h-5" />
          </button>

          <div 
            className="relative max-w-2xl max-h-[85vh] flex flex-col items-center justify-center space-y-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhotoModal.image}
              alt={selectedPhotoModal.title}
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.endsWith('.jpg')) {
                  target.src = target.src.replace(/\.jpg$/, '.png');
                } else if (target.src.endsWith('.png')) {
                  target.src = target.src.replace(/\.png$/, '.jpg');
                }
              }}
              className="max-h-[65vh] w-auto object-contain rounded-2xl shadow-2xl filter drop-shadow-[0_20px_50px_rgba(201,155,66,0.3)]"
            />

            <div className="text-center text-white space-y-1">
              <h4 className="text-lg font-bold font-playfair text-[#FFF9EF]">
                {selectedPhotoModal.title}
              </h4>
              <p className="text-xs text-[#C99B42]">
                {selectedPhotoModal.subtitle} • {selectedPhotoModal.sizeLabel}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const item = selectedPhotoModal;
                    setSelectedPhotoModal(null);
                    handleOrderSample(item);
                  }}
                  className="btn-gold-luxury px-6 py-2.5 rounded-full font-bold text-xs shadow-lg cursor-pointer"
                >
                  Order Physical Samples of This Bottle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
