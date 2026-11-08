import React, { useState } from 'react';
import { Shield, KeyRound, Copy, Check, X, AlertTriangle, Smartphone, Mail } from 'lucide-react';
import { AdminUser } from '../../types';
import { StorageService } from '../../services/storage';
import { TotpService } from '../../services/totpService';
import { soundPlayer } from '../../services/sound';

interface AdminProfileSettingsModalProps {
  isOpen: boolean;
  user: AdminUser;
  onClose: () => void;
  onUpdated: (updatedUser: AdminUser) => void;
}

export const AdminProfileSettingsModal: React.FC<AdminProfileSettingsModalProps> = ({
  isOpen,
  user,
  onClose,
  onUpdated,
}) => {
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  // Lifetime changes count (max 5)
  const changesCount = user.emailPhoneChangesCount || 0;
  const isLimitReached = changesCount >= 5;

  const totpSecret = user.totpSecret || 'JBSWY3DPEHPK3PXP';
  const otpAuthUrl = TotpService.generateOtpAuthUrl(user.email, totpSecret, 'Harit Jal Super Admin');
  const qrCodeUrl = TotpService.getQrCodeUrl(otpAuthUrl);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(totpSecret);
    setCopiedSecret(true);
    soundPlayer.playWaterDrop();
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (user.role !== 'Super Admin') {
      setError('Staff accounts cannot update credentials. Contact Super Admin.');
      soundPlayer.playBubblePop();
      return;
    }

    if (isLimitReached) {
      setError('Lifetime modification limit reached. You can only update your email or mobile number 5 times.');
      soundPlayer.playBubblePop();
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanEmail || !cleanPhone) {
      setError('Both Email Address and Mobile Number are required.');
      soundPlayer.playBubblePop();
      return;
    }

    const res = StorageService.updateAdminProfile(user.id, cleanEmail, cleanPhone);
    if (res.success && res.user) {
      soundPlayer.playSuccessChime();
      setSuccess('Admin profile and credentials updated successfully!');
      onUpdated(res.user);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      soundPlayer.playBubblePop();
      setError(res.error || 'Failed to update credentials.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102C47]/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-[#FFF9EF] border border-[#C99B42]/50 rounded-3xl shadow-2xl overflow-hidden font-manrope text-[#102C47]">
        
        {/* Header */}
        <div className="p-5 bg-[#F8F3E9] border-b border-[#C99B42]/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#102C47] text-[#C99B42] flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-playfair text-[#102C47]">
                Super Admin Security & Profile
              </h2>
              <p className="text-[11px] text-[#77766F]">
                Manage authoritative admin contact and Google Authenticator 2FA.
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
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          
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

          {/* EDIT CONTACT FORM */}
          <form onSubmit={handleSaveContact} className="p-4 rounded-2xl bg-white border border-[#C99B42]/35 space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#102C47] flex items-center gap-1.5">
              <span>Authoritative Contact Information</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                Admin Email ID *
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  disabled={isLimitReached}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42] disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <Mail className="w-4 h-4 text-[#C99B42] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                Admin Mobile Phone Number *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  disabled={isLimitReached}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42] disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <Smartphone className="w-4 h-4 text-[#C99B42] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isLimitReached}
                className="btn-gold-luxury w-full py-2.5 rounded-full font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLimitReached ? 'Lifetime Limit Reached (Locked)' : 'Save Contact Changes'}
              </button>
            </div>
          </form>

          {/* GOOGLE AUTHENTICATOR (TOTP) KEY & QR DISPLAY */}
          <div className="p-4 rounded-2xl bg-white border border-[#C99B42]/35 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#C99B42]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#102C47]">
                  Google Authenticator (TOTP) Secret
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="text-[11px] font-bold text-[#52652D] hover:underline cursor-pointer"
              >
                {showQr ? 'Hide QR Code' : 'Show QR Code'}
              </button>
            </div>

            {showQr && (
              <div className="flex flex-col items-center p-3 rounded-xl bg-[#F8F5EC] border border-[#C99A3C]/30 animate-fadeIn">
                <div className="w-32 h-32 bg-white p-1 rounded-xl border border-[#C99A3C]/40 shadow-xs mb-2">
                  <img src={qrCodeUrl} alt="Google Authenticator QR" className="w-full h-full object-contain" />
                </div>
                <span className="text-[10.5px] text-[#77766F] text-center">
                  Scan with Google Authenticator app on iOS or Android.
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-[#F8F5EC] px-3 py-2 rounded-xl border border-[#C99A3C]/30 font-mono text-xs text-[#102C47] font-bold">
              <span className="tracking-widest flex-1 select-all">{totpSecret}</span>
              <button
                type="button"
                onClick={handleCopySecret}
                className="p-1 text-[#77766F] hover:text-[#102C47] cursor-pointer"
                title="Copy Secret"
              >
                {copiedSecret ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-[#77766F]">
              Every administrative login requires the live 6-digit code from Google Authenticator.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
