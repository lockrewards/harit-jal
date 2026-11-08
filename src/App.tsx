import { useState, useEffect, lazy, Suspense } from 'react';
import { RouterProvider, useRouter } from './router/RouterContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { BookCallModal } from './components/BookCallModal';
import { CustomerPortalModal } from './components/CustomerPortalModal';
import { LegalModal } from './components/LegalModal';
import { MascotNeer } from './components/MascotNeer';
import { WaterBottleCursor } from './components/WaterBottleCursor';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { PageSkeletonLoader, TopLiquidProgressBar } from './components/PageSkeletonLoader';

// Pages
import { HomePage } from './pages/HomePage';
import { GalleryPage } from './pages/GalleryPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { ContactPage } from './pages/ContactPage';
import { CompliancePage } from './pages/CompliancePage';
import { TrackPage } from './pages/TrackPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Lazy-loaded Admin Page for security and bundle isolation
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));

import { StorageService } from './services/storage';
import { CustomerAuthService } from './services/customerAuth';
import { DynamicAdminRouter } from './services/dynamicAdminRouter';
import { AdminAuthService } from './services/adminAuth';

const VALID_ROUTES = new Set([
  '/',
  '/home',
  '/collections',
  '/gallery',
  '/how-it-works',
  '/supply-journey',
  '/roadmap',
  '/contact',
  '/book-a-call',
  '/compliance',
  '/standards',
  '/legal',
  '/track',
  '/orders',
  '/portal',
  '/login',
]);

function AppContent() {
  const { currentPath, targetPath, navigate, isNavigating } = useRouter();

  const normalizedPath = currentPath.toLowerCase().replace(/\/+$/, '') || '/';
  const dynamicAdminToken = DynamicAdminRouter.extractToken(normalizedPath);
  const isValidAdminToken = dynamicAdminToken
    ? (DynamicAdminRouter.validateRoute(dynamicAdminToken).isValid || AdminAuthService.isAuthenticated())
    : false;
  const isDynamicAdminRoute = isValidAdminToken;

  const is404 = (!VALID_ROUTES.has(normalizedPath) && !isDynamicAdminRoute) || normalizedPath === '/404';
  const isAdminRoute = isDynamicAdminRoute;
  const isLoginPage = normalizedPath === '/login' || normalizedPath === '/portal' || normalizedPath === '/track' || normalizedPath === '/orders';
  const hidePublicChrome = is404 || isAdminRoute;
  const hideFooter = hidePublicChrome || isLoginPage;

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);

  const [modalInitialData, setModalInitialData] = useState<{
    restaurantName?: string;
    bottleSize?: '250ml' | '500ml' | '750ml_glass' | '1000ml';
    capColor?: string;
    labelTheme?: string;
  }>({});

  // Track page visits
  useEffect(() => {
    const pageLabel = currentPath === '/' ? 'Home' : currentPath.replace('/', '');
    StorageService.trackCurrentVisitorSession(pageLabel);
  }, [currentPath]);

  const handleSelectProductForCustomizer = () => {
    navigate('/gallery');
  };

  const handleOpenCustomerPortalForEmail = (email: string) => {
    const cust = CustomerAuthService.login(email);
    if (cust) {
      navigate('/track');
    } else {
      navigate('/login');
    }
  };

  // Route resolver
  const renderCurrentPage = () => {
    const normalized = currentPath.toLowerCase().replace(/\/+$/, '') || '/';

    // 1. Dynamic Time-Based Administrative Access (DDMMYYHHMM)
    const token = DynamicAdminRouter.extractToken(normalized);
    if (token) {
      const validation = DynamicAdminRouter.validateRoute(token);
      if (validation.isValid || AdminAuthService.isAuthenticated()) {
        return (
          <Suspense fallback={<PageSkeletonLoader path={normalized} />}>
            <AdminPage routeToken={token} />
          </Suspense>
        );
      }
      // If token is expired (even by 1 minute), future, or invalid: return genuine 404
      return <NotFoundPage />;
    }

    switch (normalized) {
      case '/':
      case '/home':
        return (
          <HomePage
            onOpenBookingModal={() => {
              setModalInitialData({});
              setIsBookingModalOpen(true);
            }}
            onSelectProductForCustomizer={handleSelectProductForCustomizer}
          />
        );

      case '/gallery':
        return (
          <GalleryPage
            onOpenBookingModalWithProduct={(productDetails) => {
              setModalInitialData({
                restaurantName: productDetails.restaurantName,
                bottleSize: productDetails.bottleSize,
                capColor: productDetails.capColor,
                labelTheme: productDetails.labelTheme,
              });
              setIsBookingModalOpen(true);
            }}
          />
        );

      case '/collections':
        return (
          <CollectionsPage
            onSelectProductForCustomizer={() => navigate('/gallery')}
            onOpenBookingModalWithProduct={(bottle) => {
              setModalInitialData({
                restaurantName: bottle.title,
                bottleSize: bottle.size,
                capColor: bottle.capColor,
                labelTheme: bottle.category,
              });
              setIsBookingModalOpen(true);
            }}
          />
        );

      case '/how-it-works':
      case '/supply-journey':
      case '/roadmap':
        return (
          <HowItWorksPage
            onOpenBookingModal={() => {
              setModalInitialData({});
              setIsBookingModalOpen(true);
            }}
          />
        );

      case '/contact':
      case '/book-a-call':
        return (
          <ContactPage
            onOpenCustomerPortal={handleOpenCustomerPortalForEmail}
          />
        );

      case '/compliance':
      case '/standards':
      case '/legal':
        return <CompliancePage />;

      case '/track':
      case '/orders':
      case '/portal':
      case '/login':
        return <TrackPage />;

      case '/404':
      default:
        return <NotFoundPage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F3E9] text-[#102C47] flex flex-col relative selection:bg-[#C99B42] selection:text-[#FFF9EF] font-manrope">
      {/* Fixed Round Navigation Pill - Only on standard website pages */}
      {!hidePublicChrome && (
        <Navbar
          onOpenBookingModal={() => {
            setModalInitialData({});
            setIsBookingModalOpen(true);
          }}
          onOpenAuthModal={() => navigate('/login')}
        />
      )}

      {/* Top Liquid Progress Bar */}
      <TopLiquidProgressBar isVisible={isNavigating} />

      {/* Dynamic Page Content with Skeleton Screen & Smooth Luxury Transition */}
      <main className={`flex-1 ${is404 ? 'flex items-center justify-center' : 'min-h-[60vh]'}`}>
        {isNavigating ? (
          <PageSkeletonLoader path={targetPath || currentPath} />
        ) : (
          <div key={currentPath} className="animate-page-enter w-full">
            {renderCurrentPage()}
          </div>
        )}
      </main>

      {/* Global Brand Footer - Only on standard website pages (hidden on login/customer portal & 404) */}
      {!hideFooter && (
        <Footer
          onOpenBookingModal={() => {
            setModalInitialData({});
            setIsBookingModalOpen(true);
          }}
          onOpenAuthModal={() => navigate('/login')}
          onOpenLegalModal={() => setIsLegalModalOpen(true)}
        />
      )}

      {/* Book Call Consultation Modal */}
      <BookCallModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        initialData={modalInitialData}
        onOpenCustomerPortal={handleOpenCustomerPortalForEmail}
      />

      {/* Customer Quick Auth Modal */}
      <CustomerPortalModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Statutory & Legal Policy Hub Modal */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
      />

      {/* Mascot: "Neer" (नीर) - Starts closed, expands on click - Only on standard pages */}
      {!hidePublicChrome && (
        <MascotNeer
          onOpenBookingModal={() => {
            setModalInitialData({});
            setIsBookingModalOpen(true);
          }}
        />
      )}

      {/* Harit Jal Custom Animated Water Bottle Cursor System - Only on standard pages */}
      {!hidePublicChrome && <WaterBottleCursor />}

      {/* Cookie & Data Privacy Consent Banner (DPDP Act 2023) - Only on standard pages */}
      {!hidePublicChrome && <CookieConsentBanner onOpenLegalModal={() => setIsLegalModalOpen(true)} />}
    </div>
  );
}

export function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}

export default App;
