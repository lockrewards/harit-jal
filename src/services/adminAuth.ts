import { AdminUser } from '../types';
import { StorageService } from './storage';
import { SecurityRateLimiter } from './securityRateLimiter';
import { TotpService } from './totpService';

export interface AdminSession {
  adminId: string;
  name: string;
  email: string;
  phone?: string;
  role: AdminUser['role'];
  designation?: string;
  permissions?: string[];
  token: string;
  loginAt: string;
  expiresAt: number;
}

const STORAGE_KEYS = {
  ADMIN_SESSION: 'harit_jal_admin_session_v1',
  ADMIN_CREDENTIALS: 'harit_jal_admin_credentials_v1',
};

// Default seed passwords for authorized internal team members (pre-Supabase local mock)
const DEFAULT_ADMIN_CREDENTIALS: Record<string, string> = {
  'vikram@haritjal.in': 'Admin@HaritJal2026',
  'pooja.sales@haritjal.in': 'Sales@HaritJal2026',
  'rohit.ops@haritjal.in': 'Ops@HaritJal2026',
  'ananya.design@haritjal.in': 'Design@HaritJal2026',
};

// 4-hour session expiry
const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

export const AdminAuthService = {
  /**
   * Check if a valid, unexpired Admin session exists
   */
  isAuthenticated(): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
      this.logout();
      return false;
    }
    return true;
  },

  /**
   * Retrieve current active admin session
   */
  getCurrentSession(): AdminSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION);
      if (!raw) return null;
      const parsed: AdminSession = JSON.parse(raw);
      if (!parsed || !parsed.email || !parsed.role) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * Resolve an Admin or Staff user by Email ID OR Mobile Number
   */
  findUserByIdentifier(identifier: string): AdminUser | null {
    const trimmed = identifier.trim();
    if (!trimmed) return null;

    const users = StorageService.getUsers();
    const cleanEmail = trimmed.toLowerCase();
    const digitsOnly = trimmed.replace(/\D/g, '');

    return users.find(u => {
      const uEmail = u.email.toLowerCase();
      if (uEmail === cleanEmail) return true;

      if (digitsOnly.length >= 10 && u.phone) {
        const uPhoneDigits = u.phone.replace(/\D/g, '');
        if (uPhoneDigits.endsWith(digitsOnly.slice(-10))) return true;
      }
      return false;
    }) || null;
  },

  /**
   * STEP 1: Validate Email/Phone and Password
   * If correct, returns user object to proceed to Step 2 (TOTP)
   */
  validateCredentials(
    identifier: string,
    password: string
  ): {
    success: boolean;
    error?: string;
    requireFirstLoginSetup?: boolean;
    user?: AdminUser;
  } {
    const trimmedId = identifier.trim();
    const trimmedPassword = password.trim();

    if (!trimmedId || !trimmedPassword) {
      return { success: false, error: 'Staff Email or Mobile Number, and Password are required.' };
    }

    // 1. Resolve user by Email or Mobile Number
    const adminUser = this.findUserByIdentifier(trimmedId);
    if (!adminUser) {
      return { 
        success: false, 
        error: 'Access denied: No administrative staff found with this Email address or Mobile number.' 
      };
    }

    // 2. Check if staff is Blocked
    if (adminUser.status === 'Blocked') {
      return { 
        success: false, 
        error: 'Staff account has been blocked by Super Admin. Access is revoked.' 
      };
    }

    // 3. Multi-vector Security Block Check (ID + Device + IP)
    const blockCheck = SecurityRateLimiter.checkBlock(adminUser.email);
    if (blockCheck.isBlocked) {
      return {
        success: false,
        error: `Security Lockout: Administrative access is locked for 24 hours on your ID, device, and network. Time remaining: ${blockCheck.remainingFormatted}.`,
      };
    }

    // 4. Validate password against custom credentials, temporary password, or default seed
    const customCredentials = this.getCustomCredentials();
    const expectedPassword = 
      adminUser.temporaryPassword || 
      customCredentials[adminUser.email.toLowerCase()] || 
      DEFAULT_ADMIN_CREDENTIALS[adminUser.email.toLowerCase()];

    if (!expectedPassword || expectedPassword !== trimmedPassword) {
      const failRes = SecurityRateLimiter.recordFailedPassword(adminUser.email);
      return {
        success: false,
        error: failRes.error,
      };
    }

    // 5. Check if staff was added with temporary password (first login setup required)
    if (adminUser.isFirstLogin) {
      return {
        success: false,
        requireFirstLoginSetup: true,
        user: adminUser,
      };
    }

    // Step 1 Success! Clear password failure counter
    SecurityRateLimiter.recordSuccessfulPassword(adminUser.email);
    return { success: true, user: adminUser };
  },

  /**
   * STEP 2: Verify Google Authenticator (TOTP) Code and establish active session
   */
  async verifyTotpAndCreateSession(
    user: AdminUser,
    totpToken: string
  ): Promise<{ success: boolean; error?: string; session?: AdminSession }> {
    const cleanTotp = (totpToken || '').trim();
    if (!cleanTotp) {
      return {
        success: false,
        error: 'Google Authenticator 6-digit code (TOTP) is mandatory for Staff and Admin access.',
      };
    }

    if (cleanTotp.length !== 6 || !/^\d{6}$/.test(cleanTotp)) {
      return {
        success: false,
        error: 'Please enter a valid 6-digit numeric Google Authenticator code.',
      };
    }

    // Ensure user has a TOTP secret
    let secret = user.totpSecret;
    if (!secret) {
      secret = 'JBSWY3DPEHPK3PXP'; // Fallback seed
      StorageService.updateUser(user.id, { totpSecret: secret, totpEnabled: true });
    }

    // Verify token with +/- 1 time step window tolerance
    const isTotpValid = await TotpService.verifyToken(cleanTotp, secret, 1);
    if (!isTotpValid) {
      const failOtp = SecurityRateLimiter.recordFailedOtp(user.email);
      if (failOtp.isBlocked) {
        return {
          success: false,
          error: 'Maximum 3 wrong attempts reached. Account ID, device, and network are locked for 24 hours.',
        };
      }
      return {
        success: false,
        error: `Invalid Google Authenticator code. ${failOtp.attemptsRemaining} attempt(s) remaining before 24-hour block.`,
      };
    }

    // SUCCESS! Reset security counters and create session
    SecurityRateLimiter.recordSuccessfulPassword(user.email);
    SecurityRateLimiter.recordSuccessfulOtp(user.email);

    const session: AdminSession = {
      adminId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      designation: user.designation || user.role,
      permissions: user.permissions || ['all'],
      token: `hjadm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      loginAt: new Date().toISOString(),
      expiresAt: Date.now() + SESSION_DURATION_MS,
    };

    try {
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(session));
    } catch (err) {
      console.error('Failed to save admin session:', err);
    }

    return { success: true, session };
  },

  /**
   * Single-call login helper (for automated tests and unified callers)
   */
  async login(
    identifier: string, 
    password: string, 
    totpToken?: string
  ): Promise<{ 
    success: boolean; 
    error?: string; 
    session?: AdminSession; 
    requireFirstLoginSetup?: boolean; 
    user?: AdminUser; 
    tempToken?: string;
  }> {
    const credRes = this.validateCredentials(identifier, password);
    if (!credRes.success || !credRes.user) {
      return {
        success: false,
        error: credRes.error,
        requireFirstLoginSetup: credRes.requireFirstLoginSetup,
        user: credRes.user,
      };
    }

    if (!totpToken) {
      return {
        success: false,
        error: 'Google Authenticator 6-digit TOTP code is required.',
      };
    }

    const totpRes = await this.verifyTotpAndCreateSession(credRes.user, totpToken);
    return {
      success: totpRes.success,
      error: totpRes.error,
      session: totpRes.session,
      user: credRes.user,
    };
  },

  /**
   * Complete First-Time Setup for new staff: Sets permanent password & activates Google Authenticator TOTP
   */
  async completeFirstTimeSetup(
    userId: string,
    newPermanentPassword: string,
    totpToken: string,
    totpSecret: string
  ): Promise<{ success: boolean; error?: string; session?: AdminSession }> {
    const users = StorageService.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
      return { success: false, error: 'Staff account not found.' };
    }

    if (!newPermanentPassword || newPermanentPassword.length < 6) {
      return { success: false, error: 'Permanent password must be at least 6 characters long.' };
    }

    // Verify the TOTP code to ensure user successfully scanned and linked Google Authenticator
    const isTotpValid = await TotpService.verifyToken(totpToken, totpSecret, 1);
    if (!isTotpValid) {
      return {
        success: false,
        error: 'Invalid Google Authenticator code. Please scan the QR code and enter the 6 digits generated by the app.',
      };
    }

    // 1. Update user credentials
    this.updatePassword(user.email, newPermanentPassword);

    // 2. Mark first login complete and activate TOTP
    StorageService.updateUser(userId, {
      isFirstLogin: false,
      temporaryPassword: undefined,
      totpSecret,
      totpEnabled: true,
      status: 'Active',
    });

    // 3. Create active session
    const session: AdminSession = {
      adminId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      designation: user.designation || user.role,
      permissions: user.permissions || ['all'],
      token: `hjadm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      loginAt: new Date().toISOString(),
      expiresAt: Date.now() + SESSION_DURATION_MS,
    };

    sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(session));
    return { success: true, session };
  },

  /**
   * Log out admin/staff and destroy session
   */
  logout(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    } catch (err) {
      console.error('Failed to remove admin session:', err);
    }
  },

  /**
   * Check if current admin has one of the allowed roles
   */
  hasRole(allowedRoles: AdminUser['role'][]): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;
    return allowedRoles.includes(session.role);
  },

  /**
   * Check if current admin has a specific permission
   */
  hasPermission(permission: string): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;
    if (session.role === 'Super Admin') return true;
    if (!session.permissions) return false;
    return session.permissions.includes('all') || session.permissions.includes(permission);
  },

  /**
   * Internal credentials store
   */
  getCustomCredentials(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_CREDENTIALS);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  /**
   * Update password for an admin user
   */
  updatePassword(email: string, newPass: string): void {
    const creds = this.getCustomCredentials();
    creds[email.toLowerCase()] = newPass;
    localStorage.setItem(STORAGE_KEYS.ADMIN_CREDENTIALS, JSON.stringify(creds));
  },
};
