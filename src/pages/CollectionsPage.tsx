import React, { useState, useEffect } from 'react';
import { ArrowRight, Eye, Droplets, Check, Filter, X, PhoneCall, Images, Info } from 'lucide-react';
import { soundPlayer } from '../services/sound';
import { useRouter } from '../router/RouterContext';
import { PRODUCT_COLLECTIONS, ProductBottle } from '../data/products';

interface CollectionsPageProps {
  onSelectProductForCustomizer: (productId: string) => void;
  onOpenBookingModalWithProduct: (bottle: ProductBottle) => void;
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  onSelectProductForCustomizer,
  onOpenBookingModalWithProduct,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [previewProduct, setPreviewProduct] = useState<ProductBottle | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(3);
  const { navigate } = useRouter();

  // Reset pagination when category changes
  useEffect(() => {
    setVisibleCount(3);
  }, [activeCategory]);

  const categories = [
    { id: 'all', label: 'All Designs (6)' },
    { id: 'glass', label: 'Premium Glass' },
    { id: 'pet', label: 'Recyclable rPET' },
    { id: 'finedining', label: 'Fine Dining' },
    { id: 'dhaba', label: 'Dhabas & Highway' },
    { id: 'cafe', label: 'Cafes & Artisanal' },
    { id: 'banquet', label: 'Luxury Banquets' },
  ];

  const filteredBottles = activeCategory === 'all'
    ? PRODUCT_COLLECTIONS
    : PRODUCT_COLLECTIONS.filter((b) => b.categories.includes(activeCategory));

  const displayedBottles = filteredBottles.slice(0, visibleCount);

  return (
    <div className="pt-20 sm:pt-22 pb-12 md:pb-14 bg-[#F8F3E9] text-[#102C47] font-manrope min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B42]/40 text-[#52652D] text-xs font-bold mb-2.5 shadow-xs">
            <Droplets className="w-3.5 h-3.5 text-[#52652D]" />
            <span>BESPOKE BOTTLE CATALOGUE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[44px] font-bold font-playfair text-[#102C47] tracking-tight leading-tight">
            Bottle Designs Crafted For <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B42]">
              India's Dhabas, Cafes & Fine Dining.
            </span>
          </h1>
          <p className="mt-2 text-[#77766F] text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
            Every bottle sample below illustrates how bespoke branding elevates guest dining tables. Custom bottles are supplied exclusively to each partner establishment without cross-distribution.
          </p>

          {/* Clean Category Filter Pills */}
          <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
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

        {/* 3-Column Desktop, 2-Column Tablet, 1-Column Mobile Layout (Progressive 3-Bottle Load) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {displayedBottles.map((bottle) => (
            <div
              key={bottle.id}
              className="group rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/30 overflow-hidden shadow-xs hover:border-[#C99B42] hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Product Photograph Container */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <img
                    src={bottle.image}
                    alt={bottle.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-[#102C47]/90 text-[#FFF9EF] text-[10px] font-bold backdrop-blur-xs">
                    {bottle.sizeLabel}
                  </div>
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#52652D] text-[#FFF9EF] text-[9px] font-bold tracking-wider uppercase">
                    DEMO CONCEPT
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between text-[10.5px] text-[#52652D] font-bold uppercase tracking-wider">
                    <span>{bottle.subtitle}</span>
                    <span className="text-[#C99B42] font-mono">{bottle.material}</span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47] group-hover:text-[#C99B42] transition-colors leading-snug">
                    {bottle.title}
                  </h3>

                  <p className="text-xs text-[#77766F] leading-relaxed line-clamp-2">
                    {bottle.description}
                  </p>

                  <div className="pt-1 text-[11.5px] text-[#102C47]/80 flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C99B42]" />
                    <span>{bottle.tablePlacement}</span>
                  </div>

                  {/* Pricing Breakdown & Delivery T&C */}
                  <div className="pt-2 border-t border-[#C99B42]/20 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-[#77766F] block">Est. Wholesale Rate</span>
                        <span className="font-bold text-sm text-[#102C47]">₹{bottle.wholesaleRate}/unit</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#77766F] block">Menu MRP</span>
                        <span className="font-bold text-sm text-[#52652D]">₹{bottle.recommendedMRP}</span>
                      </div>
                    </div>
                    <div className="text-[9.5px] text-[#77766F] bg-[#F8F3E9] px-2.5 py-1.5 rounded-xl border border-[#C99B42]/20 leading-tight">
                      <span className="text-[#52652D] font-bold">*T&amp;C Apply:</span> Rates are indicative estimates. Delivery &amp; freight charges extra as per distance &amp; location (no flat fixed price).
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: View More Images & Order Sample */}
              <div className="p-4 sm:p-5 pt-0 flex items-center gap-2">
                <button
                  onClick={() => {
                    soundPlayer.playBubblePop();
                    setPreviewProduct(bottle);
                  }}
                  className="flex-1 py-2.5 rounded-full bg-[#F8F3E9] border border-[#C99B42]/40 hover:bg-white text-[#102C47] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Images className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>View More Images</span>
                </button>

                <button
                  onClick={() => {
                    soundPlayer.playSuccessChime();
                    onOpenBookingModalWithProduct(bottle);
                  }}
                  className="flex-1 py-2.5 rounded-full bg-[#102C47] hover:bg-[#183C60] text-[#FFF9EF] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>Order Sample</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Progressive "View More Images" Button */}
        {visibleCount < filteredBottles.length && (
          <div className="pt-6 pb-2 text-center">
            <button
              type="button"
              onClick={() => {
                soundPlayer.playWaterDrop();
                setVisibleCount((prev) => Math.min(prev + 3, filteredBottles.length));
              }}
              className="btn-gold-luxury px-8 py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-md hover:shadow-xl transition-all inline-flex items-center gap-2.5 cursor-pointer active:scale-95"
            >
              <Images className="w-4 h-4 text-[#102C47]" />
              <span>View More Images ({filteredBottles.length - visibleCount} more bottles)</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#102C47]" />
            </button>
            <p className="text-[11px] text-[#77766F] mt-2">
              Currently showing {visibleCount} of {filteredBottles.length} bottles.
            </p>
          </div>
        )}

      </div>

      {/* Product Detail Modal */}
      {previewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#102C47]/70 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-[#FFF9EF] border border-[#C99B42]/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-[#102C47]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#C99B42]/20 bg-[#F8F3E9]">
              <div>
                <h3 className="font-bold font-playfair text-lg text-[#102C47]">{previewProduct.title}</h3>
                <span className="text-xs text-[#52652D] font-semibold">{previewProduct.subtitle}</span>
              </div>
              <button
                onClick={() => setPreviewProduct(null)}
                className="p-1.5 rounded-full hover:bg-[#102C47]/10 text-[#77766F] hover:text-[#102C47] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
                <img
                  src={previewProduct.image}
                  alt={previewProduct.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/20">
                  <span className="text-[10px] text-[#77766F] block">Volume</span>
                  <span className="font-bold text-[#102C47]">{previewProduct.size}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/20">
                  <span className="text-[10px] text-[#77766F] block">Material</span>
                  <span className="font-bold text-[#102C47]">{previewProduct.material}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/20">
                  <span className="text-[10px] text-[#77766F] block">Cap Finish</span>
                  <span className="font-bold text-[#102C47]">{previewProduct.capColor}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/20">
                  <span className="text-[10px] text-[#77766F] block">Wholesale Rate</span>
                  <span className="font-bold text-[#52652D]">₹{previewProduct.wholesaleRate}/unit</span>
                </div>
              </div>

              {/* T&C Logistics Note */}
              <div className="p-3 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/25 text-[11px] text-[#77766F] space-y-1">
                <div className="flex items-center gap-1 font-bold text-[#52652D]">
                  <Info className="w-3.5 h-3.5 text-[#C99B42] shrink-0" />
                  <span>*Terms &amp; Conditions • Delivery Charges Separate</span>
                </div>
                <p className="leading-relaxed">
                  Wholesale rate is indicative. Final delivered price is determined based on your restaurant city location, transit distance, and recurring cellar dispatch schedule. No flat fixed rate is promised.
                </p>
              </div>

              <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed">
                {previewProduct.description} {previewProduct.tablePlacement}.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => {
                    const selected = previewProduct;
                    setPreviewProduct(null);
                    onOpenBookingModalWithProduct(selected);
                  }}
                  className="btn-gold-luxury flex-1 w-full py-3 rounded-full font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#102C47]" />
                  <span>Request Free Samples of This Bottle</span>
                </button>

                <button
                  onClick={() => {
                    setPreviewProduct(null);
                    navigate('/gallery');
                  }}
                  className="flex-1 w-full py-3 rounded-full bg-[#102C47] text-[#FFF9EF] font-bold text-xs hover:bg-[#183C60] transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Images className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>Explore Full Bottle Gallery</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

