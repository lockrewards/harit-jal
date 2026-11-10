import React, { useState } from 'react';
import { PhoneCall, MessageSquare, Palette, CheckCircle2, ShieldCheck, Truck } from 'lucide-react';
import { soundPlayer } from '../services/sound';
import { useRouter } from '../router/useRouter';

interface HowItWorksPageProps {
  onOpenBookingModal: () => void;
}

const JOURNEY_STEPS = [
  {
    step: '01',
    title: 'Initial Enquiry',
    hindi: 'प्रारंभिक संपर्क एवं परामर्श',
    icon: PhoneCall,
    description: 'Submit an online consultation enquiry or call our team. Share your dining concept (dhaba, hotel, cafe, or banquet) and approximate daily table turnover.',
    details: [
      'Zero upfront commitment required',
      'Understand wholesale unit costs & margins',
      'Choose between flint glass and recyclable rPET',
    ],
  },
  {
    step: '02',
    title: 'Requirement Discussion',
    hindi: 'विस्तृत आवश्यकता विश्लेषण',
    icon: MessageSquare,
    description: 'Our hospitality consultant works with your restaurant team to determine optimal bottle volume (250ml, 500ml, 750ml glass, or 1000ml) and replenishment cycles.',
    details: [
      'Dining room turnover and cover analysis',
      'Menu beverage pricing and profit margin planning',
      'Cellar storage and case stacking recommendations',
    ],
  },
  {
    step: '03',
    title: 'Bottle & Label Selection',
    hindi: 'बोतल एवं कस्टम लेबल चयन',
    icon: Palette,
    description: 'Select your cap metallic finish and label aesthetic. Provide your establishment logo or name typography; our team produces digital bespoke label proofs.',
    details: [
      'Digital bespoke label artwork proofing',
      'Matching restaurant color schemes and motifs',
      'Optional QR code linking diners to your online menu',
    ],
  },
  {
    step: '04',
    title: 'Design Approval',
    hindi: 'भौतिक सैंपल बोतल निरीक्षण',
    icon: CheckCircle2,
    description: 'Review physical sample bottles in your hands. Test cap tamper seals, inspect glass clarity, and verify label print alignment prior to bulk production.',
    details: [
      'Physical pre-production sample delivered to your door',
      'Inspect glass weight, clarity, and seal security',
      'Formal partner approval prior to commercial run',
    ],
  },
  {
    step: '05',
    title: 'Production & Quality Check',
    hindi: 'मानक बॉटलिंग एवं लैब परीक्षण',
    icon: ShieldCheck,
    description: 'Water is purified across multi-barrier RO, UV, and ozonation systems adhering to BIS IS:14543 and FSSAI standards. Bottled touchless in a Class 100,000 cleanroom.',
    details: [
      'Strict adherence to BIS IS:14543:2004 specifications',
      'Balanced natural minerals (pH 7.0–7.4 & TDS 120–150 ppm)',
      'Automated robotic capping and batch verification logs',
    ],
  },
  {
    step: '06',
    title: 'Delivery & Replenishment',
    hindi: 'सीधे रेस्टोरेंट डिलीवरी एवं रीसाइक्लिंग',
    icon: Truck,
    description: 'Consignments are transported directly to your restaurant storage cellar on a predictable weekly schedule, with collection of empty used bottles for recycling.',
    details: [
      'Direct-to-cellar unloading without distributor delays',
      'Automated recurring delivery schedule to prevent shortages',
      'Empty bottle buyback program under CPCB EPR rules',
    ],
  },
];

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onOpenBookingModal }) => {
  const [activeStep, setActiveStep] = useState(0);
  const { navigate } = useRouter();

  return (
    <div className="pt-20 sm:pt-22 pb-12 md:pb-14 bg-[#F8F3E9] text-[#102C47] font-manrope min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B42]/40 text-[#52652D] text-xs font-bold mb-2.5 shadow-xs">
            <Truck className="w-3.5 h-3.5 text-[#52652D]" />
            <span>TRANSPARENT SUPPLY JOURNEY</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[44px] font-bold font-playfair text-[#102C47] tracking-tight leading-tight">
            How Harit Jal Reaches <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B42]">
              Your Restaurant Dining Tables.
            </span>
          </h1>
          <p className="mt-2 text-[#77766F] text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
            A structured 6-stage roadmap from your first consultation to scheduled doorstep replenishment.
          </p>
        </div>

        {/* 6-Step Visual Timeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {JOURNEY_STEPS.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = activeStep === idx;
            return (
              <div
                key={item.step}
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveStep(idx);
                }}
                className={`p-4.5 sm:p-5 rounded-2xl bg-[#FFF9EF] border transition-all duration-300 cursor-pointer shadow-xs flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#C99B42] ring-2 ring-[#C99B42]/40 shadow-md transform -translate-y-0.5'
                    : 'border-[#C99B42]/25 hover:border-[#C99B42]/70 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-[#102C47] text-[#C99B42] flex items-center justify-center font-bold shadow-xs">
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-xl sm:text-2xl font-bold font-playfair text-[#C99B42]/50">
                      {item.step}
                    </span>
                  </div>

                  <div className="text-[9.5px] font-bold text-[#52652D] uppercase tracking-wider mb-1">
                    Stage {item.step}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold font-playfair text-[#102C47] mb-0.5">
                    {item.title}
                  </h3>
                  <div className="text-xs font-semibold text-[#52652D] font-devanagari mb-2">
                    {item.hindi}
                  </div>

                  <p className="text-xs text-[#77766F] leading-relaxed mb-3">
                    {item.description}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2.5 border-t border-[#C99B42]/15 text-[11px] text-[#102C47]/90">
                  {item.details.map((point, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#52652D] shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Onboarding CTA Banner */}
        <div className="mt-8 sm:mt-10 p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-[#102C47] text-[#FFF9EF] shadow-md flex flex-col md:flex-row items-center justify-between gap-5 border border-[#C99B42]/30">
          <div className="space-y-1.5 text-center md:text-left">
            <h3 className="text-2xl font-bold font-playfair text-[#FFF9EF]">
              Ready to start Step 1 for your restaurant?
            </h3>
            <p className="text-xs sm:text-sm text-[#C99B42]">
              Book a 10-minute discovery call to discuss volume requirements and receive physical bottle samples.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                soundPlayer.playSuccessChime();
                onOpenBookingModal();
              }}
              className="btn-gold-luxury px-6 py-3 rounded-full font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <PhoneCall className="w-3.5 h-3.5 text-[#102C47]" />
              <span>Book Consultation Call</span>
            </button>

            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                navigate('/gallery');
              }}
              className="px-5 py-3 rounded-full border border-[#FFF9EF]/40 text-[#FFF9EF] hover:bg-[#FFF9EF]/10 font-bold text-xs transition cursor-pointer"
            >
              <span>Explore Bottle Gallery</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

