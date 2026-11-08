import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { PhoneCall, Building, User, Mail, CheckCircle2, Lock, ArrowRight, Check, Key, Eye, EyeOff } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CustomerAuthService } from '../services/customerAuth';
import { AutomationService } from '../services/automationService';
import { InlineOtpSection } from './InlineOtpSection';
import { soundPlayer } from '../services/sound';
import { CallBooking } from '../types';

interface BookCallSectionProps {
  onBookingSuccess?: (booking: CallBooking) => void;
  onOpenCustomerPortal?: (email: string) => void;
}

const BOTTLE_FORMAT_OPTIONS = [
  { id: '250ml', label: '250ml Pocket' },
  { id: '500ml', label: '500ml Dine-In' },
  { id: '750ml_glass', label: '750ml Glass' },
  { id: '1000ml', label: '1000ml Family' },
] as const;

export const BookCallSection: React.FC<BookCallSectionProps> = ({ onBookingSuccess, onOpenCustomerPortal }) => {
  const [restaurantName, setRestaurantName] = useState('Om Dhaba');
  const [ownerName, setOwnerName] = useState('Atal Pandey');
  const [phone, setPhone] = useState('+91 62992 93497');
  const [email, setEmail] = useState('info@haritjal.in');
  const [city, setCity] = useState('Banuchhapar, Bettiah, Bihar India');
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['500ml', '750ml_glass']);
  const [notes, setNotes] = useState('Require custom typography with our restaurant identity on bottles.');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dpdpConsent, setDpdpConsent] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedBooking, setSubmittedBooking] = useState<CallBooking | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  const toggleFormat = (formatId: string) => {
    soundPlayer.playWaterDrop();
    setErrorMessage(null);
    setSelectedFormats((prev) => {
      if (prev.includes(formatId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== formatId);
      } else {
        return [...prev, formatId];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!restaurantName.trim() || !ownerName.trim()) {
      setErrorMessage('Please provide restaurant name and contact person name.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit phone number.');
      return;
    }

    if (!dpdpConsent) {
      setErrorMessage('Please agree to the DPDP Act 2023 data processing terms to proceed.');
      return;
    }

    if (password.trim().length > 0 && password.trim().length < 6) {
      setErrorMessage('Password must be at least 6 characters (or leave empty to skip account creation).');
      return;
    }

    if (password.trim().length >= 6 && !isOtpVerified) {
      setErrorMessage('Please click "Send OTP on Email" and verify your 6-digit code to create your partner account.');
      soundPlayer.playBubblePop();
      return;
    }

    setIsSubmitting(true);
    soundPlayer.playWaterDrop();

    setTimeout(() => {
      const primarySize = (selectedFormats[0] || '500ml') as '250ml' | '500ml' | '750ml_glass' | '1000ml';

      const newBooking = StorageService.addBooking({
        restaurantName: restaurantName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        bottleSize: primarySize,
        bottleFormats: selectedFormats,
        monthlyVolume: 3000,
        capColor: 'royal_gold',
        labelStyle: 'dhaba_heritage',
        preferredDateTime: '10-Minute Consultation Window (Within 2 Hours)',
        notes: notes.trim(),
      });

      AutomationService.saveOrUpdateLead({
        customerName: ownerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        businessName: restaurantName.trim(),
        location: city.trim(),
        bottleSize: selectedFormats.join(', '),
        customerRequirements: notes.trim(),
        sourcePage: 'In-Page Booking Section',
        leadStatus: 'New',
      });

      // Optional account creation (requires verified OTP)
      let createdAccount = false;
      if (password.trim().length >= 6 && isOtpVerified) {
        CustomerAuthService.register({
          restaurantName: restaurantName.trim(),
          ownerName: ownerName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          city: city.trim(),
          password: password.trim(),
        });
        createdAccount = true;
      }

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#C99B42', '#52652D', '#102C47'],
      });

      soundPlayer.playSuccessChime();
      setIsSubmitting(false);
      setAccountCreated(createdAccount);
      setSubmittedBooking(newBooking);

      if (onBookingSuccess) {
        onBookingSuccess(newBooking);
      }
    }, 450);
  };

  return (
    <section id="book-a-call" className="py-12 sm:py-16 bg-[#FFF9EF] text-[#102C47] relative overflow-hidden font-manrope">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Card */}
        <div className="rounded-3xl bg-[#FFFDF9] border border-[#C99B42]/40 p-6 sm:p-8 md:p-10 shadow-xl relative overflow-hidden">
          
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B42]/40 text-[#52652D] text-xs font-bold shadow-xs">
              <PhoneCall className="w-3.5 h-3.5 text-[#52652D]" />
              <span>DIRECT HOSPITALITY PARTNER DESK</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-playfair text-[#102C47] tracking-tight">
              Book Free Consultation Call
            </h2>
            <p className="text-xs sm:text-sm text-[#77766F]">
              10-minute briefing &amp; free physical sample bottles dispatched to your establishment
            </p>
          </div>

          {submittedBooking ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#52652D]/15 border border-[#52652D]/40 flex items-center justify-center mx-auto text-[#52652D]">
                <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
              </div>
              <h3 className="text-2xl font-bold font-playfair text-[#102C47]">
                {accountCreated
                  ? 'Thank you for creating an account!'
                  : 'Thanks for submitting your request, will reach you soon!'}
              </h3>
              <p className="text-sm text-[#77766F] max-w-md mx-auto">
                {accountCreated ? (
                  <>
                    Welcome, <strong>{submittedBooking.ownerName}</strong>! Your restaurant partner portal has been created. Our team has also confirmed your consultation call request.
                  </>
                ) : (
                  <>
                    Thank you, <strong>{submittedBooking.ownerName}</strong>. Our hospitality team will call{' '}
                    <strong className="text-[#102C47]">{submittedBooking.phone}</strong> regarding{' '}
                    <strong>{submittedBooking.restaurantName}</strong>.
                  </>
                )}
              </p>
              <div className="p-4 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/30 max-w-md mx-auto text-left text-xs space-y-1.5 shadow-xs">
                <div><span className="text-[#77766F]">Reference ID:</span> <strong className="font-mono text-[#102C47]">{submittedBooking.id}</strong></div>
                <div><span className="text-[#77766F]">Selected Formats:</span> <strong className="text-[#52652D]">{submittedBooking.bottleFormats?.join(', ') || submittedBooking.bottleSize}</strong></div>
                <div><span className="text-[#77766F]">Corridor:</span> <strong>{submittedBooking.city}</strong></div>
              </div>
              {onOpenCustomerPortal && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenCustomerPortal(email)}
                    className="btn-gold-luxury px-6 py-2.5 rounded-full text-xs font-bold shadow-md cursor-pointer"
                  >
                    Open Restaurant Tracking Portal
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8A631E] mb-1">
                    Restaurant / Dhaba Name *
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-[#C99B42] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="e.g. Om Dhaba"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8A631E] mb-1">
                    Contact Person Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#C99B42] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Atal Pandey"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8A631E] mb-1">
                    Phone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 62992 93497"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8A631E] mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#C99B42] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="atal@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#8A631E] mb-1">
                    City / Highway Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bettiah, Bihar"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                  />
                </div>
              </div>

              {/* Bottle Formats (Multi-select) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#8A631E] mb-1.5">
                  Bottle Format (Select one or more) *
                </label>
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
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#C99B42] border-[#C99B42] text-[#102C47]'
                              : 'border-[#C99B42]/60 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-bold text-xs sm:text-[13px]">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Partner Account Creation */}
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#52652D]" />
                    <span className="text-[#102C47] font-bold">Create Partner Account (Optional) to track orders:</span>
                  </div>
                  <div className="relative flex items-center rounded-xl bg-white border border-[#C99B42]/35 px-3 py-1.5 w-full sm:w-60">
                    <Key className="w-3.5 h-3.5 text-[#C99B42] mr-2 shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (!e.target.value) {
                          setIsOtpVerified(false);
                        }
                      }}
                      placeholder="Set Password (Optional)"
                      className="w-full bg-transparent text-xs font-semibold focus:outline-none"
                    />
                    {password && (
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
                {password.trim().length > 0 && (
                  <InlineOtpSection
                    email={email}
                    purpose="signup"
                    isVerified={isOtpVerified}
                    onVerified={() => {
                      setIsOtpVerified(true);
                      setErrorMessage(null);
                    }}
                    onResetVerification={() => setIsOtpVerified(false)}
                    pendingData={{
                      restaurantName,
                      ownerName,
                      email,
                      phone,
                      city,
                      password: password.trim(),
                    }}
                  />
                )}
              </div>

              {/* Specific Requests */}
              <div>
                <label className="block text-xs font-semibold text-[#77766F] mb-1">
                  Specific Requests (e.g. Logo placement, QR code, delivery frequency)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Logo placement, QR code, custom typography, delivery frequency, or any special requirements."
                  className="w-full px-4 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                />
              </div>

              {/* DPDP Act 2023 Consent Checkbox */}
              <div className="p-3 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/35">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#555A60] select-none">
                  <div
                    onClick={() => setDpdpConsent(!dpdpConsent)}
                    className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      dpdpConsent
                        ? 'bg-[#C99B42] border-[#C99B42] text-[#102C47]'
                        : 'border-[#C99B42]/60 bg-white'
                    }`}
                  >
                    {dpdpConsent && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="leading-snug">
                    I consent to Harit Jal contacting me and processing my details in accordance with India&apos;s{' '}
                    <strong className="text-[#102C47] font-semibold">Digital Personal Data Protection Act (DPDP Act 2023)</strong>{' '}
                    for sample delivery and consultation.
                  </span>
                </label>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting || (password.trim().length > 0 && !isOtpVerified)}
                className="btn-gold-luxury w-full py-3.5 rounded-full font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <PhoneCall className="w-4 h-4 text-[#102C47]" />
                <span>
                  {isSubmitting
                    ? 'Processing Request...'
                    : password.trim().length > 0
                      ? isOtpVerified
                        ? 'Create Partner Account & Confirm Booking →'
                        : 'Verify Email OTP to Create Account & Submit'
                      : 'Confirm Call Booking & Dispatch Physical Samples →'}
                </span>
                <ArrowRight className="w-4 h-4 text-[#102C47]" />
              </button>
            </form>
          )}

        </div>

      </div>
    </section>
  );
};
