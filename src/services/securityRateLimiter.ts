// ====================================================================

export interface SecurityBlockEntry {
  key: string;
  type: 'id' | 'device' | 'ip';
  identifier: string;
  blockedUntil: number;
  reason: string;
  sourceVector: 'password' | 'otp';
  createdAt: number;
}

export interface AttemptCounter {
  attempts: number;
  lastAttemptAt: number;
}

export interface OtpSendCounter {
  count: number;
  firstSendAt: number;
  lastSendAt: number;
}

export interface BlockCheckResult {
  isBlocked: boolean;
  blockedBy?: 'id' | 'device' | 'ip';
  blockedIdentifier?: string;
  remainingMs?: number;
  remainingFormatted?: string;
  reason?: string;
}

const STORAGE_KEYS = {
  BLOCK_RECORDS: 'harit_jal_security_blocks_v2',
  PASSWORD_ATTEMPTS: 'harit_jal_password_attempts_v2',
  OTP_ATTEMPTS: 'harit_jal_otp_attempts_v2',
  OTP_SENDS: 'harit_jal_otp_sends_v2',
  DEVICE_ID: 'harit_jal_device_id_v1',
  CLIENT_IP: 'harit_jal_client_ip_v1',
};

export const SECURITY_CONFIG = {
  MAX_WRONG_ATTEMPTS: 3,                   // 3 wrong attempts allowed
  BLOCK_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours block
  OTP_VALIDITY_MS: 5 * 60 * 1000,          // 5 minutes
  OTP_RESEND_COOLDOWN_MS: 60 * 1000,        // 1 minute (60s)
};

export class SecurityRateLimiter {
  // -------------------------------------------------------------
  // Storage Helpers (safe for browser and node tests)
  // -------------------------------------------------------------
  private static getStorageItem(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch {
      return null;
    }
  }

  private static setStorageItem(key: string, val: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
      }
    } catch (e) {
      console.error('Storage write error:', e);
    }
  }

  // -------------------------------------------------------------
  // 1. Device Fingerprinting (Device Dimension)
  // -------------------------------------------------------------
  public static getDeviceId(): string {
    const existing = this.getStorageItem(STORAGE_KEYS.DEVICE_ID);
    if (existing && existing.startsWith('dev_')) {
      return existing;
    }

    let seed = 'dev_fallback';
    try {
      if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent || '';
        const lang = navigator.language || '';
        const platform = navigator.platform || '';
        const screenStr = typeof screen !== 'undefined' ? `${screen.width}x${screen.height}x${screen.colorDepth}` : '';
        const raw = `${ua}|${lang}|${platform}|${screenStr}`;
        
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
          hash = (hash << 5) - hash + raw.charCodeAt(i);
          hash |= 0;
        }
        seed = `dev_${Math.abs(hash).toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      } else {
        seed = `dev_node_${Math.random().toString(36).substring(2, 8)}`;
      }
    } catch {
      seed = `dev_${Date.now().toString(36)}`;
    }

    this.setStorageItem(STORAGE_KEYS.DEVICE_ID, seed);
    return seed;
  }

  // -------------------------------------------------------------
  // 2. Client IP Address Resolution (IP Dimension)
  // -------------------------------------------------------------
  public static getClientIp(): string {
    const existing = this.getStorageItem(STORAGE_KEYS.CLIENT_IP);
    if (existing) {
      return existing;
    }

    // Default stable client IP per browser/session (e.g. simulated Indian ISP network)
    const seedIp = `103.21.${Math.floor(100 + Math.random() * 150)}.${Math.floor(10 + Math.random() * 240)}`;
    this.setStorageItem(STORAGE_KEYS.CLIENT_IP, seedIp);
    return seedIp;
  }

  public static setClientIp(ip: string): void {
    this.setStorageItem(STORAGE_KEYS.CLIENT_IP, ip.trim());
  }

  // -------------------------------------------------------------
  // Block Records Access
  // -------------------------------------------------------------
  public static getBlockRecords(): Record<string, SecurityBlockEntry> {
    try {
      const raw = this.getStorageItem(STORAGE_KEYS.BLOCK_RECORDS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public static saveBlockRecords(records: Record<string, SecurityBlockEntry>): void {
    this.setStorageItem(STORAGE_KEYS.BLOCK_RECORDS, JSON.stringify(records));
  }

  // -------------------------------------------------------------
  // 3. Multi-Vector Block Check (ID + Device + IP)
  // -------------------------------------------------------------
  public static checkBlock(email?: string, deviceId?: string, ip?: string): BlockCheckResult {
    const blocks = this.getBlockRecords();
    const now = Date.now();
    let hasExpired = false;

    // Keys to test
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanDevice = (deviceId || this.getDeviceId()).trim();
    const cleanIp = (ip || this.getClientIp()).trim();

    const targets: { type: 'id' | 'device' | 'ip'; key: string; identifier: string }[] = [];
    if (cleanEmail) targets.push({ type: 'id', key: `id:${cleanEmail}`, identifier: cleanEmail });
    if (cleanDevice) targets.push({ type: 'device', key: `device:${cleanDevice}`, identifier: cleanDevice });
    if (cleanIp) targets.push({ type: 'ip', key: `ip:${cleanIp}`, identifier: cleanIp });

    // Clean up expired blocks first
    for (const [k, b] of Object.entries(blocks)) {
      if (now >= b.blockedUntil) {
        delete blocks[k];
        hasExpired = true;
      }
    }
    if (hasExpired) {
      this.saveBlockRecords(blocks);
    }

    // Check if any target dimension is currently blocked
    for (const t of targets) {
      const activeBlock = blocks[t.key];
      if (activeBlock && now < activeBlock.blockedUntil) {
        const remainingMs = activeBlock.blockedUntil - now;
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

        const remainingFormatted = hours > 0 
          ? `${hours}h ${minutes}m` 
          : `${minutes}m ${seconds}s`;

        return {
          isBlocked: true,
          blockedBy: t.type,
          blockedIdentifier: t.identifier,
          remainingMs,
          remainingFormatted,
          reason: activeBlock.reason,
        };
      }
    }

    return { isBlocked: false };
  }

  // -------------------------------------------------------------
  // 4. Enforce 24-Hour Block across ID, Device, AND IP
  // -------------------------------------------------------------
  public static enforce24HourBlock(
    email?: string,
    deviceId?: string,
    ip?: string,
    reason: string = 'Exceeded maximum 3 failed attempts.',
    sourceVector: 'password' | 'otp' = 'password'
  ): { blockedUntil: number; remainingFormatted: string } {
    const blocks = this.getBlockRecords();
    const now = Date.now();
    const blockedUntil = now + SECURITY_CONFIG.BLOCK_DURATION_MS;

    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const cleanDevice = (deviceId || this.getDeviceId()).trim();
    const cleanIp = (ip || this.getClientIp()).trim();

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

    // Sync legacy OTP block store for backward compatibility
    try {
      const rawLegacy = this.getStorageItem('harit_jal_otp_blocks_v1');
      const legacy = rawLegacy ? JSON.parse(rawLegacy) : {};
      if (cleanEmail) {
        legacy[cleanEmail] = {
          email: cleanEmail,
          blockedUntil,
          reason,
        };
        this.setStorageItem('harit_jal_otp_blocks_v1', JSON.stringify(legacy));
      }
    } catch {}

    console.warn(`[Harit Jal Security Lockout] Blocked 24h on ID (${cleanEmail}), Device (${cleanDevice}), IP (${cleanIp}) due to: ${reason}`);

    return {
      blockedUntil,
      remainingFormatted: '24h 0m',
    };
  }

  // -------------------------------------------------------------
  // 5. Password Failed Attempts Tracking (3-Strikes Enforcement)
  // -------------------------------------------------------------
  private static getPasswordAttempts(): Record<string, AttemptCounter> {
    try {
      const raw = this.getStorageItem(STORAGE_KEYS.PASSWORD_ATTEMPTS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private static savePasswordAttempts(attempts: Record<string, AttemptCounter>): void {
    this.setStorageItem(STORAGE_KEYS.PASSWORD_ATTEMPTS, JSON.stringify(attempts));
  }

  public static recordFailedPassword(
    email: string,
    deviceId?: string,
    ip?: string
  ): {
    isBlocked: boolean;
    attemptsRemaining: number;
    error: string;
    remainingFormatted?: string;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanDevice = (deviceId || this.getDeviceId()).trim();
    const cleanIp = (ip || this.getClientIp()).trim();

    // Check if already blocked
    const priorCheck = this.checkBlock(cleanEmail, cleanDevice, cleanIp);
    if (priorCheck.isBlocked) {
      return {
        isBlocked: true,
        attemptsRemaining: 0,
        remainingFormatted: priorCheck.remainingFormatted,
        error: `Security Lockout Active: Account ID, device, and network are blocked for 24 hours. Remaining: ${priorCheck.remainingFormatted}.`,
      };
    }

    const attemptsMap = this.getPasswordAttempts();
    const now = Date.now();

    const keys = [
      `id:${cleanEmail}`,
      `device:${cleanDevice}`,
      `ip:${cleanIp}`,
    ];

    let maxAttempts = 0;
    for (const k of keys) {
      const cur = attemptsMap[k] || { attempts: 0, lastAttemptAt: now };
      cur.attempts += 1;
      cur.lastAttemptAt = now;
      attemptsMap[k] = cur;
      if (cur.attempts > maxAttempts) {
        maxAttempts = cur.attempts;
      }
    }

    this.savePasswordAttempts(attemptsMap);

    // Enforce 3-strikes rule
    if (maxAttempts >= SECURITY_CONFIG.MAX_WRONG_ATTEMPTS) {
      // Clear attempt counters and enforce 24h block on ALL THREE
      for (const k of keys) {
        delete attemptsMap[k];
      }
      this.savePasswordAttempts(attemptsMap);

      const blockRes = this.enforce24HourBlock(
        cleanEmail,
        cleanDevice,
        cleanIp,
        'Exceeded maximum 3 failed password attempts.',
        'password'
      );

      return {
        isBlocked: true,
        attemptsRemaining: 0,
        remainingFormatted: blockRes.remainingFormatted,
        error: 'Maximum 3 wrong password attempts reached. Your account ID, device, and IP address are locked for 24 hours for security.',
      };
    }

    const remaining = SECURITY_CONFIG.MAX_WRONG_ATTEMPTS - maxAttempts;
    return {
      isBlocked: false,
      attemptsRemaining: remaining,
      error: `Invalid password. ${remaining} attempt(s) remaining before a strict 24-hour block on your ID, device, and network.`,
    };
  }

  public static recordSuccessfulPassword(email: string, deviceId?: string, ip?: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const cleanDevice = (deviceId || this.getDeviceId()).trim();
    const cleanIp = (ip || this.getClientIp()).trim();

    const attemptsMap = this.getPasswordAttempts();
    delete attemptsMap[`id:${cleanEmail}`];
    delete attemptsMap[`device:${cleanDevice}`];
    delete attemptsMap[`ip:${cleanIp}`];
    this.savePasswordAttempts(attemptsMap);
  }

  // -------------------------------------------------------------
  // 6. OTP Failed Attempts Tracking (3-Strikes Enforcement)
  // -------------------------------------------------------------
  public static recordFailedOtp(
    email: string,
    deviceId?: string,
    ip?: string
  ): {
    isBlocked: boolean;
    attemptsRemaining: number;
    error: string;
    remainingFormatted?: string;
  } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanDevice = (deviceId || this.getDeviceId()).trim();
    const cleanIp = (ip || this.getClientIp()).trim();

    // Check if already blocked
    const priorCheck = this.checkBlock(cleanEmail, cleanDevice, cleanIp);
    if (priorCheck.isBlocked) {
      return {
        isBlocked: true,
        attemptsRemaining: 0,
        remainingFormatted: priorCheck.remainingFormatted,
        error: `Security Lockout Active: Account ID, device, and network are blocked for 24 hours. Remaining: ${priorCheck.remainingFormatted}.`,
      };
    }

    const attemptsMap = this.getPasswordAttempts(); // shared or dedicated
    const now = Date.now();
    const keys = [
      `otp_id:${cleanEmail}`,
      `otp_device:${cleanDevice}`,
      `otp_ip:${cleanIp}`,
    ];

    let maxAttempts = 0;
    for (const k of keys) {
      const cur = attemptsMap[k] || { attempts: 0, lastAttemptAt: now };
      cur.attempts += 1;
      cur.lastAttemptAt = now;
      attemptsMap[k] = cur;
      if (cur.attempts > maxAttempts) {
        maxAttempts = cur.attempts;
      }
    }
    this.savePasswordAttempts(attemptsMap);

    if (maxAttempts >= SECURITY_CONFIG.MAX_WRONG_ATTEMPTS) {
      for (const k of keys) {
        delete attemptsMap[k];
      }
      this.savePasswordAttempts(attemptsMap);

      const blockRes = this.enforce24HourBlock(
        cleanEmail,
        cleanDevice,
        cleanIp,
        'Exceeded maximum 3 failed OTP verification attempts.',
        'otp'
      );

      return {
        isBlocked: true,
        attemptsRemaining: 0,
        remainingFormatted: blockRes.remainingFormatted,
        error: `⛔ सुरक्षा लॉक: 3 बार गलत OTP दर्ज करने के कारण आपका अकाउंट, डिवाइस और नेटवर्क 24 घंटे के लिए लॉक कर दिया गया है। (Maximum 3 wrong attempts reached. Locked for ${blockRes.remainingFormatted}.)`,
      };
    }

    const remaining = SECURITY_CONFIG.MAX_WRONG_ATTEMPTS - maxAttempts;
    const warningPrefix = remaining === 2
      ? '⚠️ गलत OTP कोड! 2 और गलत प्रयासों के बाद आपका अकाउंट 24 घंटे के लिए लॉक हो जाएगा।'
      : '🚨 अंतिम चेतावनी: केवल 1 प्रयास शेष है! इसके बाद आपका अकाउंट 24 घंटे के लिए ब्लॉक हो जाएगा।';

    return {
      isBlocked: false,
      attemptsRemaining: remaining,
      error: `${warningPrefix} (Incorrect verification code. ${remaining} attempt(s) remaining before 24-hour block on your ID, device, and network.)`,
    };
  }

  // -------------------------------------------------------------
  // 7. OTP Send Quota Tracking (Max 3 OTP Dispatches per 24h)
  // -------------------------------------------------------------
  private static getOtpSendAttempts(): Record<string, OtpSendCounter> {
    try {
      const raw = this.getStorageItem(STORAGE_KEYS.OTP_SENDS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private static saveOtpSendAttempts(sends: Record<string, OtpSendCounter>): void {
    this.setStorageItem(STORAGE_KEYS.OTP_SENDS, JSON.stringify(sends));
  }

  /**
   * Enforces maximum 3 OTP requests in 24 hours per identifier/device/network.
   * If exceeded (attempting > 3 times), triggers 24-hour multi-vector lockout.
   */
  public static checkAndRecordOtpSend(
    identifier: string,
    deviceId?: string,
    ip?: string
  ): {
    allowed: boolean;
    isBlocked: boolean;
    sendsRemaining: number;
    error?: string;
    remainingFormatted?: string;
  } {
    const cleanId = identifier.trim().toLowerCase();
    const cleanDevice = (deviceId || this.getDeviceId()).trim();
    const cleanIp = (ip || this.getClientIp()).trim();

    // Check if already blocked by any vector
    const priorCheck = this.checkBlock(cleanId, cleanDevice, cleanIp);
    if (priorCheck.isBlocked) {
      return {
        allowed: false,
        isBlocked: true,
        sendsRemaining: 0,
        remainingFormatted: priorCheck.remainingFormatted,
        error: `सुरक्षा लॉक सक्रिय: 24 घंटे का सुरक्षा लॉक लगा हुआ है। शेष समय: ${priorCheck.remainingFormatted}. (Security Lockout Active. Remaining: ${priorCheck.remainingFormatted})`,
      };
    }

    const sendsMap = this.getOtpSendAttempts();
    const now = Date.now();
    const WINDOW_MS = SECURITY_CONFIG.BLOCK_DURATION_MS; // 24 hours

    const key = `send:${cleanId}`;
    const cur = sendsMap[key];

    let currentRecord: OtpSendCounter;
    if (!cur || now - cur.firstSendAt > WINDOW_MS) {
      currentRecord = { count: 0, firstSendAt: now, lastSendAt: now };
    } else {
      currentRecord = { ...cur };
    }

    if (currentRecord.count >= 3) {
      const blockRes = this.enforce24HourBlock(
        cleanId,
        cleanDevice,
        cleanIp,
        'Exceeded maximum 3 OTP requests in 24 hours.',
        'otp'
      );
      return {
        allowed: false,
        isBlocked: true,
        sendsRemaining: 0,
        remainingFormatted: blockRes.remainingFormatted,
        error: `सुरक्षा लॉक: 24 घंटे में अधिकतम 3 बार ही OTP भेजा जा सकता है। आपका अकाउंट और डिवाइस 24 घंटे के लिए लॉक कर दिया गया है। (Maximum 3 OTP requests allowed per 24 hours. Locked for ${blockRes.remainingFormatted}.)`,
      };
    }

    currentRecord.count += 1;
    currentRecord.lastSendAt = now;
    sendsMap[key] = currentRecord;
    this.saveOtpSendAttempts(sendsMap);

    const sendsRemaining = 3 - currentRecord.count;
    return {
      allowed: true,
      isBlocked: false,
      sendsRemaining,
    };
  }

  public static recordSuccessfulOtp(email: string, deviceId?: string, ip?: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const cleanDevice = (deviceId || this.getDeviceId()).trim();
    const cleanIp = (ip || this.getClientIp()).trim();

    const attemptsMap = this.getPasswordAttempts();
    delete attemptsMap[`otp_id:${cleanEmail}`];
    delete attemptsMap[`otp_device:${cleanDevice}`];
    delete attemptsMap[`otp_ip:${cleanIp}`];
    this.savePasswordAttempts(attemptsMap);
  }
}

