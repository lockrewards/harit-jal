import { CustomerAccount, CustomerOrder } from '../types';
import { SecurityRateLimiter } from './securityRateLimiter';

const STORAGE_KEYS = {
  CUSTOMERS: 'harit_jal_customers_v1',
  CURRENT_CUSTOMER: 'harit_jal_current_customer_v1',
  ORDERS: 'harit_jal_orders_v1',
};

const INITIAL_CUSTOMERS: CustomerAccount[] = [
  {
    id: 'cust-karan-01',
    restaurantName: 'Karan The Dhaba',
    ownerName: 'Karanpreet Singh',
    email: 'karanpreet@karanthedhaba.com',
    phone: '+91 62992 93497',
    city: 'Murthal, GT Road, Haryana',
    password: 'password123',
    createdAt: '2026-11-05 10:30',
  },
  {
    id: 'cust-royal-02',
    restaurantName: 'The Royal Darbar & Banquets',
    ownerName: 'Rajeev Singhania',
    email: 'banquets@royal-darbar.in',
    phone: '+91 98112 34567',
    city: 'Jaipur, Rajasthan',
    password: 'password123',
    createdAt: '2026-11-06 14:15',
  },
];

const INITIAL_ORDERS: CustomerOrder[] = [
  {
    id: 'ORD-HJ-8910',
    restaurantName: 'Karan The Dhaba',
    ownerEmail: 'karanpreet@karanthedhaba.com',
    bottleSize: '500ml',
    caseCount: 50,
    bottlesTotal: 1200,
    ratePerBottle: 7.5,
    totalAmount: 9000,
    status: 'Dispatched (Out for Delivery)',
    driverName: 'Joginder Singh (Vehicle #HR-26-9041)',
    driverPhone: '+91 98123 45678',
    deliveryAddress: 'Karan The Dhaba, Milestone 52, GT Karnal Road, Murthal, Haryana',
    orderedAt: '2026-11-07 08:30',
    expectedDelivery: 'Today by 5:30 PM (Express Cellar Delivery)',
  },
  {
    id: 'ORD-HJ-8842',
    restaurantName: 'Karan The Dhaba',
    ownerEmail: 'karanpreet@karanthedhaba.com',
    bottleSize: '500ml',
    caseCount: 40,
    bottlesTotal: 960,
    ratePerBottle: 7.5,
    totalAmount: 7200,
    status: 'Delivered to Restaurant',
    driverName: 'Suresh Kumar',
    driverPhone: '+91 98111 22334',
    deliveryAddress: 'Karan The Dhaba, Murthal, Haryana',
    orderedAt: '2026-10-30 09:15',
    expectedDelivery: 'Delivered on 2026-10-31',
  },
];

export const CustomerAuthService = {
  getCustomers(): CustomerAccount[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
      return INITIAL_CUSTOMERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_CUSTOMERS;
    }
  },

  getCurrentCustomer(): CustomerAccount | null {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_CUSTOMER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  notifyChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('customerAuthChange'));
    }
  },

  register(data: Omit<CustomerAccount, 'id' | 'createdAt'>): CustomerAccount {
    const all = this.getCustomers();
    const existing = all.find(c => c.email.toLowerCase() === data.email.toLowerCase());
    if (existing) {
      // Update with new password & details
      existing.restaurantName = data.restaurantName;
      existing.ownerName = data.ownerName;
      existing.phone = data.phone;
      existing.city = data.city;
      existing.password = data.password;
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(all));
      localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(existing));
      this.notifyChange();
      return existing;
    }

    const newCust: CustomerAccount = {
      ...data,
      id: `cust-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    all.push(newCust);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(all));
    localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(newCust));
    this.notifyChange();
    return newCust;
  },

  login(email: string, password?: string): CustomerAccount | null {
    const res = this.loginWithSecurity(email, password);
    return res.success ? (res.customer || null) : null;
  },

  loginWithSecurity(email: string, password?: string): {
    success: boolean;
    customer?: CustomerAccount;
    error?: string;
    isBlocked?: boolean;
    remainingAttempts?: number;
  } {
    const cleanEmail = email.trim().toLowerCase();

    // 0. Check multi-vector block (ID + Device + IP)
    const blockCheck = SecurityRateLimiter.checkBlock(cleanEmail);
    if (blockCheck.isBlocked) {
      return {
        success: false,
        isBlocked: true,
        error: `Security Lockout: Account ID, device, and network locked for 24 hours. Remaining: ${blockCheck.remainingFormatted}.`,
      };
    }

    const all = this.getCustomers();
    const found = all.find(c => c.email.toLowerCase() === cleanEmail);
    if (!found) {
      return {
        success: false,
        error: 'No registered partner account found with this email address.',
      };
    }

    // Check password
    if (password) {
      if (found.password && found.password !== password.trim()) {
        const failRes = SecurityRateLimiter.recordFailedPassword(cleanEmail);
        return {
          success: false,
          isBlocked: failRes.isBlocked,
          remainingAttempts: failRes.attemptsRemaining,
          error: failRes.error,
        };
      }
    }

    // Success - clear password failure counters
    SecurityRateLimiter.recordSuccessfulPassword(cleanEmail);
    localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(found));
    this.notifyChange();
    return {
      success: true,
      customer: found,
    };
  },

  logout() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_CUSTOMER);
    this.notifyChange();
  },

  resetPassword(email: string, newPass: string): boolean {
    const all = this.getCustomers();
    const found = all.find(c => c.email.toLowerCase() === email.trim().toLowerCase());
    if (!found) return false;
    found.password = newPass.trim();
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(all));
    const current = this.getCurrentCustomer();
    if (current && current.email.toLowerCase() === email.trim().toLowerCase()) {
      current.password = newPass.trim();
      localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(current));
    }
    return true;
  },

  updateCustomerProfile(
    customerId: string,
    newEmail?: string,
    newPhone?: string,
    newOwnerName?: string,
    newRestaurantName?: string,
    newCity?: string
  ): { success: boolean; error?: string; customer?: CustomerAccount } {
    const all = this.getCustomers();
    const cust = all.find(c => c.id === customerId);
    if (!cust) return { success: false, error: 'Customer account not found.' };

    const cleanEmail = newEmail ? newEmail.trim().toLowerCase() : cust.email;
    const cleanPhone = newPhone ? newPhone.trim() : cust.phone;

    const emailChanged = cleanEmail !== cust.email.toLowerCase();
    const phoneChanged = cleanPhone !== cust.phone;

    if (emailChanged || phoneChanged) {
      const currentCount = cust.emailPhoneChangesCount || 0;
      if (currentCount >= 5) {
        return {
          success: false,
          error: 'Lifetime modification limit reached. You have already changed your email/mobile number 5 times.'
        };
      }

      if (emailChanged && all.some(c => c.id !== customerId && c.email.toLowerCase() === cleanEmail)) {
        return { success: false, error: 'This email is already registered to another restaurant account.' };
      }

      cust.email = cleanEmail;
      cust.phone = cleanPhone;
      cust.emailPhoneChangesCount = currentCount + 1;
    }

    if (newOwnerName) cust.ownerName = newOwnerName.trim();
    if (newRestaurantName) cust.restaurantName = newRestaurantName.trim();
    if (newCity) cust.city = newCity.trim();

    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(all));
    localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(cust));
    this.notifyChange();

    return { success: true, customer: cust };
  },

  // --- ORDERS ---
  getAllOrders(): CustomerOrder[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_ORDERS;
    }
  },

  getOrdersForCustomer(email: string): CustomerOrder[] {
    const all = this.getAllOrders();
    return all.filter(o => o.ownerEmail.toLowerCase() === email.toLowerCase());
  },

  getOrderById(id: string): CustomerOrder | null {
    const all = this.getAllOrders();
    return all.find(o => o.id.toLowerCase() === id.toLowerCase().trim()) || null;
  },

  placeOrder(order: Omit<CustomerOrder, 'id' | 'orderedAt' | 'status' | 'expectedDelivery'>): CustomerOrder {
    const all = this.getAllOrders();
    const newOrder: CustomerOrder = {
      ...order,
      id: `ORD-HJ-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'Order Confirmed',
      orderedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      expectedDelivery: 'Within 48 hours via Harit Jal Express Logistics',
      driverName: 'Harit Jal Fleet Assigned (Truck Dispatching)',
      driverPhone: '+91 62992 93497',
    };

    all.unshift(newOrder);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(all));
    return newOrder;
  },
};

