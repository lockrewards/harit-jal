import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { PhoneCall, Mail, MapPin, Send, CheckCircle2, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { StorageService } from '../services/storage';
import { AutomationService } from '../services/automationService';
import { ResendService } from '../services/resendService';
import { SupabaseService, isSupabaseConfigured } from '../services/supabase';
import { soundPlayer } from '../services/sound';
import { CallBooking } from '../types';
import { LoadingButton } from '../components/ui/LoadingButton';

export const ContactPage: React.FC = () => {
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [bottleSize, setBottleSize] = useState<'250ml' | '500ml' | '750ml_glass' | '1000ml'>('500ml');
  const [dailyRequirement, setDailyRequirement] = useState<string>('');
  const [message, setMessage] = useState('');
  const [dpdpConsent, setDpdpConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedBooking, setSubmittedBooking] = useState<CallBooking | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!dpdpConsent) {
      alert('Please agree to the DPDP Act 2023 data processing terms to submit your consultation request.');
      return;
    }
    setIsSubmitting(true);
    soundPlayer.playWaterDrop();

    try {
      const cleanRestaurant = restaurantName.trim() || 'My Restaurant';
      const cleanOwner = ownerName.trim() || 'Restaurant Owner';
      const cleanPhone = phone.trim() || '+91 62992 93497';
      const cleanEmail = email.trim().toLowerCase();
      const cleanCity = city.trim() || 'Delhi NCR';

      const cleanRequirements = message.trim();
      const newBooking = StorageService.addBooking({
        restaurantName: cleanRestaurant,
        ownerName: cleanOwner,
        phone: cleanPhone,
        email: cleanEmail,
        city: cleanCity,
        bottleSize,
        monthlyVolume: (parseInt(dailyRequirement, 10) || 100) * 30,
        capColor: 'royal_gold',
        labelStyle: 'classic_luxury',
        preferredDateTime: 'Within 24 Hours',
        notes: cleanRequirements,
        source: 'contact_page',
      });

      const dbNotes = cleanRequirements
        ? `[Source: Website Form (Contact Page)] ${cleanRequirements}`
        : '[Source: Website Form (Contact Page)] Sample bottle & proposal request';

      const leadSynced = await SupabaseService.syncConsultationLead({
        id: newBooking.id,
        restaurantName: newBooking.restaurantName,
        ownerName: newBooking.ownerName,
        phone: newBooking.phone,
        email: newBooking.email,
        city: newBooking.city,
        preferredTime: newBooking.preferredDateTime,
        bottleTypes: [bottleSize],
        notes: dbNotes,
        status: newBooking.status,
      });

      if (isSupabaseConfigured() && !leadSynced) {
        StorageService.setBookings(
          StorageService.getBookings().filter((b) => b.id !== newBooking.id)
        );
        soundPlayer.playBubblePop();
        setSubmitError(
          'Unable to submit your enquiry to our cloud server right now. Please try again shortly or call +91 62992 93497 directly.'
        );
        return;
      }

      AutomationService.saveOrUpdateLead({
        id: newBooking.id,
        customerName: cleanOwner,
        email: cleanEmail,
        phone: cleanPhone,
        businessName: cleanRestaurant,
        location: cleanCity,
        bottleSize,
        customerRequirements: cleanRequirements,
        sourcePage: 'Website Form (Contact Page)',
        inquirySource: 'contact_page',
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
          bottleSize,
          customerRequirements: cleanRequirements,
          sourcePage: 'Website Form (Contact Page)',
        });
      }

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#C99B42', '#52652D', '#102C47'],
      });

      soundPlayer.playSuccessChime();
      setSubmittedBooking(newBooking);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-20 sm:pt-22 pb-12 md:pb-14 bg-[#F8F3E9] text-[#102C47] font-manrope min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9EF] border border-[#C99B42]/40 text-[#52652D] text-xs font-bold mb-2.5 shadow-xs">
            <PhoneCall className="w-3.5 h-3.5 text-[#52652D]" />
            <span>HOSPITALITY ENQUIRY & SAMPLE REQUESTS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[44px] font-bold font-playfair text-[#102C47] tracking-tight leading-tight">
            Schedule a Consultation & <br className="hidden sm:inline" />
            <span className="font-playfair italic text-[#C99B42]">
              Receive Free Sample Bottles.
            </span>
          </h1>
          <p className="mt-2 text-[#77766F] text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto">
            Speak directly with our hospitality branding consultants. We will evaluate your dining requirements, prepare digital label proofs, and dispatch physical samples to your establishment.
          </p>
        </div>

        {/* 2-Column Layout: Direct Details on Left, Form on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start max-w-6xl mx-auto">
          
          {/* Direct Details (5 Cols) */}
          <div className="lg:col-span-5 space-y-4 sm:space-y-5">
            
            <div className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#102C47] text-[#FFF9EF] shadow-md border border-[#C99B42]/30 space-y-4">
              <h3 className="text-xl font-bold font-playfair text-[#FFF9EF]">
                Hospitality Partner Desk
              </h3>
              <p className="text-xs text-[#FFF9EF]/80 leading-relaxed">
                Our team is available 7 days a week to assist restaurant owners, hotel F&B managers, and banquet banquet directors across India.
              </p>

              <div className="space-y-4 pt-2 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF9EF]/10 flex items-center justify-center text-[#C99B42] shrink-0 mt-0.5">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#C99B42] uppercase font-bold block">DIRECT HELPLINE</span>
                    <a href="tel:+916299293497" className="font-bold text-sm text-[#FFF9EF] font-mono hover:text-[#C99B42] transition block">
                      +91 62992 93497
                    </a>
                    <span className="text-[10px] text-[#FFF9EF]/70 block">Direct B2B Partner Desk</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF9EF]/10 flex items-center justify-center text-[#C99B42] shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#C99B42] uppercase font-bold block">OFFICIAL DESK EMAIL</span>
                    <a href="mailto:info@haritjal.in" className="font-medium text-xs text-[#FFF9EF] font-mono hover:text-[#C99B42] transition block">
                      info@haritjal.in
                    </a>
                    <span className="text-[10px] text-[#FFF9EF]/70 block">Response within 2 hours</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF9EF]/10 flex items-center justify-center text-[#C99B42] shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-[#C99B42] uppercase font-bold block">REGISTERED ADDRESS &amp; HEADQUARTERS</span>
                    <span className="font-medium text-xs text-[#FFF9EF] block">Banuchhapar, Bettiah, Bihar India</span>
                    <span className="text-[10px] text-[#FFF9EF]/70 block mt-0.5">Express Supply: Pan-India Hospitality Corridors</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#C99B42]/20 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-[11px] text-[#C99B42]">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Samples dispatched via express courier within 48h</span>
                </div>
                <div className="p-3 rounded-2xl bg-[#FFF9EF]/10 border border-[#C99B42]/30 flex items-start gap-2.5 text-[11px] text-[#FFF9EF]/90">
                  <ShieldCheck className="w-4 h-4 text-[#C99B42] shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong className="text-[#C99B42]">DPDP Act 2023 Compliant:</strong> Client contact details, billing records, and label artworks are encrypted (AES-256). Zero third-party sharing.
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#FFF9EF] border border-[#C99B42]/30 shadow-xs space-y-2.5">
              <h4 className="font-bold font-playfair text-base text-[#102C47]">
                What Happens Next?
              </h4>
              <ul className="space-y-2 text-xs text-[#77766F]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#52652D] shrink-0 mt-0.5" />
                  <span>A dedicated relationship manager calls you at your preferred time.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#52652D] shrink-0 mt-0.5" />
                  <span>We create a complimentary bespoke digital proof using your restaurant logo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#52652D] shrink-0 mt-0.5" />
                  <span>Physical sample bottles are couriered directly to your restaurant address.</span>
                </li>
              </ul>
            </div>

          </div>

          {/* Form (7 Cols) */}
          <div className="lg:col-span-7 bg-[#FFF9EF] border border-[#C99B42]/35 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm">
            {submittedBooking ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#52652D]/15 border border-[#52652D]/30 flex items-center justify-center mx-auto text-[#52652D]">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold font-playfair text-[#102C47]">
                  Enquiry Received!
                </h3>
                <p className="text-xs sm:text-sm text-[#77766F] max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{submittedBooking.ownerName}</strong>. Our senior consultant will reach out to you at{' '}
                  <strong className="text-[#102C47]">{submittedBooking.phone}</strong> regarding custom bottles for{' '}
                  <strong>{submittedBooking.restaurantName}</strong>.
                </p>

                <div className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/30 max-w-sm mx-auto text-left text-xs space-y-1">
                  <div><span className="text-[#77766F]">Reference ID:</span> <strong className="font-mono text-[#102C47]">{submittedBooking.id}</strong></div>
                  <div><span className="text-[#77766F]">Selected Format:</span> <strong>{submittedBooking.bottleSize}</strong></div>
                  <div><span className="text-[#77766F]">Location:</span> <strong>{submittedBooking.city}</strong></div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => setSubmittedBooking(null)}
                    className="px-6 py-2.5 rounded-full bg-[#102C47] text-[#FFF9EF] text-xs font-bold hover:bg-[#183C60] transition cursor-pointer"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-lg font-bold font-playfair text-[#102C47] pb-2 border-b border-[#C99B42]/20">
                  Request Sample Bottles & Proposal
                </h3>

                {submitError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#52652D] mb-1">
                      Restaurant / Business Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={restaurantName}
                      onChange={(e) => setRestaurantName(e.target.value)}
                      placeholder="Your business name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#52652D] mb-1">
                      Owner / Manager Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#52652D] mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="1234567890"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#52652D] mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#52652D] mb-1">
                      Establishment Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Your business location"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102B46] font-semibold focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#52652D] mb-1">
                      Required Bottle Size *
                    </label>
                    <select
                      value={bottleSize}
                      onChange={(e) => setBottleSize(e.target.value as typeof bottleSize)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs font-semibold text-[#102C47] focus:outline-none"
                    >
                      <option value="250ml">250ml Pocket (Cafes & Takeaway)</option>
                      <option value="500ml">500ml Dine-In Cylinder</option>
                      <option value="750ml_glass">750ml Heavy Flint Glass Decanter</option>
                      <option value="1000ml">1000ml Family Banquet Format</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#52652D] mb-1.5">
                    Approximate Daily Dining Tables / Turnover
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      value={dailyRequirement}
                      onChange={(e) => setDailyRequirement(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Enter approximate daily tables"
                      className="w-full sm:w-72 px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/40 text-xs sm:text-sm font-semibold text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                    />
                    <span className="text-xs font-bold text-[#102C47] shrink-0">
                      tables/day
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#77766F] mb-1">
                    Additional Message or Specific Customization Needs
                  </label>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your requirements (e.g., custom logo, label, QR code, etc.)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                  />
                </div>

                {/* DPDP Act 2023 Consent Checkbox */}
                <div className="p-3 rounded-2xl bg-white border border-[#C99B42]/30 shadow-2xs">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#555A60] select-none">
                    <input
                      type="checkbox"
                      required
                      checked={dpdpConsent}
                      onChange={(e) => setDpdpConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#102C47] accent-[#0F3826] border-[#C99B42]/50 focus:ring-[#0F3826] cursor-pointer shrink-0"
                    />
                    <span className="leading-snug">
                      I consent to Harit Jal processing my contact details for sample dispatch, order logistics, and hospitality consultation in full accordance with India&apos;s <strong className="text-[#102C47] font-semibold">Digital Personal Data Protection Act (DPDP Act 2023)</strong>. Your data is strictly encrypted and never shared.
                    </span>
                  </label>
                </div>

                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Submitting Your Request..."
                  variant="navy"
                  className="w-full py-3.5 rounded-full text-white font-bold text-sm shadow-md cursor-pointer"
                  leftIcon={<Send className="w-4 h-4 text-white" />}
                >
                  Submit Enquiry & Request Physical Samples
                </LoadingButton>
              </form>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

