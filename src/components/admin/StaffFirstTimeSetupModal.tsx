import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, QrCode, KeyRound, Copy, Check, AlertTriangle } from 'lucide-react';
import { AdminUser } from '../../types';
import { TotpService } from '../../services/totpService';
import { AdminAuthService, AdminSession } from '../../services/adminAuth';
import { soundPlayer } from '../../services/sound';

interface StaffFirstTimeSetupModalProps {
  user: AdminUser;
  isOpen: boolean;
  onSuccess: (session: AdminSession) => void;
  onCancel: () => void;
}

export const StaffFirstTimeSetupModal: React.FC<StaffFirstTimeSetupModalProps> = ({
  user,
  isOpen,
  onSuccess,
  onCancel,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // TOTP Secret state
  const [totpSecret, setTotpSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or generate TOTP secret on load
  useEffect(() => {
    if (isOpen && user) {
      const secret = user.totpSecret || TotpService.generateSecret(16);
      const url = TotpService.generateOtpAuthUrl(user.email, secret, 'Harit Jal Operations');
      const qr = TotpService.getQrCodeUrl(url);
      setTotpSecret(secret);
      setQrCodeUrl(qr);
      setTotpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleCopySecret = () => {
    if (!totpSecret) return;
    navigator.clipboard.writeText(totpSecret);
    setCopiedSecret(true);
    soundPlayer.playWaterDrop();
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError('Permanent password must be at least 6 characters long.');
      soundPlayer.playBubblePop();
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      soundPlayer.playBubblePop();
      return;
    }

    if (totpCode.trim().length !== 6 || !/^\d{6}$/.test(totpCode.trim())) {
      setError('Please enter the 6-digit code displayed in your Google Authenticator app.');
      soundPlayer.playBubblePop();
      return;
    }

    setIsLoading(true);
    soundPlayer.playWaterDrop();

    try {
      const res = await AdminAuthService.completeFirstTimeSetup(
        user.id,
        newPassword,
        totpCode.trim(),
        totpSecret
      );

      setIsLoading(false);
      if (res.success && res.session) {
        soundPlayer.playSuccessChime();
        onSuccess(res.session);
      } else {
        soundPlayer.playBubblePop();
        setError(res.error || 'Setup failed. Please check your Google Authenticator code.');
      }
    } catch {
      setIsLoading(false);
      setError('An unexpected error occurred during setup. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102C47]/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-[#FFF9EF] border border-[#C99B42]/50 rounded-3xl shadow-2xl overflow-hidden font-manrope text-[#102C47]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#F8F3E9] border-b border-[#C99B42]/30 text-center">
          <div className="w-12 h-12 rounded-full bg-[#102C47] text-[#C99B42] flex items-center justify-center mx-auto mb-3 shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-playfair text-[#102C47]">
            First-Time Staff Security Setup
          </h2>
          <p className="text-xs text-[#77766F] mt-1 max-w-sm mx-auto">
            Welcome, <strong>{user.name}</strong> ({user.designation || user.role}). To protect Harit Jal client data, please set your permanent password and link Google Authenticator.
          </p>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: PERMANENT PASSWORD */}
          <div className="p-4 rounded-2xl bg-white border border-[#C99B42]/35 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#102C47] text-[#FFF9EF] text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#102C47]">
                Create Permanent Password
              </h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                New Administrative Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] pr-10 focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77766F] hover:text-[#102C47] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#77766F] mb-1">
                Confirm Permanent Password *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-1 focus:ring-[#C99B42]"
              />
              {confirmPassword && (
                <p className={`text-[10.5px] mt-1 font-medium ${
                  newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {newPassword === confirmPassword ? '✓ Passwords match' : 'Passwords do not match yet'}
                </p>
              )}
            </div>
          </div>

          {/* STEP 2: GOOGLE AUTHENTICATOR (TOTP) SETUP */}
          <div className="p-4 rounded-2xl bg-white border border-[#C99B42]/35 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#102C47] text-[#FFF9EF] text-xs font-bold flex items-center justify-center">2</span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#102C47]">
                Mandatory Google Authenticator Setup
              </h3>
            </div>

            <p className="text-xs text-[#77766F] leading-relaxed">
              Open <strong>Google Authenticator</strong> on your phone. Tap <strong>+</strong> and scan this QR code, or copy the manual key:
            </p>

            {/* QR Code and Secret Display */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl bg-[#F8F5EC] border border-[#C99A3C]/30">
              <div className="w-28 h-28 bg-white p-1 rounded-xl border border-[#C99A3C]/40 shadow-xs flex items-center justify-center shrink-0">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="Google Authenticator QR Code" className="w-full h-full object-contain" />
                ) : (
                  <QrCode className="w-10 h-10 text-gray-400" />
                )}
              </div>

              <div className="flex-1 w-full space-y-2">
                <span className="text-[11px] text-[#77766F] font-semibold block">Manual Secret Key:</span>
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-[#C99A3C]/30 font-mono text-xs text-[#102C47] font-bold">
                  <span className="tracking-widest flex-1 select-all">{totpSecret}</span>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-1 text-[#77766F] hover:text-[#102C47] cursor-pointer"
                    title="Copy Secret Key"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-[#52652D] font-medium block">
                  Account: Harit Jal ({user.email})
                </span>
              </div>
            </div>

            {/* TOTP Verification Input */}
            <div className="pt-1">
              <label className="block text-xs font-bold text-[#102C47] mb-1">
                Enter 6-Digit App Code to Verify *
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 123456"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/50 text-center font-mono text-lg font-bold tracking-widest text-[#102C47] focus:outline-none focus:ring-2 focus:ring-[#C99B42]"
                />
                <KeyRound className="w-4 h-4 text-[#C99B42] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[10.5px] text-[#77766F] mt-1 text-center">
                Enter the code currently displayed in Google Authenticator to confirm setup.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isLoading || !newPassword || newPassword !== confirmPassword || totpCode.length !== 6}
              className="btn-gold-luxury w-full py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-[#102C47]" />
              <span>{isLoading ? 'Activating Credentials...' : 'Activate Account & Enter Portal →'}</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 rounded-full text-xs font-semibold text-[#77766F] hover:text-[#102C47] hover:bg-[#F8F5EC] transition cursor-pointer text-center"
            >
              Cancel & Exit
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
