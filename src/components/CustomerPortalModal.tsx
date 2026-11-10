import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  X, PhoneCall, Truck, Package, CheckCircle2, Clock, LogOut, PlusCircle, UserCheck, AlertTriangle
} from 'lucide-react';
import { CustomerAccount, CustomerOrder, CallBooking } from '../types';
import { CustomerAuthService } from '../services/customerAuth';
import { StorageService } from '../services/storage';
import { OtpService } from '../services/otpService';
import { SupabaseService, isSupabaseConfigured } from '../services/supabase';
import { isProductionEnvironment } from '../services/env';
import { CustomerOtpCard } from './CustomerOtpCard';
import { InlineOtpSection } from './InlineOtpSection';
import { CustomerProfileSettingsModal } from './CustomerProfileSettingsModal';
import { UnifiedLoginCard } from './auth/UnifiedLoginCard';
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
  const [loginEmail, setLoginEmail] = useState(prefillEmail || '');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState(prefillEmail || '');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  // Sign up form state
  const [signupRestaurant, setSignupRestaurant] = useState(prefillRestaurant || '');
  const [signupOwner, setSignupOwner] = useState(prefillOwner || '');
  const [signupPhone, setSignupPhone] = useState(prefillPhone || '');
  const [signupEmail, setSignupEmail] = useState(prefillEmail || '');
  const [signupCity, setSignupCity] = useState(prefillCity || '');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupDpdpConsent, setSignupDpdpConsent] = useState(false);

  // Place order state
  const [orderSize, setOrderSize] = useState<'250ml' | '500ml' | '750ml_glass' | '1000ml'>('500ml');
  const [orderCases, setOrderCases] = useState<number>(50);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Rates
  const getRate = (size: typeof orderSize) => {
    if (size === '750ml_glass') return 24;
    if (size === '1000ml') return 11;
    return 7.5;
  };

  const bottlesPerCase = orderSize === '1000ml' ? 12 : orderSize === '750ml_glass' ? 12 : 24;
  const totalBottles = orderCases * bottlesPerCase;
  const totalCost = totalBottles * getRate(orderSize);

  const refreshCustomerData = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured()) {
      const [cloudOrders, cloudBookings] = await Promise.all([
        SupabaseService.fetchOrdersForCustomer(cleanEmail),
        SupabaseService.fetchConsultationsForCustomer(cleanEmail),
      ]);

      if (cloudOrders) {
        CustomerAuthService.setOrdersCache(cloudOrders);
        setOrders(cloudOrders);
      } else {
        setOrders(CustomerAuthService.getOrdersForCustomer(cleanEmail));
      }

      if (cloudBookings) {
        setMyInquiries(cloudBookings);
      } else {
        setMyInquiries(
          StorageService.getBookings().filter((inq) => inq.email.toLowerCase() === cleanEmail)
        );
      }
      return;
    }

    const customerOrders = CustomerAuthService.getOrdersForCustomer(cleanEmail);
    setOrders(customerOrders);

    const allInquiries = StorageService.getBookings();
    const matched = allInquiries.filter((inq) => inq.email.toLowerCase() === cleanEmail);
    setMyInquiries(matched);
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const syncOnOpen = async () => {
      let user = CustomerAuthService.getCurrentCustomer();
      if (!user && isSupabaseConfigured()) {
        user = await CustomerAuthService.syncSessionProfile();
      } else {
        await Promise.resolve();
      }
      if (cancelled) return;
      setCurrentUser(user);
      if (user) {
        await refreshCustomerData(user.email);
      }
    };

    void syncOnOpen();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignUp = async (e: React.FormEvent) => {
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

    if (!signupPassword || signupPassword.length < 8) {
      setLoginError('Password must be at least 8 characters.');
      soundPlayer.playBubblePop();
      return;
    }

    const alreadyRegistered = await CustomerAuthService.checkIfAlreadyRegistered(signupEmail, signupPhone);
    if (alreadyRegistered.exists) {
      setLoginError(alreadyRegistered.error || 'यह ईमेल आईडी या मोबाइल नंबर पहले से रजिस्टर्ड है। कृपया लॉगिन करें, या यदि पासवर्ड भूल गए हैं तो "Forgot Password" का उपयोग करें।');
      soundPlayer.playBubblePop();
      return;
    }

    if (!isSignupOtpVerified) {
      setLoginError('Please click "Send OTP on Email" below and verify your 6-digit code before creating your account.');
      soundPlayer.playBubblePop();
      return;
    }

    soundPlayer.playWaterDrop();
    try {
      const res = await CustomerAuthService.signUpWithSupabaseAuth({
        restaurantName: signupRestaurant,
        ownerName: signupOwner,
        email: signupEmail,
        phone: signupPhone,
        city: signupCity,
        password: signupPassword,
      });

      if (res.success && res.customer) {
        setCurrentUser(res.customer);
        await refreshCustomerData(res.customer.email);
        soundPlayer.playSuccessChime();

        confetti({
          particleCount: 85,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#C99B43', '#455C22', '#102B46'],
        });

        setLoginSuccess('Thank you for creating an account! Your restaurant partner portal is now active.');
      } else if (res.success && res.requiresEmailConfirmation) {
        soundPlayer.playSuccessChime();
        setLoginSuccess('Account created! Please check your email inbox and click the confirmation link before signing in.');
        setLoginEmail(signupEmail.trim().toLowerCase());
        setMode('login');
      } else {
        setLoginError(res.error || 'Registration failed. Please check your credentials.');
        soundPlayer.playBubblePop();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during account creation.';
      setLoginError(message);
      soundPlayer.playBubblePop();
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
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

    const res = await OtpService.requestSupabasePasswordReset(forgotEmail);
    if (res.success && res.recoveryEmailSent) {
      soundPlayer.playSuccessChime();
      setForgotSuccess('Password recovery link dispatched! Please check your email inbox and click the reset link to set a new password.');
    } else if (res.success && res.useLocalOtp && !isProductionEnvironment()) {
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

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setOrderError(null);
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

    const orderSynced = await SupabaseService.syncOrder({
      ...newOrder,
      ownerName: currentUser.ownerName,
      phone: currentUser.phone,
    });

    if (isSupabaseConfigured() && !orderSynced) {
      CustomerAuthService.setOrdersCache(
        CustomerAuthService.getAllOrders().filter((o) => o.id !== newOrder.id)
      );
      soundPlayer.playBubblePop();
      setOrderError(
        'Unable to save your order to our cloud server right now. Please try again or contact +91 62992 93497.'
      );
      return;
    }

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#C99B43', '#455C22', '#102B46'],
    });

    soundPlayer.playSuccessChime();
    setOrderSuccess(`Order ${newOrder.id} placed successfully! Automated fleet dispatch scheduled.`);
    await refreshCustomerData(currentUser.email);
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

                {orderError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{orderError}</span>
                  </div>
                )}

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

            {/* UNIFIED PARTNER LOGIN CARD */}
            {mode === 'login' && (
              <div className="max-w-md mx-auto">
                {loginSuccess && (
                  <div className="p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{loginSuccess}</span>
                  </div>
                )}
                <UnifiedLoginCard
                  initialAccountType="partner"
                  allowedAccountTypes={['partner']}
                  initialIdentifier={loginEmail}
                  onSuccess={async (result) => {
                    if (result.partnerUser) {
                      setCurrentUser(result.partnerUser);
                      await refreshCustomerData(result.partnerUser.email);
                      soundPlayer.playSuccessChime();
                    }
                  }}
                  onForgotPassword={(identifier) => {
                    soundPlayer.playWaterDrop();
                    setForgotEmail(identifier || '');
                    setForgotError(null);
                    setForgotSuccess(null);
                    setMode('forgot_password');
                  }}
                />
              </div>
            )}

            {/* SIGN UP FORM */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="max-w-lg mx-auto space-y-3.5">
                {loginError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                    <p>{loginError}</p>
                    {(loginError.includes('पहले से रजिस्टर्ड') || loginError.includes('already registered')) && (
                      <div className="flex flex-wrap gap-2 pt-2 mt-2 border-t border-red-200">
                        <button
                          type="button"
                          onClick={() => {
                            soundPlayer.playWaterDrop();
                            setLoginEmail(signupEmail.trim().toLowerCase());
                            setLoginError(null);
                            setMode('login');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#102C46] text-white text-xs font-bold hover:bg-[#1B3F63] transition cursor-pointer shadow-xs"
                        >
                          Sign In Now →
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            soundPlayer.playWaterDrop();
                            setForgotEmail(signupEmail.trim().toLowerCase());
                            setLoginError(null);
                            setMode('forgot_password');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#C99B43] text-[#102C46] text-xs font-bold hover:bg-[#B38734] transition cursor-pointer shadow-xs"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}
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
                      placeholder="Your business name"
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
                      placeholder="Your name"
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
                      placeholder="1234567890"
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
                      placeholder="your@gmail.com"
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
                      placeholder="Your business location"
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
                      placeholder="••••••••"
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
                    Enter your registered restaurant email address to receive your password recovery link or verification challenge.
                  </p>
                </div>

                {forgotSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{forgotSuccess}</span>
                  </div>
                )}

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
                  Send Recovery Instructions →
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundPlayer.playWaterDrop();
                    setForgotSuccess(null);
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
                onSuccess={async (res) => {
                  const pending = (res.pendingData || {}) as {
                    restaurantName?: string;
                    ownerName?: string;
                    phone?: string;
                    email?: string;
                    city?: string;
                    password?: string;
                  };
                  const resolvedEmail = pending.email || signupEmail;
                  const authRes = await CustomerAuthService.signUpWithSupabaseAuth({
                    restaurantName: pending.restaurantName || signupRestaurant,
                    ownerName: pending.ownerName || signupOwner,
                    phone: pending.phone || signupPhone,
                    email: resolvedEmail,
                    city: pending.city || signupCity,
                    password: pending.password || signupPassword,
                  });
                  if (authRes.success && authRes.customer) {
                    setCurrentUser(authRes.customer);
                    await refreshCustomerData(authRes.customer.email);
                    soundPlayer.playSuccessChime();
                    confetti({
                      particleCount: 80,
                      spread: 70,
                      origin: { y: 0.6 },
                      colors: ['#C99B43', '#455C22', '#102B46'],
                    });
                  } else if (authRes.success && authRes.requiresEmailConfirmation) {
                    soundPlayer.playSuccessChime();
                    setLoginSuccess('Account created! Please check your email inbox and click the confirmation link before signing in.');
                    setLoginEmail(resolvedEmail.trim().toLowerCase());
                    setMode('login');
                  } else {
                    setLoginError(authRes.error || 'Registration failed. Please try again.');
                    setMode('signup');
                  }
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
            {mode === 'verify_reset_otp' && !isProductionEnvironment() && (
              <CustomerOtpCard
                email={forgotEmail}
                purpose="forgot_password"
                onSuccess={() => {
                  soundPlayer.playSuccessChime();
                  setLoginSuccess('Password reset successfully! Please sign in with your new password.');
                  setLoginEmail(forgotEmail);
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
            void refreshCustomerData(updated.email);
          }}
        />
      )}
    </div>
  );
};
