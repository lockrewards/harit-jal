import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  QrCode,
  Copy,
  Check,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { AdminUser } from '../../types';
import { AdminAuthService, AdminSession } from '../../services/adminAuth';
import { formatRoleDisplay } from '../../services/roles';
import { TotpService } from '../../services/totpService';
import { getSupabaseClient, isSupabaseConfigured } from '../../services/supabase';
import { soundPlayer } from '../../services/sound';
import { LoadingButton } from '../ui/LoadingButton';

interface MfaEnrollmentModalProps {
  user: AdminUser;
  isOpen: boolean;
  onSuccess: (session: AdminSession) => void;
  onCancel: () => void;
}

export const MfaEnrollmentModal: React.FC<MfaEnrollmentModalProps> = ({
  user,
  isOpen,
  onSuccess,
  onCancel,
}) => {
  const [factorId, setFactorId] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [isEnrolling, setIsEnrolling] = useState(true);
  const [hasExistingVerifiedFactor, setHasExistingVerifiedFactor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user) return;
    let isMounted = true;

    const initNativeMfaEnrollment = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      setIsEnrolling(true);
      setHasExistingVerifiedFactor(false);
      setError(null);

      const supabase = getSupabaseClient();
      if (!isSupabaseConfigured() || !supabase) {
        if (isMounted) {
          setError('Supabase Auth connection is mandatory to enroll Google Authenticator MFA.');
          setIsEnrolling(false);
        }
        return;
      }

      try {
        const { data: existing } = await supabase.auth.mfa.listFactors();
        const combinedFactors = [...(existing?.all || []), ...(existing?.totp || [])];

        // Reuse existing verified TOTP factor instead of failing on collision (MED-H3-02 recovery)
        const existingVerified = combinedFactors.find(
          (f) =>
            (f as { factor_type?: string; status?: string }).factor_type === 'totp' &&
            f.status === 'verified'
        ) as { id: string } | undefined;

        if (existingVerified?.id) {
          if (isMounted) {
            setFactorId(existingVerified.id);
            setHasExistingVerifiedFactor(true);
            setTotpSecret('');
            setQrCodeUrl('');
            setIsEnrolling(false);
          }
          return;
        }

        // Unenroll any stale unverified TOTP factors to prevent collision errors
        const staleUnverified = combinedFactors.filter(
          (f, idx, arr) =>
            (f as { factor_type?: string; status?: string }).factor_type === 'totp' &&
            f.status === 'unverified' &&
            arr.findIndex((item) => item.id === f.id) === idx
        );

        for (const stale of staleUnverified) {
          await supabase.auth.mfa.unenroll({ factorId: stale.id }).catch(() => {});
        }

        let { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'Harit Jal Operations',
          friendlyName: `Harit Jal Authenticator (${user.email})`,
        });

        if (enrollError || !data) {
          const { data: recheckFactors } = await supabase.auth.mfa
            .listFactors()
            .catch(() => ({ data: null }));
          const recheckCombined = [
            ...(recheckFactors?.all || []),
            ...(recheckFactors?.totp || []),
          ];
          const recoveredVerified = recheckCombined.find(
            (f) =>
              (f as { factor_type?: string; status?: string }).factor_type === 'totp' &&
              f.status === 'verified'
          ) as { id: string } | undefined;

          if (recoveredVerified?.id) {
            if (isMounted) {
              setFactorId(recoveredVerified.id);
              setHasExistingVerifiedFactor(true);
              setTotpSecret('');
              setQrCodeUrl('');
              setIsEnrolling(false);
            }
            return;
          }

          const retryRes = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'Harit Jal Operations',
            friendlyName: `Harit Jal Authenticator (${user.email}) #${Date.now().toString().slice(-4)}`,
          });
          data = retryRes.data;
          enrollError = retryRes.error;
        }

        if (!isMounted) return;

        if (enrollError || !data) {
          setError(
            `Native MFA enrollment failed: ${enrollError?.message || 'Unable to register TOTP factor.'}`
          );
          setIsEnrolling(false);
          return;
        }

        setFactorId(data.id);
        setHasExistingVerifiedFactor(false);
        setTotpSecret(data.totp.secret);
        if (data.totp.qr_code && data.totp.qr_code.startsWith('<svg')) {
          setQrCodeUrl(`data:image/svg+xml;utf8,${encodeURIComponent(data.totp.qr_code)}`);
        } else if (data.totp.qr_code && data.totp.qr_code.startsWith('data:')) {
          setQrCodeUrl(data.totp.qr_code);
        } else if (data.totp.uri) {
          setQrCodeUrl(TotpService.getQrCodeUrl(data.totp.uri));
        }
        setIsEnrolling(false);
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Connection failed.';
          setError(`Native MFA service unavailable: ${message}`);
          setIsEnrolling(false);
        }
      }
    };

    void initNativeMfaEnrollment();
    return () => {
      isMounted = false;
    };
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

    const cleanCode = totpCode.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setError('Please enter a valid 6-digit numeric code from Google Authenticator.');
      soundPlayer.playBubblePop();
      return;
    }

    const supabase = getSupabaseClient();
    if (!isSupabaseConfigured() || !supabase || !factorId) {
      setError('TOTP factor is not initialized. Please close and re-attempt sign-in.');
      soundPlayer.playBubblePop();
      return;
    }

    setIsSubmitting(true);
    soundPlayer.playWaterDrop();

    try {
      // Browser session MUST perform challengeAndVerify to reach AAL2 before server completion
      const { error: challengeError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: cleanCode,
      });

      if (challengeError) {
        setIsSubmitting(false);
        soundPlayer.playBubblePop();
        setError(
          `Verification failed: ${challengeError.message || 'Please enter the current 6-digit code from Google Authenticator.'}`
        );
        return;
      }

      const completion = await AdminAuthService.completeMfaEnrollment(user, factorId);
      setIsSubmitting(false);

      if (completion.success && completion.session) {
        soundPlayer.playSuccessChime();
        onSuccess(completion.session);
      } else {
        soundPlayer.playBubblePop();
        setError(completion.error || 'Could not finalize MFA enrollment on server.');
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      soundPlayer.playBubblePop();
      const message = err instanceof Error ? err.message : 'Unexpected MFA verification error.';
      setError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#102C47]/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-lg bg-[#FFF9EF] border border-[#C99B42]/50 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden font-manrope text-[#102C47] flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-[#F8F3E9] border-b border-[#C99B42]/30 text-center shrink-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#102C47] text-[#C99B43] flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-md">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <h2 className="text-lg sm:text-2xl font-bold font-playfair text-[#102C47]">
            Enroll Google Authenticator (AAL2)
          </h2>
          <p className="text-xs text-[#77766F] mt-1 max-w-sm mx-auto">
            <strong>{user.name}</strong> ({user.designation || formatRoleDisplay(user.role)}), privileged portal actions require a verified authenticator factor.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-white border border-[#C99B42]/35 space-y-3">
            {hasExistingVerifiedFactor ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Verified Google Authenticator Factor Found</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  An active authenticator factor is already enrolled for <strong>{user.email}</strong>. Enter your live 6-digit code below to elevate your session to AAL2 and enter the portal.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-[#77766F] leading-relaxed">
                  Scan this QR code in <strong>Google Authenticator</strong> (or Authy / 1Password) to bind your Harit Jal corporate account to cryptographic AAL2 verification:
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl bg-[#F8F5EC] border border-[#C99A3C]/30">
                  <div className="w-28 h-28 bg-white p-1 rounded-xl border border-[#C99A3C]/40 shadow-xs flex items-center justify-center shrink-0">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="Google Authenticator Enrollment QR Code"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <QrCode className="w-10 h-10 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <span className="text-[11px] text-[#77766F] font-semibold block">
                      {isEnrolling ? 'Generating cryptographic TOTP factor...' : 'Manual Secret Key:'}
                    </span>
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-[#C99A3C]/30 font-mono text-xs text-[#102C47] font-bold">
                      <span className="tracking-widest flex-1 select-all break-all">
                        {totpSecret || 'Initializing...'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        disabled={!totpSecret}
                        className="p-1 text-[#77766F] hover:text-[#102C47] cursor-pointer disabled:opacity-40"
                        title="Copy Secret Key"
                      >
                        {copiedSecret ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <span className="text-[10px] text-[#52652D] font-medium block">
                      Account: Harit Jal ({user.email})
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="pt-1">
              <label className="block text-xs font-bold text-[#102C47] mb-1">
                Enter 6-Digit Authenticator Code to Verify *
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FFF9EF] border border-[#C99B42]/50 text-center font-mono text-lg font-bold tracking-widest text-[#102C47] focus:outline-none focus:ring-2 focus:ring-[#C99B42]"
                />
                <KeyRound className="w-4 h-4 text-[#C99B42] absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="pt-1 space-y-2">
            <LoadingButton
              type="submit"
              isLoading={isSubmitting || isEnrolling}
              loadingText={isEnrolling ? 'Generating MFA Factor...' : 'Verifying & Elevating to AAL2...'}
              disabled={!factorId || totpCode.length !== 6}
              variant="gold"
              className="w-full py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-md"
              leftIcon={<Lock className="w-4 h-4 text-[#102C47]" />}
            >
              Verify Authenticator & Enter Portal →
            </LoadingButton>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 rounded-full text-xs font-semibold text-[#77766F] hover:text-[#102C47] hover:bg-[#F8F5EC] transition cursor-pointer text-center"
            >
              Cancel &amp; Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

