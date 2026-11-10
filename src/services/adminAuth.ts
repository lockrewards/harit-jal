import { AdminUser } from '../types';
import { StorageService } from './storage';
import { SecurityRateLimiter } from './securityRateLimiter';
import { TotpService } from './totpService';
import { hashPassword, verifyPassword, timingSafeEqual, generateSecureTemporaryPassword } from './cryptoUtils';
import { getSupabaseClient, isSupabaseConfigured, SupabaseService } from './supabase';
import { isProductionEnvironment } from './env';
import { isStaffRole, normalizeStaffRole } from './roles';
import { normalizeIndianPhoneNumber } from './phoneUtils';

export interface AdminSession {
  adminId: string;
  name: string;
  email: string;
  phone?: string;
  role: AdminUser['role'];
  designation?: string;
  permissions?: string[];
  isRootSuperAdmin?: boolean;
  authLevel?: 'aal1' | 'aal2';
  token: string;
  loginAt: string;
  expiresAt: number;
}

const STORAGE_KEYS = {
  ADMIN_SESSION: 'harit_jal_admin_session_v1',
  ADMIN_CREDENTIALS: 'harit_jal_admin_credentials_v1',
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
    // MED-H5-02: Require AAL2 synchronously in production or when Supabase is configured
    if ((isProductionEnvironment() || isSupabaseConfigured()) && session.authLevel !== 'aal2') {
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

    return (
      users.find((u) => {
        if (u.id === trimmed) return true;
        const uEmail = u.email.toLowerCase();
        if (uEmail === cleanEmail) return true;

        if (digitsOnly.length >= 10 && u.phone) {
          const uPhoneDigits = u.phone.replace(/\D/g, '');
          if (uPhoneDigits.endsWith(digitsOnly.slice(-10))) return true;
        }
        return false;
      }) || null
    );
  },

  /**
   * STEP 1: Validate Email/Phone and Password
   * Enforces:
   * 1. No plaintext hardcoded credentials [SEC-04]
   * 2. Non-enumerating uniform authentication error messages [SEC-06]
   * 3. Multi-vector rate-limiting (3 strikes -> 24h lockout)
   * 4. Real Supabase Auth signInWithPassword integration + trusted app_metadata.role validation
   * 5. Server-side temporary password 72h expiry enforcement & verified GoTrue TOTP factor gate
   */
  async validateCredentials(
    identifier: string,
    password: string
  ): Promise<{
    success: boolean;
    error?: string;
    requireFirstLoginSetup?: boolean;
    requireMfaEnrollment?: boolean;
    user?: AdminUser;
  }> {
    const trimmedId = identifier.trim();
    const trimmedPassword = password.trim();

    if (!trimmedId || !trimmedPassword) {
      return { success: false, error: 'Staff Email or Mobile Number, and Password are required.' };
    }

    const blockCheck = SecurityRateLimiter.checkBlock(trimmedId);
    if (blockCheck.isBlocked) {
      return {
        success: false,
        error: `Security Lockout: Administrative access is locked for 24 hours on your ID, device, and network. Time remaining: ${blockCheck.remainingFormatted}.`,
      };
    }

    const isProd = isProductionEnvironment();
    const supabase = getSupabaseClient();

    // 1. LIVE SUPABASE AUTH INTEGRATION
    if (isSupabaseConfigured() && supabase) {
      try {
        let authUser: { id: string; email?: string; phone?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null = null;
        let rateLimitKey = trimmedId.toLowerCase();

        if (trimmedId.includes('@')) {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: trimmedId.toLowerCase(),
            password: trimmedPassword,
          });

          if (authError || !authData.user) {
            const authErrObj = authError as { name?: string; status?: number } | null;
            const isServiceOutage =
              authErrObj?.name === 'AuthRetryableFetchError' ||
              authErrObj?.status === 0 ||
              (typeof authErrObj?.status === 'number' && authErrObj.status >= 500);
            if (isServiceOutage && (isProd || isSupabaseConfigured())) {
              return {
                success: false,
                error: 'Authentication service temporarily unavailable. Please try again shortly.',
              };
            }
            const failRes = SecurityRateLimiter.recordFailedPassword(trimmedId.toLowerCase());
            return {
              success: false,
              error: failRes.isBlocked
                ? 'Security Lockout: Maximum failed attempts exceeded. Access locked for 24 hours.'
                : 'Invalid administrative credentials. Please verify your Email or Mobile number and Password.',
            };
          }
          authUser = authData.user;
        } else {
          // Server-Side Mobile Authentication (No client storage reliance)
          const normPhone = normalizeIndianPhoneNumber(trimmedId);
          if (!normPhone.isValid) {
            return {
              success: false,
              error: 'Please enter a valid corporate email address or 10-digit Indian mobile number.',
            };
          }
          rateLimitKey = normPhone.e164;

          const { data: edgeData, error: edgeError } = await supabase.functions.invoke('staff-auth', {
            body: {
              action: 'phone_login',
              phone: normPhone.e164,
              password: trimmedPassword,
              accountType: 'admin',
            },
          });

          if (edgeError || !edgeData?.success || !edgeData?.session) {
            const failRes = SecurityRateLimiter.recordFailedPassword(normPhone.e164);
            return {
              success: false,
              error: failRes.isBlocked
                ? 'Security Lockout: Maximum failed attempts exceeded. Access locked for 24 hours.'
                : (edgeData?.error || 'Invalid mobile number or password. Please verify your credentials.'),
            };
          }

          await supabase.auth.setSession({
            access_token: edgeData.session.access_token,
            refresh_token: edgeData.session.refresh_token,
          });
          authUser = edgeData.user;
        }

        if (!authUser) {
          return {
            success: false,
            error: 'Authentication failed. No user identity returned.',
          };
        }

        const appMeta = authUser.app_metadata || {};
        const rawAppRole = typeof appMeta.role === 'string' ? appMeta.role : null;

        // Strictly authorize using server-signed app_metadata.role (NEVER user_metadata)
        if (!isStaffRole(rawAppRole)) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'Access denied: Administrative Portal is restricted to authorized Harit Jal Staff.',
          };
        }

        if (appMeta.is_blocked === true) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'Staff account has been blocked by Super Admin. Access is revoked.',
          };
        }

        const isFirstLogin = appMeta.is_first_login === true;
        const tempExpiresAt = typeof appMeta.temporary_password_expires_at === 'number'
          ? appMeta.temporary_password_expires_at
          : Number(appMeta.temporary_password_expires_at || 0);

        if (isFirstLogin && tempExpiresAt > 0 && Date.now() > tempExpiresAt) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: 'Temporary password invitation has expired (72h limit). Please contact Super Admin to generate a new invitation.',
          };
        }

        const canonicalRole = normalizeStaffRole(rawAppRole) || 'staff';
        const userMeta = authUser.user_metadata || {};

        const adminUser: AdminUser = {
          id: authUser.id,
          name: typeof userMeta.name === 'string' && userMeta.name.trim() ? userMeta.name.trim() : 'Staff Member',
          email: (authUser.email || rateLimitKey).toLowerCase(),
          phone: authUser.phone || '',
          designation: typeof userMeta.designation === 'string' && userMeta.designation.trim()
            ? userMeta.designation.trim()
            : canonicalRole,
          role: canonicalRole,
          permissions: Array.isArray(appMeta.permissions) ? appMeta.permissions.map(String) : ['leads', 'orders'],
          status: appMeta.is_blocked === true ? 'Blocked' : 'Active',
          isRootSuperAdmin: appMeta.is_root_super_admin === true,
          isFirstLogin,
          totpEnabled: appMeta.totp_enabled === true,
          inquiriesAssigned: 0,
          temporaryPasswordExpiresAt: tempExpiresAt || undefined,
        };

        if (isFirstLogin) {
          SecurityRateLimiter.recordSuccessfulPassword(rateLimitKey);
          return {
            success: false,
            requireFirstLoginSetup: true,
            user: adminUser,
          };
        }

        // Verify whether the account has at least one verified GoTrue TOTP factor
        const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
        const hasVerifiedTotp = !factorError && Boolean(
          factorData?.totp?.some((f) => f.status === 'verified') ||
          factorData?.all?.some((f) => (f as { factor_type?: string; status?: string }).factor_type === 'totp' && f.status === 'verified')
        );

        SecurityRateLimiter.recordSuccessfulPassword(adminUser.email);

        if (!hasVerifiedTotp) {
          return {
            success: false,
            requireMfaEnrollment: true,
            user: adminUser,
          };
        }

        return { success: true, user: adminUser };
      } catch {
        if (isProd || isSupabaseConfigured()) {
          return {
            success: false,
            error: 'Authentication service temporarily unavailable. Please try again shortly.',
          };
        }
      }
    }

    // Fail-Closed in Production: Never authenticate against local mock users
    if (isProd) {
      return {
        success: false,
        error: 'Production administrative authentication requires an active connection to Supabase Auth. Local mock login is disabled.',
      };
    }

    // 2. Offline / Local Development Fallback (non-production only)
    const adminUser = this.findUserByIdentifier(trimmedId);
    if (!adminUser) {
      const failRes = SecurityRateLimiter.recordFailedPassword(trimmedId);
      return {
        success: false,
        error: failRes.isBlocked
          ? 'Security Lockout: Maximum failed attempts exceeded. Access locked for 24 hours.'
          : 'Invalid administrative credentials. Please verify your Email or Mobile number and Password.',
      };
    }

    if (adminUser.status === 'Blocked') {
      return {
        success: false,
        error: 'Staff account has been blocked by Super Admin. Access is revoked.',
      };
    }

    let isMatch = false;
    if (adminUser.isFirstLogin) {
      if (adminUser.temporaryPasswordExpiresAt && Date.now() > adminUser.temporaryPasswordExpiresAt) {
        return {
          success: false,
          error: 'Temporary password has expired (72h limit). Please contact Super Admin to generate a new invitation.',
        };
      }

      if (adminUser.temporaryPasswordHash) {
        isMatch = verifyPassword(trimmedPassword, adminUser.temporaryPasswordHash);
      } else if (adminUser.temporaryPassword) {
        isMatch = timingSafeEqual(trimmedPassword, adminUser.temporaryPassword.trim());
      }
    } else if (adminUser.passwordHash) {
      isMatch = verifyPassword(trimmedPassword, adminUser.passwordHash);
    } else {
      const customCredentials = this.getCustomCredentials();
      const storedCred = customCredentials[adminUser.email.toLowerCase()];
      if (storedCred) {
        isMatch = verifyPassword(trimmedPassword, storedCred);
      }
    }

    if (!isMatch) {
      const failRes = SecurityRateLimiter.recordFailedPassword(adminUser.email);
      return {
        success: false,
        error: failRes.isBlocked
          ? 'Security Lockout: Maximum failed attempts exceeded. Access locked for 24 hours.'
          : 'Invalid administrative credentials. Please verify your Email or Mobile number and Password.',
      };
    }

    if (adminUser.isFirstLogin) {
      return {
        success: false,
        requireFirstLoginSetup: true,
        user: adminUser,
      };
    }

    SecurityRateLimiter.recordSuccessfulPassword(adminUser.email);
    return { success: true, user: adminUser };
  },

  /**
   * Hydrate authoritative AAL2 staff profile fields from public.staff_users after GoTrue AAL2 elevation.
   */
  async hydrateUserFromStaffDb(baseUser: AdminUser): Promise<{ blocked: boolean; user: AdminUser }> {
    const supabase = getSupabaseClient();
    if (!isSupabaseConfigured() || !supabase) {
      return { blocked: baseUser.status === 'Blocked', user: baseUser };
    }

    try {
      let row: Record<string, unknown> | null = null;
      
      // Option A Hardened Identity Resolution (Rules A, B, C, D)
      const [{ data: byAuthId, error: authIdErr }, { data: byId, error: idErr }] = await Promise.all([
        supabase
          .from('staff_users')
          .select('id, name, email, phone, designation, role, permissions, is_blocked, is_root_super_admin, email_phone_changes_count, auth_user_id')
          .eq('auth_user_id', baseUser.id)
          .maybeSingle(),
        supabase
          .from('staff_users')
          .select('id, name, email, phone, designation, role, permissions, is_blocked, is_root_super_admin, email_phone_changes_count, auth_user_id')
          .eq('id', baseUser.id)
          .maybeSingle(),
      ]);

      // Check errors from both parallel queries: if either fails, reject hydration (fail-closed)
      if (authIdErr || idErr) {
        return { blocked: true, user: { ...baseUser, status: 'Blocked' } };
      }

      // Rule D: Detect ambiguous matches across both identity vectors
      if (byAuthId && byId && byAuthId.id !== byId.id) {
        return { blocked: true, user: { ...baseUser, status: 'Blocked' } };
      }

      if (byAuthId) {
        // Rule A: Exact match on auth_user_id = authenticated GoTrue UUID
        row = byAuthId;
      } else if (byId) {
        // Rule B & C: Legacy fallback permitted ONLY when matched row has auth_user_id IS NULL
        if (byId.auth_user_id != null && byId.auth_user_id !== baseUser.id) {
          return { blocked: true, user: { ...baseUser, status: 'Blocked' } };
        }
        row = byId;
      }

      if (!row) {
        return { blocked: baseUser.status === 'Blocked', user: baseUser };
      }

      if (row.is_blocked === true) {
        return {
          blocked: true,
          user: { ...baseUser, status: 'Blocked' },
        };
      }

      const canonicalRole = normalizeStaffRole(typeof row.role === 'string' ? row.role : null) || baseUser.role;
      return {
        blocked: false,
        user: {
          ...baseUser,
          name: typeof row.name === 'string' && row.name ? row.name : baseUser.name,
          email: typeof row.email === 'string' && row.email ? row.email.toLowerCase() : baseUser.email,
          phone: typeof row.phone === 'string' ? row.phone : baseUser.phone,
          designation: typeof row.designation === 'string' && row.designation ? row.designation : baseUser.designation,
          role: canonicalRole,
          permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : baseUser.permissions,
          status: 'Active',
          isRootSuperAdmin: row.is_root_super_admin === true,
          totpEnabled: true,
          isFirstLogin: false,
          emailPhoneChangesCount: typeof row.email_phone_changes_count === 'number'
            ? row.email_phone_changes_count
            : baseUser.emailPhoneChangesCount,
        },
      };
    } catch {
      return { blocked: baseUser.status === 'Blocked', user: baseUser };
    }
  },

  /**
   * STEP 2: Verify Google Authenticator (TOTP) Code via Supabase Native MFA and elevate session to AAL2.
   * Fails closed if verified TOTP factor is missing or AAL2 elevation fails.
   */
  async verifyTotpAndCreateSession(
    user: AdminUser,
    totpToken: string
  ): Promise<{ success: boolean; error?: string; requireMfaEnrollment?: boolean; session?: AdminSession }> {
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

    const isProd = isProductionEnvironment();
    const supabase = getSupabaseClient();
    let sessionToken = '';
    let resolvedUser = user;
    let authLevel: 'aal1' | 'aal2' = 'aal1';

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: factorData, error: factorListError } = await supabase.auth.mfa.listFactors();
        const totpFactor =
          factorData?.totp?.find((f) => f.status === 'verified') ||
          factorData?.all?.find((f) => (f as { factor_type?: string; status?: string }).factor_type === 'totp' && f.status === 'verified');

        if (factorListError || !totpFactor) {
          return {
            success: false,
            requireMfaEnrollment: true,
            error: 'No verified Google Authenticator MFA factor is enrolled for this account. Complete Native MFA enrollment first.',
          };
        }

        const { error: challengeError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: totpFactor.id,
          code: cleanTotp,
        });

        if (challengeError) {
          const failOtp = SecurityRateLimiter.recordFailedOtp(user.email);
          return {
            success: false,
            error: failOtp.isBlocked
              ? 'Maximum 3 wrong attempts reached. Account ID, device, and network are locked for 24 hours.'
              : `Invalid Google Authenticator code. ${failOtp.attemptsRemaining} attempt(s) remaining before 24-hour block.`,
          };
        }

        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        let authSession = (await supabase.auth.getSession()).data.session;
        if (!authSession || aalData?.currentLevel !== 'aal2') {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.data?.session) {
            authSession = refreshed.data.session;
          }
        }

        const { data: postAal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!authSession?.access_token || postAal?.currentLevel !== 'aal2') {
          await supabase.auth.signOut().catch(() => {});
          return {
            success: false,
            error: 'Multi-factor authentication failed to elevate session to AAL2.',
          };
        }

        sessionToken = authSession.access_token;
        authLevel = 'aal2';

        const hydrated = await this.hydrateUserFromStaffDb(user);
        if (hydrated.blocked) {
          await supabase.auth.signOut().catch(() => {});
          return {
            success: false,
            error: 'Staff account has been blocked by Super Admin. Access is revoked.',
          };
        }
        resolvedUser = hydrated.user;
      } catch (err: unknown) {
        if (isProd || isSupabaseConfigured()) {
          const message = err instanceof Error ? err.message : 'MFA verification failed.';
          return {
            success: false,
            error: `Multi-factor verification error: ${message}`,
          };
        }
      }
    }

    if (isProd && (!sessionToken || authLevel !== 'aal2')) {
      return {
        success: false,
        error: 'Multi-factor authentication failed to elevate session. A valid Supabase Auth AAL2 session token is required.',
      };
    }

    if (!sessionToken && user.totpSecret) {
      const isTotpValid = await TotpService.verifyToken(cleanTotp, user.totpSecret, 1);
      if (!isTotpValid) {
        const failOtp = SecurityRateLimiter.recordFailedOtp(user.email);
        return {
          success: false,
          error: failOtp.isBlocked
            ? 'Maximum 3 wrong attempts reached. Account ID, device, and network are locked for 24 hours.'
            : `Invalid Google Authenticator code. ${failOtp.attemptsRemaining} attempt(s) remaining before 24-hour block.`,
        };
      }
    }

    SecurityRateLimiter.recordSuccessfulPassword(resolvedUser.email);
    SecurityRateLimiter.recordSuccessfulOtp(resolvedUser.email);

    const session: AdminSession = {
      adminId: resolvedUser.id,
      name: resolvedUser.name,
      email: resolvedUser.email,
      phone: resolvedUser.phone,
      role: resolvedUser.role,
      designation: resolvedUser.designation || resolvedUser.role,
      permissions: resolvedUser.permissions || ['leads', 'orders'],
      isRootSuperAdmin: resolvedUser.isRootSuperAdmin === true,
      authLevel,
      token: sessionToken || `hjadm_dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
   * Completes mandatory Native GoTrue MFA enrollment for existing staff or Root Super Admin
   * after browser-side `supabase.auth.mfa.challengeAndVerify` has already elevated the session to AAL2.
   */
  async completeMfaEnrollment(
    user: AdminUser,
    factorId: string
  ): Promise<{ success: boolean; error?: string; session?: AdminSession }> {
    const cleanFactorId = (factorId || '').trim();
    if (!cleanFactorId) {
      return { success: false, error: 'Verified TOTP factorId is required to complete MFA enrollment.' };
    }

    const supabase = getSupabaseClient();
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase Auth client is required for Native MFA enrollment.' };
    }

    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel !== 'aal2') {
        return {
          success: false,
          error: 'Browser session has not reached AAL2 yet. Verify your 6-digit authenticator code first.',
        };
      }

      const { data, error } = await supabase.functions.invoke('staff-auth', {
        body: {
          action: 'complete_mfa_enrollment',
          factorId: cleanFactorId,
        },
      });

      if (error || !data?.success) {
        return {
          success: false,
          error: data?.error || error?.message || 'Server-side MFA activation failed.',
        };
      }

      await supabase.auth.refreshSession().catch(() => {});
      const authSession = (await supabase.auth.getSession()).data.session;
      const { data: postAal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (!authSession?.access_token || postAal?.currentLevel !== 'aal2') {
        return {
          success: false,
          error: 'Failed to obtain refreshed AAL2 session token after MFA activation.',
        };
      }

      const hydrated = await this.hydrateUserFromStaffDb(user);
      if (hydrated.blocked) {
        await supabase.auth.signOut().catch(() => {});
        return { success: false, error: 'Staff account is blocked.' };
      }

      const resolvedUser = hydrated.user;
      const session: AdminSession = {
        adminId: resolvedUser.id,
        name: resolvedUser.name,
        email: resolvedUser.email,
        phone: resolvedUser.phone,
        role: resolvedUser.role,
        designation: resolvedUser.designation || resolvedUser.role,
        permissions: resolvedUser.permissions || ['leads', 'orders'],
        isRootSuperAdmin: resolvedUser.isRootSuperAdmin === true,
        authLevel: 'aal2',
        token: authSession.access_token,
        loginAt: new Date().toISOString(),
        expiresAt: Date.now() + SESSION_DURATION_MS,
      };

      sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(session));
      return { success: true, session };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'MFA enrollment error';
      return { success: false, error: msg };
    }
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
    requireMfaEnrollment?: boolean;
    user?: AdminUser;
  }> {
    const credRes = await this.validateCredentials(identifier, password);
    if (!credRes.success || !credRes.user) {
      return {
        success: false,
        error: credRes.error,
        requireFirstLoginSetup: credRes.requireFirstLoginSetup,
        requireMfaEnrollment: credRes.requireMfaEnrollment,
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
      requireMfaEnrollment: totpRes.requireMfaEnrollment,
      user: credRes.user,
    };
  },

  /**
   * Complete First-Time Setup for new staff:
   * - Enforces >=12 char password policy (uppercase, lowercase, digit)
   * - Verifies browser session has already elevated to AAL2 via `challengeAndVerify`
   * - Invokes Edge Function `complete_staff_first_time_setup`
   * - Purges temporary credentials & returns AAL2 AdminSession
   */
  async completeFirstTimeSetup(
    userId: string,
    newPermanentPassword: string,
    totpToken: string,
    totpSecret?: string,
    factorId?: string
  ): Promise<{ success: boolean; error?: string; session?: AdminSession }> {
    if (!newPermanentPassword || newPermanentPassword.length < 12) {
      return { success: false, error: 'Permanent password must be at least 12 characters long.' };
    }
    if (!/[A-Z]/.test(newPermanentPassword) || !/[a-z]/.test(newPermanentPassword) || !/[0-9]/.test(newPermanentPassword)) {
      return { success: false, error: 'Permanent password must contain at least one uppercase letter, one lowercase letter, and one number.' };
    }

    if (!totpToken || totpToken.trim().length !== 6 || !/^\d{6}$/.test(totpToken.trim())) {
      return { success: false, error: 'Valid 6-digit Google Authenticator code is mandatory.' };
    }

    const isProd = isProductionEnvironment();
    const supabase = getSupabaseClient();

    // Resolve user details from cache or live Supabase user
    let user: AdminUser | undefined = StorageService.getUsers().find((u) => u.id === userId);
    if (!user && supabase && isSupabaseConfigured()) {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const authUser = userRes?.user;
        if (authUser && authUser.id === userId) {
          const appMeta = authUser.app_metadata || {};
          const uMeta = authUser.user_metadata || {};
          user = {
            id: authUser.id,
            name: typeof uMeta.name === 'string' && uMeta.name ? uMeta.name : 'Staff Member',
            email: (authUser.email || '').toLowerCase(),
            phone: authUser.phone || '',
            designation: typeof uMeta.designation === 'string' ? uMeta.designation : 'Staff',
            role: normalizeStaffRole(typeof appMeta.role === 'string' ? appMeta.role : null) || 'staff',
            permissions: Array.isArray(appMeta.permissions) ? appMeta.permissions.map(String) : ['leads', 'orders'],
            status: 'Active',
            isRootSuperAdmin: appMeta.is_root_super_admin === true,
            isFirstLogin: true,
            totpEnabled: false,
            inquiriesAssigned: 0,
          };
        }
      } catch {
        // Fallback below
      }
    }

    const resolvedBaseUser: AdminUser = user || {
      id: userId,
      email: 'staff@haritjal.in',
      name: 'Staff Member',
      role: 'staff',
      permissions: ['leads', 'orders'],
      status: 'Active',
      inquiriesAssigned: 0,
    };

    let liveToken = '';

    if (isSupabaseConfigured() && supabase) {
      try {
        if (!factorId) {
          return {
            success: false,
            error: 'Verified TOTP factorId is required to complete Supabase Native MFA setup.',
          };
        }

        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel !== 'aal2') {
          return {
            success: false,
            error: 'Google Authenticator challenge must be verified to AAL2 in your browser before saving setup.',
          };
        }

        const { data, error } = await supabase.functions.invoke('staff-auth', {
          body: {
            action: 'complete_staff_first_time_setup',
            newPassword: newPermanentPassword,
            factorId,
            totpCode: totpToken.trim(),
          },
        });

        if (error || !data?.success) {
          return {
            success: false,
            error: data?.error || error?.message || 'Server-side first-time setup failed. Please check your Authenticator code.',
          };
        }

        await supabase.auth.refreshSession().catch(() => {});
        const refreshedSession = (await supabase.auth.getSession()).data.session;
        const { data: postAal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (!refreshedSession?.access_token || postAal?.currentLevel !== 'aal2') {
          return {
            success: false,
            error: 'Setup completed on server, but AAL2 session refresh failed. Please sign in with your new password and TOTP.',
          };
        }

        liveToken = refreshedSession.access_token;
      } catch {
        if (isProd || isSupabaseConfigured()) {
          return { success: false, error: 'Server authentication service unavailable. Setup could not be completed.' };
        }
      }
    } else {
      if (isProd) {
        return { success: false, error: 'First-time staff setup requires Supabase Auth in production.' };
      }
      if (totpSecret) {
        const isTotpValid = await TotpService.verifyToken(totpToken, totpSecret, 1);
        if (!isTotpValid) {
          return {
            success: false,
            error: 'Invalid Google Authenticator code. Please scan the QR code and enter the 6 digits generated by the app.',
          };
        }
      }
      const newPasswordHash = hashPassword(newPermanentPassword.trim()).combined;
      this.updatePassword(resolvedBaseUser.email, newPermanentPassword);

      StorageService.updateUser(userId, {
        isFirstLogin: false,
        passwordHash: newPasswordHash,
        temporaryPassword: undefined,
        temporaryPasswordHash: undefined,
        temporaryPasswordExpiresAt: undefined,
        totpSecret: undefined,
        totpEnabled: true,
        status: 'Active',
      });

      StorageService.addStaffAuditLog({
        action: 'FIRST_LOGIN_COMPLETE',
        targetUserId: resolvedBaseUser.id,
        targetUserEmail: resolvedBaseUser.email,
        performedBy: resolvedBaseUser.email,
        details: `Staff member ${resolvedBaseUser.name} (${resolvedBaseUser.email}) completed mandatory first-time password setup and activated TOTP.`,
      });
    }

    // Purge any cached temporary credentials cleanly
    StorageService.updateUser(userId, {
      isFirstLogin: false,
      temporaryPassword: undefined,
      temporaryPasswordHash: undefined,
      temporaryPasswordExpiresAt: undefined,
      totpSecret: undefined,
      totpEnabled: true,
      status: 'Active',
    });

    const hydrated = liveToken ? await this.hydrateUserFromStaffDb(resolvedBaseUser) : { blocked: false, user: resolvedBaseUser };
    const finalUser = hydrated.user;

    const session: AdminSession = {
      adminId: finalUser.id,
      name: finalUser.name,
      email: finalUser.email,
      phone: finalUser.phone,
      role: finalUser.role,
      designation: finalUser.designation || finalUser.role,
      permissions: finalUser.permissions || ['leads', 'orders'],
      isRootSuperAdmin: finalUser.isRootSuperAdmin === true,
      authLevel: liveToken ? 'aal2' : 'aal1',
      token: liveToken || `hjadm_dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
      const supabase = getSupabaseClient();
      if (isSupabaseConfigured() && supabase) {
        supabase.auth.signOut().catch(() => {});
      }
    } catch (err) {
      console.error('Failed to remove admin session:', err);
    }
  },

  /**
   * SERVER-SIDE INTEGRATION: Authoritative Staff Creation via Supabase Edge Function
   */
  async createStaffUser(details: {
    name: string;
    designation: string;
    email: string;
    phone: string;
    role: AdminUser['role'];
    permissions: string[];
    performedBy: string;
  }): Promise<{ success: boolean; error?: string; staff?: AdminUser & { temporaryPassword?: string; expiresAt?: number; totpSecret?: string } }> {
    const supabase = getSupabaseClient();
    const isProd = isProductionEnvironment();
    const canonicalRole = normalizeStaffRole(details.role) || 'staff';

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('staff-auth', {
          body: {
            action: 'create_staff_user',
            name: details.name,
            designation: details.designation,
            email: details.email,
            phone: details.phone,
            role: canonicalRole,
            permissions: details.permissions,
          },
        });

        if (error || !data?.success) {
          return {
            success: false,
            error: data?.error || error?.message || 'Server-side staff creation failed.',
          };
        }

        // Sync non-secret roster metadata into local UI state using the authoritative server UUID
        const createdUser = StorageService.addUser({
          id: data.staff.id,
          name: data.staff.name || details.name,
          designation: data.staff.designation || details.designation,
          email: data.staff.email || details.email.toLowerCase(),
          phone: data.staff.phone || details.phone,
          role: normalizeStaffRole(data.staff.role) || canonicalRole,
          permissions: Array.isArray(data.staff.permissions) ? data.staff.permissions : details.permissions,
          status: 'Active',
          isRootSuperAdmin: false,
          isFirstLogin: true,
          temporaryPasswordExpiresAt: data.staff.expiresAt,
          totpEnabled: false,
          emailPhoneChangesCount: 0,
          createdAt: new Date().toISOString(),
        });

        return {
          success: true,
          staff: {
            ...createdUser,
            temporaryPassword: data.staff.temporaryPassword,
            expiresAt: data.staff.expiresAt,
          },
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        return {
          success: false,
          error: `Server staff creation service unavailable: ${msg}`,
        };
      }
    }

    if (isProd) {
      return {
        success: false,
        error: 'Staff accounts can only be created via the authoritative Supabase Edge Function in production.',
      };
    }

    // Local offline fallback strictly for non-production development/test
    const tempPassword = generateSecureTemporaryPassword();
    const tempHash = hashPassword(tempPassword).combined;
    const expiresAt = Date.now() + 72 * 60 * 60 * 1000;
    const totpSecret = TotpService.generateSecret(16);

    const newUser = StorageService.addUser({
      name: details.name,
      designation: details.designation,
      email: details.email.toLowerCase(),
      phone: details.phone,
      role: canonicalRole,
      permissions: details.permissions,
      status: 'Active',
      isRootSuperAdmin: false,
      isFirstLogin: true,
      temporaryPasswordHash: tempHash,
      temporaryPasswordExpiresAt: expiresAt,
      totpSecret,
      totpEnabled: false,
      emailPhoneChangesCount: 0,
      createdAt: new Date().toISOString(),
    });

    StorageService.addStaffAuditLog({
      action: 'CREATE_STAFF',
      targetUserId: newUser.id,
      targetUserEmail: newUser.email,
      performedBy: details.performedBy,
      details: `Created staff member ${details.name} (${canonicalRole}, ${details.designation}) with single-use 72h temporary credentials.`,
    });

    return {
      success: true,
      staff: {
        ...newUser,
        temporaryPassword: tempPassword,
        expiresAt,
        totpSecret,
      },
    };
  },

  /**
   * SERVER-SIDE INTEGRATION: Authoritative Staff Block & Global Session Revocation
   */
  async blockStaffUser(targetUserId: string, callerEmail?: string): Promise<{ success: boolean; error?: string }> {
    const localTarget = StorageService.getUsers().find((u) => u.id === targetUserId);
    if (localTarget?.isRootSuperAdmin || localTarget?.id === 'admin_seed_001') {
      return { success: false, error: 'The Root Super Admin account cannot be blocked.' };
    }

    const supabase = getSupabaseClient();
    const isProd = isProductionEnvironment();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('staff-auth', {
          body: { action: 'block_staff_user', targetUserId },
        });
        if (error || !data?.success) {
          return {
            success: false,
            error: data?.error || error?.message || 'Server failed to block staff member.',
          };
        }
        StorageService.blockUser(targetUserId);
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        return {
          success: false,
          error: `Block staff service unavailable: ${msg}`,
        };
      }
    }

    if (isProd) {
      return { success: false, error: 'Staff blocking requires authoritative Supabase Edge Function in production.' };
    }

    StorageService.blockUser(targetUserId);
    if (localTarget) {
      StorageService.addStaffAuditLog({
        action: 'BLOCK_STAFF',
        targetUserId,
        targetUserEmail: localTarget.email,
        performedBy: callerEmail || 'admin',
        details: `Blocked staff account ${localTarget.email} in local development workspace.`,
      });
    }
    return { success: true };
  },

  /**
   * SERVER-SIDE INTEGRATION: Authoritative Staff Unblock
   */
  async unblockStaffUser(targetUserId: string, callerEmail?: string): Promise<{ success: boolean; error?: string }> {
    const localTarget = StorageService.getUsers().find((u) => u.id === targetUserId);
    const supabase = getSupabaseClient();
    const isProd = isProductionEnvironment();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('staff-auth', {
          body: { action: 'unblock_staff_user', targetUserId },
        });
        if (error || !data?.success) {
          return {
            success: false,
            error: data?.error || error?.message || 'Server failed to unblock staff member.',
          };
        }
        StorageService.unblockUser(targetUserId);
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        return {
          success: false,
          error: `Unblock staff service unavailable: ${msg}`,
        };
      }
    }

    if (isProd) {
      return { success: false, error: 'Staff unblocking requires authoritative Supabase Edge Function in production.' };
    }

    StorageService.unblockUser(targetUserId);
    if (localTarget) {
      StorageService.addStaffAuditLog({
        action: 'UNBLOCK_STAFF',
        targetUserId,
        targetUserEmail: localTarget.email,
        performedBy: callerEmail || 'admin',
        details: `Unblocked staff account ${localTarget.email} in local development workspace.`,
      });
    }
    return { success: true };
  },

  /**
   * SERVER-SIDE INTEGRATION: Authoritative Staff Deletion
   */
  async deleteStaffUser(targetUserId: string, callerEmail?: string): Promise<{ success: boolean; error?: string }> {
    const localTarget = StorageService.getUsers().find((u) => u.id === targetUserId);
    if (localTarget?.isRootSuperAdmin || localTarget?.id === 'admin_seed_001') {
      return { success: false, error: 'The Root Super Admin account cannot be deleted.' };
    }

    const supabase = getSupabaseClient();
    const isProd = isProductionEnvironment();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('staff-auth', {
          body: { action: 'delete_staff_user', targetUserId },
        });
        if (error || !data?.success) {
          return {
            success: false,
            error: data?.error || error?.message || 'Server failed to delete staff member.',
          };
        }
        StorageService.deleteUser(targetUserId);
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        return {
          success: false,
          error: `Delete staff service unavailable: ${msg}`,
        };
      }
    }

    if (isProd) {
      return { success: false, error: 'Staff deletion requires authoritative Supabase Edge Function in production.' };
    }

    StorageService.deleteUser(targetUserId);
    if (localTarget) {
      StorageService.addStaffAuditLog({
        action: 'DELETE_STAFF',
        targetUserId,
        targetUserEmail: localTarget.email,
        performedBy: callerEmail || 'admin',
        details: `Deleted staff member ${localTarget.email} in local development workspace (business records preserved).`,
      });
    }
    return { success: true };
  },

  /**
   * Synchronize Supabase staff roster into local UI cache if authorized at AAL2.
   */
  async syncStaffRosterFromCloud(): Promise<AdminUser[] | null> {
    const cloudUsers = await SupabaseService.fetchStaffUsers();
    if (cloudUsers) {
      StorageService.setUsers(cloudUsers);
    }
    return cloudUsers;
  },

  /**
   * Validates live Supabase session, AAL2 status, non-blocked state, and role freshness.
   * Ensures a blocked or signed-out staff member cannot retain stale sessionStorage access.
   */
  async verifyLiveSession(): Promise<{ valid: boolean; reason?: string; session?: AdminSession }> {
    const localSession = this.getCurrentSession();
    if (!localSession) {
      return { valid: false, reason: 'No active admin session.' };
    }
    if (Date.now() > localSession.expiresAt) {
      this.logout();
      return { valid: false, reason: 'Administrative session expired.' };
    }

    const supabase = getSupabaseClient();
    const isProd = isProductionEnvironment();

    if (isSupabaseConfigured() && supabase) {
      try {
        const [{ data: sessionData }, { data: aalData }, { data: userRes, error: userErr }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.getUser(),
        ]);

        const liveUser = userRes?.user;
        const liveSession = sessionData?.session;
        if (userErr || !liveUser || !liveSession) {
          this.logout();
          return { valid: false, reason: 'Supabase session expired or invalidated.' };
        }

        if (aalData?.currentLevel !== 'aal2') {
          this.logout();
          return { valid: false, reason: 'Authenticator Assurance Level 2 (AAL2) is required.' };
        }

        const appMeta = liveUser.app_metadata || {};
        if (appMeta.is_blocked === true || !isStaffRole(typeof appMeta.role === 'string' ? appMeta.role : null)) {
          this.logout();
          return { valid: false, reason: 'Staff access revoked or blocked by Super Admin.' };
        }

        const canonicalRole = normalizeStaffRole(typeof appMeta.role === 'string' ? appMeta.role : null) || localSession.role;
        const baseUser: AdminUser = {
          id: liveUser.id,
          name: localSession.name,
          email: (liveUser.email || localSession.email).toLowerCase(),
          phone: liveUser.phone || localSession.phone || '',
          designation: localSession.designation,
          role: canonicalRole,
          permissions: Array.isArray(appMeta.permissions) ? appMeta.permissions.map(String) : localSession.permissions,
          status: 'Active',
          isRootSuperAdmin: appMeta.is_root_super_admin === true,
          inquiriesAssigned: 0,
          totpEnabled: true,
          isFirstLogin: false,
        };

        const hydrated = await this.hydrateUserFromStaffDb(baseUser);
        if (hydrated.blocked) {
          this.logout();
          return { valid: false, reason: 'Staff account has been blocked by Administrator.' };
        }

        const refreshedSession: AdminSession = {
          ...localSession,
          name: hydrated.user.name,
          email: hydrated.user.email,
          phone: hydrated.user.phone,
          role: hydrated.user.role,
          designation: hydrated.user.designation || hydrated.user.role,
          permissions: hydrated.user.permissions || localSession.permissions,
          isRootSuperAdmin: hydrated.user.isRootSuperAdmin === true,
          authLevel: 'aal2',
          token: liveSession.access_token,
        };
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(refreshedSession));
        return { valid: true, session: refreshedSession };
      } catch {
        if (isProd || isSupabaseConfigured()) {
          this.logout();
          return { valid: false, reason: 'Unable to validate live cloud session.' };
        }
        return { valid: true, session: localSession };
      }
    }

    if (isProd || isSupabaseConfigured()) {
      this.logout();
      return { valid: false, reason: 'Cloud authentication session required.' };
    }

    return { valid: true, session: localSession };
  },

  /**
   * SERVER-SIDE INTEGRATION: Super Admin Reset of Lost/Deadlocked Staff MFA Factor
   */
  async resetStaffMfa(targetUserId: string, callerEmail?: string): Promise<{ success: boolean; error?: string }> {
    const localTarget = StorageService.getUsers().find((u) => u.id === targetUserId);
    if (localTarget?.isRootSuperAdmin || localTarget?.id === 'admin_seed_001') {
      return { success: false, error: 'Root Super Admin MFA cannot be reset from staff directory.' };
    }

    const supabase = getSupabaseClient();
    const isProd = isProductionEnvironment();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('staff-auth', {
          body: { action: 'reset_staff_mfa', targetUserId },
        });
        if (error || !data?.success) {
          return { success: false, error: data?.error || error?.message || 'Failed to reset staff MFA factor.' };
        }
        StorageService.updateUser(targetUserId, { totpEnabled: false });
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        return { success: false, error: `Reset MFA service unavailable: ${msg}` };
      }
    }

    if (isProd) {
      return { success: false, error: 'MFA reset requires authoritative Supabase Edge Function in production.' };
    }

    StorageService.updateUser(targetUserId, { totpEnabled: false, totpSecret: undefined });
    if (localTarget) {
      StorageService.addStaffAuditLog({
        action: 'RESET_STAFF_MFA',
        targetUserId,
        targetUserEmail: localTarget.email,
        performedBy: callerEmail || 'admin',
        details: `Reset TOTP factor for ${localTarget.email} in local development workspace.`,
      });
    }
    return { success: true };
  },

  /**
   * SERVER-SIDE INTEGRATION: Super Admin Reissue Fresh 72h CSPRNG Staff Invite
   */
  async reissueStaffInvite(
    targetUserId: string,
    resetMfa = true,
    callerEmail?: string
  ): Promise<{ success: boolean; temporaryPassword?: string; expiresAt?: number; error?: string }> {
    const localTarget = StorageService.getUsers().find((u) => u.id === targetUserId);
    if (localTarget?.isRootSuperAdmin || localTarget?.id === 'admin_seed_001') {
      return { success: false, error: 'Cannot reissue temporary invite for Root Super Admin.' };
    }

    const supabase = getSupabaseClient();
    const isProd = isProductionEnvironment();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('staff-auth', {
          body: { action: 'reissue_staff_invite', targetUserId, resetMfa },
        });
        if (error || !data?.success) {
          return { success: false, error: data?.error || error?.message || 'Failed to reissue staff invite.' };
        }
        StorageService.updateUser(targetUserId, {
          status: 'Active',
          isFirstLogin: true,
          temporaryPasswordExpiresAt: data.expiresAt,
          ...(data.factorsReset ? { totpEnabled: false } : {}),
        });
        return {
          success: true,
          temporaryPassword: data.temporaryPassword,
          expiresAt: data.expiresAt,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        return { success: false, error: `Invite reissue service unavailable: ${msg}` };
      }
    }

    if (isProd) {
      return { success: false, error: 'Reissuing staff invites requires Supabase Edge Function in production.' };
    }

    const tempPassword = generateSecureTemporaryPassword();
    const tempHash = hashPassword(tempPassword).combined;
    const expiresAt = Date.now() + 72 * 60 * 60 * 1000;
    StorageService.updateUser(targetUserId, {
      status: 'Active',
      isFirstLogin: true,
      temporaryPasswordHash: tempHash,
      temporaryPasswordExpiresAt: expiresAt,
      ...(resetMfa ? { totpEnabled: false, totpSecret: undefined } : {}),
    });
    if (localTarget) {
      StorageService.addStaffAuditLog({
        action: 'REISSUE_STAFF_INVITE',
        targetUserId,
        targetUserEmail: localTarget.email,
        performedBy: callerEmail || 'admin',
        details: `Reissued 72h temporary invite for ${localTarget.email} in local development workspace.`,
      });
    }
    return { success: true, temporaryPassword: tempPassword, expiresAt };
  },

  /**
   * SERVER-SIDE INTEGRATION: Super Admin Update Staff Role & Workspace Permissions
   */
  async updateStaffRolePermissions(
    targetUserId: string,
    role: AdminUser['role'],
    permissions: string[],
    callerEmail?: string
  ): Promise<{ success: boolean; error?: string }> {
    const localTarget = StorageService.getUsers().find((u) => u.id === targetUserId);
    if (localTarget?.isRootSuperAdmin || localTarget?.id === 'admin_seed_001') {
      return { success: false, error: 'Root Super Admin role and permissions cannot be modified.' };
    }

    const canonicalRole = normalizeStaffRole(role);
    if (!canonicalRole) {
      return { success: false, error: 'Invalid staff role specified.' };
    }

    const supabase = getSupabaseClient();
    const isProd = isProductionEnvironment();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('staff-auth', {
          body: { action: 'update_staff_role_permissions', targetUserId, role: canonicalRole, permissions },
        });
        if (error || !data?.success) {
          return { success: false, error: data?.error || error?.message || 'Failed to update staff permissions.' };
        }
        StorageService.updateUser(targetUserId, { role: canonicalRole, permissions: data.permissions || permissions });
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        return { success: false, error: `Permission update service unavailable: ${msg}` };
      }
    }

    if (isProd) {
      return { success: false, error: 'Permission changes require authoritative Supabase Edge Function in production.' };
    }

    StorageService.updateUser(targetUserId, { role: canonicalRole, permissions });
    if (localTarget) {
      StorageService.addStaffAuditLog({
        action: 'UPDATE_STAFF_PERMISSIONS',
        targetUserId,
        targetUserEmail: localTarget.email,
        performedBy: callerEmail || 'admin',
        details: `Updated ${localTarget.email} to role '${canonicalRole}' with permissions [${permissions.join(', ')}].`,
      });
    }
    return { success: true };
  },

  /**
   * SERVER-SIDE INTEGRATION: Super Admin Profile & Security Contact Update (5-Change Quota)
   */
  async updateOwnAdminProfile(updates: {
    userId: string;
    email: string;
    phone: string;
    name?: string;
  }): Promise<{ success: boolean; error?: string; user?: AdminUser }> {
    const supabase = getSupabaseClient();
    const isProd = isProductionEnvironment();
    const cleanEmail = updates.email.trim().toLowerCase();
    const cleanPhone = updates.phone.trim();
    const cleanName = updates.name?.trim();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.functions.invoke('staff-auth', {
          body: {
            action: 'update_own_admin_profile',
            email: cleanEmail,
            phone: cleanPhone,
            ...(cleanName ? { name: cleanName } : {}),
          },
        });
        if (error || !data?.success) {
          return {
            success: false,
            error: data?.error || error?.message || 'Failed to update Super Admin profile on server.',
          };
        }

        const updatedLocal = StorageService.updateUser(updates.userId, {
          email: data.email || cleanEmail,
          phone: data.phone || cleanPhone,
          ...(data.name ? { name: data.name } : {}),
          emailPhoneChangesCount:
            typeof data.emailPhoneChangesCount === 'number' ? data.emailPhoneChangesCount : undefined,
        });

        const activeSession = this.getCurrentSession();
        if (activeSession && activeSession.adminId === updates.userId) {
          const nextSession: AdminSession = {
            ...activeSession,
            email: data.email || cleanEmail,
            phone: data.phone || cleanPhone,
            name: data.name || activeSession.name,
          };
          sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, JSON.stringify(nextSession));
        }

        const resolvedUser: AdminUser = updatedLocal || {
          id: updates.userId,
          name: data.name || activeSession?.name || 'Atal Pandey',
          email: data.email || cleanEmail,
          phone: data.phone || cleanPhone,
          role: 'admin',
          status: 'Active',
          inquiriesAssigned: 0,
          isRootSuperAdmin: activeSession?.isRootSuperAdmin === true,
          totpEnabled: true,
          emailPhoneChangesCount:
            typeof data.emailPhoneChangesCount === 'number' ? data.emailPhoneChangesCount : 0,
        };
        return { success: true, user: resolvedUser };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        return { success: false, error: `Admin profile service unavailable: ${msg}` };
      }
    }

    if (isProd) {
      return {
        success: false,
        error: 'Updating Super Admin contact details requires an authoritative Supabase Edge Function in production.',
      };
    }

    const res = StorageService.updateAdminProfile(updates.userId, cleanEmail, cleanPhone);
    if (res.success && res.user) {
      const activeSession = this.getCurrentSession();
      if (activeSession && activeSession.adminId === updates.userId) {
        sessionStorage.setItem(
          STORAGE_KEYS.ADMIN_SESSION,
          JSON.stringify({ ...activeSession, email: res.user.email, phone: res.user.phone })
        );
      }
    }
    return res;
  },

  /**
   * Check if current admin has one of the allowed roles (canonical role comparison)
   */
  hasRole(allowedRoles: AdminUser['role'][]): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;
    const sessionCanonical = normalizeStaffRole(session.role);
    if (!sessionCanonical) return false;
    return allowedRoles.some((r) => normalizeStaffRole(r) === sessionCanonical);
  },

  /**
   * Check if current admin has a specific permission
   */
  hasPermission(permission: string): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;
    if (session.isRootSuperAdmin === true) return true;
    if (!session.permissions) return false;
    return session.permissions.includes('all') || session.permissions.includes(permission);
  },

  /**
   * Internal dev-only credentials store (Stores Salted SHA-256 Hashes)
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
   * Update password for a local dev admin user (Stores salted hash, NEVER plaintext)
   */
  updatePassword(email: string, newPass: string): void {
    const creds = this.getCustomCredentials();
    const hashed = hashPassword(newPass.trim()).combined;
    creds[email.toLowerCase()] = hashed;
    localStorage.setItem(STORAGE_KEYS.ADMIN_CREDENTIALS, JSON.stringify(creds));
  },
};
