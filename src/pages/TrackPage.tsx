import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  PhoneCall, Truck, Package, CheckCircle2, Clock, LogOut, PlusCircle,
  Phone, MessageSquare, Calendar, CalendarCheck, AlertCircle, ChevronDown, ChevronUp, User, UserCheck
} from 'lucide-react';
import { CustomerAccount, CustomerOrder, CallBooking } from '../types';
import { CustomerAuthService } from '../services/customerAuth';
import { StorageService } from '../services/storage';
import { AutomationService } from '../services/automationService';
import { OtpService } from '../services/otpService';
import { CustomerOtpCard } from '../components/CustomerOtpCard';
import { InlineOtpSection } from '../components/InlineOtpSection';
import { CustomerProfileSettingsModal } from '../components/CustomerProfileSettingsModal';
import { soundPlayer } from '../services/sound';

export const TrackPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CustomerAccount | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [myInquiries, setMyInquiries] = useState<CallBooking[]>([]);
  const [activeTab, setActiveTab] = useState<'track' | 'new_order' | 'inquiry'>('track');
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot_password' | 'verify_signup_otp' | 'verify_reset_otp'>('login');
  const [isSignupOtpVerified, setIsSignupOtpVerified] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('karanpreet@karanthedhaba.com');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Sign up form state
  const [signupRestaurant, setSignupRestaurant] = useState('Karan The Dhaba');
  const [signupOwner, setSignupOwner] = useState('Karanpreet Singh');
  const [signupPhone, setSignupPhone] = useState('+91 62992 93497');
  const [signupEmail, setSignupEmail] = useState('info@haritjal.in');
  const [signupCity, setSignupCity] = useState('Murthal, GT Road, Haryana');
  const [signupPassword, setSignupPassword] = useState('password123');
  const [signupDpdpConsent, setSignupDpdpConsent] = useState(true);

  // Place order state
  const [orderSize, setOrderSize] = useState<'250ml' | '500ml' | '750ml_glass' | '1000ml'>('500ml');
  const [orderCases, setOrderCases] = useState<number>(50);
  const [deliveryAddress, setDeliveryAddress] = useState('Milestone 52, GT Karnal Road, Murthal, Haryana');
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // Schedule a Call State
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [schedulePhone, setSchedulePhone] = useState('');
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleBottleSize, setScheduleBottleSize] = useState<'250ml' | '500ml' | '750ml_glass' | '1000ml'>('500ml');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const getMinDateTimeString = () => {
    // Current time + 2 hours
    const minTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const year = minTime.getFullYear();
    const month = String(minTime.getMonth() + 1).padStart(2, '0');
    const day = String(minTime.getDate()).padStart(2, '0');
    const hours = String(minTime.getHours()).padStart(2, '0');
    const minutes = String(minTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getDefaultDateTimeString = () => {
    const d = new Date(Date.now() + 2.5 * 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() >= 30 ? 60 : 30, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDisplayDateTime = (dateTimeStr: string) => {
    try {
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return dateTimeStr;
      return d.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateTimeStr;
    }
  };

  const getRate = (size: typeof orderSize) => {
    if (size === '750ml_glass') return 24;
    if (size === '1000ml') return 11;
    return 7.5;
  };

  const bottlesPerCase = orderSize === '1000ml' ? 12 : orderSize === '750ml_glass' ? 12 : 24;
  const totalBottles = orderCases * bottlesPerCase;
  const totalCost = totalBottles * getRate(orderSize);

  useEffect(() => {
    document.title = 'Restaurant Partner Portal | Harit Jal™';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const user = CustomerAuthService.getCurrentCustomer();
    setCurrentUser(user);
    if (user) {
      refreshData(user.email);
      setScheduleName(user.ownerName || '');
      setSchedulePhone(user.phone || '');
      setScheduleDateTime(getDefaultDateTimeString());
    }
  }, []);

  const refreshData = (email: string) => {
    const customerOrders = CustomerAuthService.getOrdersForCustomer(email);
    setOrders(customerOrders);

    const allInquiries = StorageService.getBookings();
    const matched = allInquiries.filter(
      (inq) => inq.email.toLowerCase() === email.toLowerCase()
    );
    setMyInquiries(matched);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    soundPlayer.playWaterDrop();

    const res = CustomerAuthService.loginWithSecurity(loginEmail, loginPassword);
    if (res.success && res.customer) {
      setCurrentUser(res.customer);
      refreshData(res.customer.email);
      soundPlayer.playSuccessChime();
    } else {
      soundPlayer.playBubblePop();
      setLoginError(res.error || 'Invalid credentials. Check demo account details below.');
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
    refreshData(newAccount.email);
    soundPlayer.playSuccessChime();

    confetti({
      particleCount: 85,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#C99B42', '#52652D', '#102C47'],
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
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#C99B42', '#52652D', '#102C47'],
    });

    soundPlayer.playSuccessChime();
    setOrderSuccess(`Order ${newOrder.id} confirmed! Scheduled for cellar delivery.`);
    refreshData(currentUser.email);
    setActiveTab('track');
    setTimeout(() => setOrderSuccess(null), 5000);
  };

  const handleScheduleCallSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);

    if (!scheduleName.trim()) {
      setScheduleError('कृपया अपना नाम दर्ज करें। (Please enter your name).');
      soundPlayer.playBubblePop();
      return;
    }

    const cleanPhone = schedulePhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setScheduleError('कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें। (Please enter a valid 10-digit mobile number).');
      soundPlayer.playBubblePop();
      return;
    }

    if (!scheduleDateTime) {
      setScheduleError('कृपया कॉल के लिए समय और तारीख चुनें। (Please pick a preferred date and time).');
      soundPlayer.playBubblePop();
      return;
    }

    const selectedTimestamp = new Date(scheduleDateTime).getTime();
    const minAllowedTimestamp = Date.now() + 2 * 60 * 60 * 1000 - 60000; // 2 hours buffer

    if (isNaN(selectedTimestamp) || selectedTimestamp < minAllowedTimestamp) {
      setScheduleError(
        'कॉल का समय वर्तमान समय से कम से कम 2 घंटे बाद का होना चाहिए ताकि हमारी टीम आपके रेस्टोरेंट के लिए कस्टमाइज्ड बॉटल प्रोफाइल और कैटलॉग तैयार कर सके।'
      );
      soundPlayer.playBubblePop();
      return;
    }

    soundPlayer.playWaterDrop();
    setIsScheduling(true);

    setTimeout(() => {
      const formattedDisplay = formatDisplayDateTime(scheduleDateTime);

      StorageService.addBooking({
        restaurantName: currentUser?.restaurantName || 'Restaurant Partner',
        ownerName: scheduleName.trim(),
        phone: schedulePhone.trim(),
        email: currentUser?.email || 'partner@haritjal.in',
        city: currentUser?.city || 'India',
        bottleSize: scheduleBottleSize,
        monthlyVolume: 3000,
        capColor: 'royal_gold',
        labelStyle: 'bespoke_crest',
        preferredDateTime: formattedDisplay,
        notes: scheduleNotes.trim(),
      });

      AutomationService.saveOrUpdateLead({
        customerName: scheduleName.trim(),
        email: currentUser?.email || 'partner@haritjal.in',
        phone: schedulePhone.trim(),
        businessName: currentUser?.restaurantName || 'Partner',
        location: currentUser?.city || 'India',
        bottleSize: scheduleBottleSize,
        customerRequirements: `Customer Portal Scheduled Call: ${scheduleNotes.trim() || 'No specific notes'}`,
        sourcePage: 'Partner Portal Inquiries Tab',
        leadStatus: 'New',
      });

      if (currentUser) {
        refreshData(currentUser.email);
      }

      setIsScheduling(false);
      setShowScheduleForm(false);
      setScheduleSuccess(`कॉल अनुरोध दर्ज हो गया है! स्लॉट: ${formattedDisplay}. एडमिन अनुमोदन (Admin Approval) के बाद यहाँ "Approved by Admin" दिखेगा।`);
      soundPlayer.playSuccessChime();
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#C99B42', '#52652D', '#102C47'],
      });

      setTimeout(() => setScheduleSuccess(null), 8000);
    }, 300);
  };

  return (
    <div className="pt-24 sm:pt-28 pb-16 md:pb-20 bg-[#F8F3E9] text-[#102C47] font-manrope min-h-screen">
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${currentUser ? 'max-w-4xl' : 'max-w-xl'}`}>
        
        {currentUser ? (
          /* LOGGED IN PARTNER VIEW */
          <div className="bg-[#FFF9EF] border border-[#C99B42]/35 rounded-2xl sm:rounded-3xl p-5 sm:p-6.5 shadow-sm space-y-5">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#C99B42]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#102C47] text-[#C99B42] flex items-center justify-center font-bold text-lg shadow-xs">
                  {currentUser.restaurantName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold font-playfair text-[#102C47]">
                      {currentUser.restaurantName}
                    </h1>
                    <span className="px-2 py-0.5 rounded-full bg-[#52652D]/10 text-[#52652D] text-[10px] font-bold border border-[#52652D]/30">
                      PARTNER ACCOUNT
                    </span>
                  </div>
                  <p className="text-xs text-[#77766F]">
                    {currentUser.ownerName} • <span className="text-[#102C47] font-semibold">{currentUser.city}</span> ({currentUser.email})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    soundPlayer.playWaterDrop();
                    setShowProfileSettings(true);
                  }}
                  className="px-4 py-1.5 rounded-full bg-[#102C47] text-[#FFF9EF] hover:bg-[#183C60] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#C99B42]" />
                  <span>Profile Settings</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="px-4 py-1.5 rounded-full bg-[#F8F3E9] hover:bg-white text-[#102C47] text-xs font-semibold flex items-center gap-1.5 border border-[#C99B42]/30 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>

            {orderSuccess && (
              <div className="p-3.5 rounded-2xl bg-[#52652D]/10 border border-[#52652D] text-[#52652D] text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{orderSuccess}</span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[#C99B42]/20 pb-2">
              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('track');
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'track'
                    ? 'btn-gold-luxury shadow-xs'
                    : 'bg-[#F8F3E9] text-[#102C47] hover:bg-white'
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
                    ? 'btn-gold-luxury shadow-xs'
                    : 'bg-[#F8F3E9] text-[#102C47] hover:bg-white'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-[#52652D]" />
                <span>Place New Order</span>
              </button>

              <button
                onClick={() => {
                  soundPlayer.playWaterDrop();
                  setActiveTab('inquiry');
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'inquiry'
                    ? 'btn-gold-luxury shadow-xs'
                    : 'bg-[#F8F3E9] text-[#102C47] hover:bg-white'
                }`}
              >
                <PhoneCall className="w-4 h-4" />
                <span>Call Inquiries ({myInquiries.length})</span>
              </button>
            </div>

            {/* TAB 1: TRACK ORDERS */}
            {activeTab === 'track' && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/20 space-y-3">
                    <Package className="w-10 h-10 text-[#C99B42] mx-auto" />
                    <h3 className="text-base font-bold text-[#102C47]">No Orders Placed Yet</h3>
                    <p className="text-xs text-[#77766F] max-w-sm mx-auto">
                      Place your first recurring custom bottle order to experience direct-to-cellar delivery.
                    </p>
                    <button
                      onClick={() => setActiveTab('new_order')}
                      className="px-5 py-2.5 rounded-full bg-[#102C47] text-[#FFF9EF] font-bold text-xs hover:bg-[#183C60] transition cursor-pointer"
                    >
                      Place First Order
                    </button>
                  </div>
                ) : (
                  orders.map((ord) => (
                    <div key={ord.id} className="p-5 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/30 space-y-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#C99B42]/15">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#102C47] text-sm">{ord.id}</span>
                            <span className="text-xs text-[#77766F]">• {ord.orderedAt}</span>
                          </div>
                          <div className="text-xs text-[#102C47] font-semibold mt-0.5">
                            {ord.caseCount} Cases ({ord.bottlesTotal.toLocaleString()} bottles of {ord.bottleSize})
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-[#52652D]">₹{ord.totalAmount.toLocaleString()}</span>
                          <span className="text-[11px] text-[#77766F] block">Rate: ₹{ord.ratePerBottle}/bottle</span>
                        </div>
                      </div>

                      {/* 4-Step Tracker */}
                      <div>
                        <div className="text-[11px] font-semibold text-[#102C47] uppercase tracking-wider mb-2 flex items-center justify-between">
                          <span>Status:</span>
                          <span className="text-[#52652D] font-bold">{ord.status}</span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center text-[10px] sm:text-xs">
                          <div className="p-2 rounded-xl bg-[#52652D]/15 border border-[#52652D] text-[#52652D] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 mx-auto mb-1 text-[#52652D]" />
                            <span>1. Confirmed</span>
                          </div>

                          <div className={`p-2 rounded-xl border font-bold ${
                            ord.status !== 'Order Confirmed'
                              ? 'bg-[#52652D]/15 border-[#52652D] text-[#52652D]'
                              : 'bg-white border-[#C99B42]/30 text-[#102C47]'
                          }`}>
                            <Clock className="w-3.5 h-3.5 mx-auto mb-1" />
                            <span>2. Bottling</span>
                          </div>

                          <div className={`p-2 rounded-xl border font-bold ${
                            ord.status === 'Dispatched (Out for Delivery)' || ord.status === 'Delivered to Restaurant'
                              ? 'bg-[#52652D]/15 border-[#52652D] text-[#52652D]'
                              : 'bg-white border-[#C99B42]/20 text-[#77766F]'
                          }`}>
                            <Truck className="w-3.5 h-3.5 mx-auto mb-1" />
                            <span>3. In Transit</span>
                          </div>

                          <div className={`p-2 rounded-xl border font-bold ${
                            ord.status === 'Delivered to Restaurant'
                              ? 'bg-[#52652D]/15 border-[#52652D] text-[#52652D]'
                              : 'bg-white border-[#C99B42]/20 text-[#77766F]'
                          }`}>
                            <CheckCircle2 className="w-3.5 h-3.5 mx-auto mb-1" />
                            <span>4. Delivered</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-[#C99B42]/20 text-xs text-[#77766F]">
                        <span className="text-[10px] uppercase font-bold text-[#102C47] block">Delivery Drop-Off:</span>
                        <span className="text-[#102C47] font-medium">{ord.deliveryAddress}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: PLACE NEW ORDER */}
            {activeTab === 'new_order' && (
              <form onSubmit={handlePlaceOrder} className="p-6 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/30 space-y-4">
                <h3 className="text-base font-bold text-[#102C47] flex items-center gap-2 pb-2 border-b border-[#C99B42]/20">
                  <Package className="w-4 h-4 text-[#52652D]" />
                  <span>Order Custom Bottles for "{currentUser.restaurantName}"</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#102C47] mb-1">Select Bottle Format</label>
                    <select
                      value={orderSize}
                      onChange={(e) => setOrderSize(e.target.value as typeof orderSize)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#C99B42]/30 text-[#102C47] text-xs font-bold focus:outline-none"
                    >
                      <option value="500ml">500ml Dine-In Classic (₹7.50 / bottle)</option>
                      <option value="250ml">250ml Pocket QSR (₹7.50 / bottle)</option>
                      <option value="750ml_glass">750ml Luxury Glass Decanter (₹24.00 / bottle)</option>
                      <option value="1000ml">1000ml Family Banquet (₹11.00 / bottle)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#102C47] mb-1">Number of Cases</label>
                    <select
                      value={orderCases}
                      onChange={(e) => setOrderCases(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#C99B42]/30 text-[#102C47] text-xs font-bold focus:outline-none"
                    >
                      <option value={25}>25 Cases ({25 * bottlesPerCase} bottles)</option>
                      <option value={50}>50 Cases ({50 * bottlesPerCase} bottles) - Recommended</option>
                      <option value={100}>100 Cases ({100 * bottlesPerCase} bottles)</option>
                      <option value={200}>200 Cases ({200 * bottlesPerCase} bottles)</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white border border-[#C99B42]/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[#77766F] block text-[10px]">TOTAL UNITS:</span>
                    <span className="text-base font-extrabold text-[#102C47]">{totalBottles.toLocaleString()} Bottles</span>
                  </div>
                  <div>
                    <span className="text-[#77766F] block text-[10px]">UNIT RATE:</span>
                    <span className="text-base font-extrabold text-[#C99B42]">₹{getRate(orderSize)} / bottle</span>
                  </div>
                  <div>
                    <span className="text-[#77766F] block text-[10px]">ESTIMATED AMOUNT:</span>
                    <span className="text-lg font-black text-[#52652D]">₹{totalCost.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#102C47] mb-1">Delivery Address</label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#C99B42]/30 text-[#102C47] text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-gold-luxury w-full py-3.5 px-6 rounded-full font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Truck className="w-4 h-4 text-[#102C47]" />
                  <span>Confirm Order & Schedule Cellar Dispatch</span>
                </button>
              </form>
            )}

            {/* TAB 3: INQUIRIES & CALL SCHEDULING */}
            {activeTab === 'inquiry' && (
              <div className="space-y-5">
                {/* Header Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/30 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-[#C99B42]" />
                      <h3 className="font-bold text-sm text-[#102C47]">
                        Consultation Calls & Inquiries ({myInquiries.length})
                      </h3>
                    </div>
                    <p className="text-[11px] text-[#77766F] mt-0.5">
                      Schedule a custom bottle consultation or view admin approval status for your scheduled calls.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundPlayer.playWaterDrop();
                      setShowScheduleForm(prev => !prev);
                    }}
                    className="self-start sm:self-auto px-4 py-2 rounded-full btn-gold-luxury text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    {showScheduleForm ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Hide Form</span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5 text-[#102C47]" />
                        <span>+ Schedule a New Call</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Success Banner */}
                {scheduleSuccess && (
                  <div className="p-4 rounded-2xl bg-[#52652D]/15 border border-[#52652D] text-[#52652D] text-xs font-bold flex items-center gap-2 shadow-xs animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{scheduleSuccess}</span>
                  </div>
                )}

                {/* SCHEDULE A CALL FORM */}
                {showScheduleForm && (
                  <div className="p-5 sm:p-6 rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/45 space-y-4 shadow-sm animate-fadeIn">
                    <div className="flex items-center justify-between pb-3 border-b border-[#C99B42]/20">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="w-4 h-4 text-[#C99B42]" />
                        <h4 className="font-bold text-sm text-[#102C47]">
                          Schedule a Call Consultation
                        </h4>
                      </div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#102C47]/10 text-[#102C47] font-semibold">
                        VIP Partner Desk
                      </span>
                    </div>

                    {scheduleError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{scheduleError}</span>
                      </div>
                    )}

                    <form onSubmit={handleScheduleCallSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Name */}
                        <div>
                          <label className="block text-xs font-bold text-[#102C47] mb-1">
                            Your Name (आपका नाम) *
                          </label>
                          <div className="relative">
                            <User className="w-3.5 h-3.5 text-[#77766F] absolute left-3 top-3 pointer-events-none" />
                            <input
                              type="text"
                              required
                              value={scheduleName}
                              onChange={(e) => setScheduleName(e.target.value)}
                              placeholder="e.g. Karanpreet Singh"
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Mobile Number */}
                        <div>
                          <label className="block text-xs font-bold text-[#102C47] mb-1">
                            Mobile Number (मोबाइल नंबर) *
                          </label>
                          <div className="relative">
                            <Phone className="w-3.5 h-3.5 text-[#77766F] absolute left-3 top-3 pointer-events-none" />
                            <input
                              type="tel"
                              required
                              value={schedulePhone}
                              onChange={(e) => setSchedulePhone(e.target.value)}
                              placeholder="e.g. +91 98765 43210"
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Preferred Date & Time (Must be >= 2 hours in future) */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-[#102C47] mb-1">
                            Preferred Call Time (कॉल का समय — कम से कम 2 घंटे बाद) *
                          </label>
                          <div className="relative">
                            <Calendar className="w-3.5 h-3.5 text-[#77766F] absolute left-3 top-3 pointer-events-none" />
                            <input
                              type="datetime-local"
                              required
                              min={getMinDateTimeString()}
                              value={scheduleDateTime}
                              onChange={(e) => setScheduleDateTime(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-semibold focus:outline-none"
                            />
                          </div>
                          <p className="text-[10.5px] text-[#77766F] mt-1">
                            ⏱️ <strong>नियम:</strong> कॉल का समय वर्तमान समय से कम से कम <strong>2 घंटे बाद</strong> का होना चाहिए ताकि हमारे हॉस्पिटैलिटी मैनेजर आपके रेस्टोरेंट के लिए कस्टमाइज्ड बॉटल प्रोफाइल और कैटलॉग तैयार कर सकें।
                          </p>
                        </div>

                        {/* Bottle Size of Interest */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-[#102C47] mb-1">
                            Bottle Format of Interest (किस साइज में रुचि है?)
                          </label>
                          <select
                            value={scheduleBottleSize}
                            onChange={(e) => setScheduleBottleSize(e.target.value as any)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-medium focus:outline-none"
                          >
                            <option value="250ml">250ml Pocket Mist (Artisanal Cafes & Bar)</option>
                            <option value="500ml">500ml Dine-In Glass (Fine Dining & Banquet)</option>
                            <option value="750ml_glass">750ml Heavy Fluted Carafe (Luxury Suites & Lounges)</option>
                            <option value="1000ml">1000ml Family Estate Glass (Highway Dhabas & Dining)</option>
                          </select>
                        </div>

                        {/* Optional Notes */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-[#102C47] mb-1">
                            Any Specific Requirements / Questions? (वैकल्पिक)
                          </label>
                          <textarea
                            rows={2}
                            value={scheduleNotes}
                            onChange={(e) => setScheduleNotes(e.target.value)}
                            placeholder="e.g. Logo embossing, metallic cap colors, minimum order crate delivery..."
                            className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] focus:outline-none resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <button
                          type="submit"
                          disabled={isScheduling}
                          className="btn-gold-luxury py-3 px-6 rounded-full font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-[#102C47]" />
                          <span>{isScheduling ? 'Scheduling...' : 'Confirm & Schedule Consultation Call'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowScheduleForm(false)}
                          className="px-4 py-2 rounded-full text-xs text-[#77766F] hover:text-[#102C47] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>

                    {/* Instant Direct Dial & WhatsApp Section */}
                    <div className="p-4 rounded-xl bg-white border border-[#C99B42]/35 space-y-2 mt-3">
                      <div className="flex items-center gap-2 font-bold text-xs text-[#102C47]">
                        <PhoneCall className="w-3.5 h-3.5 text-[#C99B42]" />
                        <span>क्या आप अभी तुरंत बात करना चाहते हैं? (Need Immediate Assistance?)</span>
                      </div>
                      <p className="text-[11px] text-[#77766F] leading-relaxed">
                        अगर आप अभी तुरंत बात करना चाहते हैं, तो 2 घंटे इंतज़ार करने की ज़रूरत नहीं है! सीधे नीचे दिए गए नंबर पर कॉल या WhatsApp करें — नंबर पर क्लिक करते ही तुरंत डायल खुल जाएगा:
                      </p>
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        {/* Direct Clickable Phone Link */}
                        <a
                          href="tel:+916299293497"
                          onClick={() => soundPlayer.playWaterDrop()}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#102C47] hover:bg-[#183C60] active:scale-95 text-[#FFF9EF] text-xs font-bold transition shadow-2xs cursor-pointer group"
                          title="Click to dial +91 62992 93497"
                        >
                          <Phone className="w-3.5 h-3.5 text-[#C99B42] group-hover:scale-110 transition-transform" />
                          <span>+91 62992 93497</span>
                          <span className="text-[10px] text-[#C99B42] underline">(कॉल करने के लिए क्लिक करें)</span>
                        </a>

                        {/* Direct Clickable WhatsApp Link */}
                        <a
                          href="https://wa.me/916299293497?text=Hello%20Harit%20Jal%20Team%2C%20I%20am%20calling%20from%20my%20restaurant%20partner%20account%20and%20want%20to%20discuss%20custom%20glass%20water%20bottles%20immediately."
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => soundPlayer.playWaterDrop()}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white text-xs font-bold transition shadow-2xs cursor-pointer group"
                          title="Chat on WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                          <span>WhatsApp पर चैट करें</span>
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* MY INQUIRIES LIST */}
                {myInquiries.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-[#F8F3E9] border border-[#C99B42]/20 space-y-3">
                    <PhoneCall className="w-10 h-10 text-[#C99B42] mx-auto opacity-70" />
                    <h4 className="text-sm font-bold text-[#102C47]">No Scheduled Inquiries Yet</h4>
                    <p className="text-xs text-[#77766F] max-w-sm mx-auto">
                      Schedule a 10-minute consultation call with our bottle specialists to review physical samples and wholesale tariffs.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowScheduleForm(true)}
                      className="px-4 py-2 rounded-full btn-gold-luxury text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Schedule First Consultation Call
                    </button>
                  </div>
                ) : (
                  myInquiries.map((inq) => {
                    const isApproved = inq.status === 'Call Scheduled' || inq.status === 'Active Client' || inq.adminApproved;

                    return (
                      <div
                        key={inq.id}
                        className={`p-5 rounded-2xl border transition shadow-xs space-y-3 ${
                          isApproved
                            ? 'bg-[#F4F8F0] border-emerald-500/40'
                            : 'bg-[#F8F3E9] border-[#C99B42]/30'
                        }`}
                      >
                        {/* Top ID & Approval Status Badge */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#C99B42]/20">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#102C47] text-sm">{inq.id}</span>
                            <span className="text-xs text-[#77766F]">• Created {inq.createdAt}</span>
                          </div>

                          {/* Approval Badge */}
                          {isApproved ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#52652D]/15 text-[#52652D] border border-[#52652D]/40 text-xs font-bold self-start sm:self-auto shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#52652D]" />
                              <span>Approved by Admin</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-900 border border-amber-500/40 text-xs font-bold self-start sm:self-auto shadow-2xs">
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              <span>Pending Admin Approval</span>
                            </div>
                          )}
                        </div>

                        {/* Approval Details Banner */}
                        {isApproved ? (
                          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                              <CalendarCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                              <span>एडमिन द्वारा स्वीकृत (Call Slot Confirmed & Approved by Admin)</span>
                            </div>
                            <p className="text-[11.5px] text-emerald-900 leading-relaxed">
                              एडमिन ने आपके चुने हुए समय <strong>{inq.preferredDateTime}</strong> के लिए कॉल अप्रूव कर दिया है। निर्धारित समय पर आपके असाइन किए गए मैनेजर <strong>{inq.assignedTo || 'Pooja Verma'}</strong> आपको <strong>{inq.phone}</strong> पर कॉल करेंगे।
                            </p>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-xs text-amber-950 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-900">
                              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                              <span>एडमिन अनुमोदन प्रतीक्षित (Waiting for Admin Approval)</span>
                            </div>
                            <p className="text-[11.5px] text-amber-800 leading-relaxed">
                              आपके कॉल का अनुरोध (समय: <strong>{inq.preferredDateTime}</strong>) प्राप्त हो चुका है। जैसे ही एडमिन आपके स्लॉट को कन्फर्म करेंगे, यहाँ <strong>"Approved by Admin"</strong> का स्टेटस दिखने लगेगा।
                            </p>
                          </div>
                        )}

                        {/* Additional Inquiry Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                          <div>
                            <span className="text-[#77766F] text-[10.5px] block">SCHEDULED TIME:</span>
                            <span className="font-semibold text-[#102C47]">{inq.preferredDateTime}</span>
                          </div>
                          <div>
                            <span className="text-[#77766F] text-[10.5px] block">ASSIGNED MANAGER:</span>
                            <span className="font-semibold text-[#102C47]">{inq.assignedTo || 'Harit Jal Lead'}</span>
                          </div>
                          <div>
                            <span className="text-[#77766F] text-[10.5px] block">CONTACT NUMBER:</span>
                            <span className="font-semibold text-[#102C47]">{inq.phone}</span>
                          </div>
                        </div>

                        {/* Need to talk now button link */}
                        <div className="pt-2 border-t border-[#C99B42]/15 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#77766F]">
                          <span>तुरंत संपर्क के लिए:</span>
                          <div className="flex items-center gap-2">
                            <a
                              href="tel:+916299293497"
                              className="font-bold text-[#102C47] hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3 text-[#C99B42]" />
                              <span>+91 62992 93497</span>
                            </a>
                            <span>•</span>
                            <a
                              href={`https://wa.me/916299293497?text=Hello%20Harit%20Jal%20Team%2C%20regarding%20my%20inquiry%20${inq.id}.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-[#25D366] hover:underline flex items-center gap-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Always-visible Instant Contact Box at bottom of tab if inquiries exist */}
                {myInquiries.length > 0 && !showScheduleForm && (
                  <div className="p-4 rounded-2xl bg-white border border-[#C99B42]/35 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-[#102C47]">
                      <PhoneCall className="w-3.5 h-3.5 text-[#C99B42]" />
                      <span>तुरंत बात करना चाहते हैं? (Need Immediate Assistance?)</span>
                    </div>
                    <p className="text-[11px] text-[#77766F] leading-relaxed">
                      अगर आप अभी तुरंत बात करना चाहते हैं, तो सीधे कॉल या WhatsApp करें — नंबर पर क्लिक करते ही डायल ओपन हो जाएगा:
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <a
                        href="tel:+916299293497"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#102C47] hover:bg-[#183C60] text-[#FFF9EF] text-xs font-bold transition shadow-2xs"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#C99B42]" />
                        <span>+91 62992 93497 (कॉल करें)</span>
                      </a>
                      <a
                        href="https://wa.me/916299293497?text=Hello%20Harit%20Jal%20Team%2C%20I%20am%20calling%20from%20my%20restaurant%20partner%20account%20and%20want%20to%20discuss%20custom%20glass%20water%20bottles%20immediately."
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold transition shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp Chat</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        ) : (
          /* NOT LOGGED IN VIEW — DEDICATED PARTNER PORTAL PAGE */
          <div className="bg-[#FFF9EF] border border-[#C99B42]/35 rounded-3xl p-6 sm:p-8 md:p-10 shadow-[0_20px_50px_rgba(16,44,71,0.06)]">
            
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full border border-[#C99B42]/70 flex items-center justify-center bg-[#FFF9EF] mx-auto mb-3 shadow-inner overflow-hidden p-2">
                <img 
                  src="/images/brand/harit-jal-logo-mark.png" 
                  alt="Harit Jal Logo" 
                  className="w-full h-full object-contain filter drop-shadow-xs" 
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-playfair text-[#102C47]">
                Harit Jal Restaurant Partner Portal
              </h1>
              <p className="text-xs sm:text-sm text-[#77766F] mt-1.5 max-w-md mx-auto leading-relaxed">
                Sign in or register your restaurant to track booked calls, manage custom bottle orders, and view delivery logs.
              </p>
            </div>

            {/* Toggle (shown for login & signup modes) */}
            {(mode === 'login' || mode === 'signup') && (
              <div className="flex max-w-xs mx-auto p-1 rounded-full bg-[#F8F3E9] border border-[#C99B42]/30 mb-5">
                <button
                  onClick={() => {
                    soundPlayer.playWaterDrop();
                    setLoginError(null);
                    setMode('login');
                  }}
                  className={`flex-1 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                    mode === 'login' ? 'bg-[#102C47] text-[#FFF9EF] shadow-xs' : 'text-[#77766F] hover:text-[#102C47]'
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
                    mode === 'signup' ? 'bg-[#102C47] text-[#FFF9EF] shadow-xs' : 'text-[#77766F] hover:text-[#102C47]'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* 1. SIGN IN FORM */}
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
                  <label className="block text-xs font-bold text-[#102C47] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-[#102C47]">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        soundPlayer.playWaterDrop();
                        setForgotEmail(loginEmail || '');
                        setForgotError(null);
                        setMode('forgot_password');
                      }}
                      className="text-xs font-semibold text-[#102C47] hover:text-[#C99B42] hover:underline cursor-pointer"
                    >
                      Forgot your password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-medium focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-gold-luxury w-full py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
                >
                  Sign In to Partner Portal
                </button>

                <div className="p-3 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/20 text-[11px] text-[#77766F] space-y-1">
                  <div className="font-bold text-[#102C47]">Demo Partner Credentials:</div>
                  <div>Email: <strong className="font-mono text-[#102C47]">karanpreet@karanthedhaba.com</strong></div>
                  <div>Password: <strong className="font-mono text-[#102C47]">password123</strong></div>
                </div>
              </form>
            )}

            {/* 2. SIGN UP FORM */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="max-w-lg mx-auto space-y-3.5">
                {loginError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                    {loginError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#102C47] mb-1">Restaurant / Dhaba Name *</label>
                    <input
                      type="text"
                      required
                      value={signupRestaurant}
                      onChange={(e) => setSignupRestaurant(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102C47] mb-1">Owner / Manager Name *</label>
                    <input
                      type="text"
                      required
                      value={signupOwner}
                      onChange={(e) => setSignupOwner(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102C47] mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102C47] mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102C47] mb-1">City / Location *</label>
                    <input
                      type="text"
                      required
                      value={signupCity}
                      onChange={(e) => setSignupCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#102C47] mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47]"
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
                <div className="p-2.5 rounded-xl bg-[#F8F3E9] border border-[#C99B42]/30">
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-[#555A60] select-none">
                    <input
                      type="checkbox"
                      required
                      checked={signupDpdpConsent}
                      onChange={(e) => setSignupDpdpConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-[#102C47] accent-[#C99B42] border-[#C99B42]/50 focus:ring-[#C99B42] cursor-pointer shrink-0"
                    />
                    <span className="leading-snug text-[11px]">
                      I agree to the Terms and consent to data processing under the <strong className="text-[#102C47] font-semibold">DPDP Act 2023</strong>. Your account credentials and restaurant orders remain strictly encrypted and confidential.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!isSignupOtpVerified}
                  className="btn-gold-luxury w-full py-3.5 rounded-full font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSignupOtpVerified ? 'Create Partner Account →' : 'Verify Email OTP to Create Account'}
                </button>
              </form>
            )}

            {/* 3. FORGOT PASSWORD REQUEST FORM */}
            {mode === 'forgot_password' && (
              <form onSubmit={handleRequestPasswordReset} className="max-w-md mx-auto space-y-4">
                <div className="text-center mb-4">
                  <h3 className="font-playfair font-bold text-lg text-[#102C47]">
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
                  <label className="block text-xs font-bold text-[#102C47] mb-1">Registered Email Address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="partner@restaurant.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C99B42]/35 text-xs text-[#102C47] font-medium focus:outline-none"
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
                  className="w-full py-2 rounded-full text-xs font-semibold text-[#77766F] hover:text-[#102C47] hover:bg-[#F8F3E9] transition cursor-pointer text-center block"
                >
                  ← Return to Sign In
                </button>
              </form>
            )}

            {/* 4. VERIFY SIGNUP OTP */}
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
                  refreshData(newAccount.email);
                  soundPlayer.playSuccessChime();
                  confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#C99B42', '#52652D', '#102C47'],
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

            {/* 5. VERIFY FORGOT PASSWORD OTP */}
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
            refreshData(updated.email);
          }}
        />
      )}
    </div>
  );
};

