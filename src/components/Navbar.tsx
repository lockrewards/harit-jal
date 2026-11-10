import React, { useState, useEffect } from 'react';
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
    <header className="fixed top-2.5 sm:top-3.5 inset-x-0 z-50 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto transition-all duration-300">
      {/* 
        Simplified, Compact Premium Liquid-Glass Navigation Pill:
        - Ivory/Cream backdrop (#FFF9EF)
        - Subtle Champagne Gold (#C99B42) border
        - Only 4 primary links: Bottle Gallery | Collections | How It Works | Contact
        - Right: Prominent Gold "Book a Call" button
      */}
      <div 
        className={`relative rounded-full px-3.5 sm:px-5 flex items-center justify-between transition-all duration-300 border ${
          isScrolled 
            ? 'bg-[#FFF9EF]/85 py-1.5 sm:py-2 border-[#C99B42]/45 shadow-[0_12px_36px_rgba(16,44,71,0.12)] backdrop-blur-md'
            : 'bg-[#FFF9EF]/95 py-2 sm:py-2.5 border-[#C99B42]/30 shadow-[0_8px_24px_rgba(16,44,71,0.06)] backdrop-blur-sm'
        }`}
      >
        
        {/* Brand Logo & Name */}
        <Link 
          to="/" 
          onClick={() => soundPlayer.playWaterDrop()}
          className="flex items-center gap-2 sm:gap-2.5 group select-none shrink-0"
        >
          {/* Round Circle Brand Logo Mark */}
          <div className="w-8 h-8 rounded-full border border-[#C99B42]/70 flex items-center justify-center bg-[#FFF9EF] shadow-inner overflow-hidden p-1 group-hover:border-[#C99B42] group-hover:scale-105 transition-all">
            <img 
              src="/images/brand/harit-jal-logo-mark.png" 
              alt="Harit Jal Logo" 
              className="w-full h-full object-contain filter drop-shadow-xs" 
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#102C47] group-hover:text-[#C99B42] transition-colors font-playfair leading-tight">
                Harit Jal<span className="text-[10px] text-[#C99B42] align-top">™</span>
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#52652D]/10 text-[#52652D] border border-[#52652D]/30 font-devanagari">
                हरित जल
              </span>
            </div>
            <span className="text-[7.5px] sm:text-[8.5px] text-[#77766F] tracking-widest uppercase font-semibold">
              Bespoke Dining Hydration
            </span>
          </div>
        </Link>

        {/* Center: Exactly 4 Primary Links */}
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

        {/* Right: Partner Login & Prominent Gold "Book a Call" CTA */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Partner / Business Login Button -> Opens dedicated Partner Login / Portal Page */}
          <button
            onClick={() => {
              soundPlayer.playWaterDrop();
              navigate('/login');
            }}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-full border border-[#C99B42]/50 hover:border-[#C99B42] bg-[#FFF9EF] hover:bg-[#F8F3E9] text-[#102C47] text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
            title={customer ? `Logged in: ${customer.restaurantName}` : 'Partner / Business Login'}
          >
            <User className="w-3.5 h-3.5 text-[#C99B42]" />
            <span className="whitespace-nowrap hidden sm:inline">
              {customer ? (customer.restaurantName.length > 12 ? `${customer.restaurantName.slice(0, 10)}...` : customer.restaurantName) : 'Partner Login'}
            </span>
            <span className="whitespace-nowrap sm:hidden">
              {customer ? 'Partner' : 'Login'}
            </span>
          </button>

          {/* Book a Call */}
          <button
            onClick={() => {
              soundPlayer.playSuccessChime();
              onOpenBookingModal();
            }}
            className="btn-gold-luxury flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold shadow-xs cursor-pointer active:scale-95"
          >
            <PhoneCall className="w-3.5 h-3.5 text-[#102C47]" />
            <span className="whitespace-nowrap hidden sm:inline">Book a Call</span>
            <span className="whitespace-nowrap sm:hidden">Consult</span>
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-full text-[#102C47] hover:bg-[#102C47]/5 transition cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 rounded-2xl bg-[#FFF9EF]/95 border border-[#C99B42]/35 p-3.5 shadow-xl backdrop-blur-xl animate-fadeIn text-[#102C47] font-manrope">
          <div className="flex flex-col gap-1 font-semibold text-sm">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => handleNavClick(link.path)}
                className={`text-left py-2 px-3 rounded-xl transition ${
                  currentPath === link.path ? 'bg-[#F8F3E9] text-[#C99B42] font-bold' : 'hover:bg-[#F8F3E9]'
                }`}
              >
                {link.label}
              </button>
            ))}
            <div className="pt-2 border-t border-[#C99B42]/20 flex flex-col gap-2">
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setMobileMenuOpen(false);
                  navigate('/login');
                }}
                className="w-full py-2.5 rounded-full border border-[#C99B42]/60 bg-[#F8F3E9] text-[#102C47] text-center font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <User className="w-3.5 h-3.5 text-[#C99B42]" />
                <span>{customer ? `Partner Account (${customer.restaurantName})` : 'Partner Login / Order Tracking'}</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenBookingModal();
                }}
                className="btn-gold-luxury w-full py-2.5 rounded-full text-center font-bold text-xs shadow-sm cursor-pointer"
              >
                Book a Free Consultation Call
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
