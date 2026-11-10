/**
 * ====================================================================
 * HARIT JAL™ (हरित जल) — DYNAMIC TIME-BASED ADMIN ROUTER
 * Authoritative Timezone: Asia/Kolkata (IST - UTC+05:30)
 * Route Format: /DDMMYYHHMM
 * Examples: /0811261718, /0811261719, /0811261720
 * ====================================================================
 */

import { isProductionEnvironment, readViteEnv } from './env';

export interface RouteValidationResult {
  isValid: boolean;
  token: string;
  reason?: string;
  mode: 'server_edge_function' | 'local_ist_mock';
  serverVerified: boolean;
  expiresInSeconds?: number;
}

export const DynamicAdminRouter = {
  /**
   * Generates the authoritative 10-digit IST token (DDMMYYHHMM) for a given Date
   * Accurately handles zero padding, midnight (00:00), month bounds, and leap years.
   */
  generateISTToken(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.day}${map.month}${map.year}${map.hour}${map.minute}`;
  },

  /**
   * Generates local system time 10-digit token (DDMMYYHHMM) for a given Date
   */
  generateLocalToken(date: Date = new Date()): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${day}${month}${year}${hour}${minute}`;
  },

  /**
   * Checks if a string or path matches the 10-digit numeric pattern
   */
  isDynamicAdminPattern(path: string): boolean {
    const clean = path.replace(/^\/+/, '').replace(/\/+$/, '');
    return /^[0-9]{10}$/.test(clean);
  },

  /**
   * Extracts the 10-digit token from a path
   */
  extractToken(path: string): string | null {
    const clean = path.replace(/^\/+/, '').replace(/\/+$/, '');
    return /^[0-9]{10}$/.test(clean) ? clean : null;
  },

  /**
   * Syntactically parses the 10-digit DDMMYYHHMM string and validates date calendar bounds
   */
  parseTokenComponents(token: string): {
    valid: boolean;
    day?: number;
    month?: number;
    year?: number;
    hour?: number;
    minute?: number;
    error?: string;
  } {
    if (!/^[0-9]{10}$/.test(token)) {
      return { valid: false, error: 'Token must be exactly 10 digits.' };
    }

    const day = parseInt(token.slice(0, 2), 10);
    const month = parseInt(token.slice(2, 4), 10);
    const year = 2000 + parseInt(token.slice(4, 6), 10);
    const hour = parseInt(token.slice(6, 8), 10);
    const minute = parseInt(token.slice(8, 10), 10);

    if (month < 1 || month > 12) {
      return { valid: false, error: `Invalid month: ${month}` };
    }

    // Days in month validation (including leap year)
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      return { valid: false, error: `Invalid day ${day} for month ${month}/${year}` };
    }

    if (hour < 0 || hour > 23) {
      return { valid: false, error: `Invalid hour: ${hour}` };
    }

    if (minute < 0 || minute > 59) {
      return { valid: false, error: `Invalid minute: ${minute}` };
    }

    return { valid: true, day, month, year, hour, minute };
  },

  /**
   * Synchronously validates a route token against the authoritative IST current minute.
   * Rejects expired previous minutes, future minutes, and malformed dates.
   */
  validateRoute(tokenOrPath: string): RouteValidationResult {
    const token = this.extractToken(tokenOrPath);

    if (!token) {
      return {
        isValid: false,
        token: tokenOrPath,
        reason: 'Path does not match dynamic route pattern.',
        mode: 'local_ist_mock',
        serverVerified: false,
      };
    }

    // Check calendar validity
    const parsed = this.parseTokenComponents(token);
    if (!parsed.valid) {
      return {
        isValid: false,
        token,
        reason: parsed.error || 'Calendar component out of range.',
        mode: 'local_ist_mock',
        serverVerified: false,
      };
    }

    // Current authoritative IST & Local tokens (supports current minute validation)
    const now = new Date();
    const currentValidToken = this.generateISTToken(now);
    const currentLocalToken = this.generateLocalToken(now);

    if (token === currentValidToken || token === currentLocalToken) {
      const secondsLeft = 60 - now.getSeconds();
      return {
        isValid: true,
        token,
        mode: 'local_ist_mock',
        serverVerified: false, // Edge function deployment pending in phase
        expiresInSeconds: secondsLeft,
      };
    }

    // Determine whether expired or future
    const nowMinutes = Math.floor(now.getTime() / 60000);
    // Rough estimate of token date
    const tokenDate = new Date(Date.UTC(parsed.year!, parsed.month! - 1, parsed.day!, parsed.hour!, parsed.minute!));
    // Offset by 5h30m for IST comparison
    const tokenMinutes = Math.floor((tokenDate.getTime() - (5.5 * 3600 * 1000)) / 60000);

    const isPast = tokenMinutes < nowMinutes;

    return {
      isValid: false,
      token,
      reason: isPast 
        ? 'Administrative time-window has expired. Routes rotate every 60 seconds.'
        : 'Future routes are not authorized. Access is granted only during the active minute.',
      mode: 'local_ist_mock',
      serverVerified: false,
    };
  },

  /**
   * Asynchronously attempts authoritative verification against Supabase Edge Function.
   * Sends both `apikey` and `Authorization: Bearer` headers required when `verify_jwt = true`.
   * Fails CLOSED in production whenever Edge Function verification is missing, rejected, or unreachable.
   */
  async validateRouteAuthoritative(tokenOrPath: string): Promise<RouteValidationResult> {
    const token = this.extractToken(tokenOrPath);
    if (!token) {
      return {
        isValid: false,
        token: tokenOrPath,
        reason: 'Path does not match dynamic route pattern.',
        mode: isProductionEnvironment() ? 'server_edge_function' : 'local_ist_mock',
        serverVerified: false,
      };
    }

    const parsed = this.parseTokenComponents(token);
    if (!parsed.valid) {
      return {
        isValid: false,
        token,
        reason: parsed.error || 'Calendar component out of range.',
        mode: isProductionEnvironment() ? 'server_edge_function' : 'local_ist_mock',
        serverVerified: false,
      };
    }

    const isProd = isProductionEnvironment();
    const supabaseUrl = readViteEnv('VITE_SUPABASE_URL');
    const anonKey = readViteEnv('VITE_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !anonKey || supabaseUrl.includes('your-project-id')) {
      if (isProd) {
        return {
          isValid: false,
          token,
          reason: 'Production administrative gateway requires configured server route verification.',
          mode: 'server_edge_function',
          serverVerified: false,
        };
      }
      return this.validateRoute(tokenOrPath);
    }

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/validate-admin-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ routeToken: token }),
      });

      if (!res.ok) {
        if (!isProd) {
          // Graceful fallback to local validation in development when Edge Function is not deployed
          return this.validateRoute(tokenOrPath);
        }
        return {
          isValid: false,
          token,
          reason: 'Server route verification failed or rate limit exceeded.',
          mode: 'server_edge_function',
          serverVerified: true,
        };
      }

      const data = await res.json();
      return {
        isValid: Boolean(data.valid),
        token,
        mode: 'server_edge_function',
        serverVerified: true,
        expiresInSeconds: data.expiresInSeconds,
      };
    } catch {
      if (isProd) {
        return {
          isValid: false,
          token,
          reason: 'Authoritative server route verification service is unreachable.',
          mode: 'server_edge_function',
          serverVerified: false,
        };
      }
      // Graceful fallback to local IST validation strictly in non-production development/test
      const localResult = this.validateRoute(tokenOrPath);
      return {
        ...localResult,
        mode: 'local_ist_mock',
        serverVerified: false,
      };
    }
  },

  /**
   * Helper: Returns the active dynamic route path for the current minute
   * Example: "/0811261725"
   */
  getCurrentAdminPath(): string {
    return `/${this.generateISTToken()}`;
  },
};

