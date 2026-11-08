import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Mail, Home, LogOut, AlertTriangle, 
  Eye, EyeOff, Layers, BarChart3, Settings, KeyRound,
  ArrowLeft, Smartphone, CheckCircle2
} from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { AdminAuthService, AdminSession } from '../services/adminAuth';
import { DynamicAdminRouter } from '../services/dynamicAdminRouter';
import { AdminPortal } from '../components/AdminPortal';
import { NotFoundPage } from './NotFoundPage';
import { soundPlayer } from '../services/sound';
import { StaffFirstTimeSetupModal } from '../components/admin/StaffFirstTimeSetupModal';
import { AdminUser } from '../types';

interface AdminPageProps {
  routeToken?: string;
}

export const AdminPage: React.FC<AdminPageProps> = ({ routeToken }) => {
  const { navigate, currentPath } = useRouter();

  // Route token from prop or current path
  const token = routeToken || DynamicAdminRouter.extractToken(currentPath) || '';

  // Validation state
  const [routeValidation, setRouteValidation] = useState(() => DynamicAdminRouter.validateRoute(token));
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const now = new Date();
    return 60 - now.getSeconds();
  });

  // Authentication state
  const [session, setSession] = useState<AdminSession | null>(() => AdminAuthService.getCurrentSession());
  const [loginStep, setLoginStep] = useState<'credentials' | 'totp'>('credentials');
  const [pendingUser, setPendingUser] = useState<AdminUser | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // First-Time Staff Setup State
  const [firstTimeUser, setFirstTimeUser] = useState<AdminUser | null>(null);
  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);

  // Security: Prevent search engines from indexing administrative pages
  useEffect(() => {
    const originalTitle = document.title;
    document.title = 'Operations Gateway | Harit Jal™ Administrative Console';

    let metaTag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    let createdMeta = false;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'robots';
      document.head.appendChild(metaTag);
      createdMeta = true;
    }
    const previousContent = metaTag.content;
    metaTag.content = 'noindex, nofollow, noarchive';

    return () => {
      document.title = originalTitle;
      if (metaTag) {
        if (createdMeta) {
          document.head.removeChild(metaTag);
        } else {
          metaTag.content = previousContent;
        }
      }
    };
  }, []);

  // Timer to update second countdown and revalidate route token every second
  useEffect(() => {
    if (session && AdminAuthService.isAuthenticated()) return;

    const interval = setInterval(() => {
      const now = new Date();
      setSecondsRemaining(60 - now.getSeconds());

      // Revalidate if not already authenticated
      const res = DynamicAdminRouter.validateRoute(token);
      setRouteValidation(res);
    }, 1000);

    return () => clearInterval(interval);
  }, [token, session]);

  // STEP 1: Validate Email/Phone and Password
  const handleVerifyCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    soundPlayer.playWaterDrop();

    // Verify dynamic route is still valid at the moment of submission
    const currentValidation = DynamicAdminRouter.validateRoute(token);
    if (!currentValidation.isValid) {
      setIsLoading(false);
      setRouteValidation(currentValidation);
      return;
    }

    const res = AdminAuthService.validateCredentials(identifier.trim(), password);
    setIsLoading(false);

    if (res.requireFirstLoginSetup && res.user) {
      setFirstTimeUser(res.user);
      setShowFirstTimeSetup(true);
      soundPlayer.playSuccessChime();
      return;
    }

    if (res.success && res.user) {
      setPendingUser(res.user);
      setLoginStep('totp');
      setTotpCode('');
      soundPlayer.playWaterDrop();
    } else {
      setError(res.error || 'Invalid credentials. Please verify your email/phone and password.');
      soundPlayer.playBubblePop();
    }
  };

  // STEP 2: Verify Google Authenticator (TOTP) and enter portal
  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    soundPlayer.playWaterDrop();

    if (!pendingUser) return;

    try {
      const res = await AdminAuthService.verifyTotpAndCreateSession(pendingUser, totpCode.trim());
      setIsLoading(false);

      if (res.success && res.session) {
        setSession(res.session);
        soundPlayer.playSuccessChime();
      } else {
        setError(res.error || 'Invalid Google Authenticator code.');
        soundPlayer.playBubblePop();
      }
    } catch {
      setIsLoading(false);
      setError('An unexpected error occurred during 2FA verification. Please try again.');
      soundPlayer.playBubblePop();
    }
  };

  const handleLogout = () => {
    soundPlayer.playBubblePop();
    AdminAuthService.logout();
    setSession(null);
    setPassword('');
    navigate('/');
  };

  // -------------------------------------------------------------
  // 1. AUTHENTICATED STATE: Render full Admin Operations Console
  // -------------------------------------------------------------
  if (session && AdminAuthService.isAuthenticated()) {
    return (
      <div className="min-h-screen bg-[#102B46] text-[#FFF9EF] font-manrope flex flex-col">
        {/* Top Administration Security Bar */}
        <header className="bg-[#0B1E32] border-b border-[#C99B43]/30 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg border border-[#C99B43]/50 bg-[#FFF9EF] flex items-center justify-center p-1 shadow-xs overflow-hidden shrink-0">
              <img 
                src="/images/brand/harit-jal-logo-mark.png" 
                alt="Harit Jal Logo" 
                className="w-full h-full object-contain" 
              />
            </div>
            <div>
              <span className="font-bold text-[#FFF9EF]">Harit Jal™ Administrative Console</span>
              <span className="hidden sm:inline text-[#77766F] ml-2">• Internal Operations</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Authenticated Staff Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[#102B46] border border-[#C99B43]/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">{session.name}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[#C99B43]/20 text-[#C99B43]">
                {session.role}
              </span>
            </div>

            {/* View Public Website */}
            <button
              onClick={() => {
                soundPlayer.playWaterDrop();
                navigate('/');
              }}
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Public Site</span>
            </button>

            {/* Secure Sign Out */}
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded-full bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-500/30 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Embedded Admin Portal Component */}
        <div className="flex-1 relative">
          <AdminPortal
            isOpen={true}
            onClose={() => navigate('/')}
            onLogout={handleLogout}
            session={session}
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. INVALID / EXPIRED TIME-BASED URL
  // If the URL token is even 1 minute off or expired:
  // Render genuine 404 Page (A Drop Off the Map).
  // No administrative info, prompts, or expiry indicators are leaked.
  // -------------------------------------------------------------
  if (!routeValidation.isValid) {
    return <NotFoundPage />;
  }

  // Calculate live mm:ss string
  const minutesFormatted = String(Math.floor(secondsRemaining / 60)).padStart(2, '0');
  const secondsFormatted = String(secondsRemaining % 60).padStart(2, '0');

  // -------------------------------------------------------------
  // 3. VALID DYNAMIC TIME-WINDOW: Premium Split-Screen Login
  // Background shifted downward slightly to show bottle cap & leaves 
  // at top, and drinking glass/marble countertop cleanly at bottom.
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden w-full bg-[#FAF7EE] text-[#35432D] font-manrope selection:bg-[#C99A3C]/20 selection:text-[#123F2D] relative flex flex-col justify-center">
      
      {/* MASTER BACKDROP: Positioned slightly downward (left 66%) so bottle cap breathes at top and glass/table is visible at bottom */}
      <div 
        aria-hidden="true" 
        className="absolute inset-0 bg-cover bg-no-repeat pointer-events-none"
        style={{ 
          backgroundImage: `url('/images/admin/admin-gateway-backdrop.jpg')`,
          backgroundPosition: 'left 66%'
        }}
      />

      {/* Subtle Mobile Ambient Overlay (Ensures text/card pop cleanly on mobile without hiding artwork) */}
      <div 
        aria-hidden="true" 
        className="block lg:hidden absolute inset-0 bg-[#FAF7EE]/70 backdrop-blur-[1px] pointer-events-none"
      />

      {/* Main Responsive Layout Container */}
      <div className="w-full h-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-0 flex flex-col lg:flex-row items-center justify-between relative z-10 my-auto">
        
        {/* ======================================================== */}
        {/* 1. DESKTOP SPACER: Clears the bottle & drinking glass    */}
        {/* Shifts all text safely past the glass!                   */}
        {/* ======================================================== */}
        <div 
          aria-hidden="true" 
          className="hidden lg:block lg:w-[27%] xl:w-[28%] shrink-0 pointer-events-none select-none"
        />

        {/* ======================================================== */}
        {/* 2. BRAND & FEATURE PRESENTATION (Enlarged & Prominent)   */}
        {/* Positioned cleanly in the open warm-ivory wall space     */}
        {/* ======================================================== */}
        <section className="w-full lg:w-[35%] xl:w-[33%] py-3 lg:py-0 flex flex-col justify-center text-left">
          
          {/* Top Brand Logo & Tagline */}
          <div className="flex items-center gap-3 mb-3 sm:mb-4 select-none">
            <div className="w-11 h-11 sm:w-13 sm:h-13 shrink-0 flex items-center justify-center">
              <img 
                src="/images/brand/harit-jal-logo-mark.png" 
                alt="Harit Jal Logo" 
                className="w-full h-full object-contain filter drop-shadow-xs" 
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-playfair font-bold text-2xl sm:text-[28px] text-[#123F2D] tracking-tight leading-none">
                  Harit Jal<span className="text-sm font-sans font-normal text-[#123F2D] align-top">™</span>
                </span>
                <span className="text-[9.5px] font-bold px-2 py-0.2 rounded-full bg-[#52652D]/10 text-[#52652D] border border-[#52652D]/30 font-devanagari">
                  हरित जल
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-[#8A631E] tracking-[0.22em] uppercase font-bold mt-1">
                BESPOKE DINING HYDRATION
              </span>
            </div>
          </div>

          {/* Main Serif Heading (Enlarged and high-impact) */}
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] xl:text-[48px] font-playfair font-extrabold text-[#123F2D] leading-[1.08] mb-2 sm:mb-3 tracking-tight">
            Operations<br />Gateway
          </h1>

          {/* Subtitle (Enlarged for readability) */}
          <p className="text-sm sm:text-base text-[#35432D] font-medium leading-snug max-w-sm mb-4 sm:mb-6">
            A secure workspace for the<br className="hidden sm:inline" /> Harit Jal team.
          </p>

          {/* Clean Vertical Feature Highlights (Enlarged Icons & Text) */}
          <div className="hidden lg:flex flex-col space-y-3.5 sm:space-y-4">
            <div className="flex items-center gap-3.5 text-base sm:text-[17px] font-bold text-[#123F2D]">
              <ShieldCheck className="w-5 h-5 text-[#123F2D] shrink-0" strokeWidth={2} />
              <span>Secure Access</span>
            </div>
            <div className="flex items-center gap-3.5 text-base sm:text-[17px] font-bold text-[#123F2D]">
              <Layers className="w-5 h-5 text-[#123F2D] shrink-0" strokeWidth={2} />
              <span>Role-Based Control</span>
            </div>
            <div className="flex items-center gap-3.5 text-base sm:text-[17px] font-bold text-[#123F2D]">
              <BarChart3 className="w-5 h-5 text-[#123F2D] shrink-0" strokeWidth={2} />
              <span>Business Operations</span>
            </div>
            <div className="flex items-center gap-3.5 text-base sm:text-[17px] font-bold text-[#123F2D]">
              <Settings className="w-5 h-5 text-[#123F2D] shrink-0" strokeWidth={2} />
              <span>Inventory & Fulfillment</span>
            </div>
          </div>

          {/* Mobile 2x2 Feature Chips (Clean & touch-friendly) */}
          <div className="grid grid-cols-2 gap-2 my-2 lg:hidden max-w-sm mx-auto w-full">
            <div className="p-2 px-3 rounded-xl bg-white/95 border border-[#C99A3C]/35 text-xs font-bold text-[#123F2D] flex items-center gap-2 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#123F2D] shrink-0" />
              <span>Secure Access</span>
            </div>
            <div className="p-2 px-3 rounded-xl bg-white/95 border border-[#C99A3C]/35 text-xs font-bold text-[#123F2D] flex items-center gap-2 shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-[#123F2D] shrink-0" />
              <span>Role-Based Control</span>
            </div>
            <div className="p-2 px-3 rounded-xl bg-white/95 border border-[#C99A3C]/35 text-xs font-bold text-[#123F2D] flex items-center gap-2 shadow-2xs">
              <BarChart3 className="w-3.5 h-3.5 text-[#123F2D] shrink-0" />
              <span>Operations CRM</span>
            </div>
            <div className="p-2 px-3 rounded-xl bg-white/95 border border-[#C99A3C]/35 text-xs font-bold text-[#123F2D] flex items-center gap-2 shadow-2xs">
              <Settings className="w-3.5 h-3.5 text-[#123F2D] shrink-0" />
              <span>Fulfillment Desk</span>
            </div>
          </div>

        </section>

        {/* ======================================================== */}
        {/* 3. RIGHT SECTION — LOGIN CARD                            */}
        {/* Shifted inwards (closer to text) to remove large gap      */}
        {/* Fits 100vh on laptop screen with zero drag/scroll needed */}
        {/* ======================================================== */}
        <section className="w-full lg:w-[38%] xl:w-[36%] flex items-center justify-center lg:justify-start lg:pl-6 xl:pl-10 py-2 lg:py-0">
          
          <div className="w-full max-w-[390px] sm:max-w-[410px] bg-[#FAF7EE] border border-[#E2D5BE] rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 md:p-6 shadow-[0_20px_45px_rgba(18,63,45,0.08)] relative">
            
            {loginStep === 'credentials' ? (
              <>
                {/* Small Golden Badge (Restricted Administrative Access) */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[#D4AF37]/50 bg-[#F3ECE0] text-[9.5px] sm:text-[10px] font-bold tracking-wider text-[#8B6F38] uppercase mb-2 shadow-2xs">
                  <Lock className="w-2.5 h-2.5 text-[#8B6F38]" strokeWidth={2.2} />
                  <span>RESTRICTED ADMINISTRATIVE ACCESS</span>
                </div>

                {/* Main Heading & Subtitle */}
                <h2 className="text-2xl sm:text-[26px] font-playfair font-bold text-[#123F2D] tracking-tight leading-tight">
                  Welcome Back
                </h2>
                <p className="text-[11px] sm:text-xs text-[#687764] mt-0.5 font-medium">
                  Harit Jal Operations Portal
                </p>

                {/* IST ACCESS INDICATOR */}
                <div className="mt-2.5 p-2 px-3 rounded-full bg-[#E8F3EB] border border-[#C5E0CC] flex items-center justify-between text-[11px] text-[#123F2D] shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shrink-0" />
                    <span className="font-semibold text-[11px] text-[#123F2D]">
                      IST Access Window Active
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#35432D] font-medium text-[11px]">
                    <span className="text-[#C5E0CC] text-xs font-light">|</span>
                    <span className="font-mono font-bold text-[10.5px] text-[#35432D]">
                      {minutesFormatted}:{secondsFormatted} remaining
                    </span>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="mt-2.5 p-2 px-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-1.5 shadow-2xs animate-shake">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* STEP 1: Credentials Form (ID & Password Only - NO TOTP field here) */}
                <form onSubmit={handleVerifyCredentials} className="space-y-2.5 sm:space-y-3 mt-3">
                  
                  {/* Field 1: Staff Email Address OR Mobile Number */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#123F2D] mb-1 font-manrope flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-[#123F2D]" strokeWidth={2} />
                        <span>Staff Email or Mobile Number</span>
                      </span>
                      <span className="text-[10px] text-[#52652D] font-normal">Email / +91</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="name@haritjal.in or +91 98765..."
                      className="w-full px-3.5 py-2 sm:py-2.5 rounded-xl bg-[#FAF7EE]/70 border border-[#D9CEBA] text-sm text-[#123F2D] placeholder-[#A09A8E] font-medium focus:outline-none focus:ring-1 focus:ring-[#C99A3C] focus:border-[#C99A3C] transition"
                      autoComplete="username"
                    />
                  </div>

                  {/* Field 2: Administrative Password */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#123F2D] mb-1 font-manrope flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-[#123F2D]" strokeWidth={2} />
                      <span>Administrative Password</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full px-3.5 pr-10 py-2 sm:py-2.5 rounded-xl bg-[#FAF7EE]/70 border border-[#D9CEBA] text-sm text-[#123F2D] placeholder-[#A09A8E] font-medium focus:outline-none focus:ring-1 focus:ring-[#C99A3C] focus:border-[#C99A3C] transition"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707D6B] hover:text-[#123F2D] transition cursor-pointer p-1"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* STEP 1 BUTTON: Verify Credentials & Continue */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 sm:py-3 px-5 rounded-full bg-[#0F3826] hover:bg-[#082015] text-white font-bold text-xs sm:text-[13px] tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-60"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-white" />
                    <span>
                      {isLoading ? 'Verifying Credentials...' : 'Verify Credentials & Continue →'}
                    </span>
                  </button>
                </form>
              </>
            ) : (
              <>
                {/* STEP 2: Google Authenticator TOTP Screen */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-50 text-[9.5px] sm:text-[10px] font-bold tracking-wider text-emerald-800 uppercase mb-2 shadow-2xs">
                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-700" strokeWidth={2.2} />
                  <span>TWO-FACTOR AUTHENTICATION • STEP 2 OF 2</span>
                </div>

                {/* Main Heading & Subtitle */}
                <h2 className="text-2xl sm:text-[26px] font-playfair font-bold text-[#123F2D] tracking-tight leading-tight">
                  Google Authenticator
                </h2>
                <p className="text-[11px] sm:text-xs text-[#687764] mt-0.5 font-medium">
                  Enter 6-digit TOTP code generated on your device
                </p>

                {/* Verified Identity Badge */}
                <div className="mt-2.5 p-2 px-3 rounded-xl bg-[#E8F3EB] border border-[#C5E0CC] flex items-center justify-between text-xs text-[#123F2D] shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#123F2D] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#123F2D] truncate text-[11.5px]">{pendingUser?.name}</p>
                      <p className="text-[10px] text-[#52652D] truncate">{pendingUser?.email || pendingUser?.phone}</p>
                    </div>
                  </div>
                  <span className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#123F2D]/10 text-[#123F2D] shrink-0 border border-[#123F2D]/20">
                    {pendingUser?.designation || pendingUser?.role}
                  </span>
                </div>

                {/* IST ACCESS INDICATOR */}
                <div className="mt-2 p-1.5 px-3 rounded-full bg-[#FAF7EE] border border-[#E2D5BE] flex items-center justify-between text-[10.5px] text-[#123F2D]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse shrink-0" />
                    <span className="font-semibold text-[#123F2D]">
                      IST Window Active
                    </span>
                  </div>
                  <div className="font-mono font-bold text-[10px] text-[#35432D]">
                    {minutesFormatted}:{secondsFormatted} remaining
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="mt-2.5 p-2 px-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-1.5 shadow-2xs animate-shake">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* STEP 2 FORM: 6-Digit TOTP Input */}
                <form onSubmit={handleVerifyTotp} className="space-y-3 mt-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#123F2D] mb-1 font-manrope flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="w-3 h-3 text-[#123F2D]" strokeWidth={2} />
                        <span>Google Authenticator (TOTP) *</span>
                      </span>
                      <span className="text-[10px] text-[#52652D] font-bold">Mandatory 2FA</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/90 border border-[#D9CEBA] text-xl font-mono font-bold tracking-[0.4em] text-center text-[#123F2D] placeholder-[#A09A8E] focus:outline-none focus:ring-2 focus:ring-[#123F2D] focus:border-[#123F2D] transition shadow-inner"
                    />
                    <span className="text-[10px] text-[#707D6B] block mt-1 text-center">
                      Open Google Authenticator on your mobile to view your 6-digit code.
                    </span>
                  </div>

                  {/* Primary Button */}
                  <button
                    type="submit"
                    disabled={isLoading || totpCode.length !== 6}
                    className="w-full py-2.5 sm:py-3 px-5 rounded-full bg-[#0F3826] hover:bg-[#082015] text-white font-bold text-xs sm:text-[13px] tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    <span>
                      {isLoading ? 'Verifying 2FA Credentials...' : 'Authenticate & Enter Portal →'}
                    </span>
                  </button>

                  {/* Back to Step 1 Button */}
                  <button
                    type="button"
                    onClick={() => {
                      soundPlayer.playBubblePop();
                      setLoginStep('credentials');
                      setTotpCode('');
                      setError(null);
                    }}
                    className="w-full py-1 text-[11px] font-semibold text-[#687764] hover:text-[#123F2D] transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back to Password Login</span>
                  </button>
                </form>
              </>
            )}

            {/* SECURITY FOOTER INSIDE LOGIN CARD */}
            <div className="w-full h-px bg-[#E8DFCF] mt-3 sm:mt-3.5 mb-2.5" />
            
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#707D6B]">
              <ShieldCheck className="w-3 h-3 text-[#707D6B]" />
              <span>Protected by Dynamic IST Route Verification</span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundPlayer.playWaterDrop();
                navigate('/');
              }}
              className="text-[11px] font-semibold text-[#123F2D] hover:underline transition flex items-center justify-center gap-1.5 mx-auto mt-2 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5 text-[#123F2D]" />
              <span>Return to Public Website</span>
            </button>

          </div>

        </section>

      </div>

      {/* Staff First-Time Setup Modal */}
      {firstTimeUser && (
        <StaffFirstTimeSetupModal
          isOpen={showFirstTimeSetup}
          user={firstTimeUser}
          onSuccess={(newSession) => {
            setShowFirstTimeSetup(false);
            setFirstTimeUser(null);
            setSession(newSession);
          }}
          onCancel={() => {
            setShowFirstTimeSetup(false);
            setFirstTimeUser(null);
          }}
        />
      )}
    </div>
  );
};
