import React, { useState } from 'react';
import { 
  Mail, Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, 
  AlertCircle, Smartphone, ArrowRight, ArrowLeft 
} from 'lucide-react';
import { HaritJalAccountType } from '../../services/roles';
import { UnifiedAuthService, UnifiedAuthResult } from '../../services/unifiedAuth';
import { isValidIndianMobile, isPotentialPhoneNumber } from '../../services/phoneUtils';
import { AdminUser } from '../../types';
import { soundPlayer } from '../../services/sound';
import { LoadingButton } from '../ui/LoadingButton';

interface UnifiedLoginCardProps {
  initialAccountType?: HaritJalAccountType;
  allowedAccountTypes?: HaritJalAccountType[];
  initialIdentifier?: string;
  initialEmail?: string;
  onSuccess: (result: UnifiedAuthResult) => void;
  onForgotPassword?: (identifier: string) => void;
  onRequireFirstTimeSetup?: (user: AdminUser) => void;
  onRequireMfaEnrollment?: (user: AdminUser) => void;
  className?: string;
}

function sanitizeUserFacingError(rawMsg: string | undefined): string {
  if (!rawMsg) return 'गलत ईमेल/मोबाइल या पासवर्ड। कृपया पुनः जाँचें। (Authentication failed.)';
  const lower = rawMsg.toLowerCase();
  if (
    lower.includes('non-2xx') ||
    lower.includes('edge function') ||
    lower.includes('status code') ||
    lower.includes('database query failure') ||
    lower.includes('pgrst') ||
    lower.includes('column') ||
    lower.includes('relation') ||
    lower.includes('failed to fetch') ||
    lower.includes('syntax error')
  ) {
    return 'गलत मोबाइल नंबर या पासवर्ड। कृपया सही जानकारी दर्ज करें या अपनी रजिस्टर्ड ईमेल आईडी से लॉगिन करें। (Invalid credentials. Please verify your details or sign in using your registered email.)';
  }
  return rawMsg;
}

export const UnifiedLoginCard: React.FC<UnifiedLoginCardProps> = ({
  initialAccountType = 'partner',
  allowedAccountTypes = ['partner'],
  initialIdentifier = '',
  initialEmail = '',
  onSuccess,
  onForgotPassword,
  onRequireFirstTimeSetup,
  onRequireMfaEnrollment,
  className = '',
}) => {
  const [activeAccountType, setActiveAccountType] = useState<HaritJalAccountType>(initialAccountType);
  const defaultInitial = initialIdentifier || initialEmail || '';
  const [identifier, setIdentifier] = useState(() => {
    if (defaultInitial) return defaultInitial;
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('harit_jal_remember_identifier') || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    if (defaultInitial) return false;
    if (typeof window !== 'undefined' && window.localStorage) {
      return Boolean(localStorage.getItem('harit_jal_remember_identifier'));
    }
    return false;
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 2 TOTP state for Admin / Staff
  const [totpStep, setTotpStep] = useState(false);
  const [pendingAdminUser, setPendingAdminUser] = useState<AdminUser | null>(null);
  const [totpCode, setTotpCode] = useState('');

  const accountTypeConfig = {
    admin: {
      heading: 'Admin Login',
      subtitle: 'Access the Harit Jal admin portal',
      identifierPlaceholder: 'Email or mobile number',
      tabLabel: 'Admin',
    },
    staff: {
      heading: 'Staff Login',
      subtitle: 'Access your assigned workspace',
      identifierPlaceholder: 'Email or mobile number',
      tabLabel: 'Staff',
    },
    partner: {
      heading: 'Partner / Business Login',
      subtitle: 'Access your business account',
      identifierPlaceholder: 'Email or mobile number',
      tabLabel: 'Partner / Business',
    },
  }[activeAccountType];

  const isPhone = isPotentialPhoneNumber(identifier);
  const isIdentifierValid = (identifier.includes('@') && identifier.trim().length > 4) || isValidIndianMobile(identifier);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    soundPlayer.playWaterDrop();

    try {
      if (rememberMe && identifier.trim()) {
        localStorage.setItem('harit_jal_remember_identifier', identifier.trim());
      } else {
        localStorage.removeItem('harit_jal_remember_identifier');
      }

      const res = await UnifiedAuthService.authenticate(identifier, password, activeAccountType);
      setIsLoading(false);

      if (res.requireFirstLoginSetup && res.adminUser) {
        if (onRequireFirstTimeSetup) {
          onRequireFirstTimeSetup(res.adminUser);
        } else {
          onSuccess(res);
        }
        return;
      }

      if (res.requireMfaEnrollment && res.adminUser) {
        if (onRequireMfaEnrollment) {
          onRequireMfaEnrollment(res.adminUser);
        } else {
          onSuccess(res);
        }
        return;
      }

      if (res.requireTotpVerification && res.adminUser) {
        setPendingAdminUser(res.adminUser);
        setTotpStep(true);
        setTotpCode('');
        soundPlayer.playWaterDrop();
        return;
      }

      if (res.success) {
        soundPlayer.playSuccessChime();
        onSuccess(res);
      } else {
        setError(sanitizeUserFacingError(res.error));
        soundPlayer.playBubblePop();
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(sanitizeUserFacingError(msg));
      soundPlayer.playBubblePop();
    }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAdminUser) return;
    setError(null);
    setIsLoading(true);
    soundPlayer.playWaterDrop();

    try {
      const res = await UnifiedAuthService.verifyTotp(pendingAdminUser, totpCode);
      setIsLoading(false);

      if (res.success && res.session) {
        soundPlayer.playSuccessChime();
        onSuccess({
          success: true,
          accountType: activeAccountType,
          adminUser: pendingAdminUser,
          adminSession: res.session,
        });
      } else if (res.requireMfaEnrollment) {
        if (onRequireMfaEnrollment) {
          onRequireMfaEnrollment(pendingAdminUser);
        } else {
          setError(res.error || 'MFA Enrollment required.');
        }
      } else {
        setError(res.error || 'Invalid 6-digit Google Authenticator code.');
        soundPlayer.playBubblePop();
      }
    } catch {
      setIsLoading(false);
      setError('2-Factor verification service unavailable. Please try again.');
      soundPlayer.playBubblePop();
    }
  };

  const handleSwitchTab = (type: HaritJalAccountType) => {
    soundPlayer.playWaterDrop();
    setActiveAccountType(type);
    setError(null);
    setTotpStep(false);
    setPendingAdminUser(null);
    setTotpCode('');
  };

  return (
    <div className={`w-full max-w-[420px] mx-auto bg-white border border-[#E5E7EB] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 shadow-[0_20px_50px_rgba(16,44,71,0.08)] font-manrope text-[#102C47] ${className}`}>
      
      {/* Brand Logo & Name Header */}
      <div className="flex flex-col items-center justify-center text-center mb-6">
        <div className="flex items-center gap-2 mb-2 select-none">
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <img 
              src="/images/brand/harit-jal-logo-mark.png" 
              alt="Harit Jal Logo" 
              className="w-full h-full object-contain filter drop-shadow-xs" 
            />
          </div>
          <span className="font-playfair font-extrabold text-2xl text-[#102C47] tracking-tight">
            Harit Jal<span className="text-xs font-normal align-top">™</span>
          </span>
        </div>

        {/* Dynamic Heading & Subtitle */}
        <h1 className="text-2xl sm:text-[26px] font-bold font-playfair text-[#102C47] tracking-tight leading-tight mt-1">
          {totpStep ? 'Two-Factor Authentication' : accountTypeConfig.heading}
        </h1>
        <p className="text-xs sm:text-[13px] text-[#6B7280] mt-1 font-medium">
          {totpStep ? 'Enter 6-digit code from Google Authenticator' : accountTypeConfig.subtitle}
        </p>
      </div>

      {/* Account Type Selector Tabs (Only shown when multiple account types are permitted and not in TOTP step) */}
      {!totpStep && allowedAccountTypes.length > 1 && (
        <div className="flex p-1 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] mb-5 text-xs font-semibold">
          {allowedAccountTypes.map((type) => {
            const isSelected = activeAccountType === type;
            const labels: Record<HaritJalAccountType, string> = {
              partner: 'Partner',
              staff: 'Staff',
              admin: 'Admin',
            };
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleSwitchTab(type)}
                className={`flex-1 py-1.5 px-2 rounded-full transition-all cursor-pointer text-center truncate ${
                  isSelected
                    ? 'bg-[#0F3826] text-white shadow-xs font-bold'
                    : 'text-[#4B5563] hover:text-[#102C47]'
                }`}
              >
                {labels[type]}
              </button>
            );
          })}
        </div>
      )}

      {/* Error Message Alert */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2 shadow-2xs animate-shake">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span>{error}</span>
            {isPhone && (error.includes('गलत') || error.includes('Invalid') || error.includes('failed')) && (
              <p className="text-[11px] text-[#4B5563] font-normal pt-1.5 border-t border-red-200/60">
                💡 <strong>सुझाव:</strong> यदि मोबाइल नंबर से लॉगिन नहीं हो रहा है, तो कृपया अपनी <strong>रजिस्टर्ड ईमेल आईडी</strong> दर्ज करके लॉगिन करें।
              </p>
            )}
          </div>
        </div>
      )}

      {/* STEP 1: CREDENTIALS LOGIN FORM */}
      {!totpStep ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Email or Mobile Number Input */}
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                {isPhone ? <Smartphone className="w-4 h-4 text-[#0F3826]" /> : <Mail className="w-4 h-4" />}
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={accountTypeConfig.identifierPlaceholder}
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-[#D1D5DB] text-sm text-[#102C47] placeholder-[#9CA3AF] font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3826] focus:border-transparent transition shadow-2xs"
                autoComplete="username"
              />
              {isIdentifierValid && (
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>

          {/* Password Input */}
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-[#D1D5DB] text-sm text-[#102C47] placeholder-[#9CA3AF] font-medium focus:outline-none focus:ring-2 focus:ring-[#0F3826] focus:border-transparent transition shadow-2xs"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9CA3AF] hover:text-[#102C47] transition cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Options: Remember Me & Forgot Password (Forgot password is exclusively for Partners; Admin & Staff use Admin-provisioned credentials & first-login TOTP) */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[#4B5563]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#D1D5DB] text-[#0F3826] focus:ring-[#0F3826]"
              />
              <span>Remember me</span>
            </label>

            {activeAccountType === 'partner' && onForgotPassword && (
              <button
                type="button"
                onClick={() => onForgotPassword(identifier)}
                className="text-[#0F3826] hover:underline font-semibold cursor-pointer"
              >
                Forgot password?
              </button>
            )}
          </div>

          {/* Primary Green Login Button */}
          <LoadingButton
            type="submit"
            isLoading={isLoading}
            loadingText="Verifying Credentials..."
            variant="navy"
            className="w-full py-3.5 px-5 rounded-xl !bg-[#0F3826] hover:!bg-[#082015] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg cursor-pointer"
            rightIcon={!isLoading ? <ArrowRight className="w-4 h-4" /> : undefined}
          >
            Login
          </LoadingButton>
        </form>
      ) : (
        /* STEP 2: GOOGLE AUTHENTICATOR TOTP FORM */
        <form onSubmit={handleVerifyTotp} className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-[#0F3826] flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="truncate">
                <span className="font-bold block">{pendingAdminUser?.name}</span>
                <span className="text-[11px] text-[#4B5563] truncate block">{pendingAdminUser?.email}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {pendingAdminUser?.role}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#102C47] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#0F3826]" />
                <span>6-Digit Authenticator Code *</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-bold">Mandatory 2FA</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full px-4 py-3 rounded-xl bg-white border border-[#D1D5DB] text-2xl font-mono font-bold tracking-[0.4em] text-center text-[#102C47] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0F3826] focus:border-transparent transition shadow-inner"
            />
            <p className="text-[11px] text-[#6B7280] text-center mt-1.5">
              Open Google Authenticator on your mobile device to view your 6-digit code.
            </p>
          </div>

          <LoadingButton
            type="submit"
            isLoading={isLoading}
            loadingText="Authenticating 2FA..."
            disabled={totpCode.length !== 6}
            variant="navy"
            className="w-full py-3.5 px-5 rounded-xl !bg-[#0F3826] hover:!bg-[#082015] text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg cursor-pointer"
            leftIcon={<ShieldCheck className="w-4 h-4" />}
          >
            Authenticate & Enter Portal
          </LoadingButton>

          <button
            type="button"
            onClick={() => {
              setTotpStep(false);
              setPendingAdminUser(null);
              setTotpCode('');
              setError(null);
            }}
            className="w-full py-2 text-xs font-semibold text-[#6B7280] hover:text-[#102C47] transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to credentials</span>
          </button>
        </form>
      )}

      {/* Security Privacy Notice */}
      <div className="mt-6 pt-4 border-t border-[#F3F4F6] text-center">
        <p className="text-[10.5px] text-[#9CA3AF] leading-tight">
          Protected by Supabase Auth with Row-Level Security & Multi-Factor Verification.
        </p>
      </div>

    </div>
  );
};
