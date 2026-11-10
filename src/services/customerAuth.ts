import { CustomerAccount, CustomerOrder } from '../types';
import { SecurityRateLimiter } from './securityRateLimiter';
import { hashPasswordPBKDF2, verifyPassword } from './cryptoUtils';
import { getSupabaseClient, isSupabaseConfigured, SupabaseService } from './supabase';
import { isProductionEnvironment } from './env';
import { normalizeIndianPhoneNumber } from './phoneUtils';

const STORAGE_KEYS = {
  CUSTOMERS: 'harit_jal_customers_v1',
  CURRENT_CUSTOMER: 'harit_jal_current_customer_v1',
  ORDERS: 'harit_jal_orders_v1',
};

/**
 * Generates a valid RFC 4122 v4 UUID string
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Sanitizes customer profile object by stripping all password and hash fields before
 * storing in active session or returning to the UI components.
 */
function sanitizeCustomer(cust: CustomerAccount): CustomerAccount {
  const clean = { ...cust };
  delete clean.password;
  delete clean.passwordHash;
  return clean;
}

// Development-only customer seed records (UUID-based, zero exposed password hashes, never seeded in production)
const INITIAL_CUSTOMERS: CustomerAccount[] = [
  {
    id: 'e0c7a38b-8c2d-4d7a-9a9c-1a2b3c4d5e01',
    restaurantName: 'Karan The Dhaba',
    ownerName: 'Karanpreet Singh',
    email: 'karanpreet@karanthedhaba.com',
    phone: '+91 62992 93497',
    city: 'Murthal, GT Road, Haryana',
    createdAt: '2026-11-05 10:30',
  },
  {
    id: 'f1d8b49c-9d3e-5e8b-0b0d-2b3c4d5e6f02',
    restaurantName: 'The Royal Darbar & Banquets',
    ownerName: 'Rajeev Singhania',
    email: 'banquets@royal-darbar.in',
    phone: '+91 98765 43210',
    city: 'Jaipur, Rajasthan',
    createdAt: '2026-11-06 14:15',
  },
];

// Development-only demo order history (never seeded in production)
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
      if (isProductionEnvironment()) {
        return [];
      }
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
      return INITIAL_CUSTOMERS;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return isProductionEnvironment() ? [] : INITIAL_CUSTOMERS;
    }
  },

  getCurrentCustomer(): CustomerAccount | null {
    const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_CUSTOMER);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.email) return null;
      return sanitizeCustomer(parsed);
    } catch {
      return null;
    }
  },

  notifyChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('customerAuthChange'));
    }
  },

  /**
   * Asynchronously signs up a customer through Supabase Auth.
   * Fails closed in production if Supabase Auth is unavailable or errors.
   */
  async signUpWithSupabaseAuth(data: {
    email: string;
    password: string;
    restaurantName: string;
    ownerName: string;
    phone: string;
    city: string;
  }): Promise<{
    success: boolean;
    customer?: CustomerAccount;
    requiresEmailConfirmation?: boolean;
    error?: string;
  }> {
    if (!data.password || data.password.trim().length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }
    if (!data.email || !data.email.includes('@')) {
      return { success: false, error: 'A valid email address is required.' };
    }

    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPassword = data.password.trim();
    const isProd = isProductionEnvironment();

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const redirectUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/track`
          : 'https://haritjal.in/track';

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              restaurant_name: data.restaurantName.trim(),
              owner_name: data.ownerName.trim(),
              phone: data.phone.trim(),
              city: data.city.trim(),
              dpdp_consent: true,
              role: 'customer',
            },
          },
        });

        if (authError) {
          return { success: false, error: authError.message };
        }

        if (authData.user) {
          let session = authData.session;
          if (!session) {
            try {
              const { data: signInData } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: cleanPassword,
              });
              session = signInData?.session || null;
            } catch {
              // Ignore background sign-in attempt
            }
          }

          const customerProfile: CustomerAccount = {
            id: authData.user.id,
            restaurantName: data.restaurantName.trim(),
            ownerName: data.ownerName.trim(),
            email: cleanEmail,
            phone: data.phone.trim(),
            city: data.city.trim(),
            createdAt: authData.user.created_at || new Date().toISOString(),
            emailPhoneChangesCount: 0,
          };

          await SupabaseService.syncCustomer(customerProfile);

          const sanitized = sanitizeCustomer(customerProfile);
          if (session) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(sanitized));
            this.notifyChange();
          }

          return {
            success: true,
            customer: sanitized,
            requiresEmailConfirmation: !session,
          };
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[CustomerAuth] Supabase Auth registration notice:', errMsg);
        if (isProd) {
          return {
            success: false,
            error: 'Registration service temporarily unavailable. Please try again shortly.',
          };
        }
      }
    }

    // Fail closed in production
    if (isProd) {
      return {
        success: false,
        error: 'Registration service temporarily unavailable. Please try again shortly.',
      };
    }

    // Offline / Local Testing Fallback (non-production only)
    const localAccount = this.register({
      restaurantName: data.restaurantName,
      ownerName: data.ownerName,
      email: cleanEmail,
      phone: data.phone,
      city: data.city,
      password: cleanPassword,
    });
    return { success: true, customer: localAccount };
  },

  /**
   * Asynchronously authenticates a customer through Supabase Auth.
   * Fails closed in production environments if cloud service encounters errors.
   */
  async loginWithSupabaseAuth(email: string, password?: string): Promise<{
    success: boolean;
    customer?: CustomerAccount;
    error?: string;
    isBlocked?: boolean;
    remainingAttempts?: number;
  }> {
    if (!password || !password.trim()) {
      return { success: false, error: 'Password is required to sign in.' };
    }
    if (!email || !email.trim()) {
      return { success: false, error: 'Email address is required to sign in.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const isProd = isProductionEnvironment();

    const blockCheck = SecurityRateLimiter.checkBlock(cleanEmail);
    if (blockCheck.isBlocked) {
      return {
        success: false,
        isBlocked: true,
        error: `Security Lockout: Account ID, device, and network locked for 24 hours. Remaining: ${blockCheck.remainingFormatted}.`,
      };
    }

    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (authError) {
          const authErrObj = authError as { name?: string; status?: number };
          const isServiceOutage =
            authErrObj.name === 'AuthRetryableFetchError' ||
            authErrObj.status === 0 ||
            (typeof authErrObj.status === 'number' && authErrObj.status >= 500);
          if (isServiceOutage && isProd) {
            return {
              success: false,
              error: 'Authentication service temporarily unavailable. Please try again shortly.',
            };
          }
          const failRes = SecurityRateLimiter.recordFailedPassword(cleanEmail);
          return {
            success: false,
            isBlocked: failRes.isBlocked,
            remainingAttempts: failRes.attemptsRemaining,
            error: 'Invalid email address or password. Please verify your credentials.',
          };
        }

        SecurityRateLimiter.recordSuccessfulPassword(cleanEmail);

        if (authData.user) {
          const meta = authData.user.user_metadata || {};
          let dbProfile: Record<string, unknown> | null = null;
          try {
            const { data: row } = await supabase
              .from('customers')
              .select('restaurant_name, owner_name, email, phone, city, email_phone_changes_count, created_at')
              .eq('id', authData.user.id)
              .maybeSingle();
            dbProfile = row;
          } catch {
            // Fall back to user_metadata if profile query fails
          }

          const customerProfile: CustomerAccount = {
            id: authData.user.id,
            restaurantName:
              (typeof dbProfile?.restaurant_name === 'string' && dbProfile.restaurant_name) ||
              (typeof meta.restaurant_name === 'string' && meta.restaurant_name) ||
              'Restaurant Partner',
            ownerName:
              (typeof dbProfile?.owner_name === 'string' && dbProfile.owner_name) ||
              (typeof meta.owner_name === 'string' && meta.owner_name) ||
              cleanEmail.split('@')[0],
            email: (typeof dbProfile?.email === 'string' && dbProfile.email) || cleanEmail,
            phone:
              (typeof dbProfile?.phone === 'string' ? dbProfile.phone : undefined) ??
              (typeof meta.phone === 'string' ? meta.phone : ''),
            city:
              (typeof dbProfile?.city === 'string' ? dbProfile.city : undefined) ??
              (typeof meta.city === 'string' ? meta.city : ''),
            createdAt:
              (typeof dbProfile?.created_at === 'string' && dbProfile.created_at) ||
              authData.user.created_at ||
              new Date().toISOString(),
            emailPhoneChangesCount:
              typeof dbProfile?.email_phone_changes_count === 'number'
                ? dbProfile.email_phone_changes_count
                : 0,
          };

          const sanitized = sanitizeCustomer(customerProfile);
          localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(sanitized));
          this.notifyChange();
          return { success: true, customer: sanitized };
        }
      } catch (err: unknown) {
        console.warn('[CustomerAuth] Supabase auth login notice:', err);
        if (isProd) {
          return {
            success: false,
            error: 'Authentication service temporarily unavailable. Please try again shortly.',
          };
        }
      }
    }

    // Fail closed in production
    if (isProd) {
      return {
        success: false,
        error: 'Authentication service temporarily unavailable. Please try again shortly.',
      };
    }

    // Local / Offline Mode Fallback
    return this.loginWithSecurity(cleanEmail, cleanPassword);
  },

  register(data: Omit<CustomerAccount, 'id' | 'createdAt'>): CustomerAccount {
    const all = this.getCustomers();
    const existing = all.find((c) => c.email.toLowerCase() === data.email.toLowerCase());

    let passwordHash: string | undefined = undefined;
    if (data.password && data.password.trim()) {
      passwordHash = hashPasswordPBKDF2(data.password.trim()).combined;
    } else if (data.passwordHash) {
      passwordHash = data.passwordHash;
    }

    if (existing) {
      existing.restaurantName = data.restaurantName;
      existing.ownerName = data.ownerName;
      existing.phone = data.phone;
      existing.city = data.city;
      if (passwordHash) {
        existing.passwordHash = passwordHash;
        delete existing.password;
      }
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(all));
      const sanitized = sanitizeCustomer(existing);
      localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(sanitized));
      this.notifyChange();
      return sanitized;
    }

    const newCust: CustomerAccount = {
      restaurantName: data.restaurantName,
      ownerName: data.ownerName,
      email: data.email.trim().toLowerCase(),
      phone: data.phone,
      city: data.city,
      passwordHash,
      id: generateUUID(),
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      emailPhoneChangesCount: 0,
    };

    all.push(newCust);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(all));
    const sanitized = sanitizeCustomer(newCust);
    localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(sanitized));
    this.notifyChange();
    return sanitized;
  },

  /**
   * Safe login wrapper — strictly rejects passwordless attempts
   */
  login(email: string, password?: string): CustomerAccount | null {
    if (!password || !password.trim()) {
      return null;
    }
    const res = this.loginWithSecurity(email, password);
    return res.success ? (res.customer || null) : null;
  },

  /**
   * Find a customer record by email address or mobile number.
   */
  findCustomerByIdentifier(identifier: string): CustomerAccount | null {
    if (!identifier || !identifier.trim()) return null;
    const rawId = identifier.trim();
    const isEmail = rawId.includes('@');
    const normPhone = !isEmail ? normalizeIndianPhoneNumber(rawId) : null;
    const all = this.getCustomers();

    return all.find((c) => {
      if (isEmail && c.email.toLowerCase() === rawId.toLowerCase()) return true;
      if (!isEmail && normPhone?.isValid && c.phone) {
        const cNorm = normalizeIndianPhoneNumber(c.phone);
        if (cNorm.isValid && cNorm.digits10 === normPhone.digits10) return true;
      }
      return false;
    }) || null;
  },

  /**
   * Local / Offline Customer Authentication (non-production fallback)
   */
  loginWithSecurity(identifier: string, password?: string): {
    success: boolean;
    customer?: CustomerAccount;
    error?: string;
    isBlocked?: boolean;
    remainingAttempts?: number;
  } {
    if (!password || !password.trim()) {
      return {
        success: false,
        error: 'Password is required to sign in.',
      };
    }

    if (!identifier || !identifier.trim()) {
      return {
        success: false,
        error: 'Email address or mobile number is required to sign in.',
      };
    }

    const rawId = identifier.trim();
    const cleanPassword = password.trim();
    const isEmail = rawId.includes('@');
    const normPhone = !isEmail ? normalizeIndianPhoneNumber(rawId) : null;

    if (!isEmail && (!normPhone || !normPhone.isValid)) {
      return {
        success: false,
        error: 'Please enter a valid email address or 10-digit Indian mobile number.',
      };
    }

    const rateLimitKey = isEmail ? rawId.toLowerCase() : (normPhone?.e164 || rawId);

    const blockCheck = SecurityRateLimiter.checkBlock(rateLimitKey);
    if (blockCheck.isBlocked) {
      return {
        success: false,
        isBlocked: true,
        error: `Security Lockout: Account ID, device, and network locked for 24 hours. Remaining: ${blockCheck.remainingFormatted}.`,
      };
    }

    const all = this.getCustomers();
    const found = all.find((c) => {
      if (isEmail && c.email.toLowerCase() === rawId.toLowerCase()) return true;
      if (!isEmail && normPhone?.isValid && c.phone) {
        const cNorm = normalizeIndianPhoneNumber(c.phone);
        if (cNorm.isValid && cNorm.digits10 === normPhone.digits10) return true;
      }
      return false;
    });

    if (!found) {
      const failRes = SecurityRateLimiter.recordFailedPassword(rateLimitKey);
      return {
        success: false,
        isBlocked: failRes.isBlocked,
        remainingAttempts: failRes.attemptsRemaining,
        error: isEmail
          ? 'Invalid email address or password. Please verify your credentials.'
          : 'Invalid mobile number or password. Please verify your credentials.',
      };
    }

    const storedHash = found.passwordHash || found.password || '';
    const isMatch = verifyPassword(cleanPassword, storedHash);

    if (!isMatch) {
      const failRes = SecurityRateLimiter.recordFailedPassword(rateLimitKey);
      return {
        success: false,
        isBlocked: failRes.isBlocked,
        remainingAttempts: failRes.attemptsRemaining,
        error: isEmail
          ? 'Invalid email address or password. Please verify your credentials.'
          : 'Invalid mobile number or password. Please verify your credentials.',
      };
    }

    SecurityRateLimiter.recordSuccessfulPassword(rateLimitKey);

    if (found.password && !found.passwordHash) {
      found.passwordHash = hashPasswordPBKDF2(cleanPassword).combined;
      delete found.password;
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(all));
    }

    const sanitized = sanitizeCustomer(found);
    localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(sanitized));
    this.notifyChange();
    return {
      success: true,
      customer: sanitized,
    };
  },

  logout() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_CUSTOMER);
    const supabase = getSupabaseClient();
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    this.notifyChange();
  },

  resetPassword(email: string, newPass: string): boolean {
    if (!newPass || !newPass.trim()) return false;
    const cleanEmail = email.trim().toLowerCase();
    const all = this.getCustomers();
    const found = all.find((c) => c.email.toLowerCase() === cleanEmail);
    if (!found) return false;

    found.passwordHash = hashPasswordPBKDF2(newPass.trim()).combined;
    delete found.password;
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(all));

    const current = this.getCurrentCustomer();
    if (current && current.email.toLowerCase() === cleanEmail) {
      const sanitized = sanitizeCustomer(found);
      localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(sanitized));
    }
    return true;
  },

  async syncSessionProfile(): Promise<CustomerAccount | null> {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) return this.getCurrentCustomer();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) return null;

      const appMetaRole = typeof authUser.app_metadata?.role === 'string'
        ? authUser.app_metadata.role.toLowerCase()
        : 'customer';
      if (appMetaRole !== 'customer' && appMetaRole !== '') {
        return null;
      }

      const meta = authUser.user_metadata || {};
      const current = this.getCurrentCustomer();
      const authEmail = (authUser.email || current?.email || '').toLowerCase();

      let dbProfile: Record<string, unknown> | null = null;
      try {
        const { data: row } = await supabase
          .from('customers')
          .select('restaurant_name, owner_name, email, phone, city, email_phone_changes_count, created_at')
          .eq('id', authUser.id)
          .maybeSingle();
        dbProfile = row;
      } catch {
        // Fallback below
      }

      const customerProfile: CustomerAccount = {
        id: authUser.id,
        restaurantName:
          (typeof dbProfile?.restaurant_name === 'string' && dbProfile.restaurant_name) ||
          current?.restaurantName ||
          (typeof meta.restaurant_name === 'string' && meta.restaurant_name) ||
          'Restaurant Partner',
        ownerName:
          (typeof dbProfile?.owner_name === 'string' && dbProfile.owner_name) ||
          current?.ownerName ||
          (typeof meta.owner_name === 'string' && meta.owner_name) ||
          authEmail.split('@')[0],
        email: authEmail,
        phone:
          (typeof dbProfile?.phone === 'string' ? dbProfile.phone : undefined) ??
          current?.phone ??
          (typeof meta.phone === 'string' ? meta.phone : ''),
        city:
          (typeof dbProfile?.city === 'string' ? dbProfile.city : undefined) ??
          current?.city ??
          (typeof meta.city === 'string' ? meta.city : ''),
        createdAt:
          (typeof dbProfile?.created_at === 'string' && dbProfile.created_at) ||
          authUser.created_at ||
          new Date().toISOString(),
        emailPhoneChangesCount:
          typeof dbProfile?.email_phone_changes_count === 'number'
            ? dbProfile.email_phone_changes_count
            : (current?.emailPhoneChangesCount ?? 0),
      };

      if (dbProfile && typeof dbProfile.email === 'string' && dbProfile.email.toLowerCase() !== authEmail) {
        await SupabaseService.syncCustomer(customerProfile);
      }

      const sanitized = sanitizeCustomer(customerProfile);
      localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(sanitized));
      this.notifyChange();
      return sanitized;
    } catch {
      return null;
    }
  },

  async updateCustomerProfile(
    customerId: string,
    newEmail?: string,
    newPhone?: string,
    newOwnerName?: string,
    newRestaurantName?: string,
    newCity?: string
  ): Promise<{
    success: boolean;
    error?: string;
    customer?: CustomerAccount;
    emailConfirmationPending?: boolean;
  }> {
    const all = this.getCustomers();
    const current = this.getCurrentCustomer();
    const idx = all.findIndex((c) => c.id === customerId);
    const cust = idx >= 0 ? { ...all[idx] } : current && current.id === customerId ? { ...current } : null;
    if (!cust) return { success: false, error: 'Customer account not found.' };

    const cleanEmail = newEmail ? newEmail.trim().toLowerCase() : cust.email.toLowerCase();
    const cleanPhone = newPhone ? newPhone.trim() : cust.phone;

    const emailChanged = cleanEmail !== cust.email.toLowerCase();
    const phoneChanged = cleanPhone !== cust.phone;

    if (emailChanged || phoneChanged) {
      const currentCount = cust.emailPhoneChangesCount || 0;
      if (currentCount >= 5) {
        return {
          success: false,
          error: 'Lifetime modification limit reached. You have already changed your email/mobile number 5 times.',
        };
      }

      if (emailChanged && all.some((c) => c.id !== customerId && c.email.toLowerCase() === cleanEmail)) {
        return { success: false, error: 'This email is already registered to another restaurant account.' };
      }
    }

    const isProd = isProductionEnvironment();
    const supabase = getSupabaseClient();
    let emailConfirmationPending = false;
    let resolvedEmail = cleanEmail;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData?.session?.user;
        if (!sessionUser || sessionUser.id !== customerId) {
          return {
            success: false,
            error: 'Your authentication session has expired. Please sign in again to update your profile.',
          };
        }

        if (emailChanged) {
          const { data: authUpdateData, error: authUpdateErr } = await supabase.auth.updateUser({
            email: cleanEmail,
          });
          if (authUpdateErr) {
            return {
              success: false,
              error: authUpdateErr.message || 'Failed to update login email in Supabase Auth.',
            };
          }

          const confirmedAuthEmail = (authUpdateData?.user?.email || sessionUser.email || '').toLowerCase();
          if (confirmedAuthEmail && confirmedAuthEmail !== cleanEmail) {
            emailConfirmationPending = true;
            // Keep public.customers email synchronized to active JWT email until confirmation link is clicked
            resolvedEmail = confirmedAuthEmail;
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unable to reach authentication service.';
        if (isProd || isSupabaseConfigured()) {
          return { success: false, error: msg };
        }
      }
    } else if (isProd) {
      return {
        success: false,
        error: 'Updating account credentials requires an active Supabase Auth connection in production.',
      };
    }

    const previousEmail = cust.email.toLowerCase();
    const appliedEmailChange = resolvedEmail !== previousEmail;
    if (appliedEmailChange || phoneChanged) {
      const currentCount = cust.emailPhoneChangesCount || 0;
      cust.email = resolvedEmail;
      cust.phone = cleanPhone;
      cust.emailPhoneChangesCount = currentCount + 1;
    }

    if (newOwnerName) cust.ownerName = newOwnerName.trim();
    if (newRestaurantName) cust.restaurantName = newRestaurantName.trim();
    if (newCity) cust.city = newCity.trim();

    const sanitized = sanitizeCustomer(cust);

    if (isSupabaseConfigured() && supabase) {
      const synced = await SupabaseService.syncCustomer(sanitized);
      if (!synced) {
        return {
          success: false,
          error: 'Could not save profile changes to the cloud database. Please try again.',
        };
      }
    }

    if (appliedEmailChange && previousEmail) {
      const cachedOrders = this.getAllOrders();
      let updatedOrderCache = false;
      const nextOrders = cachedOrders.map((o) => {
        if (o.ownerEmail.toLowerCase() === previousEmail) {
          updatedOrderCache = true;
          return { ...o, ownerEmail: resolvedEmail };
        }
        return o;
      });
      if (updatedOrderCache) {
        this.setOrdersCache(nextOrders);
      }
    }

    if (idx >= 0) {
      all[idx] = cust;
    } else {
      all.push(cust);
    }

    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(all));
    localStorage.setItem(STORAGE_KEYS.CURRENT_CUSTOMER, JSON.stringify(sanitized));
    this.notifyChange();

    return {
      success: true,
      customer: sanitized,
      emailConfirmationPending,
    };
  },

  // --- ORDERS ---
  getAllOrders(): CustomerOrder[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (!raw) {
      if (isProductionEnvironment()) {
        return [];
      }
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return isProductionEnvironment() ? [] : INITIAL_ORDERS;
    }
  },

  setOrdersCache(orders: CustomerOrder[]): CustomerOrder[] {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    return orders;
  },

  getOrdersForCustomer(email: string): CustomerOrder[] {
    const all = this.getAllOrders();
    return all.filter((o) => o.ownerEmail.toLowerCase() === email.toLowerCase());
  },

  getOrderById(id: string): CustomerOrder | null {
    const all = this.getAllOrders();
    return all.find((o) => o.id.toLowerCase() === id.toLowerCase().trim()) || null;
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
