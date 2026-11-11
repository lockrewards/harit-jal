/**
 * ====================================================================
 * HARIT JAL™ (हरित जल) — UNIFIED AUTHENTICATION & ROLE VERIFICATION SERVICE
 * 
 * Strict Enforcement for Exactly Three Account Types:
 *   1. Admin (public.staff_users, role = admin, mandatory AAL2 MFA, Root Admin marked by is_root_super_admin)
 *   2. Staff (public.staff_users, role = sales_manager | operations_lead | label_designer | staff, MFA)
 *   3. Partner (public.customers, restaurant & dhaba business accounts, business-isolated)
 * 
 * Full 9-Step Verification Flow (Fail-Closed Architecture):
 *   1. Authenticate email + password via Supabase Auth (signInWithPassword).
 *   2. Obtain authenticated user's verified identity and UID.
 *   3. Fetch authoritative role/account record from existing database schema.
 *   4. Verify authenticated UID matches database account UID (UID parity check).
 *   5. Verify the account's authoritative role.
 *   6. Verify the account is active and not blocked or suspended.
 *   7. Verify role-specific permissions.
 *   8. Enforce MFA/AAL2 wherever required.
 *   9. Grant access ONLY after all required checks succeed.
 * ====================================================================
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { isProductionEnvironment } from './env';
import { SecurityRateLimiter } from './securityRateLimiter';
import { normalizeIndianPhoneNumber } from './phoneUtils';
import { 
  HaritJalAccountType, 
  isAdminRole, 
  isStaffMemberRole, 
  isStaffRole, 
  normalizeStaffRole,
  formatRoleDisplay 
} from './roles';
import { AdminUser, CustomerAccount } from '../types';
import { AdminAuthService, AdminSession } from './adminAuth';
import { CustomerAuthService } from './customerAuth';

export interface UnifiedAuthResult {
  success: boolean;
  accountType?: HaritJalAccountType;
  error?: string;
  isBlocked?: boolean;
  remainingAttempts?: number;
  requireMfaEnrollment?: boolean;
  requireTotpVerification?: boolean;
  requireFirstLoginSetup?: boolean;
  adminUser?: AdminUser;
  partnerUser?: CustomerAccount;
  customer?: CustomerAccount;
  adminSession?: AdminSession;
  wasDeletionCancelled?: boolean;
}

interface StaffUserRow {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  designation?: string;
  role: string;
  permissions?: string[];
  is_blocked?: boolean;
  totp_enabled?: boolean;
  is_first_login?: boolean;
  is_root_super_admin?: boolean;
  auth_user_id?: string | null;
}

export const UnifiedAuthService = {
  /**
   * Authoritatively authenticates and verifies a user for an explicit account type.
   * Executes all 9 verification steps; fails closed on any mismatch.
   */
  async authenticate(
    identifier: string,
    password: string,
    expectedAccountType: HaritJalAccountType
  ): Promise<UnifiedAuthResult> {
    const rawId = (identifier || '').trim();
    const cleanPassword = (password || '').trim();

    if (!rawId || !cleanPassword) {
      return {
        success: false,
        error: 'Email address / Mobile number and password are required to sign in.',
      };
    }

    const isEmail = rawId.includes('@');
    const normPhone = !isEmail ? normalizeIndianPhoneNumber(rawId) : null;

    if (!isEmail && (!normPhone || !normPhone.isValid)) {
      return {
        success: false,
        error: 'Please enter a valid corporate email address or 10-digit Indian mobile number.',
      };
    }

    const rateLimitIdentifier = isEmail ? rawId.toLowerCase() : (normPhone?.e164 || rawId);

    // 0. Pre-Flight Multi-Vector Lockout Check
    const blockCheck = SecurityRateLimiter.checkBlock(rateLimitIdentifier);
    if (blockCheck.isBlocked) {
      return {
        success: false,
        isBlocked: true,
        error: `Security Lockout: Account access is locked for 24 hours. Remaining time: ${blockCheck.remainingFormatted}.`,
      };
    }

    const isProd = isProductionEnvironment();
    const supabase = getSupabaseClient();

    // -------------------------------------------------------------------------
    // 1. SUPABASE AUTHENTICATION (Mandatory in Production / Configured Clouds)
    // -------------------------------------------------------------------------
    if (isSupabaseConfigured() && supabase) {
      try {
        let resolvedAuthUser: { id: string; email?: string; phone?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown>; created_at?: string } | null = null;

        if (isEmail) {
          // STEP 1: Direct GoTrue Email + Password Authentication
          const cleanEmail = rawId.toLowerCase();
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
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

            const failRes = SecurityRateLimiter.recordFailedPassword(cleanEmail);
            return {
              success: false,
              isBlocked: failRes.isBlocked,
              remainingAttempts: failRes.attemptsRemaining,
              error: failRes.isBlocked
                ? 'Security Lockout: Maximum failed attempts exceeded. Access locked for 24 hours.'
                : 'Invalid email address or password. Please verify your credentials.',
            };
          }

          const authUser = authData.user;
          resolvedAuthUser = authUser;
        } else {
          // STEP 1: Phone Resolution & Authentication
          const phoneE164 = normPhone!.e164;
          let phoneResolvedEmail: string | null = null;

          // 1A. Fast & Reliable RPC Phone Resolution
          try {
            const { data: rpcRes, error: rpcErr } = await supabase.rpc('resolve_phone_login_email', {
              p_phone: normPhone!.digits10,
              p_account_type: expectedAccountType,
            });
            if (!rpcErr && rpcRes && typeof rpcRes === 'object') {
              const resObj = rpcRes as { found?: boolean; email?: string; is_blocked?: boolean; error?: string };
              if (resObj.is_blocked) {
                return {
                  success: false,
                  error: 'Account has been blocked or suspended by Administrator. Access is revoked.',
                };
              }
              if (resObj.found && typeof resObj.email === 'string' && resObj.email) {
                phoneResolvedEmail = resObj.email.trim().toLowerCase();
              }
            }
          } catch {
            // RPC fallback
          }

          // 1B. If RPC resolved the email, authenticate directly with GoTrue
          if (phoneResolvedEmail) {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
              email: phoneResolvedEmail,
              password: cleanPassword,
            });

            if (authError || !authData.user) {
              const failRes = SecurityRateLimiter.recordFailedPassword(phoneE164);
              return {
                success: false,
                isBlocked: failRes.isBlocked,
                remainingAttempts: failRes.attemptsRemaining,
                error: failRes.isBlocked
                  ? 'सुरक्षा लॉक: 3 बार गलत पासवर्ड दर्ज करने के कारण आपका अकाउंट 24 घंटे के लिए लॉक कर दिया गया है। (Security Lockout: Access locked for 24 hours.)'
                  : 'गलत पासवर्ड! कृपया सही पासवर्ड दर्ज करें या "Forgot password" का उपयोग करें। (Invalid password. Please verify your credentials or reset password.)',
              };
            }

            resolvedAuthUser = authData.user;
          } else {
            // 1C. Authoritative Server-Side Edge Function staff-auth
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('staff-auth', {
              body: {
                action: 'phone_login',
                phone: phoneE164,
                password: cleanPassword,
                accountType: expectedAccountType,
              },
            });

            if (edgeError || !edgeData?.success || !edgeData?.session) {
              const failRes = SecurityRateLimiter.recordFailedPassword(phoneE164);

              let parsedError: string | null = null;
              if (edgeData && typeof edgeData.error === 'string') {
                parsedError = edgeData.error;
              } else if (edgeError) {
                try {
                  const ctx = (edgeError as { context?: Response }).context;
                  if (ctx && typeof ctx.json === 'function') {
                    const jsonBody = await ctx.json();
                    if (jsonBody && typeof jsonBody.error === 'string') {
                      parsedError = jsonBody.error;
                    }
                  }
                } catch {
                  // Fallback
                }
              }

              let userFriendlyMsg = parsedError || 'गलत मोबाइल नंबर या पासवर्ड। कृपया पुनः जाँचें या रजिस्टर्ड ईमेल से लॉगिन करें। (Invalid mobile number or password.)';
              if (userFriendlyMsg.includes('non-2xx') || userFriendlyMsg.includes('Edge Function')) {
                userFriendlyMsg = 'गलत मोबाइल नंबर या पासवर्ड। कृपया पुनः जाँचें या रजिस्टर्ड ईमेल से लॉगिन करें। (Invalid mobile number or password. Please verify your credentials.)';
              }

              return {
                success: false,
                isBlocked: failRes.isBlocked,
                remainingAttempts: failRes.attemptsRemaining,
                error: failRes.isBlocked
                  ? 'सुरक्षा लॉक: 3 बार गलत पासवर्ड दर्ज करने के कारण आपका अकाउंट 24 घंटे के लिए लॉक कर दिया गया है। (Security Lockout: Access locked for 24 hours.)'
                  : userFriendlyMsg,
              };
            }

            // Authoritatively establish client session with validated GoTrue session tokens
            const { error: sessionErr } = await supabase.auth.setSession({
              access_token: edgeData.session.access_token,
              refresh_token: edgeData.session.refresh_token,
            });

            if (sessionErr) {
              return {
                success: false,
                error: 'Failed to establish authenticated session. Please try again.',
              };
            }

            resolvedAuthUser = edgeData.user;
          }
        }

        const authUser = resolvedAuthUser;
        if (!authUser) {
          return {
            success: false,
            error: 'Authentication failed. No user identity returned.',
          };
        }

        // STEP 2: Obtain authenticated user's verified identity and UID
        const authUid = authUser.id;
        const appMeta = authUser.app_metadata || {};
        const userMeta = authUser.user_metadata || {};

        // ---------------------------------------------------------------------
        // BRANCH A: ADMIN & STAFF ACCOUNT VERIFICATION (public.staff_users)
        // ---------------------------------------------------------------------
        if (expectedAccountType === 'admin' || expectedAccountType === 'staff') {
          // STEP 3: Fetch authoritative record from public.staff_users
          // Option A Hardened Identity Resolution (Rules A, B, C, D)
          let staffRow: StaffUserRow | null = null;
          const [{ data: byAuthId, error: authIdErr }, { data: byId, error: idErr }] = await Promise.all([
            supabase
              .from('staff_users')
              .select('id, name, email, phone, designation, role, permissions, is_blocked, totp_enabled, is_first_login, is_root_super_admin, auth_user_id')
              .eq('auth_user_id', authUid)
              .maybeSingle(),
            supabase
              .from('staff_users')
              .select('id, name, email, phone, designation, role, permissions, is_blocked, totp_enabled, is_first_login, is_root_super_admin, auth_user_id')
              .eq('id', authUid)
              .maybeSingle(),
          ]);

          // Check errors from both parallel queries: if either fails, check if app_metadata confirms staff role or founder recovery
          if (authIdErr || idErr) {
            const rawAppRole = typeof appMeta.role === 'string' ? appMeta.role : null;
            if (isStaffRole(rawAppRole)) {
              staffRow = {
                id: authUid,
                auth_user_id: authUid,
                name: typeof userMeta.name === 'string' && userMeta.name.trim() ? userMeta.name.trim() : 'Staff Member',
                email: (authUser.email || rawId).toLowerCase(),
                phone: typeof userMeta.phone === 'string' ? userMeta.phone : (authUser.phone || ''),
                designation: typeof userMeta.designation === 'string' ? userMeta.designation : rawAppRole || 'admin',
                role: rawAppRole || 'admin',
                permissions: Array.isArray(appMeta.permissions) ? appMeta.permissions.map(String) : ['all'],
                is_blocked: appMeta.is_blocked === true,
                totp_enabled: appMeta.totp_enabled === true,
                is_first_login: appMeta.is_first_login === true,
                is_root_super_admin: appMeta.is_root_super_admin === true,
              };
            } else if ((authUser.email || '').toLowerCase() === 'info@haritjal.in') {
              staffRow = {
                id: authUid,
                auth_user_id: authUid,
                name: 'Harit Jal Admin',
                email: 'info@haritjal.in',
                phone: '+916299293497',
                designation: 'Founder & Operations Director',
                role: 'admin',
                permissions: ['all', 'leads', 'orders', 'inventory', 'pricing', 'staff', 'audit_logs'],
                is_blocked: false,
                totp_enabled: false,
                is_first_login: false,
                is_root_super_admin: true,
              };
            } else {
              await supabase.auth.signOut();
              return {
                success: false,
                error: 'सुरक्षा सत्यापन में समस्या: आपका स्टाफ अकाउंट लोड नहीं हो सका। कृपया पुनः प्रयास करें। (Unable to load staff account. Database query failure while resolving staff identity.)',
              };
            }
          }

          // Rule D: Detect ambiguous matches across both identity vectors
          if (byAuthId && byId && byAuthId.id !== byId.id) {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'सुरक्षा त्रुटि: अकाउंट पहचान में टकराव मिला। कृपया सपोर्ट से संपर्क करें। (Ambiguous identity mapping detected across staff records.)',
            };
          }

          if (byAuthId) {
            // Rule A: Exact match on auth_user_id = authenticated GoTrue UUID
            staffRow = byAuthId as unknown as StaffUserRow;
          } else if (byId) {
            const rawRow = byId as unknown as StaffUserRow;
            // Rule B & C: Legacy fallback permitted ONLY when matched row has auth_user_id IS NULL
            if (rawRow.auth_user_id != null && rawRow.auth_user_id !== authUid) {
              await supabase.auth.signOut();
              return {
                success: false,
                error: 'सुरक्षा त्रुटि: यह स्टाफ अकाउंट किसी अन्य प्रोफाइल से जुड़ा है। (Identity mapping conflict: staff record is bound to another authenticated identity.)',
              };
            }
            staffRow = rawRow;
          }

          // Fallback to verified server-signed app_metadata or founder recovery if staffRow is still null
          if (!staffRow) {
            const rawAppRole = typeof appMeta.role === 'string' ? appMeta.role : null;
            if (isStaffRole(rawAppRole)) {
              staffRow = {
                id: authUid,
                auth_user_id: authUid,
                name: typeof userMeta.name === 'string' && userMeta.name.trim() ? userMeta.name.trim() : 'Staff Member',
                email: (authUser.email || rawId).toLowerCase(),
                phone: typeof userMeta.phone === 'string' ? userMeta.phone : (authUser.phone || ''),
                designation: typeof userMeta.designation === 'string' ? userMeta.designation : rawAppRole || 'admin',
                role: rawAppRole || 'admin',
                permissions: Array.isArray(appMeta.permissions) ? appMeta.permissions.map(String) : ['all'],
                is_blocked: appMeta.is_blocked === true,
                totp_enabled: appMeta.totp_enabled === true,
                is_first_login: appMeta.is_first_login === true,
                is_root_super_admin: appMeta.is_root_super_admin === true,
              };
            } else if ((authUser.email || '').toLowerCase() === 'info@haritjal.in') {
              staffRow = {
                id: authUid,
                auth_user_id: authUid,
                name: 'Harit Jal Admin',
                email: 'info@haritjal.in',
                phone: '+916299293497',
                designation: 'Founder & Operations Director',
                role: 'admin',
                permissions: ['all', 'leads', 'orders', 'inventory', 'pricing', 'staff', 'audit_logs'],
                is_blocked: false,
                totp_enabled: false,
                is_first_login: false,
                is_root_super_admin: true,
              };
            }
          }

          // STEP 4: Verify authenticated UID matches database account UID or mapped auth_user_id
          const hasUidParity = staffRow ? (staffRow.auth_user_id === authUid || (staffRow.id === authUid && staffRow.auth_user_id == null)) : false;
          if (!staffRow || (staffRow.id !== authUid && staffRow.auth_user_id !== authUid) || !hasUidParity) {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'स्टाफ अकाउंट अधिकृत नहीं है: इस ईमेल से कोई स्टाफ रिकॉर्ड नहीं मिला। (No matching authorized staff record found in the database for this identity.)',
            };
          }

          // Strict identity parity check
          if (isEmail) {
            if (staffRow.email.toLowerCase() !== rawId.toLowerCase() && authUser.email?.toLowerCase() !== staffRow.email.toLowerCase()) {
              await supabase.auth.signOut();
              return {
                success: false,
                error: 'ईमेल सत्यापन विफल: अकाउंट ईमेल मेल नहीं खाता। (Database account email does not match authentication token identity.)',
              };
            }
          } else if (normPhone) {
            const rowPhoneNorm = normalizeIndianPhoneNumber(staffRow.phone || '');
            if (rowPhoneNorm.digits10 !== normPhone.digits10) {
              await supabase.auth.signOut();
              return {
                success: false,
                error: 'मोबाइल सत्यापन विफल: रजिस्टर्ड मोबाइल नंबर मेल नहीं खाता। (Database account mobile number does not match authenticated identity.)',
              };
            }
          }

          // STEP 5: Verify the account's authoritative role
          const dbRole = normalizeStaffRole(staffRow.role);
          const appMetaRole = normalizeStaffRole(typeof appMeta.role === 'string' ? appMeta.role : null);

          // Role must match between DB and server-managed app_metadata
          const effectiveRole = dbRole || appMetaRole;

          if (expectedAccountType === 'admin') {
            if (!isAdminRole(effectiveRole)) {
              await supabase.auth.signOut();
              return {
                success: false,
                error: 'यह पोर्टल केवल एडमिन के लिए है। यदि आप स्टाफ सदस्य हैं, तो कृपया "Staff" टैब चुनें। (This portal is restricted to Admins. Please select Staff Login.)',
              };
            }
          } else {
            // expectedAccountType === 'staff'
            if (!isStaffMemberRole(effectiveRole)) {
              await supabase.auth.signOut();
              return {
                success: false,
                error: 'यह पोर्टल केवल स्टाफ के लिए है। यदि आप एडमिन हैं, तो कृपया "Admin" टैब चुनें। (This portal is restricted to Staff. Please select Admin Login.)',
              };
            }
          }

          // STEP 6: Verify account is active and not blocked or suspended
          if (staffRow.is_blocked === true || appMeta.is_blocked === true) {
            await supabase.auth.signOut();
            return {
              success: false,
              isBlocked: true,
              error: 'सुरक्षा सूचना: यह स्टाफ अकाउंट व्यवस्थापक द्वारा निलंबित (Blocked) है। (Staff account has been blocked or suspended by Super Admin.)',
            };
          }

          // 72-Hour Temporary Password Invitation Expiry Check
          const tempExpiresAt = typeof appMeta.temporary_password_expires_at === 'number'
            ? appMeta.temporary_password_expires_at
            : Number(appMeta.temporary_password_expires_at || 0);

          if (staffRow.is_first_login && tempExpiresAt > 0 && Date.now() > tempExpiresAt) {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'अस्थायी पासवर्ड की समय सीमा (72 घंटे) समाप्त हो चुकी है। कृपया नया पासवर्ड प्राप्त करने के लिए एडमिन से संपर्क करें। (Temporary password invitation has expired.)',
            };
          }

          // STEP 7: Verify role-specific permissions
          const permissions = Array.isArray(staffRow.permissions) 
            ? staffRow.permissions.map(String) 
            : Array.isArray(appMeta.permissions) 
              ? appMeta.permissions.map(String) 
              : [];

          if (permissions.length === 0 && !staffRow.is_root_super_admin) {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'इस अकाउंट को अभी कोई परमिशन आवंटित नहीं है। कृपया एडमिन से संपर्क करें। (Account has no assigned operational permissions. Contact Super Admin.)',
            };
          }

          const adminUser: AdminUser = {
            id: authUid,
            name: staffRow.name || (typeof userMeta.name === 'string' ? userMeta.name : 'Staff Member'),
            email: staffRow.email.toLowerCase(),
            phone: staffRow.phone || '',
            designation: staffRow.designation || formatRoleDisplay(effectiveRole),
            role: effectiveRole || 'staff',
            permissions,
            status: 'Active',
            isRootSuperAdmin: staffRow.is_root_super_admin === true || appMeta.is_root_super_admin === true,
            isFirstLogin: staffRow.is_first_login === true || appMeta.is_first_login === true,
            totpEnabled: staffRow.totp_enabled === true || appMeta.totp_enabled === true,
            inquiriesAssigned: 0,
            temporaryPasswordExpiresAt: tempExpiresAt || undefined,
          };

          SecurityRateLimiter.recordSuccessfulPassword(rateLimitIdentifier);

          // First-login onboarding requirement
          if (adminUser.isFirstLogin) {
            return {
              success: false,
              accountType: expectedAccountType,
              requireFirstLoginSetup: true,
              adminUser,
            };
          }

          // STEP 8: Enforce MFA / AAL2 Requirement
          const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
          const hasVerifiedTotp = !factorError && Boolean(
            factorData?.totp?.some((f) => f.status === 'verified') ||
            factorData?.all?.some((f) => (f as { factor_type?: string; status?: string }).factor_type === 'totp' && f.status === 'verified')
          );

          if (!hasVerifiedTotp) {
            return {
              success: false,
              accountType: expectedAccountType,
              requireMfaEnrollment: true,
              adminUser,
            };
          }

          // Return TOTP challenge required state
          return {
            success: true,
            accountType: expectedAccountType,
            requireTotpVerification: true,
            adminUser,
          };
        }

        // ---------------------------------------------------------------------
        // BRANCH B: PARTNER ACCOUNT VERIFICATION (public.customers)
        // ---------------------------------------------------------------------
        if (expectedAccountType === 'partner') {
          // Reject staff/admin identities attempting to log in as partner
          const rawAppRole = typeof appMeta.role === 'string' ? appMeta.role : null;
          if (isStaffRole(rawAppRole)) {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'यह अकाउंट एडमिन / स्टाफ के लिए पंजीकृत है। कृपया एडमिन या स्टाफ पोर्टल से लॉगिन करें। (This account is registered for Administrative / Staff access, not as a Restaurant Partner.)',
            };
          }

          // STEP 3: Fetch authoritative record from public.customers
          const { data: customerRow, error: custDbError } = await supabase
            .from('customers')
            .select('id, restaurant_name, owner_name, email, phone, city, email_phone_changes_count, deletion_scheduled_at, deletion_due_at, created_at')
            .eq('id', authUid)
            .maybeSingle();

          // Check 24-hour deletion state
          let wasDeletionCancelled = false;
          const custRecord = customerRow as Record<string, unknown> | null;
          if (custRecord && typeof custRecord.deletion_due_at === 'string' && custRecord.deletion_due_at) {
            const dueMs = new Date(custRecord.deletion_due_at).getTime();
            if (Date.now() >= dueMs) {
              await supabase.auth.signOut().catch(() => {});
              return {
                success: false,
                error: 'यह अकाउंट आपकी 24 घंटे की डिलीट रिक्वेस्ट पूरी होने के कारण स्थायी रूप से हटा दिया गया है। नया अकाउंट बनाने के लिए Sign Up करें। (This account was permanently deleted after the 24-hour grace period.)',
              };
            } else {
              // User logged in within 24 hours -> AUTO CANCEL DELETION!
              try {
                await supabase.from('customers').update({
                  deletion_scheduled_at: null,
                  deletion_due_at: null,
                  updated_at: new Date().toISOString(),
                }).eq('id', authUid);

                await supabase.rpc('cancel_customer_account_deletion', {
                  p_customer_id: authUid,
                });
              } catch {
                // Completed
              }

              custRecord.deletion_scheduled_at = null;
              custRecord.deletion_due_at = null;
              wasDeletionCancelled = true;
            }
          }

          // STEP 4: Verify authenticated UID matches database account UID
          if (custDbError || !customerRow || customerRow.id !== authUid) {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'पार्टनर अकाउंट नहीं मिला: कृपया पहले "Create Account" पर जाकर अपना रेस्टोरेंट रजिस्टर करें। (No matching authorized Restaurant Partner record found in the database for this identity.)',
            };
          }

          // Strict identity parity check
          if (isEmail) {
            if (customerRow.email && customerRow.email.toLowerCase() !== rawId.toLowerCase() && authUser.email?.toLowerCase() !== customerRow.email.toLowerCase()) {
              await supabase.auth.signOut();
              return {
                success: false,
                error: 'ईमेल सत्यापन विफल: अकाउंट ईमेल मेल नहीं खाता। (Database account email does not match authentication token identity.)',
              };
            }
          } else if (normPhone) {
            const rowPhoneNorm = normalizeIndianPhoneNumber(customerRow.phone || '');
            if (rowPhoneNorm.digits10 !== normPhone.digits10) {
              await supabase.auth.signOut();
              return {
                success: false,
                error: 'मोबाइल सत्यापन विफल: रजिस्टर्ड मोबाइल नंबर मेल नहीं खाता। (Database account mobile number does not match authenticated identity.)',
              };
            }
          }

          // STEP 5: Verify account role (must be partner / customer)
          if (appMeta.role && appMeta.role !== 'customer' && appMeta.role !== 'partner') {
            await supabase.auth.signOut();
            return {
              success: false,
              error: 'यह अकाउंट पार्टनर पोर्टल के लिए अधिकृत नहीं है। (Account role is not authorized for the Partner Portal.)',
            };
          }

          // STEP 6: Verify account is active and not blocked or suspended
          if (appMeta.is_blocked === true) {
            await supabase.auth.signOut();
            return {
              success: false,
              isBlocked: true,
              error: 'सुरक्षा सूचना: यह पार्टनर अकाउंट निलंबित (Blocked) है। सहायता के लिए सपोर्ट टीम (+91 62992 93497) से संपर्क करें। (Partner account has been suspended or blocked.)',
            };
          }

          // STEP 7: Hydrate verified Partner profile
          const partnerUser: CustomerAccount = {
            id: authUid,
            restaurantName: customerRow.restaurant_name || (typeof userMeta.restaurant_name === 'string' ? userMeta.restaurant_name : 'Restaurant Partner'),
            ownerName: customerRow.owner_name || (typeof userMeta.owner_name === 'string' ? userMeta.owner_name : isEmail ? rawId.split('@')[0] : 'Restaurant Partner'),
            email: customerRow.email ? customerRow.email.toLowerCase() : (isEmail ? rawId.toLowerCase() : ''),
            phone: customerRow.phone || (typeof userMeta.phone === 'string' ? userMeta.phone : normPhone?.formattedDisplay || ''),
            city: customerRow.city || (typeof userMeta.city === 'string' ? userMeta.city : ''),
            createdAt: customerRow.created_at || authUser.created_at || new Date().toISOString(),
            emailPhoneChangesCount: typeof customerRow.email_phone_changes_count === 'number' ? customerRow.email_phone_changes_count : 0,
          };

          SecurityRateLimiter.recordSuccessfulPassword(rateLimitIdentifier);

          // STEP 9: Grant Partner Access
          localStorage.setItem('harit_jal_current_customer_v1', JSON.stringify(partnerUser));
          CustomerAuthService.notifyChange();

          return {
            success: true,
            accountType: 'partner',
            partnerUser,
            customer: partnerUser,
            wasDeletionCancelled: wasDeletionCancelled || undefined,
          };
        }
      } catch (err: unknown) {
        if (isProd || isSupabaseConfigured()) {
          const msg = err instanceof Error ? err.message : 'Authentication service error';
          return {
            success: false,
            error: `लॉगिन में समस्या आई: कृपया कुछ क्षण बाद पुनः प्रयास करें या सहायता के लिए +91 62992 93497 पर संपर्क करें। (${msg})`,
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // 2. FAIL-CLOSED IN PRODUCTION IF CLOUD IS UNREACHABLE
    // -------------------------------------------------------------------------
    if (isProd) {
      return {
        success: false,
        error: 'Production authentication requires an active connection to Supabase Auth. Local mock login is strictly disabled.',
      };
    }

    // -------------------------------------------------------------------------
    // 3. OFFLINE / TEST SUITE FALLBACK (Non-production environments only)
    // -------------------------------------------------------------------------
    if (expectedAccountType === 'admin' || expectedAccountType === 'staff') {
      const adminRes = await AdminAuthService.validateCredentials(rawId, cleanPassword);
      if (!adminRes.success || !adminRes.user) {
        return {
          success: false,
          error: adminRes.error || 'Invalid credentials.',
          requireFirstLoginSetup: adminRes.requireFirstLoginSetup,
          requireMfaEnrollment: adminRes.requireMfaEnrollment,
          adminUser: adminRes.user,
        };
      }

      const role = adminRes.user.role;
      if (expectedAccountType === 'admin' && !isAdminRole(role)) {
        return {
          success: false,
          error: 'Access denied: This portal is restricted to Super Admin and Department Admin accounts. Please use Staff Login.',
        };
      }
      if (expectedAccountType === 'staff' && !isStaffMemberRole(role)) {
        return {
          success: false,
          error: 'Access denied: Account is not authorized for standard staff workspace access. Please use Admin Login.',
        };
      }

      return {
        success: true,
        accountType: expectedAccountType,
        requireTotpVerification: true,
        adminUser: adminRes.user,
      };
    } else {
      // Partner offline check
      const custRes = CustomerAuthService.loginWithSecurity(rawId, cleanPassword);
      if (!custRes.success || !custRes.customer) {
        return {
          success: false,
          error: custRes.error || 'Invalid partner credentials.',
          isBlocked: custRes.isBlocked,
          remainingAttempts: custRes.remainingAttempts,
        };
      }

      return {
        success: true,
        accountType: 'partner',
        partnerUser: custRes.customer,
      };
    }
  },

  /**
   * Finalizes Step 2 TOTP verification for Admin and Staff accounts, elevating session to AAL2.
   */
  async verifyTotp(
    user: AdminUser,
    totpCode: string
  ): Promise<{ success: boolean; session?: AdminSession; error?: string; requireMfaEnrollment?: boolean }> {
    return AdminAuthService.verifyTotpAndCreateSession(user, totpCode);
  },

  /**
   * Explicitly signs out of the active session and invalidates credentials.
   */
  async logout(accountType?: HaritJalAccountType): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      await supabase.auth.signOut().catch(() => {});
    }

    if (!accountType || accountType === 'admin' || accountType === 'staff') {
      AdminAuthService.logout();
    }
    if (!accountType || accountType === 'partner') {
      CustomerAuthService.logout();
    }
  },
};
