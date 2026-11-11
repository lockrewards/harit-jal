import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Home, LogOut, 
  Layers, BarChart3, Settings
} from 'lucide-react';
import { useRouter } from '../router/useRouter';
import { AdminAuthService, AdminSession } from '../services/adminAuth';
import { DynamicAdminRouter } from '../services/dynamicAdminRouter';
import { AdminPortal } from '../components/AdminPortal';
import { NotFoundPage } from './NotFoundPage';
import { PageSkeletonLoader } from '../components/PageSkeletonLoader';
import { HaritJalLoader } from '../components/ui/HaritJalLoader';
import { soundPlayer } from '../services/sound';
import { StaffFirstTimeSetupModal } from '../components/admin/StaffFirstTimeSetupModal';
import { MfaEnrollmentModal } from '../components/admin/MfaEnrollmentModal';
import { UnifiedLoginCard } from '../components/auth/UnifiedLoginCard';
import { isProductionEnvironment } from '../services/env';
import { isSupabaseConfigured } from '../services/supabase';
import { formatRoleDisplay } from '../services/roles';
import { AdminUser } from '../types';

interface AdminPageProps {
  routeToken?: string;
}

export const AdminPage: React.FC<AdminPageProps> = ({ routeToken }) => {
  const { navigate, currentPath } = useRouter();

  // Route token from prop or current path
  const token = routeToken || DynamicAdminRouter.extractToken(currentPath) || '';

  // Authentication & route validation state (fail closed behind skeleton while awaiting server gateway check)
  const [session, setSession] = useState<AdminSession | null>(() => AdminAuthService.getCurrentSession());
  const [isVerifyingInitialSession, setIsVerifyingInitialSession] = useState<boolean>(() => {
    const active = AdminAuthService.getCurrentSession();
    return Boolean(active && AdminAuthService.isAuthenticated() && (isProductionEnvironment() || isSupabaseConfigured()));
  });
  const [routeValidation, setRouteValidation] = useState(() => {
    if (!token) return DynamicAdminRouter.validateRoute('');
    if (isProductionEnvironment()) {
      return {
        isValid: false,
        token,
        mode: 'server_edge_function' as const,
        serverVerified: false,
      };
    }
    return DynamicAdminRouter.validateRoute(token);
  });
  const [isVerifyingRoute, setIsVerifyingRoute] = useState<boolean>(() => {
    const activeSession = AdminAuthService.getCurrentSession();
    if (activeSession && AdminAuthService.isAuthenticated()) return false;
    return Boolean(token) && isProductionEnvironment();
  });
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const now = new Date();
    return 60 - now.getSeconds();
  });

  // First-Time Staff Setup & Native MFA Enrollment Modals
  const [firstTimeUser, setFirstTimeUser] = useState<AdminUser | null>(null);
  const [showFirstTimeSetup, setShowFirstTimeSetup] = useState(false);
  const [mfaEnrollmentUser, setMfaEnrollmentUser] = useState<AdminUser | null>(null);
  const [showMfaEnrollment, setShowMfaEnrollment] = useState(false);

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

  // Authoritatively verify gateway token via Edge Function and maintain IST 1s countdown
  useEffect(() => {
    if (session && AdminAuthService.isAuthenticated() && !isVerifyingInitialSession) return;
    let isMounted = true;

    const verifyAuthoritative = async () => {
      const res = await DynamicAdminRouter.validateRouteAuthoritative(token);
      if (isMounted) {
        setRouteValidation(res);
        setIsVerifyingRoute(false);
      }
    };

    void verifyAuthoritative();

    const interval = setInterval(() => {
      const now = new Date();
      setSecondsRemaining(60 - now.getSeconds());

      if (isProductionEnvironment()) {
        if (now.getSeconds() === 0) {
          void verifyAuthoritative();
        }
      } else {
        setRouteValidation(DynamicAdminRouter.validateRoute(token));
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, session, isVerifyingInitialSession]);

  // Live session check: verify AAL2, server block state, and role/permission freshness
  useEffect(() => {
    if (!session) return;
    let isMounted = true;

    const validateActiveSession = async () => {
      const liveCheck = await AdminAuthService.verifyLiveSession();
      if (!isMounted) return;
      setIsVerifyingInitialSession(false);

      if (!liveCheck.valid) {
        AdminAuthService.logout();
        setSession(null);
        return;
      }

      if (
        liveCheck.session &&
        (liveCheck.session.role !== session.role ||
          liveCheck.session.email !== session.email ||
          liveCheck.session.phone !== session.phone ||
          JSON.stringify(liveCheck.session.permissions || []) !==
            JSON.stringify(session.permissions || []))
      ) {
        setSession(liveCheck.session);
      }
    };

    void validateActiveSession();
    const handleWindowFocus = () => {
      void validateActiveSession();
    };
    window.addEventListener('focus', handleWindowFocus);
    const interval = setInterval(() => {
      void validateActiveSession();
    }, 60000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(interval);
    };
  }, [session]);

  const handleLogout = () => {
    soundPlayer.playBubblePop();
    AdminAuthService.logout();
    setSession(null);
    setIsVerifyingInitialSession(false);
    setFirstTimeUser(null);
    setShowFirstTimeSetup(false);
    setMfaEnrollmentUser(null);
    setShowMfaEnrollment(false);
    navigate('/');
  };

  // -------------------------------------------------------------
  // 1. AUTHENTICATED STATE: Render full Admin Operations Console
  // (Fail closed behind PageSkeletonLoader until live session is verified)
  // -------------------------------------------------------------
  if (isVerifyingInitialSession) {
    return <PageSkeletonLoader path={currentPath} />;
  }

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
                {formatRoleDisplay(session.role)}
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

  if (isVerifyingRoute) {
    return (
      <HaritJalLoader 
        variant="fullscreen" 
        size="xl" 
        message="Verifying Operations Gateway..." 
        subMessage="Validating dynamic cryptographic window and credentials..." 
      />
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
    <div className="min-h-screen w-full bg-[#FAF7EE] text-[#35432D] font-manrope selection:bg-[#C99A3C]/20 selection:text-[#123F2D] relative flex flex-col justify-center py-6 lg:py-8 overflow-y-auto">
      
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
      <div className="w-full max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col lg:flex-row items-center justify-between relative z-10 my-auto gap-8">
        
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
        <section className="w-full lg:w-[38%] xl:w-[36%] flex flex-col items-center justify-center lg:justify-start lg:pl-6 xl:pl-10 py-2 lg:py-0">
          
          {/* IST ACCESS INDICATOR */}
          <div className="w-full max-w-[420px] mb-3 p-2 px-3 rounded-full bg-[#E8F3EB] border border-[#C5E0CC] flex items-center justify-between text-[11px] text-[#123F2D] shadow-2xs">
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

          {/* UNIFIED PREMIUM LOGIN CARD (ADMIN & STAFF ACCESS) */}
          <UnifiedLoginCard
            initialAccountType="admin"
            allowedAccountTypes={['admin', 'staff']}
            onSuccess={(result) => {
              if (result.adminSession) {
                setSession(result.adminSession);
                soundPlayer.playSuccessChime();
              }
            }}
            onRequireFirstTimeSetup={(user) => {
              setFirstTimeUser(user);
              setShowFirstTimeSetup(true);
            }}
            onRequireMfaEnrollment={(user) => {
              setMfaEnrollmentUser(user);
              setShowMfaEnrollment(true);
            }}
          />

          {/* Return to Public Website */}
          <button
            type="button"
            onClick={() => {
              soundPlayer.playWaterDrop();
              navigate('/');
            }}
            className="text-xs font-semibold text-[#123F2D] hover:underline transition flex items-center justify-center gap-1.5 mx-auto mt-4 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5 text-[#123F2D]" />
            <span>Return to Public Website</span>
          </button>

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
            AdminAuthService.logout();
            setShowFirstTimeSetup(false);
            setFirstTimeUser(null);
          }}
        />
      )}

      {/* Existing Staff & Root Super Admin Native MFA Enrollment Modal */}
      {mfaEnrollmentUser && (
        <MfaEnrollmentModal
          isOpen={showMfaEnrollment}
          user={mfaEnrollmentUser}
          onSuccess={(newSession) => {
            setShowMfaEnrollment(false);
            setMfaEnrollmentUser(null);
            setSession(newSession);
          }}
          onCancel={() => {
            AdminAuthService.logout();
            setShowMfaEnrollment(false);
            setMfaEnrollmentUser(null);
          }}
        />
      )}
    </div>
  );
};
