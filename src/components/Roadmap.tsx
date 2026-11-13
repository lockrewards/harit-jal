import React, { useState } from 'react';
import { PhoneCall, MessageSquare, Palette, CheckCircle2, ShieldCheck, Truck } from 'lucide-react';
import { soundPlayer } from '../services/sound';

interface RoadmapProps {
  onOpenBookingModal: () => void;
}

const ROADMAP_STEPS = [
  {
    step: '01',
    title: 'Initial Enquiry',
    hindi: 'प्रारंभिक संपर्क एवं परामर्श',
    icon: PhoneCall,
    badge: 'Step 1',
    description: 'Connect with our team via our booking form or direct phone call. Share your restaurant or hotel details, dining concept, and table count.',
    highlights: [
      'No upfront financial commitment',
      'Understand wholesale unit costs & margins',
      'Clarify dining volume requirements',
    ],
  },
  {
    step: '02',
    title: 'Requirement Discussion',
    hindi: 'विस्तृत आवश्यकता विश्लेषण',
    icon: MessageSquare,
    badge: 'Step 2',
    description: 'We evaluate your table turnover and dining aesthetics to recommend optimal bottle volume (250ml, 500ml, 750ml glass, or 1-litre family bottles) and delivery frequency.',
    highlights: [
      'Evaluation of table turnover patterns',
      'Selection between rPET and flint glass',
      'Menu pricing and revenue planning',
    ],
  },
  {
    step: '03',
    title: 'Bottle & Label Selection',
    hindi: 'बोतल एवं कस्टम लेबल चयन',
    icon: Palette,
    badge: 'Step 3',
    description: 'Select your preferred cap color, label theme, and provide your restaurant logo or name typography. Our design team prepares digital mockups tailored to your brand identity.',
    highlights: [
      'Digital bespoke label artwork proofing',
      'Matching restaurant color schemes',
      'Optional QR code linking to your menu',
    ],
  },
  {
    step: '04',
    title: 'Sample Approval',
    hindi: 'भौतिक सैंपल बोतल निरीक्षण',
    icon: CheckCircle2,
    badge: 'Step 4',
    description: 'Review physical sample bottles in your hands. Test cap tamper seals, inspect glass/PET clarity, and verify label print alignment prior to batch manufacturing.',
    highlights: [
      'Inspect physical bottle finish & weight',
      'Confirm typography and statutory label details',
      'Formal partner approval before production',
    ],
  },
  {
    step: '05',
    title: 'Compliance & Production',
    hindi: 'मानक बॉटलिंग एवं स्वच्छता परीक्षण',
    icon: ShieldCheck,
    badge: 'Step 5',
    description: 'Pure water sourced from licensed, certified manufacturing plants is filled into food-grade bottles adhering to FSSAI cleanroom standards with your customized labels.',
    highlights: [
      'Certified drinking water sourcing',
      'FSSAI Schedule 4 cleanroom adherence',
      'Zero human touch automated capping',
    ],
  },
  {
    step: '06',
    title: 'Doorstep Delivery',
    hindi: 'सीधे रेस्टोरेंट डिलीवरी एवं रीसाइक्लिंग',
    icon: Truck,
    badge: 'Step 6',
    description: 'Stacked cases are transported directly to your establishment cellar or beverage pantry. Scheduled recurring replenishments ensure your dining tables are never out of stock.',
    highlights: [
      'Direct doorstep unloading to storage pantry',
      'Predictable recurring replenishment schedule',
      'Collection of empty bottles for responsible recycling',
    ],
  },
];

export const Roadmap: React.FC<RoadmapProps> = ({ onOpenBookingModal }) => {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="roadmap-section" className="relative py-14 md:py-18 bg-[#F8F3E9] text-[#102B46] overflow-hidden border-t border-[#C99B43]/20">
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B43]/40 text-[#455C22] text-xs font-bold mb-3 shadow-sm">
            <Truck className="w-3.5 h-3.5 text-[#455C22]" />
            <span className="font-manrope">TRANSPARENT 6-STAGE SUPPLY ROADMAP</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-playfair text-[#102B46] tracking-tight">
            How Harit Jal Reaches <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B43]">
              Your Restaurant Dining Tables.
            </span>
          </h2>
          <p className="mt-3 text-[#77766F] text-sm sm:text-base leading-relaxed font-manrope">
            A clear, predictable roadmap from initial consultation to regular doorstep case replenishment.
          </p>
        </div>

        {/* 6 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROADMAP_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isSelected = activeStep === idx;
            return (
              <div
                key={step.step}
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveStep(idx);
                }}
                className={`p-6 rounded-3xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[#FFF9EF] border-[#C99B43] shadow-lg ring-2 ring-[#C99B43]/30 transform -translate-y-1'
                    : 'bg-[#FFF9EF] border-[#C99B43]/25 hover:border-[#C99B43]/70 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#102B46] text-[#FFF9EF] flex items-center justify-center font-bold shadow-sm">
                    <Icon className="w-5 h-5 text-[#C99B43]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#455C22] bg-[#455C22]/10 px-2.5 py-0.5 rounded-full">
                      {step.badge}
                    </span>
                    <span className="text-xl font-bold font-playfair text-[#C99B43]/60">
                      {step.step}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold font-playfair text-[#102B46]">
                  {step.title}
                </h3>
                <div className="text-xs font-bold text-[#455C22] font-devanagari mt-0.5 mb-2.5">
                  {step.hindi}
                </div>

                <p className="text-xs text-[#77766F] leading-relaxed mb-4">
                  {step.description}
                </p>

                <div className="space-y-1.5 pt-3 border-t border-[#C99B43]/15">
                  {step.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-[#102B46]/85">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#455C22] shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Consultation Call Banner */}
        <div className="mt-10 p-6 sm:p-8 rounded-3xl bg-[#102B46] text-[#FFF9EF] border border-[#C99B43]/40 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xl sm:text-2xl font-bold font-playfair text-[#FFF9EF]">
              Ready to begin Step 1 for your restaurant?
            </h3>
            <p className="text-xs sm:text-sm text-[#E0BA6E]">
              Schedule a 10-minute discovery call to discuss volume requirements and receive physical bottle samples.
            </p>
          </div>

          <button
            onClick={() => {
              soundPlayer.playSuccessChime();
              onOpenBookingModal();
            }}
            className="btn-gold-luxury px-7 py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-md whitespace-nowrap cursor-pointer active:scale-95 flex items-center gap-2"
          >
            <PhoneCall className="w-4 h-4 text-[#102B46]" />
            <span>Book Consultation Call</span>
          </button>
        </div>

      </div>

    </section>
  );
};
