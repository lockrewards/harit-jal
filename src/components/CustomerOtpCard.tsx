import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, Clock, RefreshCw, KeyRound, Lock, Eye, EyeOff, AlertTriangle, ArrowLeft, CheckCircle2
} from 'lucide-react';
import { OtpService } from '../services/otpService';
import { soundPlayer } from '../services/sound';

interface CustomerOtpCardProps {
  email: string;
  purpose: 'signup' | 'forgot_password';
  pendingData?: any;
  onSuccess: (result: { verified: boolean; newPassword?: string; pendingData?: any }) => void;
  onCancel: () => void;
  onBackToLogin?: () => void;
}

export const CustomerOtpCard: React.FC<CustomerOtpCardProps> = ({
  email,
  purpose,
  pendingData,
  onSuccess,
  onCancel,
  onBackToLogin,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPasswordInputRef = useRef<HTMLInputElement | null>(null);

  // 2-Step Forgot Password state: Step 1 = OTP verify, Step 2 = Set new password
  const [isOtpVerified, setIsOtpVerified] = useState(false);

  // Password reset fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Timers
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState<boolean>(() => OtpService.checkBlockStatus(email).isBlocked);
  const [blockMessage, setBlockMessage] = useState<string | null>(() => {
    const check = OtpService.checkBlockStatus(email);
    return check.isBlocked
      ? `This email is blocked for 24 hours due to multiple failed verification attempts. Remaining: ${check.remainingFormatted}.`
      : null;
  });

  const [validitySeconds, setValiditySeconds] = useState<number>(() => {
    const active = OtpService.getActiveOtp(email, purpose);
    return active.exists && active.expiresAt
      ? Math.max(0, Math.floor((active.expiresAt - Date.now()) / 1000))
      : 300;
  });

  const [resendSeconds, setResendSeconds] = useState<number>(() => {
    const active = OtpService.getActiveOtp(email, purpose);
    return active.exists && active.resendAvailableAt
      ? Math.max(0, Math.floor((active.resendAvailableAt - Date.now()) / 1000))
      : 60;
  });

  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(() => {
    const active = OtpService.getActiveOtp(email, purpose);
    return active.attemptsRemaining !== undefined ? active.attemptsRemaining : 3;
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Sync authoritative server-side lockout status (ID + IP + Device) & focus first digit
  useEffect(() => {
    let active = true;
    const syncLockout = async () => {
      const serverCheck = await OtpService.syncServerBlockStatus(email);
      if (active && serverCheck.isBlocked) {
        setIsBlocked(true);
        setBlockMessage(
          `This email, device, or network is blocked for 24 hours due to multiple failed verification attempts. Remaining: ${serverCheck.remainingFormatted || 'up to 24h'}.`
        );
      }
    };
    void syncLockout();

    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [email]);

  // Master Countdown Timer Tick (every 1 second)
  useEffect(() => {
    if (isBlocked || isOtpVerified) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const blockCheck = OtpService.checkBlockStatus(email);
      if (blockCheck.isBlocked) {
        setIsBlocked(true);
        setBlockMessage(`This email is blocked for 24 hours. Remaining: ${blockCheck.remainingFormatted}.`);
        return;
      }

      const active = OtpService.getActiveOtp(email, purpose);
      if (active.exists && active.expiresAt && active.resendAvailableAt) {
        const remVal = Math.max(0, Math.floor((active.expiresAt - now) / 1000));
        const remRes = Math.max(0, Math.floor((active.resendAvailableAt - now) / 1000));
        setValiditySeconds(remVal);
        setResendSeconds(remRes);
        if (active.attemptsRemaining !== undefined) {
          setAttemptsRemaining(active.attemptsRemaining);
        }
      } else {
        setValiditySeconds(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [email, purpose, isBlocked, isOtpVerified]);

  // Format MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Handle digit typing
  const handleDigitChange = (index: number, val: string) => {
    if (isBlocked || isOtpVerified) return;
    setError(null);

    // Only allow single digit
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const next = [...digits];
    next[index] = cleaned[cleaned.length - 1];
    setDigits(next);
    soundPlayer.playWaterDrop();

    // Auto-advance to next box
    if (index < 5 && cleaned) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle Backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  // Handle Paste full 6-digit code
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (isBlocked || isOtpVerified) return;
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    soundPlayer.playWaterDrop();

    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  // Resend OTP action (async server dispatch via Edge Function)
  const handleResend = async () => {
    if (resendSeconds > 0 || isBlocked || isOtpVerified || isSending) return;
    setError(null);
    setSuccessMsg(null);
    setIsSending(true);
    soundPlayer.playWaterDrop();

    try {
      const res = await OtpService.sendOtp(email, purpose, pendingData);
      if (res.success) {
        setDigits(['', '', '', '', '', '']);
        setValiditySeconds(300);
        setResendSeconds(60);
        setAttemptsRemaining(3);
        setSuccessMsg('A new 6-digit verification code has been dispatched to your email.');
        setTimeout(() => setSuccessMsg(null), 4000);
        inputRefs.current[0]?.focus();
      } else {
        if (res.isBlocked || res.error?.includes('blocked for 24 hours') || res.error?.includes('locked for 24 hours')) {
          setIsBlocked(true);
          setBlockMessage(res.error || 'Blocked for 24 hours.');
        } else {
          if (typeof res.resendInSeconds === 'number' && res.resendInSeconds > 0) {
            setResendSeconds(res.resendInSeconds);
          }
          setError(res.error || 'Failed to resend code.');
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  // Step 1: Verify OTP Only (for Forgot Password flow)
  const handleVerifyOtpOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (isBlocked) {
      soundPlayer.playBubblePop();
      return;
    }

    const fullCode = digits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      soundPlayer.playBubblePop();
      return;
    }

    if (validitySeconds <= 0) {
      setError('This verification code has expired (validity is 5 minutes). Please click "Resend Code".');
      soundPlayer.playBubblePop();
      return;
    }

    setIsVerifying(true);
    soundPlayer.playWaterDrop();

    try {
      const result = await OtpService.verifyOtp(email, fullCode, 'forgot_password');

      if (result.success) {
        setIsOtpVerified(true);
        soundPlayer.playSuccessChime();
        setSuccessMsg('OTP verified successfully! You can now set your new password below.');
        setTimeout(() => {
          newPasswordInputRef.current?.focus();
        }, 150);
      } else {
        soundPlayer.playBubblePop();
        if (result.isBlocked) {
          setIsBlocked(true);
          setBlockMessage(result.error || 'Exceeded 3 attempts. Blocked for 24 hours.');
        } else {
          setError(result.error || 'Verification failed. Please check your 6-digit code.');
          if (result.attemptsRemaining !== undefined) {
            setAttemptsRemaining(result.attemptsRemaining);
          }
        }
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: Set New Password (after OTP is confirmed)
  const handleSetNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      soundPlayer.playBubblePop();
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter.');
      soundPlayer.playBubblePop();
      return;
    }

    setIsVerifying(true);
    soundPlayer.playWaterDrop();

    const resetOk = OtpService.completePasswordReset(email, newPassword);
    if (resetOk) {
      soundPlayer.playSuccessChime();
      onSuccess({ verified: true, newPassword });
    } else {
      setIsVerifying(false);
      setError('Failed to update password. Please try again.');
      soundPlayer.playBubblePop();
    }
  };

  // Signup OTP Verification
  const handleVerifySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (isBlocked) {
      soundPlayer.playBubblePop();
      return;
    }

    const fullCode = digits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      soundPlayer.playBubblePop();
      return;
    }

    if (validitySeconds <= 0) {
      setError('This verification code has expired (validity is 5 minutes). Please click "Resend Code".');
      soundPlayer.playBubblePop();
      return;
    }

    setIsVerifying(true);
    soundPlayer.playWaterDrop();

    try {
      const result = await OtpService.verifyOtp(email, fullCode, 'signup');

      if (result.success) {
        soundPlayer.playSuccessChime();
        onSuccess({ verified: true, pendingData: result.pendingData || pendingData });
      } else {
        soundPlayer.playBubblePop();
        if (result.isBlocked) {
          setIsBlocked(true);
          setBlockMessage(result.error || 'Exceeded 3 attempts. Blocked for 24 hours.');
        } else {
          setError(result.error || 'Verification failed.');
          if (result.attemptsRemaining !== undefined) {
            setAttemptsRemaining(result.attemptsRemaining);
          }
        }
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-5 sm:p-6 rounded-2xl bg-white border border-[#C99B42]/40 shadow-lg text-[#102C47]">
      {/* Header Badge */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#C99B42]/20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#102C47] text-[#FFF9EF] flex items-center justify-center shadow-xs">
            {purpose === 'signup' ? (
              <ShieldCheck className="w-4 h-4 text-[#C99B42]" />
            ) : isOtpVerified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <KeyRound className="w-4 h-4 text-[#C99B42]" />
            )}
          </div>
          <div>
            <h3 className="font-playfair font-bold text-base text-[#102C47]">
              {purpose === 'signup'
                ? 'Verify Partner Account'
                : isOtpVerified
                  ? 'Set New Password'
                  : 'Reset Partner Password'}
            </h3>
            <p className="text-[11px] text-[#77766F]">
              {purpose === 'signup'
                ? '6-Digit Secure Email Authentication'
                : isOtpVerified
                  ? 'Step 2 of 2: Create a secure password'
                  : 'Step 1 of 2: Verify 6-digit email code'}
            </p>
          </div>
        </div>

        {/* Status Badge: Clock during OTP stage or Verified Pill once confirmed */}
        {purpose === 'forgot_password' && isOtpVerified ? (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified</span>
          </span>
        ) : (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold border transition ${
            validitySeconds <= 60 
              ? 'bg-red-50 text-red-700 border-red-300 animate-pulse' 
              : 'bg-[#F8F5EC] text-[#123F2D] border-[#C99A3C]/40'
          }`}>
            <Clock className="w-3.5 h-3.5 text-[#C99A3C]" />
            <span>{formatTime(validitySeconds)}</span>
          </div>
        )}
      </div>

      {/* Recipient Notice */}
      <div className="p-3 rounded-xl bg-[#F8F5EC] border border-[#C99A3C]/25 text-xs text-[#35432D] mb-4">
        <span className="text-[11px] text-[#77766F] block">
          {isOtpVerified ? 'Password will be updated for:' : 'Verification code dispatched to:'}
        </span>
        <strong className="text-sm font-semibold text-[#123F2D] break-all">{email}</strong>
      </div>

      {/* 24-Hour Block Banner */}
      {isBlocked ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 space-y-2 mb-4">
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>24-Hour Security Lockout Enforced</span>
          </div>
          <p className="text-xs leading-relaxed">
            {blockMessage || 'Too many consecutive failed verification attempts. For your restaurant account security, OTP requests and verification for this email, device, and network are locked for 24 hours.'}
          </p>
          {onBackToLogin && (
            <button
              type="button"
              onClick={onBackToLogin}
              className="mt-2 text-xs font-bold text-[#102C47] underline cursor-pointer"
            >
              Return to Public Login
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* CASE A: FORGOT PASSWORD - STEP 2 (SET NEW PASSWORD AFTER OTP)      */}
          {/* ----------------------------------------------------------------- */}
          {purpose === 'forgot_password' && isOtpVerified ? (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              {/* Verified Identity Badge */}
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300/80 text-emerald-950 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-900">Email Identity Verified</p>
                  <p className="text-[11px] text-emerald-700">6-digit security token matched. Please enter your new password below.</p>
                </div>
              </div>

              {/* Password Inputs */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-[#102C47] mb-1">
                    New Administrative Password *
                  </label>
                  <div className="relative">
                    <input
                      ref={newPasswordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/40 text-xs text-[#102C47] pr-10 focus:outline-none focus:ring-2 focus:ring-[#C99B42]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77766F] hover:text-[#102C47] cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && newPassword.length < 8 && (
                    <p className="text-[10.5px] text-amber-600 mt-1">Password must be at least 8 characters</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#102C47] mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/40 text-xs text-[#102C47] focus:outline-none focus:ring-2 focus:ring-[#C99B42]/20"
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

              {/* Save New Password Action Button */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isVerifying || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                  className="btn-gold-luxury w-full py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-[#102C47]" />
                  <span>
                    {isVerifying ? 'Updating Password...' : 'Save New Password & Sign In →'}
                  </span>
                </button>

                {onBackToLogin && (
                  <button
                    type="button"
                    onClick={onBackToLogin}
                    className="w-full py-2.5 rounded-full text-xs font-semibold text-[#77766F] hover:text-[#102C47] hover:bg-[#F8F5EC] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </button>
                )}
              </div>
            </form>
          ) : (
            /* ----------------------------------------------------------------- */
            /* CASE B: OTP VERIFICATION STAGE (FORGOT PASSWORD STEP 1 OR SIGNUP)  */
            /* ----------------------------------------------------------------- */
            <form onSubmit={purpose === 'forgot_password' ? handleVerifyOtpOnly : handleVerifySignup} className="space-y-4">
              {/* 6 Digit Inputs */}
              <div>
                <label className="block text-xs font-bold text-[#102C47] mb-2 text-center">
                  Enter 6-Digit Verification Code
                </label>
                <div className="flex justify-center items-center gap-2 sm:gap-2.5">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      className={`w-10 h-12 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-xl border transition-all focus:outline-none ${
                        digit 
                          ? 'bg-[#FFF9EF] border-[#C99B42] text-[#102C47] shadow-inner' 
                          : 'bg-white border-[#C99B42]/40 text-[#102C47] focus:border-[#102C47] focus:ring-2 focus:ring-[#C99B42]/20'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Resend & Security Policy Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                {/* Resend Cooldown Timer (1 min requirement) */}
                <div>
                  {resendSeconds > 0 ? (
                    <div className="flex items-center gap-1.5 text-[#77766F] font-medium text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-[#C99B42]" />
                      <span>Resend code in <strong className="font-mono text-[#102C47]">{resendSeconds}s</strong></span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isSending}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#102C47] hover:text-[#C99B42] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#C99B42] ${isSending ? 'animate-spin' : ''}`} />
                      <span>{isSending ? 'Sending...' : 'Resend Code'}</span>
                    </button>
                  )}
                </div>

                {/* Attempts Remaining Indicator (Max 3 wrong attempts rule) */}
                <div className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  attemptsRemaining <= 1 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-[#F8F5EC] text-[#35432D]'
                }`}>
                  {attemptsRemaining} of 3 attempts left
                </div>
              </div>

              {/* Step 1 Submit Action Button: VERIFY OTP CODE */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isVerifying || digits.join('').length !== 6 || validitySeconds <= 0}
                  className="btn-gold-luxury w-full py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-[#102C47]" />
                  <span>
                    {isVerifying 
                      ? 'Verifying Security Token...' 
                      : purpose === 'signup' 
                        ? 'Verify & Complete Registration' 
                        : 'Verify OTP Code →'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2.5 rounded-full text-xs font-semibold text-[#77766F] hover:text-[#102C47] hover:bg-[#F8F5EC] transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{purpose === 'signup' ? 'Edit Registration Details' : 'Back to Public Login'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Security Policy Reminder */}
      <div className="mt-4 pt-3 border-t border-[#C99B42]/15 text-[10px] text-[#77766F] text-center">
        <span>Security policy: 5-min expiry · 60s resend timer · 3 failed attempts lock for 24h</span>
      </div>
    </div>
  );
};
