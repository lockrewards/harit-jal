import { StorageService } from './storage';
import { CustomerAuthService } from './customerAuth';
import { SecurityRateLimiter } from './securityRateLimiter';
import { isProductionEnvironment, isBrowserLocalhost, readViteEnv } from './env';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export interface OtpChallengeSession {
  email: string;
  purpose: 'signup' | 'forgot_password';
  challengeToken?: string;
  verificationProof?: string;
  pendingData?: unknown;
  createdAt: number;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
  attemptsRemaining?: number;
  // Strictly isolated offline dev-only field (never populated in production or when Supabase is active)
  devOfflineOtp?: string;
}

export interface BlockRecord {
  email: string;
  blockedUntil: number;
  reason: string;
}

const STORAGE_KEYS = {
  OTP_SESSION: 'harit_jal_otp_session_v1',
  LEGACY_OTP_RECORDS: 'harit_jal_otp_records_v1',
  BLOCK_RECORDS: 'harit_jal_otp_blocks_v1',
};

// Strict Configuration:
// - OTP validity: 5 minutes
// - Resend OTP cooldown: 1 minute (60 seconds)
// - Maximum wrong attempts: 3 (then 24-hour multi-vector lockout)
// - OTP length: 6 digits (CSPRNG server-side)
// - Expired OTP: Automatically invalid
// - Verified OTP: Immediately invalid (one-time use)
const CONFIG = {
  OTP_VALIDITY_MS: 5 * 60 * 1000,
  RESEND_COOLDOWN_MS: 60 * 1000,
  MAX_WRONG_ATTEMPTS: 3,
  BLOCK_DURATION_MS: 24 * 60 * 60 * 1000,
};

function generateOfflineDevCsprngOtp(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const range = 900000;
    const maxUnbiased = Math.floor(0x100000000 / range) * range;
    const buf = new Uint32Array(1);
    let rand = 0;
    do {
      crypto.getRandomValues(buf);
      rand = buf[0];
    } while (rand >= maxUnbiased);
    return String(100000 + (rand % range));
  }
  throw new Error('Web Crypto CSPRNG unavailable for OTP generation.');
}

function getEdgeOtpEndpoint(): { endpoint: string; anonKey: string } | null {
  if (!isSupabaseConfigured()) return null;
  const supabaseUrl = readViteEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = readViteEnv('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return null;
  return {
    endpoint: `${supabaseUrl}/functions/v1/send-email-otp`,
    anonKey,
  };
}

function readSessionStore(): Record<string, OtpChallengeSession> {
  try {
    // Purge legacy plaintext localStorage store if present from earlier releases
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.LEGACY_OTP_RECORDS);
    }
    const store = typeof sessionStorage !== 'undefined' ? sessionStorage : typeof localStorage !== 'undefined' ? localStorage : null;
    if (!store) return {};
    const raw = store.getItem(STORAGE_KEYS.OTP_SESSION);
    return raw ? (JSON.parse(raw) as Record<string, OtpChallengeSession>) : {};
  } catch {
    return {};
  }
}

function writeSessionStore(records: Record<string, OtpChallengeSession>): void {
  try {
    const store = typeof sessionStorage !== 'undefined' ? sessionStorage : typeof localStorage !== 'undefined' ? localStorage : null;
    if (!store) return;
    store.setItem(STORAGE_KEYS.OTP_SESSION, JSON.stringify(records));
  } catch {
    // Ignore storage write restriction
  }
}

export const OtpService = {
  getOtpRecords(): Record<string, OtpChallengeSession> {
    return readSessionStore();
  },

  saveOtpRecords(records: Record<string, OtpChallengeSession>) {
    writeSessionStore(records);
  },

  getBlockRecords(): Record<string, BlockRecord> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BLOCK_RECORDS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  saveBlockRecords(records: Record<string, BlockRecord>) {
    try {
      localStorage.setItem(STORAGE_KEYS.BLOCK_RECORDS, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save Block records', e);
    }
  },

  // -------------------------------------------------------------
  // Block Check (24-Hour Multi-Vector Enforcement: ID + Device + IP)
  // -------------------------------------------------------------
  checkBlockStatus(email: string): { isBlocked: boolean; remainingFormatted?: string; remainingMs?: number; blockedBy?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const result = SecurityRateLimiter.checkBlock(cleanEmail);
    if (!result.isBlocked) return { isBlocked: false };

    return {
      isBlocked: true,
      remainingFormatted: result.remainingFormatted,
      remainingMs: result.remainingMs,
      blockedBy: result.blockedBy,
    };
  },

  async syncServerBlockStatus(email: string): Promise<{ isBlocked: boolean; remainingFormatted?: string; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const edge = getEdgeOtpEndpoint();
    if (!edge) {
      return this.checkBlockStatus(cleanEmail);
    }

    try {
      const deviceId = SecurityRateLimiter.getDeviceId();
      const res = await fetch(edge.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: edge.anonKey,
          Authorization: `Bearer ${edge.anonKey}`,
        },
        body: JSON.stringify({
          action: 'check_status',
          email: cleanEmail,
          deviceId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        isBlocked?: boolean;
        remainingFormatted?: string;
      };
      if (data.isBlocked) {
        SecurityRateLimiter.enforce24HourBlock(
          cleanEmail,
          deviceId,
          undefined,
          'Active 24-hour server-side OTP security lockout.',
          'otp'
        );
        return { isBlocked: true, remainingFormatted: data.remainingFormatted };
      }
      return this.checkBlockStatus(cleanEmail);
    } catch {
      return this.checkBlockStatus(cleanEmail);
    }
  },

  // -------------------------------------------------------------
  // Send 6-Digit OTP (Authoritative Server Edge Function First)
  // -------------------------------------------------------------
  async sendOtp(
    email: string,
    purpose: 'signup' | 'forgot_password',
    pendingData?: unknown,
    turnstileToken?: string
  ): Promise<{
    success: boolean;
    error?: string;
    expiresAt?: number;
    resendAvailableAt?: number;
    resendInSeconds?: number;
    isBlocked?: boolean;
    alreadyRegistered?: boolean;
    sendsRemaining?: number;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // 1. Check local multi-vector lockout immediately
    const blockStatus = this.checkBlockStatus(cleanEmail);
    if (blockStatus.isBlocked) {
      return {
        success: false,
        isBlocked: true,
        error: `Security Lockout: This account ID, device, and network are blocked for 24 hours due to multiple failed verification attempts. Time remaining: ${blockStatus.remainingFormatted}.`,
      };
    }

    // 2. Check 24-hour OTP send quota (maximum 3 sends per 24 hours)
    const sendQuota = SecurityRateLimiter.checkAndRecordOtpSend(cleanEmail);
    if (!sendQuota.allowed) {
      return {
        success: false,
        isBlocked: true,
        error: sendQuota.error || 'सुरक्षा लॉक: 24 घंटे में अधिकतम 3 बार ही OTP भेजा जा सकता है।',
      };
    }

    // 3. For signup, verify if email or phone is already registered in DB
    if (purpose === 'signup') {
      const phone = typeof (pendingData as { phone?: string } | null | undefined)?.phone === 'string'
        ? (pendingData as { phone?: string }).phone
        : undefined;
      const alreadyRegisteredCheck = await CustomerAuthService.checkIfAlreadyRegistered(cleanEmail, phone);
      if (alreadyRegisteredCheck.exists) {
        return {
          success: false,
          alreadyRegistered: true,
          error: alreadyRegisteredCheck.error || 'यह ईमेल आईडी या मोबाइल नंबर पहले से रजिस्टर्ड है। कृपया लॉगिन करें, या यदि पासवर्ड भूल गए हैं तो "Forgot Password" का उपयोग करें।',
        };
      }
    }

    const isProd = isProductionEnvironment();
    const isLocal = !isProd && isBrowserLocalhost();
    const edge = getEdgeOtpEndpoint();

    // 2. Authoritative Supabase Edge Function Path (Resend + Server CSPRNG OTP)
    if (edge) {
      try {
        const deviceId = SecurityRateLimiter.getDeviceId();
        const requestPayload: Record<string, unknown> = {
          action: 'send_otp',
          email: cleanEmail,
          purpose,
          deviceId,
        };
        if (turnstileToken) {
          requestPayload.turnstileToken = turnstileToken;
        }

        const response = await fetch(edge.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: edge.anonKey,
            Authorization: `Bearer ${edge.anonKey}`,
          },
          body: JSON.stringify(requestPayload),
        });

        const data = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          challengeToken?: string;
          expiresAt?: number;
          resendAvailableAt?: number;
          resendInSeconds?: number;
          isBlocked?: boolean;
          error?: string;
        };

        if (!response.ok || !data.success || !data.challengeToken) {
          // If in local dev and the remote Edge Function returns 404 (not yet deployed to Supabase),
          // fallback to offline dev simulation so localhost testing is smooth!
          if (isLocal && (response.status === 404 || response.status === 502)) {
            console.warn(`[OtpService] Supabase Edge Function '${edge.endpoint}' returned ${response.status}. Using local dev OTP simulation.`);
          } else {
            if (data.isBlocked) {
              SecurityRateLimiter.enforce24HourBlock(
                cleanEmail,
                deviceId,
                undefined,
                data.error || '24-hour OTP lockout active.',
                'otp'
              );
            }
            if (typeof data.expiresAt === 'number' && typeof data.resendAvailableAt === 'number') {
              const records = readSessionStore();
              const key = `${cleanEmail}_${purpose}`;
              if (records[key]) {
                records[key].expiresAt = data.expiresAt;
                records[key].resendAvailableAt = data.resendAvailableAt;
                writeSessionStore(records);
              }
            }
            return {
              success: false,
              isBlocked: Boolean(data.isBlocked),
              resendInSeconds: data.resendInSeconds,
              expiresAt: data.expiresAt,
              resendAvailableAt: data.resendAvailableAt,
              error: data.error || 'Unable to send verification code. Please try again.',
            };
          }
        } else {
          const now = Date.now();
          const expiresAt = data.expiresAt ?? now + CONFIG.OTP_VALIDITY_MS;
          const resendAvailableAt = data.resendAvailableAt ?? now + CONFIG.RESEND_COOLDOWN_MS;
          const records = readSessionStore();
          records[`${cleanEmail}_${purpose}`] = {
            email: cleanEmail,
            purpose,
            challengeToken: data.challengeToken,
            pendingData: pendingData ?? null,
            createdAt: now,
            expiresAt,
            resendAvailableAt,
            attempts: 0,
            attemptsRemaining: CONFIG.MAX_WRONG_ATTEMPTS,
          };
          writeSessionStore(records);

          const subject = purpose === 'signup'
            ? '[Harit Jal] Partner Account Verification Dispatched'
            : '[Harit Jal] Password Recovery Verification Dispatched';
          const safeBody = `Server-side 6-digit verification challenge dispatched for ${cleanEmail} (${purpose}). Token redacted from client audit storage.`;

          StorageService.addEmailLog({
            to: cleanEmail,
            subject,
            body: safeBody,
            status: 'Sent',
          });

          return {
            success: true,
            expiresAt,
            resendAvailableAt,
            resendInSeconds: data.resendInSeconds ?? 60,
          };
        }
      } catch (err) {
        // If fetch throws (e.g. CORS on 404, offline, or network fail) in local dev, fallback cleanly!
        if (isLocal) {
          console.warn('[OtpService] Supabase Edge Function unreachable on localhost. Falling back to local verification.', err);
        } else {
          return {
            success: false,
            error: 'Verification email service is temporarily unreachable. Please try again shortly.',
          };
        }
      }
    }

    // Production without configured Supabase Edge Functions MUST fail closed
    if (isProd) {
      return {
        success: false,
        error: 'Email verification service requires an active Supabase Edge Function connection in production.',
      };
    }

    // 3. Strictly Isolated Non-Production Offline Dev Fallback (Zero Supabase env)
    const records = readSessionStore();
    const recordKey = `${cleanEmail}_${purpose}`;
    const existing = records[recordKey];
    const now = Date.now();

    if (existing && now < existing.resendAvailableAt) {
      const waitSeconds = Math.ceil((existing.resendAvailableAt - now) / 1000);
      return {
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
        resendInSeconds: waitSeconds,
        expiresAt: existing.expiresAt,
        resendAvailableAt: existing.resendAvailableAt,
      };
    }

    const devOtp = generateOfflineDevCsprngOtp();
    const expiresAt = now + CONFIG.OTP_VALIDITY_MS;
    const resendAvailableAt = now + CONFIG.RESEND_COOLDOWN_MS;

    records[recordKey] = {
      email: cleanEmail,
      purpose,
      devOfflineOtp: devOtp,
      pendingData: pendingData ?? null,
      createdAt: now,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
      attemptsRemaining: CONFIG.MAX_WRONG_ATTEMPTS,
    };
    writeSessionStore(records);

    StorageService.addEmailLog({
      to: cleanEmail,
      subject: '[Harit Jal] Local Offline Dev Verification Challenge',
      body: `Offline dev verification challenge requested for ${cleanEmail} (${purpose}). Code redacted.`,
      status: 'Sent',
    });

    return {
      success: true,
      expiresAt,
      resendAvailableAt,
      resendInSeconds: 60,
    };
  },

  // -------------------------------------------------------------
  // Verify OTP (Authoritative Server Edge Function First)
  // -------------------------------------------------------------
  async verifyOtp(
    email: string,
    enteredOtp: string,
    purpose: 'signup' | 'forgot_password'
  ): Promise<{
    success: boolean;
    error?: string;
    attemptsRemaining?: number;
    isBlocked?: boolean;
    pendingData?: unknown;
    verificationProof?: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = enteredOtp.trim();

    const blockStatus = this.checkBlockStatus(cleanEmail);
    if (blockStatus.isBlocked) {
      return {
        success: false,
        isBlocked: true,
        error: `Account locked for 24 hours due to multiple failed verification attempts. Time remaining: ${blockStatus.remainingFormatted}.`,
      };
    }

    const records = readSessionStore();
    const recordKey = `${cleanEmail}_${purpose}`;
    const record = records[recordKey];
    const isProd = isProductionEnvironment();
    const isLocal = !isProd && isBrowserLocalhost();
    const edge = getEdgeOtpEndpoint();

    // Authoritative Supabase Edge Function Path
    if (edge && record?.challengeToken) {
      if (Date.now() > record.expiresAt) {
        delete records[recordKey];
        writeSessionStore(records);
        return {
          success: false,
          error: 'Verification code has expired (validity is 5 minutes). Please request a new OTP.',
        };
      }

      try {
        const deviceId = SecurityRateLimiter.getDeviceId();
        const response = await fetch(edge.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: edge.anonKey,
            Authorization: `Bearer ${edge.anonKey}`,
          },
          body: JSON.stringify({
            action: 'verify_otp',
            email: cleanEmail,
            otp: cleanOtp,
            purpose,
            challengeToken: record.challengeToken,
            deviceId,
          }),
        });

        const data = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          verified?: boolean;
          verificationProof?: string;
          attemptsRemaining?: number;
          isBlocked?: boolean;
          expired?: boolean;
          error?: string;
        };

        if (!response.ok || !data.success || !data.verified) {
          if (isLocal && (response.status === 404 || response.status === 502) && record?.devOfflineOtp) {
            console.warn('[OtpService] Edge verify returned 404. Falling back to dev check.');
          } else {
            if (data.isBlocked) {
              delete records[recordKey];
              writeSessionStore(records);
              SecurityRateLimiter.enforce24HourBlock(
                cleanEmail,
                deviceId,
                undefined,
                data.error || 'Maximum 3 wrong OTP attempts exceeded.',
                'otp'
              );
              return {
                success: false,
                isBlocked: true,
                attemptsRemaining: 0,
                error: data.error || 'Maximum 3 wrong attempts reached. Your account ID, device, and IP address are locked for 24 hours for security.',
              };
            }

            if (data.expired) {
              delete records[recordKey];
              writeSessionStore(records);
            } else if (typeof data.attemptsRemaining === 'number') {
              record.attemptsRemaining = data.attemptsRemaining;
              record.attempts = CONFIG.MAX_WRONG_ATTEMPTS - data.attemptsRemaining;
              writeSessionStore(records);
            }

            return {
              success: false,
              attemptsRemaining: data.attemptsRemaining,
              error: data.error || 'Incorrect verification code.',
            };
          }
        } else {
          SecurityRateLimiter.recordSuccessfulOtp(cleanEmail);
          const pendingData = record.pendingData;
          delete records[recordKey];
          writeSessionStore(records);

          return {
            success: true,
            pendingData,
            verificationProof: data.verificationProof,
          };
        }
      } catch (err) {
        if (isLocal && record?.devOfflineOtp) {
          console.warn('[OtpService] Edge verify unreachable on localhost. Falling back to local check.', err);
        } else {
          return {
            success: false,
            error: 'Verification server is temporarily unreachable. Please try again shortly.',
          };
        }
      }
    }

    if (isProd) {
      return {
        success: false,
        error: 'OTP verification requires an active Supabase Edge Function connection in production.',
      };
    }

    // Strictly Isolated Non-Production Offline Dev Fallback
    if (!record || !record.devOfflineOtp) {
      return {
        success: false,
        error: 'No active verification code found. Please request a new OTP.',
      };
    }

    const now = Date.now();
    if (now > record.expiresAt) {
      delete records[recordKey];
      writeSessionStore(records);
      return {
        success: false,
        error: 'Verification code has expired (validity is 5 minutes). Please request a new OTP.',
      };
    }

    if (cleanOtp !== record.devOfflineOtp) {
      record.attempts += 1;
      record.attemptsRemaining = Math.max(0, CONFIG.MAX_WRONG_ATTEMPTS - record.attempts);
      writeSessionStore(records);

      const failRes = SecurityRateLimiter.recordFailedOtp(cleanEmail);
      if (failRes.isBlocked) {
        delete records[recordKey];
        writeSessionStore(records);
        return {
          success: false,
          isBlocked: true,
          error: 'Maximum 3 wrong attempts reached. Your account ID, device, and IP address are locked for 24 hours for security.',
        };
      }

      return {
        success: false,
        attemptsRemaining: failRes.attemptsRemaining,
        error: failRes.error,
      };
    }

    SecurityRateLimiter.recordSuccessfulOtp(cleanEmail);
    const pendingData = record.pendingData;
    delete records[recordKey];
    writeSessionStore(records);

    return {
      success: true,
      pendingData,
    };
  },

  // -------------------------------------------------------------
  // Active OTP Metadata Helper (NEVER exposes OTP code in cloud/prod)
  // -------------------------------------------------------------
  getActiveOtp(email: string, purpose: 'signup' | 'forgot_password'): {
    exists: boolean;
    expiresAt?: number;
    resendAvailableAt?: number;
    attemptsRemaining?: number;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const records = readSessionStore();
    const recordKey = `${cleanEmail}_${purpose}`;
    const record = records[recordKey];
    if (!record) return { exists: false };

    const now = Date.now();
    if (now > record.expiresAt) {
      delete records[recordKey];
      writeSessionStore(records);
      return { exists: false };
    }

    return {
      exists: true,
      expiresAt: record.expiresAt,
      resendAvailableAt: record.resendAvailableAt,
      attemptsRemaining:
        record.attemptsRemaining !== undefined
          ? record.attemptsRemaining
          : Math.max(0, CONFIG.MAX_WRONG_ATTEMPTS - record.attempts),
    };
  },

  // -------------------------------------------------------------
  // Password Reset Flow Helpers (Supabase Cloud + Dev Fallback)
  // -------------------------------------------------------------
  async requestSupabasePasswordReset(email: string): Promise<{
    success: boolean;
    recoveryEmailSent?: boolean;
    useLocalOtp?: boolean;
    error?: string;
    otp?: string;
    expiresAt?: number;
    resendInSeconds?: number;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const blockStatus = this.checkBlockStatus(cleanEmail);
    if (blockStatus.isBlocked) {
      return {
        success: false,
        error: `Security Lockout: Account ID, device, and network are blocked for 24 hours. Remaining: ${blockStatus.remainingFormatted}.`,
      };
    }

    const isProd = isProductionEnvironment();
    const supabase = getSupabaseClient();

    if (isSupabaseConfigured() && supabase) {
      try {
        const origin = typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://haritjal.in';
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${origin}/track?mode=recovery`,
        });
        if (error) {
          return {
            success: false,
            error: error.message || 'Unable to send password recovery email right now.',
          };
        }

        return {
          success: true,
          recoveryEmailSent: true,
        };
      } catch {
        if (isProd || isSupabaseConfigured()) {
          return {
            success: false,
            error: 'Password recovery service temporarily unavailable. Please try again shortly.',
          };
        }
      }
    }

    if (isProd) {
      return {
        success: false,
        error: 'Password recovery service requires an active Supabase Auth connection in production.',
      };
    }

    const localRes = await this.requestPasswordReset(cleanEmail);
    return {
      ...localRes,
      useLocalOtp: localRes.success,
    };
  },

  async completeSupabasePasswordReset(newPassword: string): Promise<{ success: boolean; error?: string }> {
    const trimmed = (newPassword || '').trim();
    if (trimmed.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }

    const isProd = isProductionEnvironment();
    const supabase = getSupabaseClient();
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
          return {
            success: false,
            error: 'Recovery session expired or missing. Please request a fresh password reset link.',
          };
        }

        const { data, error } = await supabase.auth.updateUser({ password: trimmed });
        if (error) {
          return {
            success: false,
            error: error.message || 'Failed to update password in Supabase Auth.',
          };
        }

        const userEmail = data?.user?.email?.toLowerCase();
        if (userEmail && !isProd) {
          CustomerAuthService.resetPassword(userEmail, trimmed);
        }

        return { success: true };
      } catch {
        return {
          success: false,
          error: 'Failed to update password with authentication server. Please request a fresh reset link.',
        };
      }
    }

    if (isProd) {
      return {
        success: false,
        error: 'Password reset completion requires Supabase Auth in production.',
      };
    }

    return { success: false, error: 'Use local OTP card to complete offline password reset.' };
  },

  async requestPasswordReset(email: string): Promise<{
    success: boolean;
    error?: string;
    otp?: string;
    expiresAt?: number;
    resendInSeconds?: number;
  }> {
    if (isProductionEnvironment()) {
      return {
        success: false,
        error: 'Local OTP password reset is disabled in production. Use official email recovery.',
      };
    }
    const cleanEmail = email.trim().toLowerCase();
    const customers = CustomerAuthService.getCustomers();
    const exists = customers.some((c) => c.email.toLowerCase() === cleanEmail);

    if (!exists) {
      return {
        success: false,
        error: 'No registered Harit Jal restaurant partner found with this email address.',
      };
    }

    return this.sendOtp(cleanEmail, 'forgot_password');
  },

  completePasswordReset(email: string, newPassword: string): boolean {
    if (isProductionEnvironment()) {
      return false;
    }
    const trimmed = (newPassword || '').trim();
    if (trimmed.length < 8) {
      return false;
    }
    return CustomerAuthService.resetPassword(email, trimmed);
  },
};
