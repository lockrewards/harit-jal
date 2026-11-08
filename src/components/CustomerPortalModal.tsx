import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, PhoneCall, Truck, Package, CheckCircle2, Clock, LogOut, PlusCircle, UserCheck
} from 'lucide-react';
import { CustomerAccount, CustomerOrder, CallBooking } from '../types';
import { CustomerAuthService } from '../services/customerAuth';
import { StorageService } from '../services/storage';
import { OtpService } from '../services/otpService';
import { CustomerOtpCard } from './CustomerOtpCard';
import { InlineOtpSection } from './InlineOtpSection';
import { CustomerProfileSettingsModal } from './CustomerProfileSettingsModal';
import { soundPlayer } from '../services/sound';

interface CustomerPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
  prefillEmail?: string;
  prefillRestaurant?: string;
  prefillPhone?: string;
  prefillOwner?: string;
  prefillCity?: string;
}

export const CustomerPortalModal: React.FC<CustomerPortalModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  prefillEmail = '',
  prefillRestaurant = '',
  prefillPhone = '',
  prefillOwner = '',
  prefillCity = '',
}) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot_password' | 'verify_signup_otp' | 'verify_reset_otp'>(initialMode);
  const [currentUser, setCurrentUser] = useState<CustomerAccount | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [myInquiries, setMyInquiries] = useState<CallBooking[]>([]);
  const [activeTab, setActiveTab] = useState<'track' | 'new_order' | 'inquiry'>('track');
  const [isSignupOtpVerified, setIsSignupOtpVerified] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState(prefillEmail || 'karanpreet@karanthedhaba.com');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState(prefillEmail || '');
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Sign up form state
  const [signupRestaurant, setSignupRestaurant] = useState(prefillRestaurant || 'Karan The Dhaba');
  const [signupOwner, setSignupOwner] = useState(prefillOwner || 'Karanpreet Singh');
  const [signupPhone, setSignupPhone] = useState(prefillPhone || '+91 62992 93497');
  const [signupEmail, setSignupEmail] = useState(prefillEmail || 'info@haritjal.in');
  const [signupCity, setSignupCity] = useState(prefillCity || 'Murthal, GT Road, Haryana');
  const [signupPassword, setSignupPassword] = useState('password123');
  const [signupDpdpConsent, setSignupDpdpConsent] = useState(true);

  // Place order state
  const [orderSize, setOrderSize] = useState<'250ml' | '500ml' | '750ml_glass' | '1000ml'>('500ml');
  const [orderCases, setOrderCases] = useState<number>(50);
  const [deliveryAddress, setDeliveryAddress] = useState('Milestone 52, GT Karnal Road, Murthal, Haryana');
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Rates
  const getRate = (size: typeof orderSize) => {
    if (size === '750ml_glass') return 24;
    if (size === '1000ml') return 11;
    return 7.5;
  };

  const bottlesPerCase = orderSize === '1000ml' ? 12 : orderSize === '750ml_glass' ? 12 : 24;
  const totalBottles = orderCases * bottlesPerCase;
  const totalCost = totalBottles * getRate(orderSize);

  useEffect(() => {
    if (isOpen) {
      const user = CustomerAuthService.getCurrentCustomer();
      setCurrentUser(user);
      if (user) {
        refreshCustomerData(user.email);
      }
    }
  }, [isOpen]);

  const refreshCustomerData = (email: string) => {
    const customerOrders = CustomerAuthService.getOrdersForCustomer(email);
    setOrders(customerOrders);

    // Filter inquiries by email
    const allInquiries = StorageService.getBookings();
    const matched = allInquiries.filter(
      (inq) => inq.email.toLowerCase() === email.toLowerCase()
    );
    setMyInquiries(matched);
  };

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    soundPlayer.playWaterDrop();

    const res = CustomerAuthService.loginWithSecurity(loginEmail, loginPassword);
    if (res.success && res.customer) {
      setCurrentUser(res.customer);
      refreshCustomerData(res.customer.email);
      soundPlayer.playSuccessChime();
    } else {
      soundPlayer.playBubblePop();
      setLoginError(res.error || 'Invalid email or password. Use demo credentials or click Create Account.');
    }
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccess(null);

    if (!signupDpdpConsent) {
      setLoginError('Please consent to data processing under the DPDP Act 2023 to create your account.');
      soundPlayer.playBubblePop();
      return;
    }

    if (!signupEmail || !signupEmail.includes('@')) {
      setLoginError('Please enter a valid email address.');
      soundPlayer.playBubblePop();
      return;
    }

    if (!signupPassword || signupPassword.length < 6) {
      setLoginError('Password must be at least 6 characters.');
      soundPlayer.playBubblePop();
      return;
    }

    if (!isSignupOtpVerified) {
      setLoginError('Please click "Send OTP on Email" below and verify your 6-digit code before creating your account.');
      soundPlayer.playBubblePop();
      return;
    }

    soundPlayer.playWaterDrop();
    const newAccount = CustomerAuthService.register({
      restaurantName: signupRestaurant,
      ownerName: signupOwner,
      email: signupEmail,
      phone: signupPhone,
      city: signupCity,
      password: signupPassword,
    });

    setCurrentUser(newAccount);
    refreshCustomerData(newAccount.email);
    soundPlayer.playSuccessChime();

    confetti({
      particleCount: 85,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#C99B43', '#455C22', '#102B46'],
    });

    setLoginSuccess('Thank you for creating an account! Your restaurant partner portal is now active.');
  };

  const handleRequestPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    soundPlayer.playWaterDrop();

    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Please enter your registered restaurant partner email address.');
      soundPlayer.playBubblePop();
      return;
    }

    const block = OtpService.checkBlockStatus(forgotEmail);
    if (block.isBlocked) {
      setForgotError(`This email address is locked for 24 hours. Remaining: ${block.remainingFormatted}.`);
      soundPlayer.playBubblePop();
      return;
    }

    const res = OtpService.requestPasswordReset(forgotEmail);
    if (res.success) {
      setMode('verify_reset_otp');
    } else {
      setForgotError(res.error || 'Failed to initiate password reset.');
      soundPlayer.playBubblePop();
    }
  };

  const handleLogout = () => {
    soundPlayer.playBubblePop();
    CustomerAuthService.logout();
    setCurrentUser(null);
    setOrders([]);
    setMyInquiries([]);
    setMode('login');
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    soundPlayer.playWaterDrop();
    const newOrder = CustomerAuthService.placeOrder({
      ownerEmail: currentUser.email,
      restaurantName: currentUser.restaurantName,
      bottleSize: orderSize,
      caseCount: orderCases,
      bottlesTotal: totalBottles,
      ratePerBottle: getRate(orderSize),
      totalAmount: totalCost,
      deliveryAddress,
    });

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#C99B43', '#455C22', '#102B46'],
    });

    soundPlayer.playSuccessChime();
    setOrderSuccess(`Order ${newOrder.id} placed successfully! Automated fleet dispatch scheduled.`);
    refreshCustomerData(currentUser.email);
    setActiveTab('track');
    setTimeout(() => setOrderSuccess(null), 5000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#102B46]/65 backdrop-blur-md animate-fadeIn font-manrope">
      <div className="relative w-full max-w-4xl rounded-3xl bg-[#FFF9EF] border border-[#C99B43]/45 p-5 sm:p-7 md:p-8 max-h-[92vh] overflow-y-auto text-[#102B46] shadow-[0_25px_65px_rgba(16,43,70,0.25)]">
        
        {/* Close Button */}
        <button
          onClick={() => {
            soundPlayer.playWaterDrop();
            onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-full text-[#77766F] hover:text-[#102B46] hover:bg-[#102B46]/10 transition cursor-pointer"
          aria-label="Close portal modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LOGGED IN VIEW: CUSTOMER DASHBOARD */}
        {currentUser ? (
          <div className="space-y-6">
            
            {/* Header: Restaurant Profile & Logout */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#C99B43]/20">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#102B46] text-[#C99B43] flex items-center justify-center font-bold text-lg shadow-sm">
                  {currentUser.restaurantName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold font-playfair text-[#102B46]">
                      {currentUser.restaurantName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-[#455C22]/10 text-[#455C22] text-[10px] font-bold border border-[#455C22]/30">
                      REGISTERED PARTNER
                    </span>
                  </div>
                  <p className="text-xs text-[#77766F]">
                    {currentUser.ownerName} • <span className="text-[#102B46] font-semibold">{currentUser.city}</span> ({currentUser.email})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundPlayer.playWaterDrop();
                    setShowProfileSettings(true);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-[#102B46] text-[#FFF9EF] hover:bg-[#183C60] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#C99B43]" />
                  <span>Profile Settings</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 rounded-full bg-[#F8F3E9] hover:bg-[#102B46]/10 text-[#102B46] text-xs font-semibold flex items-center gap-1.5 border border-[#C99B43]/30 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>

            {/* Notification alert */}
            {orderSuccess && (
              <div className="p-3.5 rounded-2xl bg-[#455C22]/10 border border-[#455C22] text-[#455C22] text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{orderSuccess}</span>
              </div>
            )}

            {/* Dashboard Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[#C99B43]/20 pb-2">
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('track');
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'track'
                    ? 'btn-gold-luxury shadow-sm'
                    : 'bg-[#F8F3E9] text-[#102B46] hover:bg-[#102B46]/10'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Track Orders ({orders.length})</span>
              </button>

              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('new_order');
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'new_order'
                    ? 'btn-gold-luxury shadow-sm'
                    : 'bg-[#F8F3E9] text-[#102B46] hover:bg-[#102B46]/10'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-[#455C22]" />
                <span>Place New Bottle Order</span>
              </button>

              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('inquiry');
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'inquiry'
                    ? 'btn-gold-luxury shadow-sm'
                    : 'bg-[#F8F3E9] text-[#102B46] hover:bg-[#102B46]/10'
                }`}
              >
                <PhoneCall className="w-4 h-4" />
                <span>My Consultation Calls ({myInquiries.length})</span>
              </button>
            </div>

            {/* TAB 1: TRACK ACTIVE ORDERS */}
            {activeTab === 'track' && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/25 space-y-3">
                    <Package className="w-12 h-12 text-[#C99B43] mx-auto" />
                    <h3 className="text-base font-bold text-[#102B46]">No Orders Placed Yet</h3>
                    <p className="text-xs text-[#77766F] max-w-sm mx-auto">
                      Place your first recurring custom bottle order to experience seamless cellar delivery.
                    </p>
                    <button
                      onClick={() => setActiveTab('new_order')}
                      className="px-5 py-2.5 rounded-full bg-[#102B46] hover:bg-[#183C60] text-[#FFF9EF] font-bold text-xs cursor-pointer"
                    >
                      Place First Order
                    </button>
                  </div>
                ) : (
                  orders.map((ord) => (
                    <div key={ord.id} className="p-5 sm:p-6 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/30 space-y-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#C99B43]/15">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#102B46] text-sm">{ord.id}</span>
                            <span className="text-xs text-[#77766F]">• Ordered on {ord.orderedAt}</span>
                          </div>
                          <div className="text-xs text-[#102B46] font-semibold mt-0.5">
                            {ord.caseCount} Cases ({ord.bottlesTotal.toLocaleString()} bottles of {ord.bottleSize})
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-[#455C22]">₹{ord.totalAmount.toLocaleString()}</span>
                          <span className="text-[11px] text-[#77766F] block">Rate: ₹{ord.ratePerBottle} / bottle</span>
                        </div>
                      </div>

                      {/* 4-Step Tracker */}
                      <div>
                        <div className="text-[11px] font-semibold text-[#102B46] uppercase tracking-wider mb-2 flex items-center justify-between">
                          <span>Fulfillment Status:</span>
                          <span className="text-[#455C22] font-bold">{ord.status}</span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center text-[10px] sm:text-xs">
                          <div className="p-2 rounded-xl bg-[#455C22]/15 border border-[#455C22] text-[#455C22] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 mx-auto mb-1 text-[#455C22]" />
                            <span>1. Confirmed</span>
                          </div>

                          <div className={`p-2 rounded-xl border font-bold ${
                            ord.status !== 'Order Confirmed'
                              ? 'bg-[#455C22]/15 border-[#455C22] text-[#455C22]'
                              : 'bg-white border-[#C99B43]/40 text-[#102B46]'
                          }`}>
                            <Clock className="w-3.5 h-3.5 mx-auto mb-1" />
                            <span>2. Bottling</span>
                          </div>

                          <div className={`p-2 rounded-xl border font-bold ${
                            ord.status === 'Dispatched (Out for Delivery)' || ord.status === 'Delivered to Restaurant'
                              ? 'bg-[#455C22]/15 border-[#455C22] text-[#455C22]'
                              : 'bg-white border-[#C99B43]/20 text-[#77766F]'
                          }`}>
                            <Truck className="w-3.5 h-3.5 mx-auto mb-1" />
                            <span>3. In Transit</span>
                          </div>

                          <div className={`p-2 rounded-xl border font-bold ${
                            ord.status === 'Delivered to Restaurant'
                              ? 'bg-[#455C22]/15 border-[#455C22] text-[#455C22]'
                              : 'bg-white border-[#C99B43]/20 text-[#77766F]'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5 mx-auto mb-1" />
                            <span>4. Delivered</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-[#C99B43]/20 text-xs text-[#77766F] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#102B46] block">Drop-Off Address:</span>
                          <span className="text-[#102B46] font-medium">{ord.deliveryAddress}</span>
                        </div>
                        {ord.driverName && (
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-[#102B46] block">Fleet Driver:</span>
                            <span className="text-[#455C22] font-bold">{ord.driverName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: PLACE NEW ORDER */}
            {activeTab === 'new_order' && (
              <form onSubmit={handlePlaceOrder} className="p-6 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/30 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#C99B43]/20">
                  <h3 className="text-base font-bold text-[#102B46] flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#455C22]" />
                    <span>Order Custom Bottles for "{currentUser.restaurantName}"</span>
                  </h3>
                  <span className="text-xs text-[#455C22] font-bold">BIS IS:14543 Standard</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#102B46] mb-1">Select Bottle Format</label>
                    <select
                      value={orderSize}
                      onChange={(e) => setOrderSize(e.target.value as typeof orderSize)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#C99B43]/30 text-[#102B46] text-xs font-bold focus:outline-none"
                    >
                      <option value="500ml">500ml Dine-In Classic (₹7.50 / bottle)</option>
                      <option value="250ml">250ml Pocket QSR (₹7.50 / bottle)</option>
                      <option value="750ml_glass">750ml Luxury Glass Decanter (₹24.00 / bottle)</option>
                      <option value="1000ml">1000ml Family Banquet (₹11.00 / bottle)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#102B46] mb-1">Number of Cases</label>
                    <select
                      value={orderCases}
                      onChange={(e) => setOrderCases(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#C99B43]/30 text-[#102B46] text-xs font-bold focus:outline-none"
                    >
                      <option value={25}>25 Cases ({25 * bottlesPerCase} bottles)</option>
                      <option value={50}>50 Cases ({50 * bottlesPerCase} bottles) - Recommended</option>
                      <option value={100}>100 Cases ({100 * bottlesPerCase} bottles)</option>
                      <option value={200}>200 Cases ({200 * bottlesPerCase} bottles)</option>
                    </select>
                  </div>
                </div>

                {/* Price summary pill */}
                <div className="p-4 rounded-xl bg-white border border-[#C99B43]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[#77766F] block text-[10px]">TOTAL UNITS:</span>
                    <span className="text-base font-extrabold text-[#102B46]">{totalBottles.toLocaleString()} Bottles</span>
                  </div>
                  <div>
                    <span className="text-[#77766F] block text-[10px]">UNIT RATE:</span>
                    <span className="text-base font-extrabold text-[#C99B43]">₹{getRate(orderSize)} / bottle</span>
                  </div>
                  <div>
                    <span className="text-[#77766F] block text-[10px]">ESTIMATED AMOUNT:</span>
                    <span className="text-lg font-black text-[#455C22]">₹{totalCost.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#102B46] mb-1">Delivery Drop-Off Address</label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Restaurant cellar or unloading dock..."
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#C99B43]/30 text-[#102B46] text-xs font-medium"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-gold-luxury w-full py-3.5 px-6 rounded-full font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Truck className="w-4 h-4 text-[#102B46]" />
                  <span>Confirm Order & Schedule Doorstep Dispatch</span>
                </button>
              </form>
            )}

            {/* TAB 3: MY INQUIRIES */}
            {activeTab === 'inquiry' && (
              <div className="space-y-4">
                {myInquiries.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/20 text-xs text-[#77766F]">
                    No open call inquiries found for this email account.
                  </div>
                ) : (
                  myInquiries.map((inq) => (
                    <div key={inq.id} className="p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B43]/25 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#102B46]">{inq.id}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FFF9EF] text-[#455C22] font-bold border border-[#455C22]/30">
                          {inq.status}
                        </span>
                      </div>
                      <p className="text-[#102B46]">
                        Consultation scheduled for <strong>{inq.preferredDateTime}</strong>.
                      </p>
                      <p className="text-[#77766F] text-[11px]">
                        Assigned Manager: <strong className="text-[#102B46]">{inq.assignedTo}</strong>
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        ) : (
          /* NOT LOGGED IN: LOGIN OR SIGN UP TABS */
          <div>
            
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full border border-[#C99B42]/70 flex items-center justify-center bg-[#FFF9EF] mx-auto mb-3 shadow-inner overflow-hidden p-1.5">
                <img 
                  src="/images/brand/harit-jal-logo-mark.png" 
                  alt="Harit Jal Logo" 
                  className="w-full h-full object-contain filter drop-shadow-xs" 
                />
              </div>
              <h2 className="text-2xl font-bold font-playfair text-[#102B46]">
                Harit Jal Restaurant Partner Portal
              </h2>
              <p className="text-xs text-[#77766F] mt-1 max-w-md mx-auto">
                Sign in or register your restaurant to track booked calls, manage custom bottle orders, and view delivery logs.
              </p>
            </div>

            {/* Login / Sign Up Toggle (visible only in login/signup modes) */}
            {(mode === 'login' || mode === 'signup') && (
              <div className="flex max-w-xs mx-auto p-1 rounded-full bg-[#F8F3E9] border border-[#C99B43]/30 mb-6">
                <button
                  onClick={() => {
                    soundPlayer.playWaterDrop();
                    setLoginError(null);
                    setMode('login');
                  }}
                  className={`flex-1 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    mode === 'login' ? 'bg-[#102B46] text-[#FFF9EF] shadow-sm' : 'text-[#77766F] hover:text-[#102B46]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    soundPlayer.playWaterDrop();
                    setLoginError(null);
                    setMode('signup');
                  }}
                  className={`flex-1 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    mode === 'signup' ? 'bg-[#102B46] text-[#FFF9EF] shadow-sm' : 'text-[#77766F] hover:text-[#102B46]'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="max-w-md mx-auto space-y-4">
                {loginSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{loginSuccess}</span>
                  </div>
                )}

                {loginError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                    {loginError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#102B46] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="owner@restaurant.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B43]/35 text-xs text-[#102B46] font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#102B46]">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        soundPlayer.playWaterDrop();
                        setForgotEmail(loginEmail || '');
                        setForgotError(null);
                        setMode('forgot_password');
                      }}
                      className="text-xs font-semibold text-[#102B46] hover:text-[#C99B43] hover:underline cursor-pointer"
                    >
                      Forgot your password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B43]/35 text-xs text-[#102B46] font-medium focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-gold-luxury w-full py-3 rounded-full font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Sign In to Partner Portal
                </button>

                <div className="p-3 rounded-xl bg-[#F8F3E9] border border-[#C99B43]/20 text-[11px] text-[#77766F] space-y-1">
                  <div className="font-bold text-[#102B46]">Demo Partner Account:</div>
                  <div>Email: <strong className="font-mono text-[#102B46]">karanpreet@karanthedhaba.com</strong></div>
                  <div>Password: <strong className="font-mono text-[#102B46]">password123</strong></div>
                </div>
              </form>
            )}

            {/* SIGN UP FORM */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="max-w-lg mx-auto space-y-3.5">
                {loginError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                    {loginError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#102B46] mb-1">Restaurant / Dhaba Name *</label>
                    <input
                      type="text"
                      required
                      value={signupRestaurant}
                      onChange={(e) => setSignupRestaurant(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/35 text-xs text-[#102B46] font-medium focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102B46] mb-1">Owner / Manager Name *</label>
                    <input
                      type="text"
                      required
                      value={signupOwner}
                      onChange={(e) => setSignupOwner(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/35 text-xs text-[#102B46] font-medium focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102B46] mb-1">Phone / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/35 text-xs text-[#102B46] font-medium focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102B46] mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/35 text-xs text-[#102B46] font-medium focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102B46] mb-1">City / Location *</label>
                    <input
                      type="text"
                      required
                      value={signupCity}
                      onChange={(e) => setSignupCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/35 text-xs text-[#102B46] font-medium focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102B46] mb-1">Create Password *</label>
                    <input
                      type="password"
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B43]/35 text-xs text-[#102B46] font-medium focus:outline-none"
                    />
                  </div>
                </div>

                {/* Inline OTP Verification Section */}
                <InlineOtpSection
                  email={signupEmail}
                  purpose="signup"
                  isVerified={isSignupOtpVerified}
                  onVerified={() => {
                    setIsSignupOtpVerified(true);
                    setLoginError(null);
                  }}
                  onResetVerification={() => setIsSignupOtpVerified(false)}
                  pendingData={{
                    restaurantName: signupRestaurant,
                    ownerName: signupOwner,
                    email: signupEmail,
                    phone: signupPhone,
                    city: signupCity,
                    password: signupPassword,
                  }}
                />

                {/* DPDP Act 2023 Consent Checkbox */}
                <div className="p-2.5 rounded-xl bg-[#F8F3E9] border border-[#C99B43]/30">
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-[#555A60] select-none">
                    <input
                      type="checkbox"
                      required
                      checked={signupDpdpConsent}
                      onChange={(e) => setSignupDpdpConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#102B46] accent-[#C99B43] border-[#C99B43]/50 focus:ring-[#C99B43] cursor-pointer shrink-0"
                    />
                    <span className="leading-snug text-[11px]">
                      I agree to the Terms and consent to data processing under the <strong className="text-[#102B46] font-semibold">DPDP Act 2023</strong>. Your credentials and restaurant orders remain strictly encrypted.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!isSignupOtpVerified}
                  className="btn-gold-luxury w-full py-3.5 rounded-full font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSignupOtpVerified ? 'Create Restaurant Partner Account →' : 'Verify Email OTP to Create Account'}
                </button>
              </form>
            )}

            {/* FORGOT PASSWORD REQUEST FORM */}
            {mode === 'forgot_password' && (
              <form onSubmit={handleRequestPasswordReset} className="max-w-md mx-auto space-y-4">
                <div className="text-center mb-4">
                  <h3 className="font-playfair font-bold text-lg text-[#102B46]">
                    Reset Partner Password
                  </h3>
                  <p className="text-xs text-[#77766F] mt-1 leading-relaxed">
                    Enter your registered restaurant email address. We will dispatch a 6-digit OTP verification code to reset your account password.
                  </p>
                </div>

                {forgotError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                    {forgotError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#102B46] mb-1">Registered Email Address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="partner@restaurant.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B43]/35 text-xs text-[#102B46] font-medium focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-gold-luxury w-full py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
                >
                  Send 6-Digit OTP Code →
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundPlayer.playWaterDrop();
                    setLoginError(null);
                    setMode('login');
                  }}
                  className="w-full py-2 rounded-full text-xs font-semibold text-[#77766F] hover:text-[#102B46] hover:bg-[#F8F3E9] transition cursor-pointer text-center block"
                >
                  ← Return to Sign In
                </button>
              </form>
            )}

            {/* VERIFY SIGNUP OTP */}
            {mode === 'verify_signup_otp' && (
              <CustomerOtpCard
                email={signupEmail}
                purpose="signup"
                pendingData={{
                  restaurantName: signupRestaurant,
                  ownerName: signupOwner,
                  phone: signupPhone,
                  email: signupEmail,
                  city: signupCity,
                  password: signupPassword,
                }}
                onSuccess={(res) => {
                  const newAccount = CustomerAuthService.register(res.pendingData);
                  setCurrentUser(newAccount);
                  refreshCustomerData(newAccount.email);
                  soundPlayer.playSuccessChime();
                  confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#C99B43', '#455C22', '#102B46'],
                  });
                }}
                onCancel={() => {
                  soundPlayer.playWaterDrop();
                  setMode('signup');
                }}
                onBackToLogin={() => {
                  soundPlayer.playWaterDrop();
                  setMode('login');
                }}
              />
            )}

            {/* VERIFY FORGOT PASSWORD OTP */}
            {mode === 'verify_reset_otp' && (
              <CustomerOtpCard
                email={forgotEmail}
                purpose="forgot_password"
                onSuccess={() => {
                  soundPlayer.playSuccessChime();
                  setLoginSuccess('Password reset successfully! Please sign in with your new password.');
                  setLoginEmail(forgotEmail);
                  setLoginPassword('');
                  setMode('login');
                }}
                onCancel={() => {
                  soundPlayer.playWaterDrop();
                  setMode('forgot_password');
                }}
                onBackToLogin={() => {
                  soundPlayer.playWaterDrop();
                  setMode('login');
                }}
              />
            )}

          </div>
        )}

      </div>

      {/* Customer Profile Settings Modal */}
      {currentUser && (
        <CustomerProfileSettingsModal
          isOpen={showProfileSettings}
          customer={currentUser}
          onClose={() => setShowProfileSettings(false)}
          onUpdated={(updated) => {
            setCurrentUser(updated);
            refreshCustomerData(updated.email);
          }}
        />
      )}
    </div>
  );
};
