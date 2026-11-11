import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall, Menu, X, User } from 'lucide-react';
import { soundPlayer } from '../services/sound';
import { Link } from '../router/RouterContext';
import { useRouter } from '../router/useRouter';
import { CustomerAuthService } from '../services/customerAuth';

interface NavbarProps {
  onOpenBookingModal: () => void;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenBookingModal }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const { currentPath, navigate } = useRouter();
  const [customer, setCustomer] = useState(() => CustomerAuthService.getCurrentCustomer());

  useEffect(() => {
    const handleAuthChange = () => {
      setCustomer(CustomerAuthService.getCurrentCustomer());
    };
    window.addEventListener('customerAuthChange', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('customerAuthChange', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on outside tap or Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleNavClick = (path: string) => {
    soundPlayer.playWaterDrop();
    setMobileMenuOpen(false);
    navigate(path);
  };

  const navLinks = [
    { label: 'Bottle Gallery', path: '/gallery' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Compliance & BIS', path: '/compliance' },
    { label: 'Contact', path: '/contact' },
  ];

  return (
    <header 
      ref={headerRef}
      className="fixed top-2 sm:top-3.5 inset-x-0 z-50 px-2.5 sm:px-6 lg:px-8 max-w-7xl mx-auto transition-all duration-300"
    >
      {/* 
        Simplified, Compact Premium Liquid-Glass Navigation Pill:
        - Ivory/Cream backdrop (#FFF9EF)
        - Subtle Champagne Gold (#C99B42) border
        - Only 4 primary links: Bottle Gallery | Collections | How It Works | Contact
        - Right: Prominent Gold "Book a Call" button
      */}
      <div 
        className={`relative rounded-full px-3 sm:px-5 flex items-center justify-between transition-all duration-300 border ${
          isScrolled 
            ? 'bg-[#FFF9EF]/85 py-1.5 sm:py-2 border-[#C99B42]/45 shadow-[0_12px_36px_rgba(16,44,71,0.12)] backdrop-blur-md'
            : 'bg-[#FFF9EF]/95 py-2 sm:py-2.5 border-[#C99B42]/30 shadow-[0_8px_24px_rgba(16,44,71,0.06)] backdrop-blur-sm'
        }`}
      >
        
        {/* Brand Logo & Name */}
        <Link 
          to="/" 
          onClick={() => {
            soundPlayer.playWaterDrop();
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-2 sm:gap-2.5 group select-none shrink-0"
        >
          {/* Round Circle Brand Logo Mark */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#C99B42]/70 flex items-center justify-center bg-[#FFF9EF] shadow-inner overflow-hidden p-0.5 sm:p-1 group-hover:border-[#C99B42] group-hover:scale-105 transition-all shrink-0">
            <img 
              src="/images/brand/harit-jal-logo-mark.png" 
              alt="Harit Jal Logo" 
              className="w-full h-full object-contain filter drop-shadow-xs" 
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#102C47] group-hover:text-[#C99B42] transition-colors font-playfair leading-tight whitespace-nowrap">
                Harit Jal<span className="text-[10px] text-[#C99B42] align-top">™</span>
              </span>
              <span className="hidden min-[380px]:inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#52652D]/10 text-[#52652D] border border-[#52652D]/30 font-devanagari shrink-0">
                हरित जल
              </span>
            </div>
            <span className="hidden min-[540px]:block text-[7.5px] sm:text-[8.5px] text-[#77766F] tracking-widest uppercase font-semibold">
              Bespoke Dining Hydration
            </span>
          </div>
        </Link>

        {/* Center: Exactly 4 Primary Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-[13px] font-semibold font-manrope text-[#102C47]">
          {navLinks.map((link) => {
            const isActive = currentPath === link.path;
            return (
              <button
                key={link.path}
                onClick={() => handleNavClick(link.path)}
                className={`px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                  isActive
                    ? 'text-[#C99B42] bg-[#F8F3E9] font-bold shadow-xs'
                    : 'hover:text-[#C99B42] hover:bg-[#F8F3E9]/60'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Right Action Area */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Partner / Business Login Button -> Visible on Tablet & Desktop (sm: 640px+) */}
          <button
            onClick={() => {
              soundPlayer.playWaterDrop();
              navigate('/login');
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full border border-[#C99B42]/50 hover:border-[#C99B42] bg-[#FFF9EF] hover:bg-[#F8F3E9] text-[#102C47] text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
            title={customer ? `Logged in: ${customer.restaurantName}` : 'Partner / Business Login'}
            aria-label="Partner Login"
          >
            <User className="w-3.5 h-3.5 text-[#C99B42] shrink-0" />
            <span className="whitespace-nowrap">
              {customer ? (customer.restaurantName.length > 12 ? `${customer.restaurantName.slice(0, 10)}...` : customer.restaurantName) : 'Partner Login'}
            </span>
          </button>

          {/* Book a Call -> Full on Tablet & Desktop (sm: 640px+) */}
          <button
            onClick={() => {
              soundPlayer.playSuccessChime();
              onOpenBookingModal();
            }}
            className="hidden sm:flex btn-gold-luxury items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold shadow-xs cursor-pointer active:scale-95 shrink-0"
            aria-label="Book a Call Consultation"
          >
            <PhoneCall className="w-3.5 h-3.5 text-[#102C47] shrink-0" />
            <span className="whitespace-nowrap">Book a Call</span>
          </button>

          {/* Compact Quick Consult -> Only on medium phones (480px–639px) where space is comfortable */}
          <button
            onClick={() => {
              soundPlayer.playSuccessChime();
              onOpenBookingModal();
            }}
            className="hidden min-[480px]:flex sm:hidden btn-gold-luxury items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold shadow-xs cursor-pointer active:scale-95 shrink-0"
            aria-label="Consultation"
          >
            <PhoneCall className="w-3 h-3 text-[#102C47] shrink-0" />
            <span>Consult</span>
          </button>

          {/* Mobile Menu Toggle Button -> Centered, dedicated size, never clipped */}
          <button
            onClick={() => {
              soundPlayer.playWaterDrop();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            className="md:hidden flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full text-[#102C47] hover:bg-[#102C47]/10 active:bg-[#102C47]/15 transition cursor-pointer shrink-0"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#102C47]" /> : <Menu className="w-5 h-5 text-[#102C47]" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden mt-2 rounded-2xl bg-[#FFF9EF]/98 border border-[#C99B42]/40 p-3.5 sm:p-4 shadow-2xl backdrop-blur-xl animate-fadeIn text-[#102C47] font-manrope max-h-[80dvh] overflow-y-auto"
        >
          <div className="flex flex-col gap-1 text-sm font-semibold">
            {navLinks.map((link) => {
              const isActive = currentPath === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`flex items-center justify-between text-left py-2.5 px-3 rounded-xl transition cursor-pointer ${
                    isActive 
                      ? 'bg-[#F8F3E9] text-[#C99B42] font-bold shadow-2xs' 
                      : 'hover:bg-[#F8F3E9] text-[#102C47]'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#C99B42]" />}
                </button>
              );
            })}

            {/* In mobile view, Partner Login and Consultation Call live here */}
            <div className="pt-3 mt-1 border-t border-[#C99B42]/25 flex flex-col gap-2">
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setMobileMenuOpen(false);
                  navigate('/login');
                }}
                className="w-full py-2.5 px-4 rounded-full border border-[#C99B42]/60 bg-[#FFF9EF] hover:bg-[#F8F3E9] text-[#102C47] text-center font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-98 transition"
              >
                <User className="w-3.5 h-3.5 text-[#C99B42] shrink-0" />
                <span>
                  {customer ? `Partner Account (${customer.restaurantName})` : 'Partner Login / Order Tracking'}
                </span>
              </button>

              <button
                onClick={() => {
                  soundPlayer.playSuccessChime();
                  setMobileMenuOpen(false);
                  onOpenBookingModal();
                }}
                className="btn-gold-luxury w-full py-2.5 px-4 rounded-full text-center font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[#102C47] shrink-0" />
                <span>Book a Free Consultation Call</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
