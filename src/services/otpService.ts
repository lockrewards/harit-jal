import { StorageService } from './storage';
import { CustomerAuthService } from './customerAuth';
import { SecurityRateLimiter } from './securityRateLimiter';

export interface OtpRecord {
  email: string;
  otp: string;
  purpose: 'signup' | 'forgot_password';
  pendingData?: any;
  createdAt: number;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
}

export interface BlockRecord {
  email: string;
  blockedUntil: number;
  reason: string;
}

const STORAGE_KEYS = {
  OTP_RECORDS: 'harit_jal_otp_records_v1',
  BLOCK_RECORDS: 'harit_jal_otp_blocks_v1',
};

// Strict Configuration matching user requirements:
// - OTP validity: 5 minutes
// - Resend OTP: 1 minute (60 seconds) with clock timer
// - Maximum wrong attempts: 3 (then block for 24 hours)
// - OTP length: 6 digits
// - Expired OTP: Automatically invalid
// - Verified OTP: Immediately invalid (one-time use)
const CONFIG = {
  OTP_VALIDITY_MS: 5 * 60 * 1000, // 5 minutes
  RESEND_COOLDOWN_MS: 60 * 1000,   // 1 minute (60s)
  MAX_WRONG_ATTEMPTS: 3,           // 3 wrong attempts allowed
  BLOCK_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours block
  OTP_LENGTH: 6,
};

export const OtpService = {
  // -------------------------------------------------------------
  // Storage Helpers
  // -------------------------------------------------------------
  getOtpRecords(): Record<string, OtpRecord> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OTP_RECORDS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  saveOtpRecords(records: Record<string, OtpRecord>) {
    try {
      localStorage.setItem(STORAGE_KEYS.OTP_RECORDS, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save OTP records', e);
    }
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

  // -------------------------------------------------------------
  // Send 6-Digit OTP
  // -------------------------------------------------------------
  sendOtp(
    email: string, 
    purpose: 'signup' | 'forgot_password', 
    pendingData?: any
  ): { 
    success: boolean; 
    error?: string; 
    otp?: string; 
    expiresAt?: number; 
    resendAvailableAt?: number;
    resendInSeconds?: number;
  } {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // 1. Check if blocked for 24 hours
    const blockStatus = this.checkBlockStatus(cleanEmail);
    if (blockStatus.isBlocked) {
      return { 
        success: false, 
        error: `Security Lockout: This account ID, device, and network are blocked for 24 hours due to multiple failed verification attempts. Time remaining: ${blockStatus.remainingFormatted}.` 
      };
    }

    // 2. Check Resend Cooldown (1 minute rule)
    const records = this.getOtpRecords();
    const existing = records[`${cleanEmail}_${purpose}`];
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

    // 3. Generate 6-Digit Secure OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = now + CONFIG.OTP_VALIDITY_MS;
    const resendAvailableAt = now + CONFIG.RESEND_COOLDOWN_MS;

    records[`${cleanEmail}_${purpose}`] = {
      email: cleanEmail,
      otp,
      purpose,
      pendingData: pendingData || null,
      createdAt: now,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
    };
    this.saveOtpRecords(records);

    // 4. Log to Harit Jal Email Logs (visible to admin & audit)
    const subject = purpose === 'signup' 
      ? `[Harit Jal] ${otp} is your Partner Account Verification Code`
      : `[Harit Jal] ${otp} is your Password Reset Code`;

    const body = `Dear Harit Jal Partner,\n\nYour 6-digit verification code is: ${otp}\n\nSecurity notice:\n- Valid for 5 minutes.\n- Never share this code with anyone.\n- You have 3 attempts before a 24-hour block is enforced.\n\nHarit Jal Bespoke Dining Hydration`;

    StorageService.addEmailLog({
      to: cleanEmail,
      subject,
      body,
      status: 'Sent',
    });

    console.log(`[Harit Jal OTP] Sent ${otp} to ${cleanEmail} for ${purpose}. Valid for 5 mins.`);

    return {
      success: true,
      otp,
      expiresAt,
      resendAvailableAt,
      resendInSeconds: 60,
    };
  },

  // -------------------------------------------------------------
  // Verify OTP
  // -------------------------------------------------------------
  verifyOtp(
    email: string, 
    enteredOtp: string, 
    purpose: 'signup' | 'forgot_password'
  ): { 
    success: boolean; 
    error?: string; 
    attemptsRemaining?: number; 
    isBlocked?: boolean; 
    pendingData?: any;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = enteredOtp.trim();

    // 1. Check if blocked
    const blockStatus = this.checkBlockStatus(cleanEmail);
    if (blockStatus.isBlocked) {
      return {
        success: false,
        isBlocked: true,
        error: `Account locked for 24 hours due to multiple failed verification attempts. Time remaining: ${blockStatus.remainingFormatted}.`,
      };
    }

    const records = this.getOtpRecords();
    const recordKey = `${cleanEmail}_${purpose}`;
    const record = records[recordKey];

    // 2. Check if active record exists
    if (!record) {
      return {
        success: false,
        error: 'No active verification code found. Please request a new OTP.',
      };
    }

    const now = Date.now();

    // 3. Expired OTP: Automatically invalid (5 mins)
    if (now > record.expiresAt) {
      delete records[recordKey];
      this.saveOtpRecords(records);
      return {
        success: false,
        error: 'Verification code has expired (validity is 5 minutes). Please request a new OTP.',
      };
    }

    // 4. Verify code match
    if (cleanOtp !== record.otp) {
      record.attempts += 1;
      this.saveOtpRecords(records);

      // Enforce 3-strikes rule across ID, Device, and IP
      const failRes = SecurityRateLimiter.recordFailedOtp(cleanEmail);
      if (failRes.isBlocked) {
        delete records[recordKey];
        this.saveOtpRecords(records);
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

    // 5. SUCCESS! Verified OTP: Immediately invalid (one-time use)
    SecurityRateLimiter.recordSuccessfulOtp(cleanEmail);
    const pendingData = record.pendingData;
    delete records[recordKey];
    this.saveOtpRecords(records);

    return {
      success: true,
      pendingData,
    };
  },

  // -------------------------------------------------------------
  // Active OTP Inspection Helper
  // -------------------------------------------------------------
  getActiveOtp(email: string, purpose: 'signup' | 'forgot_password'): {
    exists: boolean;
    expiresAt?: number;
    resendAvailableAt?: number;
    attemptsRemaining?: number;
    otp?: string;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const records = this.getOtpRecords();
    const record = records[`${cleanEmail}_${purpose}`];
    if (!record) return { exists: false };

    const now = Date.now();
    if (now > record.expiresAt) {
      delete records[`${cleanEmail}_${purpose}`];
      this.saveOtpRecords(records);
      return { exists: false };
    }

    return {
      exists: true,
      expiresAt: record.expiresAt,
      resendAvailableAt: record.resendAvailableAt,
      attemptsRemaining: Math.max(0, CONFIG.MAX_WRONG_ATTEMPTS - record.attempts),
      otp: record.otp,
    };
  },

  // -------------------------------------------------------------
  // Password Reset Flow Helper
  // -------------------------------------------------------------
  requestPasswordReset(email: string): { 
    success: boolean; 
    error?: string; 
    otp?: string; 
    expiresAt?: number; 
    resendInSeconds?: number;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const customers = CustomerAuthService.getCustomers();
    const exists = customers.some(c => c.email.toLowerCase() === cleanEmail);

    if (!exists) {
      return {
        success: false,
        error: 'No registered Harit Jal restaurant partner found with this email address.',
      };
    }

    return this.sendOtp(cleanEmail, 'forgot_password');
  },

  completePasswordReset(email: string, newPassword: string): boolean {
    return CustomerAuthService.resetPassword(email, newPassword);
  },
};
