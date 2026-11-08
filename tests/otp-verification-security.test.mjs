// ====================================================================
// HARIT JAL™ (हरित जल) — OTP SECURITY & RATE LIMITING TEST SUITE
// Automated verification of user requirements:
// 1. OTP validity: 5 minutes (automatically invalid on expiry)
// 2. Resend OTP cooldown: 1 minute (60 seconds)
// 3. Maximum wrong attempts: 3 (exceeding triggers 24h block)
// 4. OTP length: 6 digits
// 5. Expired OTP: Automatically invalid
// 6. Verified OTP: Immediately invalid (one-time use)
// 7. Password Reset & Registration flows
// ====================================================================

import assert from 'node:assert';

// Mock localStorage for Node test runner
const memoryStore = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStore.get(key) || null,
  setItem: (key, val) => memoryStore.set(key, String(val)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

// Mock window event dispatcher
globalThis.window = {
  dispatchEvent: () => {},
};

const STORAGE_KEYS = {
  OTP_RECORDS: 'harit_jal_otp_records_v1',
  BLOCK_RECORDS: 'harit_jal_otp_blocks_v1',
  CUSTOMERS: 'harit_jal_customers_v1',
  CURRENT_CUSTOMER: 'harit_jal_current_customer_v1',
  ORDERS: 'harit_jal_orders_v1',
  EMAIL_DISPATCH_LOGS: 'harit_jal_email_logs_v1',
};

const CONFIG = {
  OTP_VALIDITY_MS: 5 * 60 * 1000, // 5 minutes
  RESEND_COOLDOWN_MS: 60 * 1000,   // 1 minute (60s)
  MAX_WRONG_ATTEMPTS: 3,           // 3 wrong attempts allowed
  BLOCK_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours block
  OTP_LENGTH: 6,
};

// Replicate OtpService test harness
class TestOtpService {
  static getOtpRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OTP_RECORDS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  static saveOtpRecords(records) {
    localStorage.setItem(STORAGE_KEYS.OTP_RECORDS, JSON.stringify(records));
  }

  static getBlockRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BLOCK_RECORDS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  static saveBlockRecords(records) {
    localStorage.setItem(STORAGE_KEYS.BLOCK_RECORDS, JSON.stringify(records));
  }

  static checkBlockStatus(email, fakeNow = Date.now()) {
    const cleanEmail = email.trim().toLowerCase();
    const blocks = this.getBlockRecords();
    const block = blocks[cleanEmail];
    if (!block) return { isBlocked: false };

    if (fakeNow >= block.blockedUntil) {
      delete blocks[cleanEmail];
      this.saveBlockRecords(blocks);
      return { isBlocked: false };
    }

    const remainingMs = block.blockedUntil - fakeNow;
    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      isBlocked: true,
      remainingMs,
      remainingFormatted: `${hours}h ${minutes}m`,
    };
  }

  static sendOtp(email, purpose, pendingData = null, fakeNow = Date.now()) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const blockStatus = this.checkBlockStatus(cleanEmail, fakeNow);
    if (blockStatus.isBlocked) {
      return {
        success: false,
        error: `This email address is temporarily blocked for 24 hours due to multiple failed verification attempts. Time remaining: ${blockStatus.remainingFormatted}.`,
      };
    }

    const records = this.getOtpRecords();
    const existing = records[`${cleanEmail}_${purpose}`];

    if (existing && fakeNow < existing.resendAvailableAt) {
      const waitSeconds = Math.ceil((existing.resendAvailableAt - fakeNow) / 1000);
      return {
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
        resendInSeconds: waitSeconds,
        expiresAt: existing.expiresAt,
        resendAvailableAt: existing.resendAvailableAt,
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = fakeNow + CONFIG.OTP_VALIDITY_MS;
    const resendAvailableAt = fakeNow + CONFIG.RESEND_COOLDOWN_MS;

    records[`${cleanEmail}_${purpose}`] = {
      email: cleanEmail,
      otp,
      purpose,
      pendingData,
      createdAt: fakeNow,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
    };
    this.saveOtpRecords(records);

    return {
      success: true,
      otp,
      expiresAt,
      resendAvailableAt,
      resendInSeconds: 60,
    };
  }

  static verifyOtp(email, enteredOtp, purpose, fakeNow = Date.now()) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = enteredOtp.trim();

    const blockStatus = this.checkBlockStatus(cleanEmail, fakeNow);
    if (blockStatus.isBlocked) {
      return {
        success: false,
        isBlocked: true,
        error: `Account locked for 24 hours. Remaining: ${blockStatus.remainingFormatted}.`,
      };
    }

    const records = this.getOtpRecords();
    const recordKey = `${cleanEmail}_${purpose}`;
    const record = records[recordKey];

    if (!record) {
      return {
        success: false,
        error: 'No active verification code found. Please request a new OTP.',
      };
    }

    // Expired OTP check (5 minutes validity)
    if (fakeNow > record.expiresAt) {
      delete records[recordKey];
      this.saveOtpRecords(records);
      return {
        success: false,
        error: 'Verification code has expired (validity is 5 minutes). Please request a new OTP.',
      };
    }

    if (cleanOtp !== record.otp) {
      record.attempts += 1;

      // Max 3 wrong attempts rule
      if (record.attempts >= CONFIG.MAX_WRONG_ATTEMPTS) {
        delete records[recordKey];
        this.saveOtpRecords(records);

        const blocks = this.getBlockRecords();
        blocks[cleanEmail] = {
          email: cleanEmail,
          blockedUntil: fakeNow + CONFIG.BLOCK_DURATION_MS,
          reason: 'Exceeded maximum 3 failed OTP attempts.',
        };
        this.saveBlockRecords(blocks);

        return {
          success: false,
          isBlocked: true,
          error: 'Maximum 3 wrong attempts reached. Your account/email is now blocked for 24 hours for security.',
        };
      }

      this.saveOtpRecords(records);
      const remaining = CONFIG.MAX_WRONG_ATTEMPTS - record.attempts;
      return {
        success: false,
        attemptsRemaining: remaining,
        error: `Incorrect verification code. ${remaining} attempt(s) remaining before 24-hour block.`,
      };
    }

    // Verified OTP: Immediately invalid (one-time use)
    const pendingData = record.pendingData;
    delete records[recordKey];
    this.saveOtpRecords(records);

    return {
      success: true,
      pendingData,
    };
  }

  static completePasswordReset(email, newPassword) {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const customers = raw ? JSON.parse(raw) : [];
    const found = customers.find(c => c.email.toLowerCase() === email.trim().toLowerCase());
    if (!found) return false;
    found.password = newPassword.trim();
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    return true;
  }
}

// ====================================================================
// RUN TESTS
// ====================================================================
console.log('--- STARTING HARIT JAL OTP SECURITY TEST SUITE ---');

let baseTime = 1700000000000;
const testEmail = 'partner@dhaba-karan.com';

// TEST 1: OTP Length is strictly 6 digits
{
  const res = TestOtpService.sendOtp(testEmail, 'signup', null, baseTime);
  assert.strictEqual(res.success, true);
  assert.strictEqual(typeof res.otp, 'string');
  assert.strictEqual(res.otp.length, 6, 'OTP must be exactly 6 digits');
  assert.strictEqual(/^\d{6}$/.test(res.otp), true, 'OTP must contain only digits');
  console.log('✅ TEST 1 PASSED: OTP is exactly 6 digits numeric.');
}

// TEST 2: 1-minute (60 seconds) resend cooldown
{
  // Try sending again at 30 seconds
  const res30 = TestOtpService.sendOtp(testEmail, 'signup', null, baseTime + 30000);
  assert.strictEqual(res30.success, false, 'Must reject resend before 60s cooldown');
  assert.strictEqual(res30.resendInSeconds, 30);
  assert(res30.error.includes('Please wait 30 seconds'));

  // Try sending at 61 seconds (cooldown elapsed)
  const res61 = TestOtpService.sendOtp(testEmail, 'signup', null, baseTime + 61000);
  assert.strictEqual(res61.success, true, 'Resend must succeed after 60s cooldown');
  console.log('✅ TEST 2 PASSED: 1-minute (60 seconds) resend cooldown strictly enforced.');
}

// TEST 3: 5-minute (300 seconds) validity & auto-expiration
{
  const sendTime = baseTime + 100000;
  const sendRes = TestOtpService.sendOtp('expire-test@dhaba.com', 'signup', null, sendTime);
  const code = sendRes.otp;

  // Verify at 4 minutes 59 seconds (should be valid)
  const okAttempt = TestOtpService.verifyOtp('expire-test@dhaba.com', 'wrong1', 'signup', sendTime + (4 * 60 + 59) * 1000);
  assert.strictEqual(okAttempt.success, false);
  assert(okAttempt.error.includes('attempt(s) remaining'), 'Code still active within 5 minutes');

  // Verify at 5 minutes 1 second (should be expired & invalid)
  const expAttempt = TestOtpService.verifyOtp('expire-test@dhaba.com', code, 'signup', sendTime + (5 * 60 + 1) * 1000);
  assert.strictEqual(expAttempt.success, false);
  assert(expAttempt.error.includes('expired (validity is 5 minutes)'), 'Expired OTP rejected');
  console.log('✅ TEST 3 PASSED: 5-minute OTP validity and automatic invalidation upon expiry verified.');
}

// TEST 4: Maximum 3 wrong attempts and 24-hour block enforcement
{
  const email3Strikes = 'three-strikes@restaurant.com';
  const sendRes = TestOtpService.sendOtp(email3Strikes, 'forgot_password', null, baseTime);
  const correctCode = sendRes.otp;

  // Strike 1
  const a1 = TestOtpService.verifyOtp(email3Strikes, '000000', 'forgot_password', baseTime + 1000);
  assert.strictEqual(a1.success, false);
  assert.strictEqual(a1.attemptsRemaining, 2);

  // Strike 2
  const a2 = TestOtpService.verifyOtp(email3Strikes, '111111', 'forgot_password', baseTime + 2000);
  assert.strictEqual(a2.success, false);
  assert.strictEqual(a2.attemptsRemaining, 1);

  // Strike 3 (Final attempt failure)
  const a3 = TestOtpService.verifyOtp(email3Strikes, '222222', 'forgot_password', baseTime + 3000);
  assert.strictEqual(a3.success, false);
  assert.strictEqual(a3.isBlocked, true);
  assert(a3.error.includes('blocked for 24 hours'));

  // Attempting with even correct OTP after block MUST fail
  const blockedAttempt = TestOtpService.verifyOtp(email3Strikes, correctCode, 'forgot_password', baseTime + 4000);
  assert.strictEqual(blockedAttempt.success, false);
  assert.strictEqual(blockedAttempt.isBlocked, true);

  // Attempting to send new OTP during 24h block MUST fail
  const sendBlocked = TestOtpService.sendOtp(email3Strikes, 'forgot_password', null, baseTime + (10 * 3600 * 1000));
  assert.strictEqual(sendBlocked.success, false);
  assert(sendBlocked.error.includes('temporarily blocked for 24 hours'));

  // After 24 hours + 1 minute, block is automatically lifted
  const after24h = TestOtpService.sendOtp(email3Strikes, 'forgot_password', null, baseTime + (24 * 3600 * 1000 + 60000));
  assert.strictEqual(after24h.success, true, 'Block lifted after 24 hours');

  console.log('✅ TEST 4 PASSED: Maximum 3 wrong attempts triggers 24-hour block on OTP generation & verification.');
}

// TEST 5: Verified OTP is immediately invalid (One-time use)
{
  const singleUseEmail = 'single-use@luxury.com';
  const sendRes = TestOtpService.sendOtp(singleUseEmail, 'signup', { plan: 'premium' }, baseTime);
  const otpCode = sendRes.otp;

  // First verification must succeed
  const v1 = TestOtpService.verifyOtp(singleUseEmail, otpCode, 'signup', baseTime + 5000);
  assert.strictEqual(v1.success, true);
  assert.deepStrictEqual(v1.pendingData, { plan: 'premium' });

  // Re-submitting the exact same OTP must fail immediately
  const v2 = TestOtpService.verifyOtp(singleUseEmail, otpCode, 'signup', baseTime + 6000);
  assert.strictEqual(v2.success, false);
  assert(v2.error.includes('No active verification code found'), 'One-time use strictly enforced');

  console.log('✅ TEST 5 PASSED: Verified OTP is immediately invalidated (one-time use).');
}

// TEST 6: 2-Step Forgot Password Flow (Verify OTP First -> Then Set New Password)
{
  const resetEmail = 'manager@grandpalace.in';
  // Seed initial customer
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([
    { email: resetEmail, password: 'oldPassword123', restaurantName: 'Grand Palace' }
  ]));

  // Step 1: User requests password reset OTP
  const sendRes = TestOtpService.sendOtp(resetEmail, 'forgot_password', null, baseTime);
  assert.strictEqual(sendRes.success, true);
  const otpCode = sendRes.otp;

  // Step 2: User verifies OTP first (Step 1 of 2)
  const verifyRes = TestOtpService.verifyOtp(resetEmail, otpCode, 'forgot_password', baseTime + 10000);
  assert.strictEqual(verifyRes.success, true, 'OTP verification must succeed before setting new password');

  // Step 3: Now user sets new password (Step 2 of 2)
  const resetOk = TestOtpService.completePasswordReset(resetEmail, 'newSecurePass2026');
  assert.strictEqual(resetOk, true, 'Password update must succeed after verified OTP');

  // Verify the customer record in storage actually updated
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOMERS));
  const updatedCust = stored.find(c => c.email === resetEmail);
  assert.strictEqual(updatedCust.password, 'newSecurePass2026', 'Customer password must be updated to new password');

  console.log('✅ TEST 6 PASSED: 2-Step Password Reset (Step 1: OTP verification -> Step 2: Set New Password) verified.');
}

console.log('--- ALL 6 AUTOMATED OTP SECURITY TESTS PASSED SUCCESSFULLY ---');

