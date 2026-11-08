import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, Check, X, Sliders, Lock, Info } from 'lucide-react';
import { CookieConsentService, CookiePreferences } from '../services/cookieConsent';
import { soundPlayer } from '../services/sound';

interface CookieConsentBannerProps {
  onOpenLegalModal?: () => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({ onOpenLegalModal }) => {
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(() =>
    CookieConsentService.getPreferences()
  );

  // Draft state for modal toggles
  const [functionalDraft, setFunctionalDraft] = useState(true);
  const [analyticsDraft, setAnalyticsDraft] = useState(true);

  useEffect(() => {
    // Check if user has already made an affirmative choice
    const consented = CookieConsentService.hasUserConsented();
    if (!consented) {
      const timer = setTimeout(() => {
        setIsBannerVisible(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for external trigger to open preferences (e.g. from footer link)
  useEffect(() => {
    const handleOpenPreferences = () => {
      const current = CookieConsentService.getPreferences();
      setPreferences(current);
      setFunctionalDraft(current.functional);
      setAnalyticsDraft(current.analytics);
      setIsPreferencesOpen(true);
    };

    window.addEventListener('harit_jal_open_cookie_preferences', handleOpenPreferences);
    return () => {
      window.removeEventListener('harit_jal_open_cookie_preferences', handleOpenPreferences);
    };
  }, []);

  const handleAcceptAll = () => {
    soundPlayer.playSuccessChime();
    const updated = CookieConsentService.acceptAll();
    setPreferences(updated);
    setIsBannerVisible(false);
    setIsPreferencesOpen(false);
  };

  const handleAcceptEssentialOnly = () => {
    soundPlayer.playWaterDrop();
    const updated = CookieConsentService.acceptEssentialOnly();
    setPreferences(updated);
    setIsBannerVisible(false);
    setIsPreferencesOpen(false);
  };

  const handleOpenPreferencesModal = () => {
    soundPlayer.playBubblePop();
    const current = CookieConsentService.getPreferences();
    setFunctionalDraft(current.functional);
    setAnalyticsDraft(current.analytics);
    setIsPreferencesOpen(true);
  };

  const handleSaveCustomPreferences = () => {
    soundPlayer.playSuccessChime();
    const updated = CookieConsentService.savePreferences({
      functional: functionalDraft,
      analytics: analyticsDraft,
    });
    setPreferences(updated);
    setIsPreferencesOpen(false);
    setIsBannerVisible(false);
  };

  return (
    <>
      {/* --- FLOATING COOKIE CONSENT BANNER (Bottom Left) --- */}
      {isBannerVisible && !isPreferencesOpen && (
        <aside
          aria-label="Cookie & Privacy Consent"
          className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 max-w-md md:max-w-lg w-[calc(100%-2rem)] sm:w-auto animate-fadeIn font-manrope select-none"
        >
          <div className="relative p-5 sm:p-6 rounded-3xl bg-[#FFF9EF]/95 backdrop-blur-md border border-[#C99B42]/45 shadow-[0_20px_50px_rgba(16,44,71,0.22)] text-[#102C47] space-y-3.5">
            
            {/* Top Badge Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#52652D]/10 text-[#52652D] text-[10.5px] font-mono font-bold border border-[#52652D]/30">
                <Cookie className="w-3.5 h-3.5 text-[#C99B42]" />
                <span>COOKIE & DATA PRIVACY</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-[#C99B42] uppercase tracking-wider">
                DPDP ACT 2023
              </span>
            </div>

            {/* Title & Body */}
            <div>
              <h3 className="text-base font-bold font-playfair text-[#102C47]">
                We Respect Your Privacy & Hospitality Trust
              </h3>
              <p className="mt-1 text-xs text-[#555A60] leading-relaxed">
                Harit Jal uses essential cookies and local storage to power your bottle gallery preview, remember custom dining presets, and ensure bank-grade account security under India&apos;s <strong className="text-[#102C47] font-semibold">DPDP Act 2023</strong>.{onOpenLegalModal ? <> <button type="button" onClick={onOpenLegalModal} className="text-[#C99B42] underline hover:text-[#102C47] font-semibold cursor-pointer">Read Privacy Policy</button>.</> : null} We never sell your restaurant data.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAcceptAll}
                className="btn-gold-luxury px-4 py-2 rounded-full font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check className="w-3.5 h-3.5 text-[#102C47]" />
                <span>Accept All Cookies</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptEssentialOnly}
                className="px-3.5 py-2 rounded-full font-bold text-xs bg-[#F8F3E9] text-[#102C47] hover:bg-white border border-[#C99B42]/35 transition cursor-pointer active:scale-95"
              >
                Essential Only
              </button>

              <button
                type="button"
                onClick={handleOpenPreferencesModal}
                className="px-3 py-2 text-xs font-semibold text-[#52652D] hover:text-[#102C47] flex items-center gap-1 cursor-pointer transition hover:underline"
              >
                <Sliders className="w-3 h-3 text-[#52652D]" />
                <span>Preferences</span>
              </button>
            </div>

          </div>
        </aside>
      )}

      {/* --- PREFERENCES CUSTOMIZATION MODAL --- */}
      {isPreferencesOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#102C47]/60 backdrop-blur-sm animate-fadeIn font-manrope"
          onClick={() => setIsPreferencesOpen(false)}
        >
          <div
            className="relative w-full max-w-xl max-h-[92vh] bg-[#FFF9EF] border border-[#C99B42]/45 rounded-3xl shadow-[0_25px_60px_rgba(16,44,71,0.25)] flex flex-col overflow-hidden text-[#102C47]"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#C99B42]/20 bg-[#F8F3E9]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#102C47] text-[#C99B42] flex items-center justify-center font-bold">
                  <Cookie className="w-4 h-4" />
                </div>
                <div>
                  <h2 id="cookie-modal-title" className="text-lg font-bold font-playfair text-[#102C47]">
                    Manage Cookie & Data Preferences
                  </h2>
                  <p className="text-xs text-[#77766F]">
                    Digital Personal Data Protection Act (DPDP Act 2023) Compliance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundPlayer.playBubblePop();
                  setIsPreferencesOpen(false);
                }}
                className="p-2 rounded-full hover:bg-[#102C47]/10 text-[#77766F] hover:text-[#102C47] transition cursor-pointer"
                aria-label="Close Preferences"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content / Category Toggles */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs leading-relaxed">
              
              <p className="text-[#555A60]">
                We use cookies and local storage technology to deliver a tailored hospitality experience. Under Indian privacy law, you have full control over non-essential tracking. Choose your preferred categories below:
              </p>

              {/* Category 1: Strictly Necessary (Always On) */}
              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#52652D]" />
                    <span className="font-bold text-sm text-[#102C47]">
                      Strictly Necessary & Security Cookies
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#52652D]/15 text-[#52652D] text-[10px] font-bold font-mono border border-[#52652D]/30">
                    ALWAYS ACTIVE
                  </span>
                </div>
                <p className="text-[#77766F] leading-relaxed">
                  Required for essential website operations, secure client authentication (`/track`), CSRF protection, and high-resolution rendering in the Bottle Gallery. Cannot be deactivated.
                </p>
              </div>

              {/* Category 2: Functional & Gallery Preferences */}
              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#C99B42]" />
                    <span className="font-bold text-sm text-[#102C47]">
                      Functional & Gallery Personalization
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={functionalDraft}
                      onChange={(e) => setFunctionalDraft(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-[#C99B42]/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#52652D]"></div>
                  </label>
                </div>
                <p className="text-[#77766F] leading-relaxed">
                  Remembers your custom restaurant logo, typography selections, metallic cap finishes, and audio sound effect preferences across page visits.
                </p>
              </div>

              {/* Category 3: Analytics & Performance */}
              <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#C99B42]" />
                    <span className="font-bold text-sm text-[#102C47]">
                      Performance & Anonymous Analytics
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={analyticsDraft}
                      onChange={(e) => setAnalyticsDraft(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-[#C99B42]/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#52652D]"></div>
                  </label>
                </div>
                <p className="text-[#77766F] leading-relaxed">
                  Collects aggregated, anonymous usage telemetry to evaluate server latency, image load speeds, and Neer AI conversational quality. No commercial profiling or third-party ad retargeting.
                </p>
              </div>

              {/* Legal Reference Note */}
              <div className="p-3.5 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/25 flex items-start gap-2.5 text-[11px] text-[#77766F]">
                <Info className="w-4 h-4 text-[#C99B42] shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Under the <strong>DPDP Act 2023</strong>, you may modify or revoke your consent at any time. For questions regarding stored records, email our Data Grievance Officer at <strong className="text-[#102C47] font-mono">info@haritjal.in</strong>.
                </span>
              </div>

            </div>

            {/* Modal Footer Buttons */}
            <div className="px-6 py-4 bg-[#F8F3E9] border-t border-[#C99B42]/20 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleAcceptEssentialOnly}
                className="text-xs font-semibold text-[#77766F] hover:text-[#102C47] underline cursor-pointer"
              >
                Reject Non-Essential
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveCustomPreferences}
                  className="px-4 py-2 rounded-full font-bold text-xs bg-[#102C47] text-[#FFF9EF] hover:bg-[#183C60] transition cursor-pointer"
                >
                  Save My Preferences
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="btn-gold-luxury px-4 py-2 rounded-full font-bold text-xs shadow-xs cursor-pointer"
                >
                  Accept All
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

