import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, ArrowUp, Lock, ShieldCheck, CheckCircle2, Award, FileText, Calendar, ArrowRight, Cookie } from 'lucide-react';
import { soundPlayer } from '../services/sound';
import { Link } from '../router/RouterContext';

interface FooterProps {
  onOpenBookingModal: () => void;
  onOpenAuthModal?: () => void;
  onOpenLegalModal?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenBookingModal,
  onOpenLegalModal,
}) => {
  const formatCurrentDateTime = (date = new Date()) => {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${weekday}, ${day} ${month} ${year} • ${timeStr} IST`;
  };

  const [currentDateTime, setCurrentDateTime] = useState<string>(() => formatCurrentDateTime());

  useEffect(() => {
    const updateDateTime = () => {
      setCurrentDateTime(formatCurrentDateTime());
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const scrollToTop = () => {
    soundPlayer.playWaterDrop();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative bg-[#FFF9EF] text-[#102C47] overflow-hidden font-manrope border-t border-[#C99B42]/25">
      
      {/* Top Wave Graphic - Royal Navy with Champagne Gold Edge */}
      <div className="w-full overflow-hidden leading-none select-none pointer-events-none">
        <svg 
          className="relative block w-full h-8 sm:h-12 text-[#102C47]" 
          viewBox="0 0 1440 60" 
          preserveAspectRatio="none"
        >
          {/* Deep Navy Wave */}
          <path 
            d="M0,0 C360,48 720,12 1080,42 C1260,54 1380,24 1440,30 L1440,0 L0,0 Z" 
            fill="currentColor"
          />
          {/* Gold Wave Ribbon Trim */}
          <path 
            d="M0,2 C360,50 720,14 1080,44 C1260,56 1380,26 1440,32" 
            stroke="#C99B42" 
            strokeWidth="2.5" 
            fill="none" 
          />
        </svg>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6">
        
        {/* 4-Column Layout as approved in reference image */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-6 items-start mb-8 sm:mb-10">
          
          {/* Column 1: Brand & Hindi Identity (5 Cols on LG) */}
          <div className="lg:col-span-5 space-y-3.5">
            {/* Logo & Brand */}
            <Link 
              to="/" 
              onClick={() => soundPlayer.playWaterDrop()}
              className="flex items-center gap-3 group inline-flex select-none"
            >
              {/* Round Circle Brand Logo Mark */}
              <div className="w-9 h-9 rounded-full border border-[#C99B42]/70 flex items-center justify-center bg-[#FFF9EF] shadow-inner overflow-hidden p-1.5 group-hover:border-[#C99B42] group-hover:scale-105 transition-all">
                <img 
                  src="/images/brand/harit-jal-logo-mark.png" 
                  alt="Harit Jal Logo" 
                  className="w-full h-full object-contain filter drop-shadow-xs" 
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-playfair text-[#102C47] tracking-tight group-hover:text-[#C99B42] transition">
                    Harit Jal<span className="text-xs text-[#C99B42] align-top">™</span>
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#52652D]/15 text-[#52652D] border border-[#52652D]/30 font-devanagari">
                    हरित जल
                  </span>
                </div>
                <span className="text-[9px] text-[#77766F] uppercase tracking-widest font-semibold">
                  BESPOKE DINING HYDRATION
                </span>
              </div>
            </Link>

            {/* Hindi Headline */}
            <div>
              <h3 className="text-2xl sm:text-[26px] font-bold font-playfair text-[#102C47] leading-tight font-devanagari">
                हर मेज़ की शान, <br />
                <span className="italic text-[#C99B42] relative inline-block mt-0.5 font-playfair">
                  शुद्धता की नई पहचान।
                  <svg 
                    className="absolute -bottom-1.5 left-0 w-full h-2 overflow-visible pointer-events-none" 
                    viewBox="0 0 200 12" 
                    fill="none" 
                    preserveAspectRatio="none"
                  >
                    <path 
                      d="M2 8 C60 14, 140 10, 198 3" 
                      stroke="#C99B42" 
                      strokeWidth="1.8" 
                      strokeLinecap="round" 
                      opacity="0.8"
                    />
                  </svg>
                </span>
              </h3>
            </div>

            {/* Hindi Subtitle */}
            <p className="text-xs sm:text-[13px] text-[#2C3E50] leading-relaxed max-w-md font-devanagari">
              रेस्टोरेंट, ढाबा, कैफ़े और होटलों के लिए कस्टमाइज़्ड ब्रांडेड पेयजल समाधान।
            </p>

            {/* 3 Authentic Trust Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F3E9] border border-[#C99B42]/35 text-[11px] font-bold text-[#102C47]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#52652D]" />
                <span className="font-devanagari">BIS गुणवत्ता</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F3E9] border border-[#C99B42]/35 text-[11px] font-bold text-[#102C47]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#52652D]" />
                <span className="font-devanagari">FSSAI अनुरूप</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F3E9] border border-[#C99B42]/35 text-[11px] font-bold text-[#102C47]">
                <Award className="w-3.5 h-3.5 text-[#C99B42]" />
                <span className="font-devanagari">100% पुनः-चक्रीय</span>
              </span>
            </div>
          </div>

          {/* Column 2: Statutory & Legal (2.5 Cols on LG) */}
          <div className="lg:col-span-2 space-y-2.5">
            <div>
              <h4 className="text-sm font-bold font-playfair text-[#102C47] tracking-tight">
                Statutory & Legal
              </h4>
              <div className="w-6 h-0.5 bg-[#C99B42] mt-1 mb-3 rounded-full" />
            </div>

            <ul className="space-y-2 text-xs text-[#2C3E50]">
              <li>
                <button
                  onClick={() => {
                    soundPlayer.playBubblePop();
                    if (onOpenLegalModal) onOpenLegalModal();
                  }}
                  className="hover:text-[#C99B42] transition cursor-pointer flex items-center gap-2 text-left"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>Terms & Conditions</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    soundPlayer.playBubblePop();
                    if (onOpenLegalModal) onOpenLegalModal();
                  }}
                  className="hover:text-[#C99B42] transition cursor-pointer flex items-center gap-2 text-left"
                >
                  <Lock className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>Privacy Policy</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    soundPlayer.playBubblePop();
                    if (onOpenLegalModal) onOpenLegalModal();
                  }}
                  className="hover:text-[#C99B42] transition cursor-pointer flex items-center gap-2 text-left"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>Delivery & Logistics Terms</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    soundPlayer.playBubblePop();
                    if (onOpenLegalModal) onOpenLegalModal();
                  }}
                  className="hover:text-[#C99B42] transition cursor-pointer flex items-center gap-2 text-left"
                >
                  <Award className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>EPR Plastic Recycling Policy</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    soundPlayer.playBubblePop();
                    window.dispatchEvent(new CustomEvent('harit_jal_open_cookie_preferences'));
                  }}
                  className="hover:text-[#C99B42] transition cursor-pointer flex items-center gap-2 text-left"
                >
                  <Cookie className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>Cookie & Privacy Consent</span>
                </button>
              </li>
              <li className="pt-1.5">
                <Link 
                  to="/compliance" 
                  onClick={() => soundPlayer.playWaterDrop()}
                  className="text-xs font-bold text-[#C99B42] hover:underline flex items-center gap-1.5"
                >
                  <span>View Full Compliance Hub</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#C99B42]" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Hospitality Desk (2.5 Cols on LG) */}
          <div className="lg:col-span-2 space-y-2.5">
            <div>
              <h4 className="text-sm font-bold font-playfair text-[#102C47] tracking-tight">
                Hospitality Desk
              </h4>
              <div className="w-6 h-0.5 bg-[#C99B42] mt-1 mb-3 rounded-full" />
            </div>

            <div className="space-y-2.5 text-xs text-[#2C3E50]">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#C99B42] shrink-0" />
                <a href="tel:+916299293497" className="font-mono text-xs font-bold text-[#102C47] hover:text-[#C99B42] transition">
                  +91 62992 93497
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#C99B42] shrink-0" />
                <a href="mailto:info@haritjal.in" className="font-mono text-xs text-[#102C47] hover:text-[#C99B42] transition">
                  info@haritjal.in
                </a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#C99B42] shrink-0 mt-0.5" />
                <span className="leading-snug">Banuchhapar, Bettiah, Bihar India</span>
              </div>
            </div>
          </div>

          {/* Column 4: Call to Action Card (2 Cols on LG) */}
          <div className="lg:col-span-3">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 shadow-xs relative overflow-hidden flex flex-col justify-between space-y-3">
              {/* Subtle water ripple decoration */}
              <div className="flex items-start justify-between">
                <h4 className="text-base sm:text-lg font-bold font-playfair text-[#102C47] leading-snug">
                  Ready to Create Your <br />
                  <span className="text-[#C99B42] italic">Branded Water?</span>
                </h4>
                {/* Water droplet ripple icon */}
                <div className="w-6 h-6 rounded-full border border-[#C99B42]/40 flex items-center justify-center shrink-0 text-[#C99B42] text-[10px]">
                  💧
                </div>
              </div>

              <button
                onClick={() => {
                  soundPlayer.playSuccessChime();
                  onOpenBookingModal();
                }}
                className="btn-gold-luxury w-full py-2.5 px-3 rounded-full font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition"
              >
                <Phone className="w-3.5 h-3.5 text-[#102C47]" />
                <span>Book a Consultation Call</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#102C47]" />
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Slim Copyright & Back to Top */}
        <div className="pt-4 border-t border-[#C99B42]/20 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-[#77766F] text-center sm:text-left">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span>© 2026 Harit Jal (हरित जल). All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-mono text-[#77766F]">
              <Calendar className="w-3 h-3 text-[#C99B42] shrink-0" />
              <span>{currentDateTime}</span>
            </span>
            <span className="text-[#C99B42]/40 hidden min-[360px]:inline">•</span>
            <button
              onClick={scrollToTop}
              className="text-[#102C47] hover:text-[#C99B42] transition flex items-center gap-1 cursor-pointer font-semibold text-xs shrink-0"
            >
              <span>Back to Top</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Wave Graphic - Royal Navy with Champagne Gold Edge */}
      <div className="w-full overflow-hidden leading-none select-none pointer-events-none -mb-1">
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

    </footer>
  );
};
