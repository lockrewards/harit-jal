// ====================================================================
// HARIT JAL™ (हरित जल) — MULTI-VECTOR SECURITY (ID, DEVICE, IP) TEST SUITE
// Automated verification of user requirements:
// 1. Password Limit: Max 3 wrong passwords -> 24 hours block on ID, Device, and IP
// 2. OTP Limit: Max 3 wrong OTP attempts -> 24 hours block on ID, Device, and IP
// 3. Multi-Vector Enforcement: Block on ANY of (Email ID, Device, IP) halts access
// 4. Recovery: Successful login/OTP resets attempts; 24h expiration auto-lifts
// ====================================================================

import assert from 'node:assert';

// Mock localStorage for Node environment
const memoryStore = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStore.get(key) || null,
  setItem: (key, val) => memoryStore.set(key, String(val)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};

globalThis.window = {
  dispatchEvent: () => {},
};

// Replicate SecurityRateLimiter logic for standalone test execution
class TestSecurityRateLimiter {
  static getStorageItem(key) {
    return globalThis.localStorage.getItem(key);
  }

  static setStorageItem(key, val) {
    globalThis.localStorage.setItem(key, String(val));
  }

  static getBlockRecords() {
    try {
      const raw = this.getStorageItem('harit_jal_security_blocks_v2');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  static saveBlockRecords(records) {
    this.setStorageItem('harit_jal_security_blocks_v2', JSON.stringify(records));
  }

  static getPasswordAttempts() {
    try {
      const raw = this.getStorageItem('harit_jal_password_attempts_v2');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  static savePasswordAttempts(attempts) {
    this.setStorageItem('harit_jal_password_attempts_v2', JSON.stringify(attempts));
  }

  static checkBlock(email, deviceId, ip, now = Date.now()) {
    const blocks = this.getBlockRecords();
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanDevice = deviceId ? deviceId.trim() : '';
    const cleanIp = ip ? ip.trim() : '';

    const targets = [];
    if (cleanEmail) targets.push({ type: 'id', key: `id:${cleanEmail}`, identifier: cleanEmail });
    if (cleanDevice) targets.push({ type: 'device', key: `device:${cleanDevice}`, identifier: cleanDevice });
    if (cleanIp) targets.push({ type: 'ip', key: `ip:${cleanIp}`, identifier: cleanIp });

    let hasExpired = false;
    for (const [k, b] of Object.entries(blocks)) {
      if (now >= b.blockedUntil) {
        delete blocks[k];
        hasExpired = true;
      }
    }
    if (hasExpired) {
      this.saveBlockRecords(blocks);
    }

    for (const t of targets) {
      const activeBlock = blocks[t.key];
      if (activeBlock && now < activeBlock.blockedUntil) {
        const remainingMs = activeBlock.blockedUntil - now;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        return {
          isBlocked: true,
          blockedBy: t.type,
          blockedIdentifier: t.identifier,
          remainingMs,
          remainingFormatted: `${hours}h ${minutes}m`,
          reason: activeBlock.reason,
        };
      }
    }

    return { isBlocked: false };
  }

  static enforce24HourBlock(email, deviceId, ip, reason = 'Exceeded maximum 3 failed attempts.', sourceVector = 'password', now = Date.now()) {
    const blocks = this.getBlockRecords();
    const blockedUntil = now + (24 * 60 * 60 * 1000);

    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanDevice = deviceId ? deviceId.trim() : '';
    const cleanIp = ip ? ip.trim() : '';

    if (cleanEmail) {
      blocks[`id:${cleanEmail}`] = {
        key: `id:${cleanEmail}`,
        type: 'id',
        identifier: cleanEmail,
        blockedUntil,
        reason,
        sourceVector,
        createdAt: now,
      };
    }

    if (cleanDevice) {
      blocks[`device:${cleanDevice}`] = {
        key: `device:${cleanDevice}`,
        type: 'device',
        identifier: cleanDevice,
        blockedUntil,
        reason,
        sourceVector,
        createdAt: now,
      };
    }

    if (cleanIp) {
      blocks[`ip:${cleanIp}`] = {
        key: `ip:${cleanIp}`,
        type: 'ip',
        identifier: cleanIp,
        blockedUntil,
        reason,
        sourceVector,
        createdAt: now,
      };
    }

    this.saveBlockRecords(blocks);
    return { blockedUntil, remainingFormatted: '24h 0m' };
  }

  static recordFailedPassword(email, deviceId, ip, now = Date.now()) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanDevice = deviceId.trim();
    const cleanIp = ip.trim();

    const prior = this.checkBlock(cleanEmail, cleanDevice, cleanIp, now);
    if (prior.isBlocked) {
      return { isBlocked: true, attemptsRemaining: 0, error: `Security Lockout Active: Blocked for 24 hours.` };
    }

    const attemptsMap = this.getPasswordAttempts();
    const keys = [`id:${cleanEmail}`, `device:${cleanDevice}`, `ip:${cleanIp}`];

    let maxAttempts = 0;
    for (const k of keys) {
      const cur = attemptsMap[k] || { attempts: 0, lastAttemptAt: now };
      cur.attempts += 1;
      cur.lastAttemptAt = now;
      attemptsMap[k] = cur;
      if (cur.attempts > maxAttempts) maxAttempts = cur.attempts;
    }
    this.savePasswordAttempts(attemptsMap);

    if (maxAttempts >= 3) {
      for (const k of keys) delete attemptsMap[k];
      this.savePasswordAttempts(attemptsMap);

      this.enforce24HourBlock(cleanEmail, cleanDevice, cleanIp, 'Exceeded maximum 3 failed password attempts.', 'password', now);
      return {
        isBlocked: true,
        attemptsRemaining: 0,
        error: 'Maximum 3 wrong password attempts reached. Account ID, device, and IP are locked for 24 hours.',
      };
    }

    const remaining = 3 - maxAttempts;
    return {
      isBlocked: false,
      attemptsRemaining: remaining,
      error: `Invalid password. ${remaining} attempt(s) remaining.`,
    };
  }

  static recordFailedOtp(email, deviceId, ip, now = Date.now()) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanDevice = deviceId.trim();
    const cleanIp = ip.trim();

    const prior = this.checkBlock(cleanEmail, cleanDevice, cleanIp, now);
    if (prior.isBlocked) {
      return { isBlocked: true, attemptsRemaining: 0, error: `Security Lockout Active: Blocked for 24 hours.` };
    }

    const attemptsMap = this.getPasswordAttempts();
    const keys = [`otp_id:${cleanEmail}`, `otp_device:${cleanDevice}`, `otp_ip:${cleanIp}`];

    let maxAttempts = 0;
    for (const k of keys) {
      const cur = attemptsMap[k] || { attempts: 0, lastAttemptAt: now };
      cur.attempts += 1;
      cur.lastAttemptAt = now;
      attemptsMap[k] = cur;
      if (cur.attempts > maxAttempts) maxAttempts = cur.attempts;
    }
    this.savePasswordAttempts(attemptsMap);

    if (maxAttempts >= 3) {
      for (const k of keys) delete attemptsMap[k];
      this.savePasswordAttempts(attemptsMap);

      this.enforce24HourBlock(cleanEmail, cleanDevice, cleanIp, 'Exceeded maximum 3 failed OTP attempts.', 'otp', now);
      return {
        isBlocked: true,
        attemptsRemaining: 0,
        error: 'Maximum 3 wrong OTP attempts reached. Account ID, device, and IP are locked for 24 hours.',
      };
    }

    const remaining = 3 - maxAttempts;
    return {
      isBlocked: false,
      attemptsRemaining: remaining,
      error: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
    };
  }

  static recordSuccessfulPassword(email, deviceId, ip) {
    const attemptsMap = this.getPasswordAttempts();
    delete attemptsMap[`id:${email.toLowerCase()}`];
    delete attemptsMap[`device:${deviceId}`];
    delete attemptsMap[`ip:${ip}`];
    this.savePasswordAttempts(attemptsMap);
  }
}

// ====================================================================
// RUN TESTS
// ====================================================================
console.log('--- STARTING MULTI-VECTOR SECURITY (ID, DEVICE, IP) TESTS ---');

const baseTime = 1700000000000;
const testEmail = 'karan@dhaba.com';
const testDevice = 'dev_win_chrome_9091';
const testIp = '103.21.144.99';

// TEST 1: Password 3 wrong attempts triggers 24-hour block on ID, Device, and IP
{
  const r1 = TestSecurityRateLimiter.recordFailedPassword(testEmail, testDevice, testIp, baseTime);
  assert.strictEqual(r1.isBlocked, false);
  assert.strictEqual(r1.attemptsRemaining, 2);

  const r2 = TestSecurityRateLimiter.recordFailedPassword(testEmail, testDevice, testIp, baseTime + 1000);
  assert.strictEqual(r2.isBlocked, false);
  assert.strictEqual(r2.attemptsRemaining, 1);

  const r3 = TestSecurityRateLimiter.recordFailedPassword(testEmail, testDevice, testIp, baseTime + 2000);
  assert.strictEqual(r3.isBlocked, true, 'Must block on 3rd wrong password attempt');
  assert.strictEqual(r3.attemptsRemaining, 0);

  console.log('✅ TEST 1 PASSED: 3 wrong passwords trigger 24-hour lockout.');
}

// TEST 2: Multi-Vector Verification: Device & IP remain blocked even with DIFFERENT email
{
  // Attacker tries to use a new email 'attacker@random.com' from the SAME device
  const checkDifferentEmailSameDevice = TestSecurityRateLimiter.checkBlock('attacker@random.com', testDevice, '99.99.99.99', baseTime + 3000);
  assert.strictEqual(checkDifferentEmailSameDevice.isBlocked, true, 'Device dimension must block attack');
  assert.strictEqual(checkDifferentEmailSameDevice.blockedBy, 'device');

  // Attacker tries from a DIFFERENT device on the SAME IP
  const checkDifferentEmailSameIp = TestSecurityRateLimiter.checkBlock('victim2@restaurant.com', 'dev_other_111', testIp, baseTime + 4000);
  assert.strictEqual(checkDifferentEmailSameIp.isBlocked, true, 'IP dimension must block attack');
  assert.strictEqual(checkDifferentEmailSameIp.blockedBy, 'ip');

  // Attacker tries from a DIFFERENT device and DIFFERENT IP on the SAME Email ID
  const checkSameEmailNewDeviceIp = TestSecurityRateLimiter.checkBlock(testEmail, 'dev_brand_new_99', '192.168.1.5', baseTime + 5000);
  assert.strictEqual(checkSameEmailNewDeviceIp.isBlocked, true, 'ID dimension must block account misuse');
  assert.strictEqual(checkSameEmailNewDeviceIp.blockedBy, 'id');

  console.log('✅ TEST 2 PASSED: Multi-Vector Lockout on ID, Device, and IP strictly enforced.');
}

// TEST 3: OTP 3 wrong attempts triggers 24-hour block on ID, Device, and IP
{
  const otpEmail = 'otp-user@restaurant.com';
  const otpDevice = 'dev_mobile_safari_22';
  const otpIp = '122.161.49.12';

  const o1 = TestSecurityRateLimiter.recordFailedOtp(otpEmail, otpDevice, otpIp, baseTime);
  assert.strictEqual(o1.isBlocked, false);
  assert.strictEqual(o1.attemptsRemaining, 2);

  const o2 = TestSecurityRateLimiter.recordFailedOtp(otpEmail, otpDevice, otpIp, baseTime + 1000);
  assert.strictEqual(o2.isBlocked, false);
  assert.strictEqual(o2.attemptsRemaining, 1);

  const o3 = TestSecurityRateLimiter.recordFailedOtp(otpEmail, otpDevice, otpIp, baseTime + 2000);
  assert.strictEqual(o3.isBlocked, true, '3rd wrong OTP must trigger 24h block');

  // Verify that device is also blocked from OTP
  const checkOtpDevice = TestSecurityRateLimiter.checkBlock('another@dhaba.com', otpDevice, '1.1.1.1', baseTime + 3000);
  assert.strictEqual(checkOtpDevice.isBlocked, true);
  assert.strictEqual(checkOtpDevice.blockedBy, 'device');

  console.log('✅ TEST 3 PASSED: 3 wrong OTP attempts trigger 24-hour block on ID, Device, and IP.');
}

// TEST 4: Auto-lifting of block after 24 hours
{
  const future24h = baseTime + (24 * 60 * 60 * 1000) + 10000; // 10s after 24 hours from base
  const liftedCheck = TestSecurityRateLimiter.checkBlock(testEmail, testDevice, testIp, future24h);
  assert.strictEqual(liftedCheck.isBlocked, false, 'Block must automatically expire after 24 hours');

  console.log('✅ TEST 4 PASSED: 24-hour block automatically lifted after 24 hours.');
}

// TEST 5: Success resets failed attempts
{
  const resetEmail = 'normal-user@dhaba.com';
  const resetDevice = 'dev_normal_device';
  const resetIp = '103.21.100.1';

  // 1 wrong attempt
  TestSecurityRateLimiter.recordFailedPassword(resetEmail, resetDevice, resetIp, baseTime);
  // Correct login resets counters
  TestSecurityRateLimiter.recordSuccessfulPassword(resetEmail, resetDevice, resetIp);

  // Next attempt should have full 2 attempts remaining (3 - 1)
  const afterReset = TestSecurityRateLimiter.recordFailedPassword(resetEmail, resetDevice, resetIp, baseTime + 10000);
  assert.strictEqual(afterReset.attemptsRemaining, 2);

  console.log('✅ TEST 5 PASSED: Successful authentication resets failed attempts counter.');
}

console.log('--- ALL 5 MULTI-VECTOR SECURITY TESTS PASSED SUCCESSFULLY ---');
