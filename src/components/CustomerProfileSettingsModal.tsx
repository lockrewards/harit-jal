import React, { useState } from 'react';
import { UserCheck, Mail, Smartphone, MapPin, Building, X, Check, AlertTriangle } from 'lucide-react';
import { CustomerAccount } from '../types';
import { CustomerAuthService } from '../services/customerAuth';
import { soundPlayer } from '../services/sound';

interface CustomerProfileSettingsModalProps {
  isOpen: boolean;
  customer: CustomerAccount;
  onClose: () => void;
  onUpdated: (updatedCustomer: CustomerAccount) => void;
}

export const CustomerProfileSettingsModal: React.FC<CustomerProfileSettingsModalProps> = ({
  isOpen,
  customer,
  onClose,
  onUpdated,
}) => {
  const [ownerName, setOwnerName] = useState(customer.ownerName);
  const [restaurantName, setRestaurantName] = useState(customer.restaurantName);
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone);
  const [city, setCity] = useState(customer.city);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const changesCount = customer.emailPhoneChangesCount || 0;
  const isLimitReached = changesCount >= 5;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanEmail || !cleanPhone || !ownerName.trim() || !restaurantName.trim()) {
      setError('Restaurant Name, Owner Name, Email, and Phone are required.');
      soundPlayer.playBubblePop();
      return;
    }

    setIsSubmitting(true);
    soundPlayer.playWaterDrop();

    const res = CustomerAuthService.updateCustomerProfile(
      customer.id,
      cleanEmail,
      cleanPhone,
      ownerName.trim(),
      restaurantName.trim(),
      city.trim()
    );

    setIsSubmitting(false);
    if (res.success && res.customer) {
      soundPlayer.playSuccessChime();
      setSuccess('Profile updated successfully!');
      onUpdated(res.customer);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      soundPlayer.playBubblePop();
      setError(res.error || 'Failed to update profile.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102C47]/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-[#FFF9EF] border border-[#C99B42]/50 rounded-3xl shadow-2xl overflow-hidden font-manrope text-[#102C47]">
        
        {/* Header */}
        <div className="p-5 bg-[#F8F3E9] border-b border-[#C99B42]/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#102C47] text-[#C99B42] flex items-center justify-center shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-playfair text-[#102C47]">
                Restaurant Partner Profile
              </h2>
              <p className="text-[11px] text-[#77766F]">
                Update your contact details and restaurant preferences.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#102C47]/10 text-[#77766F] hover:text-[#102C47] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* LIFETIME CHANGES QUOTA BADGE */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#C99B42]/35 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#77766F] block">
                Lifetime Modifications Quota
              </span>
              <p className="text-xs text-[#102C47] font-semibold mt-0.5">
                Email / Mobile updates allowed: <strong>5 maximum</strong>
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isLimitReached
                ? 'bg-red-100 text-red-800 border-red-300'
                : 'bg-[#F8F5EC] text-[#52652D] border-[#C99A3C]/40'
            }`}>
              {changesCount} of 5 used
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                Restaurant / Dhaba Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                />
                <Building className="w-4 h-4 text-[#C99B42] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                Owner / Manager Name *
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                Email Address *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  disabled={isLimitReached}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42] disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <Mail className="w-4 h-4 text-[#C99B42] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                Mobile Phone Number *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  disabled={isLimitReached}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42] disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <Smartphone className="w-4 h-4 text-[#C99B42] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                City / Location *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                />
                <MapPin className="w-4 h-4 text-[#C99B42] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-gold-luxury w-full py-3 rounded-full font-bold text-xs sm:text-sm shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Updating Profile...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

