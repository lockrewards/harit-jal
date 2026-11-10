import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  PhoneCall,
  CheckCircle2,
  Calendar,
  Package,
  Headphones,
  Store,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Key,
  Eye,
  EyeOff,
  Check,
  ArrowRight,
  Droplets,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { CallBooking } from '../types';
import { StorageService } from '../services/storage';
import { CustomerAuthService } from '../services/customerAuth';
import { AutomationService } from '../services/automationService';
import { ResendService } from '../services/resendService';
import { SupabaseService, isSupabaseConfigured } from '../services/supabase';
import { InlineOtpSection } from './InlineOtpSection';
import { soundPlayer } from '../services/sound';

const getMinDateTimeString = () => {
  const minTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const year = minTime.getFullYear();
  const month = String(minTime.getMonth() + 1).padStart(2, '0');
  const day = String(minTime.getDate()).padStart(2, '0');
  const hours = String(minTime.getHours()).padStart(2, '0');
  const minutes = String(minTime.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getDefaultDateTimeString = () => {
  const d = new Date(Date.now() + 2.5 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() >= 30 ? 60 : 30, 0, 0);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDisplayDateTime = (dateTimeStr: string) => {
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return dateTimeStr;
  }
};

interface BookCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    restaurantName?: string;
    bottleSize?: '250ml' | '500ml' | '750ml_glass' | '1000ml';
    capColor?: string;
    labelTheme?: string;
  };
  onBookingSuccess?: (booking: CallBooking) => void;
  onOpenCustomerPortal?: (email: string) => void;
}

const BOTTLE_FORMAT_OPTIONS = [
  { id: '250ml', label: '250ml Pocket' },
  { id: '500ml', label: '500ml Dine-In' },
  { id: '750ml_glass', label: '750ml Glass' },
  { id: '1000ml', label: '1000ml Family' },
] as const;

export const BookCallModal: React.FC<BookCallModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onBookingSuccess,
  onOpenCustomerPortal,
}) => {
  // Form fields start cleanly empty without hardcoded demo credentials
  const [restaurantName, setRestaurantName] = useState(initialData?.restaurantName || '');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');

  // Multi-select bottle formats (default 500ml and 750ml selected, matching reference image)
  const [selectedFormats, setSelectedFormats] = useState<string[]>(() => {
    if (initialData?.bottleSize) {
      return [initialData.bottleSize];
    }
    return ['500ml', '750ml_glass'];
  });

  // Optional partner password
  const [accountPassword, setAccountPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Specific requests
  const [specificRequests, setSpecificRequests] = useState('');

  // Lazily compute date bounds to avoid impure Date.now() calls during render
  const [{ minDateTime, defaultCallDateTime }] = useState(() => ({
    minDateTime: getMinDateTimeString(),
    defaultCallDateTime: getDefaultDateTimeString(),
  }));

  const [callDateTime, setCallDateTime] = useState(defaultCallDateTime);

  // DPDP Act 2023 consent
  const [dpdpConsent, setDpdpConsent] = useState(true);

  // Form states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedBooking, setSubmittedBooking] = useState<CallBooking | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [accountCreationError, setAccountCreationError] = useState<string | null>(null);
  const [isAccountOtpVerified, setIsAccountOtpVerified] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundPlayer.playBubblePop();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Toggle multi-selection for bottle formats
  const toggleFormat = (formatId: string) => {
    soundPlayer.playWaterDrop();
    setErrorMessage(null);
    setSelectedFormats((prev) => {
      if (prev.includes(formatId)) {
        // Prevent deselecting all - must keep at least 1
        if (prev.length <= 1) {
          return prev;
        }
        return prev.filter((id) => id !== formatId);
      } else {
        return [...prev, formatId];
      }
    });
  };

  const validateForm = (): boolean => {
    setErrorMessage(null);

    if (!restaurantName.trim()) {
      setErrorMessage('Please enter your Restaurant / Dhaba Name.');
      return false;
    }
    if (!ownerName.trim()) {
      setErrorMessage('Please enter your Contact Person Name.');
      return false;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit Phone / WhatsApp number.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid Email Address.');
      return false;
    }

    if (!city.trim()) {
      setErrorMessage('Please enter your City / Highway Location.');
      return false;
    }

    if (selectedFormats.length === 0) {
      setErrorMessage('Please select at least one bottle format.');
      return false;
    }

    if (!callDateTime) {
      setErrorMessage('Please select your preferred date and time for the consultation call.');
      return false;
    }

    const selectedTimestamp = new Date(callDateTime).getTime();
    const minAllowedTimestamp = Date.now() + 2 * 60 * 60 * 1000 - 60000;
    if (isNaN(selectedTimestamp) || selectedTimestamp < minAllowedTimestamp) {
      setErrorMessage('कॉल का समय वर्तमान समय से कम से कम 2 घंटे बाद का होना चाहिए। (Call time must be scheduled at least 2 hours in advance).');
      return false;
    }

    if (accountPassword.trim().length > 0 && accountPassword.trim().length < 8) {
      setErrorMessage('Password should be at least 8 characters long (or leave empty to skip account creation).');
      return false;
    }

    if (accountPassword.trim().length >= 8 && !isAccountOtpVerified) {
      setErrorMessage('Please click "Send OTP on Email" and verify your 6-digit code to create your partner account.');
      return false;
    }

    if (!dpdpConsent) {
      setErrorMessage('Please agree to the DPDP Act 2023 data processing terms to confirm your booking.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      soundPlayer.playBubblePop();
      return;
    }

    setIsSubmitting(true);
    setAccountCreationError(null);
    soundPlayer.playWaterDrop();

    try {
      const primarySize = (selectedFormats[0] || '500ml') as '250ml' | '500ml' | '750ml_glass' | '1000ml';

      // 1. Save Call Booking record in local storage (inquiry succeeds independently)
      const cleanRequirements = specificRequests.trim();
      const newBooking = StorageService.addBooking({
        restaurantName: restaurantName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        bottleSize: primarySize,
        bottleFormats: selectedFormats,
        monthlyVolume: 3000,
        capColor: initialData?.capColor || 'royal_gold',
        labelStyle: initialData?.labelTheme || 'dhaba_heritage',
        preferredDateTime: formatDisplayDateTime(callDateTime),
        notes: cleanRequirements,
        source: 'website_form',
      });

      const dbNotes = cleanRequirements
        ? `[Source: Website Form (Consultation Modal)] ${cleanRequirements}`
        : '[Source: Website Form (Consultation Modal)] Bespoke dining bottle tasting consultation';

      const leadSynced = await SupabaseService.syncConsultationLead({
        id: newBooking.id,
        restaurantName: newBooking.restaurantName,
        ownerName: newBooking.ownerName,
        phone: newBooking.phone,
        email: newBooking.email,
        city: newBooking.city,
        preferredTime: newBooking.preferredDateTime,
        bottleTypes: selectedFormats,
        notes: dbNotes,
        status: newBooking.status,
      });

      if (isSupabaseConfigured() && !leadSynced) {
        StorageService.setBookings(
          StorageService.getBookings().filter((b) => b.id !== newBooking.id)
        );
        soundPlayer.playBubblePop();
        setIsSubmitting(false);
        setErrorMessage(
          'Unable to save consultation request to our cloud server right now. Please try again shortly or contact +91 62992 93497 directly.'
        );
        return;
      }

      // 2. Save or update lead in CRM Automation & trigger notifications (after cloud sync succeeds)
      AutomationService.saveOrUpdateLead({
        id: newBooking.id,
        customerName: ownerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        businessName: restaurantName.trim(),
        location: city.trim(),
        bottleSize: selectedFormats.join(', '),
        customerRequirements: cleanRequirements,
        sourcePage: 'Website Form (Consultation Modal)',
        inquirySource: 'website_form',
        leadStatus: 'New',
      });

      if (isSupabaseConfigured()) {
        void ResendService.sendConsultationConfirmation({
          bookingId: newBooking.id,
          restaurantName: newBooking.restaurantName,
          ownerName: newBooking.ownerName,
          email: newBooking.email,
          phone: newBooking.phone,
          preferredTime: newBooking.preferredDateTime,
          city: newBooking.city,
        });
        void ResendService.sendAdminLeadAlert({
          id: newBooking.id,
          customerName: newBooking.ownerName,
          email: newBooking.email,
          phone: newBooking.phone,
          businessName: newBooking.restaurantName,
          location: newBooking.city,
          bottleSize: selectedFormats.join(', '),
          customerRequirements: cleanRequirements,
          sourcePage: 'Website Form (Consultation Modal)',
        });
      }

      // 3. Optional Partner Account Creation (requires OTP verification)
      let createdAccount = false;
      let accountFailNotice: string | null = null;

      if (accountPassword.trim().length >= 8 && isAccountOtpVerified) {
        // Await Supabase Auth registration - prevent background dispatch (FINDING 1B-02)
        const authRes = await CustomerAuthService.signUpWithSupabaseAuth({
          restaurantName: restaurantName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          city: city.trim(),
          password: accountPassword.trim(),
        });

        if (authRes.success && authRes.customer) {
          createdAccount = true;
        } else if (authRes.success && authRes.requiresEmailConfirmation) {
          accountFailNotice = 'Account created! Please check your email inbox and click the confirmation link before signing in.';
        } else {
          // If Supabase registration fails, DO NOT create an orphaned local customer session!
          // Preserve consultation enquiry independently and notify user
          accountFailNotice = authRes.error || 'Partner account creation could not be completed.';
          console.warn('[BookCall] Supabase registration notice:', accountFailNotice);
        }
      }

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#C99B42', '#52652D', '#102C47'],
      });

      soundPlayer.playSuccessChime();
      setIsSubmitting(false);
      setAccountCreated(createdAccount);
      setSubmittedBooking(newBooking);
      if (accountFailNotice) {
        setAccountCreationError(accountFailNotice);
      }

      if (onBookingSuccess) {
        onBookingSuccess(newBooking);
      }
    } catch (err) {
      console.error('Call booking error:', err);
      setIsSubmitting(false);
      setErrorMessage('An unexpected error occurred while booking. Please try again or call +91 62992 93497 directly.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#102C47]/70 backdrop-blur-md overflow-y-auto font-manrope cursor-pointer"
      onClick={() => {
        soundPlayer.playBubblePop();
        onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl bg-[#FFFDF9] border border-[#C99B42]/45 rounded-3xl shadow-[0_25px_60px_rgba(16,44,71,0.28)] flex flex-col overflow-hidden text-[#102C47] my-auto cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Left Luxury Gold Flourish Accent */}
        <div className="absolute top-0 left-0 w-32 h-20 pointer-events-none overflow-hidden z-10">
          <svg viewBox="0 0 120 80" className="w-full h-full" fill="none">
            <path
              d="M-20 -20 Q 30 15 70 8 Q 110 0 130 -20 Z"
              fill="url(#goldFlourishGrad)"
              opacity="0.9"
            />
            <path
              d="M-20 -10 Q 40 25 90 12 Q 120 4 130 -10 Z"
              stroke="#D4AF37"
              strokeWidth="1.5"
              fill="none"
              opacity="0.6"
            />
            <defs>
              <linearGradient id="goldFlourishGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#C99B42" />
                <stop offset="50%" stopColor="#E6C665" />
                <stop offset="100%" stopColor="#8A631E" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Modal Header */}
        <div className="relative flex items-start justify-between pt-6 pb-4 px-6 sm:px-8 border-b border-[#C99B42]/20 bg-gradient-to-b from-[#FFFDF9] to-[#FFF9EF]">
          <div className="flex items-center gap-3.5">
            {/* Header Navy Round Medallion */}
            <div className="w-12 h-12 rounded-full bg-[#102C47] border border-[#C99B42]/60 flex items-center justify-center text-[#C99B42] shadow-sm shrink-0">
              <Calendar className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-playfair text-[#102C47] leading-tight">
                Book Free Consultation Call
              </h2>
              <p className="text-xs sm:text-sm text-[#77766F] font-medium mt-0.5">
                10-minute briefing &amp; free physical sample bottles
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              soundPlayer.playBubblePop();
              onClose();
            }}
            aria-label="Close Modal"
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-[#77766F] hover:text-[#102C47] border border-[#C99B42]/30 flex items-center justify-center transition cursor-pointer shadow-xs active:scale-95 shrink-0"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Benefits Strip */}
        <div className="px-6 sm:px-8 pt-4 pb-2">
          <div className="rounded-full bg-[#FFF9EF] border border-[#C99B42]/35 px-4 py-2 flex items-center justify-between gap-2 shadow-xs text-xs font-bold text-[#102C47]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C99B42] shrink-0" />
              <span className="text-[11px] sm:text-xs">Quick 10-Min Call</span>
            </div>
            <span className="text-[#C99B42]/40 font-light select-none">|</span>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#C99B42] shrink-0" />
              <span className="text-[11px] sm:text-xs">Free Sample Bottles</span>
            </div>
            <span className="text-[#C99B42]/40 font-light select-none">|</span>
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4 text-[#C99B42] shrink-0" />
              <span className="text-[11px] sm:text-xs">Expert Guidance</span>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto px-6 sm:px-8 py-3 max-h-[calc(88vh-140px)]">
          {submittedBooking ? (
            /* Success State */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#52652D]/15 border border-[#52652D]/40 flex items-center justify-center mx-auto text-[#52652D] shadow-xs">
                <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-2xl font-bold font-playfair text-[#102C47]">
                  {accountCreated 
                    ? 'Thank you for creating an account!' 
                    : 'Thanks for submitting your request, will reach you soon!'}
                </h3>
                <p className="text-sm text-[#77766F] max-w-md mx-auto leading-relaxed">
                  {accountCreated ? (
                    <>
                      Welcome to Harit Jal, <strong className="text-[#102C47]">{submittedBooking.ownerName}</strong>! Your partner portal is now active. We have also confirmed your consultation call for{' '}
                      <strong className="text-[#102C47]">{submittedBooking.preferredDateTime}</strong>.
                    </>
                  ) : (
                    <>
                      Thank you, <strong className="text-[#102C47]">{submittedBooking.ownerName}</strong>. Our hospitality partner desk will contact you at{' '}
                      <strong className="text-[#102C47]">{submittedBooking.phone}</strong> regarding custom bottle supply for{' '}
                      <strong className="text-[#102C47]">{submittedBooking.restaurantName}</strong>.
                    </>
                  )}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 max-w-md mx-auto text-left text-xs space-y-2 shadow-xs">
                <div className="flex justify-between border-b border-[#C99B42]/20 pb-1.5">
                  <span className="text-[#77766F]">Booking Reference ID:</span>
                  <strong className="font-mono text-[#102C47]">{submittedBooking.id}</strong>
                </div>
                <div className="flex justify-between border-b border-[#C99B42]/20 pb-1.5">
                  <span className="text-[#77766F]">Selected Bottle Formats:</span>
                  <strong className="text-[#52652D] font-bold">
                    {submittedBooking.bottleFormats?.join(', ') || submittedBooking.bottleSize}
                  </strong>
                </div>
                <div className="flex justify-between border-b border-[#C99B42]/20 pb-1.5">
                  <span className="text-[#77766F]">Location / Corridor:</span>
                  <strong className="text-[#102C47]">{submittedBooking.city}</strong>
                </div>
                {accountCreated && (
                  <div className="p-2 rounded-xl bg-[#52652D]/10 border border-[#52652D]/30 text-[#52652D] text-[11px] font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Partner Account created! Track samples anytime at /track.</span>
                  </div>
                )}
                {accountCreationError && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-medium flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Account Notice:</strong> Consultation is confirmed, but partner account creation could not be completed ({accountCreationError}). You can create your account directly via the Restaurant Portal.
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                {onOpenCustomerPortal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCustomerPortal(email);
                    }}
                    className="btn-gold-luxury px-6 py-2.5 rounded-full text-xs font-bold shadow-md cursor-pointer"
                  >
                    Open Restaurant Portal &amp; Track
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full bg-[#102C47] text-[#FFF9EF] text-xs font-bold hover:bg-[#183C60] transition cursor-pointer"
                >
                  Return to Website
                </button>
              </div>
            </div>
          ) : (
            /* Booking Form */
            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Row 1: Restaurant Name & Contact Person Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Restaurant / Dhaba Name */}
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 flex items-center justify-center text-[#C99B42] shrink-0 mt-5 shadow-xs">
                    <Store className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#8A631E] mb-1 font-manrope">
                      RESTAURANT / DHABA NAME
                    </label>
                    <input
                      type="text"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="Your business name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs font-semibold text-[#102C47] placeholder-[#77766F]/60 focus:outline-none focus:ring-2 focus:ring-[#C99B42] shadow-xs"
                    />
                  </div>
                </div>

                {/* Contact Person Name */}
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 flex items-center justify-center text-[#C99B42] shrink-0 mt-5 shadow-xs">
                    <User className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#8A631E] mb-1 font-manrope">
                      CONTACT PERSON NAME
                    </label>
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs font-semibold text-[#102C47] placeholder-[#77766F]/60 focus:outline-none focus:ring-2 focus:ring-[#C99B42] shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Phone / WhatsApp & Email Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Phone / WhatsApp */}
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 flex items-center justify-center text-[#C99B42] shrink-0 mt-5 shadow-xs">
                    <Phone className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#8A631E] mb-1 font-manrope">
                      PHONE / WHATSAPP
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="1234567890"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs font-semibold text-[#102C47] placeholder-[#77766F]/60 focus:outline-none focus:ring-2 focus:ring-[#C99B42] shadow-xs font-mono"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 flex items-center justify-center text-[#C99B42] shrink-0 mt-5 shadow-xs">
                    <Mail className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#8A631E] mb-1 font-manrope">
                      EMAIL ADDRESS
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs font-semibold text-[#102C47] placeholder-[#77766F]/60 focus:outline-none focus:ring-2 focus:ring-[#C99B42] shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: City / Highway Location (Full-Width) */}
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 flex items-center justify-center text-[#C99B42] shrink-0 mt-5 shadow-xs">
                  <MapPin className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#8A631E] mb-1 font-manrope">
                    CITY / HIGHWAY LOCATION
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Your business location"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs font-semibold text-[#102C47] placeholder-[#77766F]/60 focus:outline-none focus:ring-2 focus:ring-[#C99B42] shadow-xs"
                  />
                </div>
              </div>

              {/* Row 4: Preferred Call Time (Must be >= 2 hours in advance) */}
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 flex items-center justify-center text-[#C99B42] shrink-0 mt-5 shadow-xs">
                  <Calendar className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#8A631E] mb-1 font-manrope">
                    PREFERRED CALL TIME (कम से कम 2 घंटे बाद) *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    min={minDateTime}
                    value={callDateTime}
                    onChange={(e) => setCallDateTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs font-semibold text-[#102C47] focus:outline-none focus:ring-2 focus:ring-[#C99B42] shadow-xs"
                  />
                  <p className="text-[10.5px] text-[#77766F] mt-1">
                    ⏱️ <strong>नियम:</strong> कॉल का समय वर्तमान समय से कम से कम <strong>2 घंटे बाद</strong> का होना चाहिए ताकि हमारे हॉस्पिटैलिटी मैनेजर आपके रेस्टोरेंट के लिए कस्टमाइज्ड बॉटल प्रोफाइल और कैटलॉग तैयार कर सकें।
                  </p>
                </div>
              </div>

              {/* Bottle Format Multi-Select Section */}
              <div className="pt-1">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/35 flex items-center justify-center text-[#C99B42] shrink-0 shadow-xs">
                    <Droplets className="w-4 h-4 stroke-[2]" />
                  </div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A631E] font-manrope">
                    BOTTLE FORMAT (SELECT ONE OR MORE)
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {BOTTLE_FORMAT_OPTIONS.map((opt) => {
                    const isSelected = selectedFormats.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleFormat(opt.id)}
                        className={`py-2.5 px-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-center gap-2.5 shadow-xs ${
                          isSelected
                            ? 'bg-[#102C47] border-[#C99B42] text-[#FFF9EF] ring-1 ring-[#C99B42]'
                            : 'bg-white hover:bg-[#FFF9EF] border-[#C99B42]/35 text-[#102C47]'
                        }`}
                      >
                        {/* Checkbox square */}
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#C99B42] border-[#C99B42] text-[#102C47]'
                              : 'border-[#C99B42]/60 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-bold text-xs sm:text-[13px] leading-tight">
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Partner Account Creation */}
              <div className="space-y-3">
                <div className="p-3 sm:p-3.5 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white border border-[#C99B42]/30 flex items-center justify-center text-[#C99B42] shrink-0 shadow-xs">
                      <User className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-[13px] font-bold text-[#102C47] leading-tight">
                        Create Partner Account (Optional)
                      </h4>
                      <p className="text-[10.5px] text-[#77766F] leading-snug">
                        Set a password to access your enquiries, samples and orders later.
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-center rounded-xl bg-white border border-[#C99B42]/35 px-3 py-1.5 w-full sm:w-60 focus-within:ring-2 focus-within:ring-[#C99B42] shadow-xs">
                    <Key className="w-3.5 h-3.5 text-[#C99B42] shrink-0 mr-2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={accountPassword}
                      onChange={(e) => {
                        setAccountPassword(e.target.value);
                        if (!e.target.value) {
                          setIsAccountOtpVerified(false);
                        }
                      }}
                      placeholder="Set Password (Optional)"
                      className="w-full bg-transparent text-xs font-semibold text-[#102C47] placeholder-[#77766F]/60 focus:outline-none"
                    />
                    {accountPassword && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[#77766F] hover:text-[#102C47] ml-1 shrink-0 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline OTP Section - appears only when password is typed */}
                {accountPassword.trim().length > 0 && (
                  <InlineOtpSection
                    email={email}
                    purpose="signup"
                    isVerified={isAccountOtpVerified}
                    onVerified={() => {
                      setIsAccountOtpVerified(true);
                      setErrorMessage(null);
                    }}
                    onResetVerification={() => setIsAccountOtpVerified(false)}
                    pendingData={{
                      restaurantName,
                      ownerName,
                      email,
                      phone,
                      city,
                      password: accountPassword.trim(),
                    }}
                  />
                )}
              </div>

              {/* Specific Requests (Textarea) */}
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 flex items-center justify-center text-[#C99B42] shrink-0 mt-5 shadow-xs">
                  <FileText className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#8A631E] mb-1 font-manrope">
                    SPECIFIC REQUESTS (EG. LOGO PLACEMENT, QR CODE, DELIVERY FREQUENCY)
                  </label>
                  <textarea
                    rows={2}
                    value={specificRequests}
                    onChange={(e) => setSpecificRequests(e.target.value)}
                    placeholder="Logo placement, QR code, custom typography, delivery frequency, or any special requirements."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] placeholder-[#77766F]/60 focus:outline-none focus:ring-2 focus:ring-[#C99B42] shadow-xs resize-y min-h-[64px]"
                  />
                </div>
              </div>

              {/* DPDP Act 2023 Consent Checkbox */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 shadow-xs">
                <label className="flex items-start gap-3 cursor-pointer text-xs text-[#555A60] select-none">
                  <div
                    onClick={() => setDpdpConsent(!dpdpConsent)}
                    className={`mt-0.5 w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      dpdpConsent
                        ? 'bg-[#C99B42] border-[#C99B42] text-[#102C47]'
                        : 'border-[#C99B42]/60 bg-white'
                    }`}
                  >
                    {dpdpConsent && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span className="leading-relaxed text-[11px] sm:text-xs">
                    I consent to Harit Jal contacting me and processing my details under India&apos;s{' '}
                    <strong className="text-[#102C47] font-semibold">Digital Personal Data Protection Act (DPDP Act 2023)</strong>{' '}
                    for sample dispatch and consultation.
                  </span>
                </label>
              </div>

              {/* Primary Luxury Gold CTA */}
              <button
                type="submit"
                disabled={isSubmitting || (accountPassword.trim().length > 0 && !isAccountOtpVerified)}
                className="btn-gold-luxury w-full py-3.5 sm:py-4 px-6 rounded-full font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <PhoneCall className="w-4.5 h-4.5 text-[#102C47]" />
                <span>
                  {isSubmitting
                    ? 'Processing Request...'
                    : accountPassword.trim().length > 0
                      ? isAccountOtpVerified
                        ? 'Create Partner Account & Confirm Booking →'
                        : 'Verify Email OTP to Create Account & Submit'
                      : 'Confirm Call Booking & Dispatch Physical Samples →'}
                </span>
                <ArrowRight className="w-4 h-4 text-[#102C47]" />
              </button>

              {/* Instant Contact Notice with Direct Clickable Phone & WhatsApp Links */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 space-y-2 mt-2">
                <div className="flex items-center gap-2 font-bold text-xs text-[#102C47]">
                  <PhoneCall className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>क्या आप अभी तुरंत बात करना चाहते हैं? (Need Immediate Assistance?)</span>
                </div>
                <p className="text-[11px] text-[#77766F] leading-relaxed">
                  अगर आप अभी तुरंत बात करना चाहते हैं, तो 2 घंटे इंतज़ार करने की ज़रूरत नहीं है! सीधे नीचे दिए गए नंबर पर कॉल या WhatsApp करें — नंबर पर क्लिक करते ही डायल खुल जाएगा:
                </p>
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {/* Direct Clickable Phone Link */}
                  <a
                    href="tel:+916299293497"
                    onClick={() => soundPlayer.playWaterDrop()}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#102C47] hover:bg-[#183C60] active:scale-95 text-[#FFF9EF] text-xs font-bold transition shadow-2xs cursor-pointer group"
                    title="Click to dial +91 62992 93497"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#C99B42] group-hover:scale-110 transition-transform" />
                    <span>+91 62992 93497</span>
                    <span className="text-[10px] text-[#C99B42] underline">(कॉल करने के लिए क्लिक करें)</span>
                  </a>

                  {/* Direct Clickable WhatsApp Link */}
                  <a
                    href="https://wa.me/916299293497?text=Hello%20Harit%20Jal%20Team%2C%20I%20am%20calling%20to%20discuss%20custom%20glass%20water%20bottles%20for%20my%20restaurant%20immediately."
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => soundPlayer.playWaterDrop()}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white text-xs font-bold transition shadow-2xs cursor-pointer group"
                    title="Chat on WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    <span>WhatsApp पर चैट करें</span>
                  </a>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Bottom Luxury Navy Ribbon with Gold Edge Accent */}
        <div className="w-full h-4 sm:h-5 bg-gradient-to-r from-[#0A1B2D] via-[#102C47] to-[#0A1B2D] border-t-2 border-[#C99B42] relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C99B42]/20 via-transparent to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
