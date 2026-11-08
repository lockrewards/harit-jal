import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { PhoneCall, Mail, MapPin, Building, User, Send, CheckCircle2, Droplets, Clock, ShieldCheck, Lock } from 'lucide-react';
import { StorageService } from '../services/storage';
import { CustomerAuthService } from '../services/customerAuth';
import { soundPlayer } from '../services/sound';
import { CallBooking } from '../types';

interface ContactPageProps {
  onOpenCustomerPortal?: (email: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onOpenCustomerPortal }) => {
  const [restaurantName, setRestaurantName] = useState('Karan The Dhaba');
  const [ownerName, setOwnerName] = useState('Karanpreet Singh');
  const [phone, setPhone] = useState('+91 62992 93497');
  const [email, setEmail] = useState('info@haritjal.in');
  const [city, setCity] = useState('Murthal, GT Road, Haryana');
  const [bottleSize, setBottleSize] = useState<'250ml' | '500ml' | '750ml_glass' | '1000ml'>('500ml');
  const [dailyRequirement, setDailyRequirement] = useState<number>(120);
  const [message, setMessage] = useState('Interested in 500ml glass bottles with custom logo and menu QR code.');
  const [password, setPassword] = useState('password123');
  const [dpdpConsent, setDpdpConsent] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedBooking, setSubmittedBooking] = useState<CallBooking | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dpdpConsent) {
      alert('Please agree to the DPDP Act 2023 data processing terms to submit your consultation request.');
      return;
    }
    setIsSubmitting(true);
    soundPlayer.playWaterDrop();

    setTimeout(() => {
      const newBooking = StorageService.addBooking({
        restaurantName: restaurantName.trim() || 'My Restaurant',
        ownerName: ownerName.trim() || 'Restaurant Owner',
        phone: phone.trim() || '+91 62992 93497',
        email: email.trim() || 'info@haritjal.in',
        city: city.trim() || 'Delhi NCR',
        bottleSize,
        monthlyVolume: dailyRequirement * 30,
        capColor: 'royal_gold',
        labelStyle: 'classic_luxury',
        preferredDateTime: 'Within 24 Hours',
        notes: message.trim(),
      });

      // Register customer account for seamless order tracking
      CustomerAuthService.register({
        restaurantName: restaurantName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        password: password.trim(),
      });

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#C99B42', '#52652D', '#102C47'],
      });

      soundPlayer.playSuccessChime();
      setIsSubmitting(false);
      setSubmittedBooking(newBooking);
    }, 500);
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
                      placeholder="e.g. Karan The Dhaba"
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
                      placeholder="e.g. Karanpreet Singh"
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
                      placeholder="+91 62992 93497"
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
                      placeholder="owner@restaurant.com"
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
                      placeholder="e.g. Murthal, GT Road, Haryana"
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
                      type="number"
                      min="1"
                      max="10000"
                      value={dailyRequirement || ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
                        setDailyRequirement(val);
                      }}
                      placeholder="120"
                      className="w-28 px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/40 text-sm font-bold text-[#102C47] focus:outline-none focus:ring-2 focus:ring-[#C99B42] shadow-inner text-center"
                    />
                    <span className="text-xs font-bold text-[#102C47]">
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
                    placeholder="Tell us about your menu, logo preferences, or target launch date..."
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
                      className="mt-0.5 w-4 h-4 rounded text-[#102C47] accent-[#C99B42] border-[#C99B42]/50 focus:ring-[#C99B42] cursor-pointer shrink-0"
                    />
                    <span className="leading-snug">
                      I consent to Harit Jal processing my contact details for sample dispatch, order logistics, and hospitality consultation in full accordance with India&apos;s <strong className="text-[#102C47] font-semibold">Digital Personal Data Protection Act (DPDP Act 2023)</strong>. Your data is strictly encrypted and never shared.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-gold-luxury w-full py-3.5 rounded-full font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4 text-[#102C47]" />
                  <span>{isSubmitting ? 'Submitting Enquiry...' : 'Submit Enquiry & Request Physical Samples'}</span>
                </button>
              </form>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

