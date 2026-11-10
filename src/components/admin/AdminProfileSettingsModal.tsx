import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  KeyRound,
  Check,
  X,
  AlertTriangle,
  Smartphone,
  Mail,
} from 'lucide-react';
import { AdminUser } from '../../types';
import { AdminAuthService } from '../../services/adminAuth';
import { formatRoleDisplay, isAdminRole } from '../../services/roles';
import { getSupabaseClient, isSupabaseConfigured } from '../../services/supabase';
import { soundPlayer } from '../../services/sound';

interface AdminProfileSettingsModalProps {
  isOpen: boolean;
  user: AdminUser;
  onClose: () => void;
  onUpdated: (updatedUser: AdminUser) => void;
}

interface MfaStatusSnapshot {
  loading: boolean;
  currentLevel: string;
  nextLevel: string;
  verifiedCount: number;
  factorId?: string;
  friendlyName?: string;
  source: 'supabase' | 'local_dev';
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
  const [isSaving, setIsSaving] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<MfaStatusSnapshot>({
    loading: true,
    currentLevel: 'checking',
    nextLevel: 'checking',
    verifiedCount: 0,
    source: isSupabaseConfigured() ? 'supabase' : 'local_dev',
  });

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const loadMfaState = async () => {
      const supabase = getSupabaseClient();
      if (!isSupabaseConfigured() || !supabase) {
        await Promise.resolve();
        if (isMounted) {
          setMfaStatus({
            loading: false,
            currentLevel: user.totpEnabled ? 'aal1_dev' : 'aal1',
            nextLevel: user.totpEnabled ? 'aal1_dev' : 'aal1',
            verifiedCount: user.totpEnabled ? 1 : 0,
            source: 'local_dev',
          });
        }
        return;
      }

      try {
        const [{ data: factorData }, { data: aalData }] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);

        const verifiedTotp =
          factorData?.totp?.filter((f) => f.status === 'verified') ||
          factorData?.all?.filter(
            (f) =>
              (f as { factor_type?: string; status?: string }).factor_type === 'totp' &&
              f.status === 'verified'
          ) ||
          [];

        const primaryFactor = verifiedTotp[0] as
          | { id?: string; friendly_name?: string }
          | undefined;

        if (isMounted) {
          setMfaStatus({
            loading: false,
            currentLevel: aalData?.currentLevel || 'aal1',
            nextLevel: aalData?.nextLevel || 'aal1',
            verifiedCount: verifiedTotp.length,
            factorId: primaryFactor?.id,
            friendlyName: primaryFactor?.friendly_name || 'Google Authenticator (TOTP)',
            source: 'supabase',
          });
        }
      } catch {
        if (isMounted) {
          setMfaStatus({
            loading: false,
            currentLevel: 'unavailable',
            nextLevel: 'unavailable',
            verifiedCount: user.totpEnabled ? 1 : 0,
            source: 'supabase',
          });
        }
      }
    };

    void loadMfaState();
    return () => {
      isMounted = false;
    };
  }, [isOpen, user.totpEnabled]);

  if (!isOpen) return null;

  // Lifetime changes count (max 5)
  const changesCount = user.emailPhoneChangesCount || 0;
  const isLimitReached = changesCount >= 5;

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isAdminRole(user.role) && !user.isRootSuperAdmin) {
      setError('Staff accounts cannot update authoritative credentials. Contact Admin.');
      soundPlayer.playBubblePop();
      return;
    }

    if (user.isRootSuperAdmin === true) {
      setError('Root Admin email address and mobile number are permanently bound and immutable.');
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

    setIsSaving(true);
    soundPlayer.playWaterDrop();
    try {
      const res = await AdminAuthService.updateOwnAdminProfile({
        userId: user.id,
        email: cleanEmail,
        phone: cleanPhone,
        name: user.name,
      });

      if (res.success && res.user) {
        soundPlayer.playSuccessChime();
        setEmail(res.user.email);
        setPhone(res.user.phone || cleanPhone);
        setSuccess(
          isSupabaseConfigured()
            ? 'Super Admin profile and Supabase Auth identity updated on server!'
            : 'Admin profile and credentials updated successfully!'
        );
        onUpdated(res.user);
        setTimeout(() => setSuccess(null), 4000);
      } else {
        soundPlayer.playBubblePop();
        setError(res.error || 'Failed to update credentials.');
      }
    } finally {
      setIsSaving(false);
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
                Super Admin Security &amp; Profile
              </h2>
              <p className="text-[11px] text-[#77766F]">
                Role: {formatRoleDisplay(user.role)} • Native Supabase MFA Status
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
            <div
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isLimitReached
                  ? 'bg-red-100 text-red-800 border-red-300'
                  : 'bg-[#F8F5EC] text-[#52652D] border-[#C99A3C]/40'
              }`}
            >
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
                disabled={isLimitReached || isSaving}
                className="btn-gold-luxury w-full py-2.5 rounded-full font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLimitReached
                  ? 'Lifetime Limit Reached (Locked)'
                  : isSaving
                    ? 'Saving Authoritative Profile...'
                    : 'Save Contact Changes'}
              </button>
            </div>
          </form>

          {/* LIVE NATIVE GOTRUE MFA FACTOR STATUS (NO CLIENT-SIDE SECRET EXPOSURE) */}
          <div className="p-4 rounded-2xl bg-white border border-[#C99B42]/35 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#C99B42]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#102C47]">
                  Google Authenticator Native MFA
                </h3>
              </div>

              <span
                className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                  mfaStatus.currentLevel === 'aal2'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {mfaStatus.loading ? 'Checking...' : `Assurance: ${mfaStatus.currentLevel.toUpperCase()}`}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F8F5EC] border border-[#C99A3C]/30 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#77766F]">Verified TOTP Factors:</span>
                <strong className="text-[#102C47] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{mfaStatus.verifiedCount} Active</span>
                </strong>
              </div>
              {mfaStatus.factorId && (
                <div className="flex items-center justify-between">
                  <span className="text-[#77766F]">Active Factor ID:</span>
                  <span className="font-mono text-[11px] text-[#102C47]">{mfaStatus.factorId}</span>
                </div>
              )}
              {mfaStatus.friendlyName && (
                <div className="flex items-center justify-between">
                  <span className="text-[#77766F]">Authenticator Device:</span>
                  <span className="font-semibold text-[#102C47]">{mfaStatus.friendlyName}</span>
                </div>
              )}
            </div>

            <p className="text-[10.5px] text-[#77766F] leading-relaxed">
              For security compliance, TOTP seeds are stored encrypted inside Supabase Auth GoTrue (`auth.mfa_factors`) and are never exposed after initial QR enrollment. Every privileged action is enforced server-side at <strong>AAL2</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
