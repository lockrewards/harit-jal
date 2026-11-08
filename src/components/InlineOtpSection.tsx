import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Clock, RefreshCw, AlertTriangle, CheckCircle2, Mail, Lock } from 'lucide-react';
import { OtpService } from '../services/otpService';
import { soundPlayer } from '../services/sound';

interface InlineOtpSectionProps {
  email: string;
  purpose?: 'signup' | 'forgot_password';
  onVerified: () => void;
  isVerified: boolean;
  onResetVerification?: () => void;
  pendingData?: any;
}

export const InlineOtpSection: React.FC<InlineOtpSectionProps> = ({
  email,
  purpose = 'signup',
  onVerified,
  isVerified,
  onResetVerification,
  pendingData,
}) => {
  const [isOtpSent, setIsOtpSent] = useState<boolean>(() => {
    if (!email || !email.includes('@')) return false;
    const active = OtpService.getActiveOtp(email, purpose);
    return active.exists;
  });
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // Master Countdown Timer (1s tick)
  useEffect(() => {
    if (!isOtpSent || isVerified || isBlocked) return;

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
        setValiditySeconds(Math.max(0, Math.floor((active.expiresAt - now) / 1000)));
        setResendSeconds(Math.max(0, Math.floor((active.resendAvailableAt - now) / 1000)));
        if (active.attemptsRemaining !== undefined) {
          setAttemptsRemaining(active.attemptsRemaining);
        }
      } else {
        setValiditySeconds(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOtpSent, isVerified, email, purpose, isBlocked]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Send OTP
  const handleSendOtp = () => {
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address first.');
      soundPlayer.playBubblePop();
      return;
    }

    const blockCheck = OtpService.checkBlockStatus(cleanEmail);
    if (blockCheck.isBlocked) {
      setIsBlocked(true);
      setBlockMessage(`This email is locked for 24 hours due to multiple failed verification attempts. Remaining: ${blockCheck.remainingFormatted}.`);
      soundPlayer.playBubblePop();
      return;
    }

    setIsSending(true);
    soundPlayer.playWaterDrop();

    setTimeout(() => {
      const res = OtpService.sendOtp(cleanEmail, purpose, pendingData);
      setIsSending(false);

      if (res.success) {
        setIsOtpSent(true);
        setDigits(['', '', '', '', '', '']);
        setValiditySeconds(300);
        setResendSeconds(60);
        setAttemptsRemaining(3);
        setSuccessMsg(`6-digit OTP code dispatched to ${cleanEmail}. Valid for 5 minutes.`);
        soundPlayer.playWaterDrop();

        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      } else {
        if (res.error?.includes('blocked for 24 hours')) {
          setIsBlocked(true);
          setBlockMessage(res.error);
        } else {
          setError(res.error || 'Failed to dispatch verification code.');
        }
        soundPlayer.playBubblePop();
      }
    }, 300);
  };

  // Digit change
  const handleDigitChange = (index: number, val: string) => {
    if (isBlocked || isVerified) return;
    setError(null);

    const cleaned = val.replace(/\D/g, '');
    const next = [...digits];
    next[index] = cleaned ? cleaned[cleaned.length - 1] : '';
    setDigits(next);
    soundPlayer.playWaterDrop();

    if (index < 5 && cleaned) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify if all 6 digits entered
    if (index === 5 && cleaned) {
      const full = [...next.slice(0, 5), cleaned[cleaned.length - 1]].join('');
      if (full.length === 6) {
        triggerVerification(full);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (isBlocked || isVerified) return;
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    soundPlayer.playWaterDrop();

    if (pasted.length === 6) {
      triggerVerification(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  // Trigger verify
  const triggerVerification = (codeToVerify?: string) => {
    const fullCode = codeToVerify || digits.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits of the OTP code.');
      soundPlayer.playBubblePop();
      return;
    }

    if (validitySeconds <= 0) {
      setError('This OTP code has expired. Please request a new code.');
      soundPlayer.playBubblePop();
      return;
    }

    setIsVerifying(true);
    soundPlayer.playWaterDrop();

    const result = OtpService.verifyOtp(email, fullCode, purpose);
    setIsVerifying(false);

    if (result.success) {
      soundPlayer.playSuccessChime();
      setSuccessMsg('Email verified successfully! You can now submit your account request.');
      setError(null);
      onVerified();
    } else {
      soundPlayer.playBubblePop();
      if (result.isBlocked) {
        setIsBlocked(true);
        setBlockMessage(result.error || 'Exceeded 3 attempts. Blocked for 24 hours.');
      } else {
        setError(result.error || 'Incorrect OTP code.');
        if (result.attemptsRemaining !== undefined) {
          setAttemptsRemaining(result.attemptsRemaining);
        }
      }
    }
  };

  // If already verified
  if (isVerified) {
    return (
      <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-emerald-900 flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-300">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="font-bold text-emerald-950 flex items-center gap-1.5">
              <span>Email Verified Successfully</span>
              <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-mono">
                {email}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700">
              One-time verification complete. You can now submit your request.
            </p>
          </div>
        </div>

        {onResetVerification && (
          <button
            type="button"
            onClick={onResetVerification}
            className="text-[11px] font-bold text-emerald-800 underline hover:text-emerald-950 cursor-pointer shrink-0"
          >
            Change
          </button>
        )}
      </div>
    );
  }

  // If 24-hour blocked
  if (isBlocked) {
    return (
      <div className="p-3.5 sm:p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 space-y-1.5 text-xs shadow-xs">
        <div className="flex items-center gap-2 font-bold text-red-800">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>24-Hour Security Lockout Enforced</span>
        </div>
        <p className="text-[11px] text-red-700 leading-relaxed">
          {blockMessage || 'Too many failed verification attempts. For security, OTP requests and verification are blocked for 24 hours.'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FFF9EF] border border-[#C99B42]/40 shadow-xs space-y-3 font-manrope">
      {/* Step 1: Initial "Send OTP on Email" button */}
      {!isOtpSent ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-[#C99B42]/35 flex items-center justify-center text-[#C99B42] shrink-0 shadow-xs">
              <Mail className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#102C47]">
                Email Verification Required for Account
              </div>
              <p className="text-[11px] text-[#77766F]">
                Click below to receive a 6-digit verification code at <strong className="text-[#102C47]">{email || 'your email'}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={isSending || !email || !email.includes('@')}
            className="btn-gold-luxury px-4 py-2 rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#102C47]" />
            <span>{isSending ? 'Sending OTP...' : 'Send OTP on Email'}</span>
          </button>
        </div>
      ) : (
        /* Step 2: OTP Input Boxes + Live Timers */
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#C99B42]/20 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#102C47] text-[#FFF9EF] flex items-center justify-center text-xs">
                <Lock className="w-3 h-3 text-[#C99B42]" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#102C47]">
                  Enter 6-Digit Email OTP
                </span>
                <span className="block text-[10.5px] text-[#77766F]">
                  Sent to <strong className="text-[#102C47]">{email}</strong>
                </span>
              </div>
            </div>

            {/* 5-Min Expiry Clock */}
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border transition ${
              validitySeconds <= 60
                ? 'bg-red-50 text-red-700 border-red-300 animate-pulse'
                : 'bg-white text-[#123F2D] border-[#C99B42]/40'
            }`}>
              <Clock className="w-3 h-3 text-[#C99B42]" />
              <span>{formatTime(validitySeconds)}</span>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && !error && (
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 6 Digit Inputs */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className={`w-9 h-11 sm:w-10 sm:h-12 text-center font-mono text-lg font-bold rounded-xl border transition-all focus:outline-none ${
                    digit
                      ? 'bg-white border-[#C99B42] text-[#102C47] shadow-inner'
                      : 'bg-white/90 border-[#C99B42]/40 text-[#102C47] focus:border-[#102C47] focus:ring-2 focus:ring-[#C99B42]/20'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => triggerVerification()}
              disabled={isVerifying || digits.join('').length !== 6 || validitySeconds <= 0}
              className="btn-gold-luxury px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isVerifying ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>

          {/* Resend Cooldown & Attempts Bar */}
          <div className="flex items-center justify-between text-[11px] pt-1">
            {/* 1-Minute Resend Timer */}
            <div>
              {resendSeconds > 0 ? (
                <span className="text-[#77766F]">
                  Resend code in <strong className="font-mono text-[#102C47]">{resendSeconds}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="font-bold text-[#102C47] hover:text-[#C99B42] underline cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3 text-[#C99B42]" />
                  <span>Resend Code</span>
                </button>
              )}
            </div>

            {/* 3 Attempts Badge */}
            <span className={`px-2 py-0.5 rounded-full font-medium ${
              attemptsRemaining <= 1 ? 'bg-red-100 text-red-800' : 'bg-white text-[#77766F] border border-[#C99B42]/20'
            }`}>
              {attemptsRemaining} of 3 attempts left
            </span>
          </div>
        </div>
      )}

      {error && !isOtpSent && (
        <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
