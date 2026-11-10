// ====================================================================
// HARIT JAL™ (हरित जल) — API KEY SECURITY & ENV HARDENING TEST SUITE
// Verifies zero browser credential exposure, server-side Edge Function
// isolation (send-email-otp & crm-sync), fail-closed security controls,
// localStorage legacy secret scrubbing, CSP tightening, .env hygiene,
// and production bundle artifact scanning.
// ZERO live network or Supabase Cloud requests occur during execution.
// ====================================================================

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT_DIR = process.cwd();

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(String(k), String(v));
    },
    removeItem: (k) => {
      store.delete(String(k));
    },
    clear: () => {
      store.clear();
    },
    _dump: () => store,
  };
}

function makeFakeJwt(payload) {
  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.fakesig`;
}

function createEmailOtpAdminMock(options = {}) {
  const getNowMs = options.getNow || (() => Date.now());
  const securityBlocks = new Map(Object.entries(options.seedBlocks || {}));
  const emailLogs = [];
  const otpChallenges = new Map();
  const edgeRateLimits = new Map();
  const consultations = new Map(Object.entries(options.seedConsultations || {}));

  const client = {
    async rpc(name, params = {}) {
      if (name === 'consume_edge_rate_limit') {
        const key = params.p_bucket_key;
        const maxReq = params.p_max_requests || 10;
        const windowSec = params.p_window_seconds || 60;
        const nowSec = Math.floor(getNowMs() / 1000);
        let row = edgeRateLimits.get(key);
        if (!row || nowSec >= row.reset_at) {
          row = { count: 1, reset_at: nowSec + windowSec };
          edgeRateLimits.set(key, row);
          return { data: [{ allowed: true, current_count: 1, retry_after_seconds: windowSec }], error: null };
        }
        if (row.count >= maxReq) {
          return { data: [{ allowed: false, current_count: row.count, retry_after_seconds: Math.max(1, row.reset_at - nowSec) }], error: null };
        }
        row.count += 1;
        return { data: [{ allowed: true, current_count: row.count, retry_after_seconds: Math.max(1, row.reset_at - nowSec) }], error: null };
      }
      if (name === 'verify_otp_challenge_attempt') {
        const jti = params.p_jti;
        const record = otpChallenges.get(jti);
        if (!record) {
          return { data: [{ outcome: 'not_found', attempts_remaining: 0, blocked_until: null }], error: null };
        }
        const nowIso = new Date(getNowMs()).toISOString();
        if (record.used) {
          return { data: [{ outcome: 'already_used', attempts_remaining: 0, blocked_until: null }], error: null };
        }
        if (new Date(record.expires_at) < new Date(nowIso)) {
          return { data: [{ outcome: 'expired', attempts_remaining: 0, blocked_until: null }], error: null };
        }
        if (record.otp_hash !== params.p_otp_hash) {
          record.attempts = (record.attempts || 0) + 1;
          const attemptsRemaining = Math.max(0, 3 - record.attempts);
          if (attemptsRemaining === 0) {
            record.used = true;
            const blockedUntilIso = new Date(getNowMs() + 86400000).toISOString();
            securityBlocks.set(`id:${record.email}`, { target_key: `id:${record.email}`, target_type: 'id', identifier: record.email, blocked_until: blockedUntilIso });
            if (params.p_device_id) securityBlocks.set(`device:${params.p_device_id}`, { target_key: `device:${params.p_device_id}`, target_type: 'device', identifier: params.p_device_id, blocked_until: blockedUntilIso });
            if (params.p_client_ip && params.p_client_ip !== 'unknown') securityBlocks.set(`ip:${params.p_client_ip}`, { target_key: `ip:${params.p_client_ip}`, target_type: 'ip', identifier: params.p_client_ip, blocked_until: blockedUntilIso });
            return { data: [{ outcome: 'locked', attempts_remaining: 0, blocked_until: blockedUntilIso }], error: null };
          }
          return { data: [{ outcome: 'invalid', attempts_remaining: attemptsRemaining, blocked_until: null }], error: null };
        }
        record.used = true;
        record.consumed_at = nowIso;
        return { data: [{ outcome: 'verified', attempts_remaining: 3, blocked_until: null }], error: null };
      }
      if (name === 'check_security_block') {
        const keys = params.p_target_keys || [];
        const nowIso = new Date(getNowMs()).toISOString();
        const matched = keys
          .map((k) => securityBlocks.get(k))
          .filter((b) => b && b.blocked_until && b.blocked_until > nowIso);
        return { data: matched, error: null };
      }
      return { data: null, error: null };
    },
    from(table) {
      return {
        select(_columns) {
          const filters = {};
          const chain = {
            in(_col, values) {
              if (table === 'security_blocks') {
                const matched = values
                  .map((v) => securityBlocks.get(v))
                  .filter(Boolean);
                return Promise.resolve({ data: matched, error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
            eq(col, val) {
              filters[col] = val;
              return chain;
            },
            order() { return chain; },
            limit() { return chain; },
            is() { return chain; },
            gte() { return chain; },
            async maybeSingle() {
              if (table === 'otp_challenges') {
                if (filters.jti) {
                  return { data: otpChallenges.get(filters.jti) || null, error: null };
                }
                const matches = Array.from(otpChallenges.values())
                  .filter((c) => (!filters.email || c.email === filters.email) && (!filters.purpose || c.purpose === filters.purpose));
                matches.sort((a, b) => (Date.parse(b.created_at || '0') || 0) - (Date.parse(a.created_at || '0') || 0));
                return { data: matches[0] || null, error: null };
              }
              if (table === 'consultations') {
                if (filters.id) {
                  return { data: consultations.get(filters.id) || null, error: null };
                }
                return { data: null, error: null };
              }
              return { data: null, error: null };
            },
          };
          return chain;
        },
        async upsert(payload) {
          if (table === 'security_blocks') {
            securityBlocks.set(String(payload.target_key), { ...payload });
          } else if (table === 'otp_challenges') {
            const key = payload.jti || payload.id;
            otpChallenges.set(key, { ...payload, jti: key, id: key });
          }
          return { error: null };
        },
        async insert(payload) {
          if (table === 'email_logs') {
            emailLogs.push({ ...payload });
          } else if (table === 'otp_challenges') {
            const key = payload.jti || payload.id;
            otpChallenges.set(key, { ...payload, jti: key, id: key });
          } else if (table === 'consultations') {
            consultations.set(String(payload.id), { ...payload });
          }
          return { error: null };
        },
        update(payload) {
          let targetId = null;
          const chain = {
            eq(col, val) {
              targetId = val;
              if (table === 'otp_challenges' && col === 'jti') {
                const existing = otpChallenges.get(val);
                if (existing) Object.assign(existing, payload);
              }
              if (table === 'consultations' && col === 'id') {
                const existing = consultations.get(val);
                if (existing) Object.assign(existing, payload);
              }
              return chain;
            },
            is() { return chain; },
            select() { return chain; },
            async maybeSingle() {
              if (table === 'consultations' && targetId) {
                const c = consultations.get(targetId);
                if (c) {
                  Object.assign(c, payload);
                  return { data: c, error: null };
                }
              }
              if (table === 'otp_challenges' && targetId) {
                const ch = otpChallenges.get(targetId);
                if (ch) {
                  Object.assign(ch, payload);
                  return { data: ch, error: null };
                }
              }
              return { data: null, error: null };
            },
            then(resolve, reject) {
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
      };
    },
  };

  return { client, securityBlocks, emailLogs, otpChallenges, consultations };
}

function createCrmAdminMock(userByToken, options = {}) {
  const consultations = new Map(Object.entries(options.seedConsultations || {}));

  return {
    async rpc(name, _params = {}) {
      if (name === 'consume_edge_rate_limit') {
        return { data: [{ allowed: true, current_count: 1, retry_after_seconds: 60 }], error: null };
      }
      return { data: null, error: null };
    },
    auth: {
      async getUser(jwt) {
        const user = userByToken.get(jwt) || null;
        if (!user) {
          return { data: { user: null }, error: { message: 'Invalid token' } };
        }
        return { data: { user }, error: null };
      },
    },
    from(table) {
      return {
        select(_cols) {
          let selectedId = null;
          const chain = {
            eq(col, val) {
              if (col === 'id') selectedId = val;
              return chain;
            },
            is() { return chain; },
            gte() { return chain; },
            async maybeSingle() {
              if (table === 'consultations' && selectedId) {
                return { data: consultations.get(selectedId) || null, error: null };
              }
              return { data: null, error: null };
            },
          };
          return chain;
        },
        update(payload) {
          let targetId = null;
          return {
            eq(col, val) {
              if (col === 'id') targetId = val;
              return {
                is() {
                  return {
                    select() {
                      return {
                        async maybeSingle() {
                          if (table === 'consultations' && targetId) {
                            const c = consultations.get(targetId);
                            if (c) {
                              Object.assign(c, payload);
                              return { data: c, error: null };
                            }
                          }
                          return { data: null, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function collectFilesRecursive(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('API Key Security & Environment Variables Hardening Suite', () => {
  let viteServer;
  let originalFetch;
  let originalViteAppEnv;
  let originalNodeEnv;
  let originalSupabaseUrl;
  let originalSupabaseKey;
  let fetchStub;

  let sendEmailOtpHandler;
  let crmSyncHandler;
  let envService;
  let ResendService;
  let OtpService;
  let AutomationService;
  let StorageService;
  let NeerAIService;
  let TotpService;

  before(async () => {
    originalFetch = globalThis.fetch;
    originalViteAppEnv = process.env.VITE_APP_ENV;
    originalNodeEnv = process.env.NODE_ENV;
    originalSupabaseUrl = process.env.VITE_SUPABASE_URL;
    originalSupabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    globalThis.localStorage = createMemoryStorage();
    globalThis.sessionStorage = createMemoryStorage();
    globalThis.window = {
      location: { origin: 'https://haritjal.in', pathname: '/', search: '', hash: '' },
      history: { replaceState: () => {} },
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    fetchStub = async () => {
      throw new Error('Unexpected unmocked fetch call in API Key Security test');
    };
    globalThis.fetch = (...args) => fetchStub(...args);

    viteServer = await createServer({
      root: ROOT_DIR,
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      logLevel: 'silent',
    });

    sendEmailOtpHandler = await viteServer.ssrLoadModule('/supabase/functions/send-email-otp/handler.ts');
    crmSyncHandler = await viteServer.ssrLoadModule('/supabase/functions/crm-sync/handler.ts');
    envService = await viteServer.ssrLoadModule('/src/services/env.ts');
    ({ ResendService } = await viteServer.ssrLoadModule('/src/services/resendService.ts'));
    ({ OtpService } = await viteServer.ssrLoadModule('/src/services/otpService.ts'));
    ({ AutomationService } = await viteServer.ssrLoadModule('/src/services/automationService.ts'));
    ({ StorageService } = await viteServer.ssrLoadModule('/src/services/storage.ts'));
    ({ NeerAIService } = await viteServer.ssrLoadModule('/src/services/neerAI.ts'));
    ({ TotpService } = await viteServer.ssrLoadModule('/src/services/totpService.ts'));
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (originalViteAppEnv === undefined) delete process.env.VITE_APP_ENV;
    else process.env.VITE_APP_ENV = originalViteAppEnv;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSupabaseUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = originalSupabaseUrl;
    if (originalSupabaseKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
    else process.env.VITE_SUPABASE_ANON_KEY = originalSupabaseKey;
    if (viteServer) await viteServer.close();
  });

  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    fetchStub = async () => {
      throw new Error('Unexpected unmocked fetch call in API Key Security test');
    };
  });

  it('SEC-API-01: send-email-otp fails closed without valid RESEND_API_KEY and keeps OTP + secrets out of responses & audit logs', async () => {
    const storesMissing = sendEmailOtpHandler.createOtpStateStores();
    const { client: adminMock, emailLogs } = createEmailOtpAdminMock();

    // 1. Missing RESEND_API_KEY -> HTTP 500 fail-closed
    const missingEnvRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.10' },
        body: JSON.stringify({ action: 'send_otp', email: 'owner@dhaba.in', purpose: 'signup' }),
      }),
      {
        getEnv: (k) => ({
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'srv_test_signing_material_at_least_32_bytes_long',
          OTP_SIGNING_SECRET: '0123456789abcdef0123456789abcdef',
        })[k],
        createAdminClient: () => adminMock,
        stores: storesMissing,
      }
    );
    assert.strictEqual(missingEnvRes.status, 500);
    const missingJson = await missingEnvRes.json();
    assert.strictEqual(missingJson.success, false);
    assert.strictEqual('otp' in missingJson, false);

    // 2. Valid server env -> dispatches via api.resend.com on server, strips OTP from HTTP response & email_logs
    const stores = sendEmailOtpHandler.createOtpStateStores();
    let capturedResendPayload = null;
    let capturedAuthHeader = null;

    const sendRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.11' },
        body: JSON.stringify({ action: 'send_otp', email: 'owner@dhaba.in', purpose: 'signup', deviceId: 'dev_abc' }),
      }),
      {
        getEnv: (k) => ({
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'srv_test_signing_material_at_least_32_bytes_long',
          OTP_SIGNING_SECRET: '0123456789abcdef0123456789abcdef',
          RESEND_API_KEY: 're_test_server_secret_token_999999',
          RESEND_FROM_EMAIL: 'Harit Jal <noreply@haritjal.in>',
        })[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (url, init) => {
          assert.strictEqual(String(url), 'https://api.resend.com/emails');
          capturedAuthHeader = init?.headers?.Authorization || init?.headers?.authorization;
          capturedResendPayload = JSON.parse(String(init?.body || '{}'));
          return new Response(JSON.stringify({ id: 'msg_otp_001' }), { status: 200 });
        },
        now: () => 1_700_000_000_000,
        stores,
      }
    );

    assert.strictEqual(sendRes.status, 200);
    const sendJson = await sendRes.json();
    assert.strictEqual(sendJson.success, true);
    assert.ok(typeof sendJson.challengeToken === 'string' && sendJson.challengeToken.includes('.'));
    assert.strictEqual('otp' in sendJson, false, 'Server response must NEVER include plaintext OTP');
    assert.strictEqual(JSON.stringify(sendJson).includes('re_test_server_secret'), false);
    assert.strictEqual(capturedAuthHeader, 'Bearer re_test_server_secret_token_999999');

    // Verify 6-digit CSPRNG OTP exists in Resend email text ONLY (never in response or DB email_logs)
    const otpMatch = String(capturedResendPayload?.text || '').match(/\b(\d{6})\b/);
    assert.ok(otpMatch, 'Email dispatched to Resend must contain 6-digit OTP');
    assert.strictEqual(emailLogs.some((log) => /\b\d{6}\b/.test(log.body)), false, 'email_logs body must never store 6-digit OTP');

    // 3. Immediate resend within 60 seconds -> HTTP 429 cooldown
    const cooldownRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.11' },
        body: JSON.stringify({ action: 'send_otp', email: 'owner@dhaba.in', purpose: 'signup', deviceId: 'dev_abc' }),
      }),
      {
        getEnv: (k) => ({
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'srv_test_signing_material_at_least_32_bytes_long',
          OTP_SIGNING_SECRET: '0123456789abcdef0123456789abcdef',
          RESEND_API_KEY: 're_test_server_secret_token_999999',
        })[k],
        createAdminClient: () => adminMock,
        now: () => 1_700_000_015_000,
        stores,
      }
    );
    assert.strictEqual(cooldownRes.status, 429);
    const cooldownJson = await cooldownRes.json();
    assert.strictEqual(cooldownJson.success, false);
    assert.strictEqual(cooldownJson.resendInSeconds, 45);
  });

  it('SEC-API-02: send-email-otp enforces HMAC tamper resistance, 5m expiry, single-use replay protection & 3-strike 24h multi-vector lockout', async () => {
    const stores = sendEmailOtpHandler.createOtpStateStores();
    let clock = 1_700_000_000_000;
    let sentOtp = '';
    const { client: adminMock, securityBlocks } = createEmailOtpAdminMock({ getNow: () => clock });

    const envMap = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srv_test_signing_material_at_least_32_bytes_long',
      OTP_SIGNING_SECRET: 'fedcba9876543210fedcba9876543210',
      RESEND_API_KEY: 're_test_server_secret_token_888888',
    };

    const callOtp = (payload, ip = '203.0.113.20') =>
      sendEmailOtpHandler.handleSendEmailOtpRequest(
        new Request('https://example.supabase.co/functions/v1/send-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': ip },
          body: JSON.stringify(payload),
        }),
        {
          getEnv: (k) => envMap[k],
          createAdminClient: () => adminMock,
          fetchImpl: async (_url, init) => {
            const parsed = JSON.parse(String(init?.body || '{}'));
            const match = String(parsed.text || '').match(/\b(\d{6})\b/);
            if (match) sentOtp = match[1];
            return new Response(JSON.stringify({ id: 'msg_otp_002' }), { status: 200 });
          },
          now: () => clock,
          stores,
        }
      );

    // Send OTP #1
    const issueRes = await callOtp({
      action: 'send_otp',
      email: 'chef@royalpalace.in',
      purpose: 'signup',
      deviceId: 'dev_01',
    });
    assert.strictEqual(issueRes.status, 200);
    const { challengeToken } = await issueRes.json();

    // Tampered token rejected
    const [hdr, sig] = challengeToken.split('.');
    const tampered = `${hdr}.${sig.slice(0, -4)}AAAA`;
    const tamperRes = await callOtp({
      action: 'verify_otp',
      email: 'chef@royalpalace.in',
      otp: sentOtp,
      purpose: 'signup',
      challengeToken: tampered,
      deviceId: 'dev_01',
    });
    assert.strictEqual(tamperRes.status, 400);

    // Wrong email / purpose rejected
    const wrongPurposeRes = await callOtp({
      action: 'verify_otp',
      email: 'chef@royalpalace.in',
      otp: sentOtp,
      purpose: 'forgot_password',
      challengeToken,
      deviceId: 'dev_01',
    });
    assert.strictEqual(wrongPurposeRes.status, 400);

    // Valid verification succeeds & invalidates token for single-use replay
    const validRes = await callOtp({
      action: 'verify_otp',
      email: 'chef@royalpalace.in',
      otp: sentOtp,
      purpose: 'signup',
      challengeToken,
      deviceId: 'dev_01',
    });
    assert.strictEqual(validRes.status, 200);
    const validJson = await validRes.json();
    assert.strictEqual(validJson.verified, true);
    assert.ok(validJson.verificationProof);

    const replayRes = await callOtp({
      action: 'verify_otp',
      email: 'chef@royalpalace.in',
      otp: sentOtp,
      purpose: 'signup',
      challengeToken,
      deviceId: 'dev_01',
    });
    assert.strictEqual(replayRes.status, 400);

    // Issue OTP #2 after cooldown, verify 5-minute expiry enforcement
    clock += 61 * 1000;
    const issueRes2 = await callOtp({
      action: 'send_otp',
      email: 'chef@royalpalace.in',
      purpose: 'forgot_password',
      deviceId: 'dev_01',
    });
    assert.strictEqual(issueRes2.status, 200);
    const { challengeToken: token2 } = await issueRes2.json();

    clock += 5 * 60 * 1000 + 1000;
    const expiredRes = await callOtp({
      action: 'verify_otp',
      email: 'chef@royalpalace.in',
      otp: sentOtp,
      purpose: 'forgot_password',
      challengeToken: token2,
      deviceId: 'dev_01',
    });
    assert.strictEqual(expiredRes.status, 400);
    assert.strictEqual((await expiredRes.json()).expired, true);

    // Issue OTP #3 -> 3 wrong attempts -> 24-hour multi-vector lockout (ID, device, IP)
    clock += 61 * 1000;
    const issueRes3 = await callOtp({
      action: 'send_otp',
      email: 'victim@hotel.in',
      purpose: 'signup',
      deviceId: 'dev_lock_target',
    }, '198.51.100.77');
    assert.strictEqual(issueRes3.status, 200);
    const { challengeToken: token3 } = await issueRes3.json();
    const wrongOtp = sentOtp === '000000' ? '999999' : '000000';

    const w1 = await callOtp({ action: 'verify_otp', email: 'victim@hotel.in', otp: wrongOtp, purpose: 'signup', challengeToken: token3, deviceId: 'dev_lock_target' }, '198.51.100.77');
    assert.strictEqual(w1.status, 401);
    assert.strictEqual((await w1.json()).attemptsRemaining, 2);

    const w2 = await callOtp({ action: 'verify_otp', email: 'victim@hotel.in', otp: wrongOtp, purpose: 'signup', challengeToken: token3, deviceId: 'dev_lock_target' }, '198.51.100.77');
    assert.strictEqual(w2.status, 401);
    assert.strictEqual((await w2.json()).attemptsRemaining, 1);

    const w3 = await callOtp({ action: 'verify_otp', email: 'victim@hotel.in', otp: wrongOtp, purpose: 'signup', challengeToken: token3, deviceId: 'dev_lock_target' }, '198.51.100.77');
    assert.strictEqual(w3.status, 403);
    assert.strictEqual((await w3.json()).isBlocked, true);

    assert.ok(securityBlocks.has('id:victim@hotel.in'));
    assert.ok(securityBlocks.has('device:dev_lock_target'));
    assert.ok(securityBlocks.has('ip:198.51.100.77'));

    // Subsequent OTP request from blocked IP or device even with another email is blocked
    const blockedStatusRes = await callOtp({
      action: 'check_status',
      email: 'another@hotel.in',
      deviceId: 'dev_lock_target',
    }, '198.51.100.99');
    assert.strictEqual(blockedStatusRes.status, 200);
    assert.strictEqual((await blockedStatusRes.json()).isBlocked, true);
  });

  it('SEC-API-03: send-email-otp escapes HTML templates against XSS, prevents header injection, forces admin email & restricts CORS origins', async () => {
    const stores = sendEmailOtpHandler.createOtpStateStores();
    const sentEmails = [];
    const seedConsultations = {
      'BOOK-HJ-101': {
        id: 'BOOK-HJ-101',
        email: 'guest@dining.in',
        phone: '9876543210',
        restaurant_name: 'Royal Palace',
        owner_name: 'Royal',
        created_at: new Date().toISOString(),
      },
      'LEAD-HJ-101': {
        id: 'LEAD-HJ-101',
        email: 'karan@dhaba.in',
        phone: '9876543210',
        restaurant_name: 'Karan Dhaba',
        owner_name: 'Karan',
        created_at: new Date().toISOString(),
      },
    };
    const { client: adminMock } = createEmailOtpAdminMock({ seedConsultations });
    const envMap = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srv_test_signing_material_at_least_32_bytes_long',
      RESEND_API_KEY: 're_test_server_secret_token_777777',
      HARIT_JAL_ADMIN_EMAIL: 'info@haritjal.in',
      ALLOWED_ORIGINS: 'https://staging.haritjal.in',
    };

    // 1. CORS allowlist rejects arbitrary origin
    const evilCors = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil-attacker.test' },
      }),
      { getEnv: (k) => envMap[k], createAdminClient: () => adminMock, stores }
    );
    assert.strictEqual(evilCors.headers.get('Access-Control-Allow-Origin'), 'https://haritjal.in');

    // 2. Consultation confirmation HTML escapes XSS and strips CRLF
    const xssRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.30' },
        body: JSON.stringify({
          action: 'send_consultation_confirmation',
          booking: {
            id: 'BOOK-HJ-101',
            email: 'guest@dining.in',
            ownerName: '<script>alert(1)</script>',
            restaurantName: 'Royal<img src=x onerror=alert(2)>\r\nBcc: evil@evil.test',
            city: 'Delhi & NCR',
            preferredTime: '5 PM',
            phone: '9876543210',
          },
        }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (_url, init) => {
          sentEmails.push(JSON.parse(String(init?.body || '{}')));
          return new Response(JSON.stringify({ id: 'msg_tpl_1' }), { status: 200 });
        },
        stores,
      }
    );
    assert.strictEqual(xssRes.status, 200);
    assert.strictEqual(sentEmails[0].html.includes('<script>'), false);
    assert.ok(sentEmails[0].html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.strictEqual(/[\r\n]/.test(sentEmails[0].subject), false);

    // 3. Admin lead alert ignores arbitrary recipients and sends only to HARIT_JAL_ADMIN_EMAIL
    const adminAlertRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.30' },
        body: JSON.stringify({
          action: 'send_admin_lead_alert',
          to: 'attacker@evil.test',
          lead: {
            id: 'LEAD-HJ-101',
            customerName: '<b>Karan</b>',
            email: 'karan@dhaba.in',
            phone: '9876543210',
            businessName: 'Karan Dhaba',
          },
        }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (_url, init) => {
          sentEmails.push(JSON.parse(String(init?.body || '{}')));
          return new Response(JSON.stringify({ id: 'msg_tpl_2' }), { status: 200 });
        },
        stores,
      }
    );
    assert.strictEqual(adminAlertRes.status, 200);
    assert.deepStrictEqual(sentEmails[1].to, ['info@haritjal.in']);
    assert.strictEqual(sentEmails[1].html.includes('<b>Karan</b>'), false);
  });

  it('SEC-API-04: crm-sync keeps Sheets webhook/secret & Gemini key server-side, enforces AAL2 staff auth on integration_status & sanitizes formula injection', async () => {
    const rateStore = new Map();
    const superToken = makeFakeJwt({ sub: 'sa-1', aal: 'aal2' });
    const aal1Token = makeFakeJwt({ sub: 'sa-1', aal: 'aal1' });
    const customerToken = makeFakeJwt({ sub: 'cust-1', aal: 'aal2' });

    const adminMock = createCrmAdminMock(new Map([
      [superToken, { id: 'sa-1', email: 'root@haritjal.in', app_metadata: { role: 'super_admin', is_blocked: false } }],
      [aal1Token, { id: 'sa-1', email: 'root@haritjal.in', app_metadata: { role: 'super_admin', is_blocked: false } }],
      [customerToken, { id: 'cust-1', email: 'guest@hotel.in', app_metadata: { role: 'customer', is_blocked: false } }],
    ]), {
      seedConsultations: {
        'LEAD-HJ-777': {
          id: 'LEAD-HJ-777',
          email: 'chef@bistro.in',
          phone: '9876543210',
          restaurant_name: 'Bistro',
          owner_name: 'Chef',
          created_at: new Date().toISOString(),
        },
      },
    });

    // 1. Missing webhook secret -> 503 fail closed
    const missingWebhookRes = await crmSyncHandler.handleCrmSyncRequest(
      new Request('https://example.supabase.co/functions/v1/crm-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.40' },
        body: JSON.stringify({ action: 'sync_lead', lead: { businessName: 'Taj', phone: '9876543210' } }),
      }),
      { getEnv: () => undefined, rateLimitStore: rateStore }
    );
    assert.strictEqual(missingWebhookRes.status, 503);

    // 2. sync_lead injects server GOOGLE_SHEETS_WEBHOOK_SECRET & sanitizes formula cells
    let forwardedWebhookBody = null;
    const syncRes = await crmSyncHandler.handleCrmSyncRequest(
      new Request('https://example.supabase.co/functions/v1/crm-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.40' },
        body: JSON.stringify({
          action: 'sync_lead',
          spreadsheetId: 'sheet-123',
          lead: {
            id: 'LEAD-HJ-777',
            customerName: '=cmd|\'/C calc\'!A0',
            businessName: '+SUM(1,1) Bistro',
            email: 'chef@bistro.in',
            phone: '9876543210',
            customerRequirements: '@IMPORTXML("http://evil")',
          },
        }),
      }),
      {
        getEnv: (k) => ({
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'srv_test_signing_material_at_least_32_bytes_long',
          GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/server_only_script_id/exec',
          GOOGLE_SHEETS_WEBHOOK_SECRET: 'server_only_sheets_secret_xyz123',
        })[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (url, init) => {
          assert.strictEqual(String(url), 'https://script.google.com/macros/s/server_only_script_id/exec');
          forwardedWebhookBody = JSON.parse(String(init?.body || '{}'));
          return new Response(JSON.stringify({ success: true, status: 'success' }), { status: 200 });
        },
        rateLimitStore: rateStore,
      }
    );
    assert.strictEqual(syncRes.status, 200);
    assert.strictEqual(forwardedWebhookBody.webhookSecret, 'server_only_sheets_secret_xyz123');
    assert.strictEqual(forwardedWebhookBody.customerName.startsWith("'="), true);
    assert.strictEqual(forwardedWebhookBody.businessName.startsWith("'+"), true);
    assert.strictEqual(forwardedWebhookBody.customerRequirements.startsWith("'@"), true);

    // 3. integration_status authz: rejects anon/customer/AAL1; accepts AAL2 staff with boolean flags ONLY
    const callStatus = (token) =>
      crmSyncHandler.handleCrmSyncRequest(
        new Request('https://example.supabase.co/functions/v1/crm-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            origin: 'https://haritjal.in',
            'x-real-ip': '203.0.113.40',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ action: 'integration_status' }),
        }),
        {
          getEnv: (k) => ({
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'srv_test_signing_material_at_least_32_bytes_long',
            RESEND_API_KEY: 're_test_123456789',
            GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/abc/exec',
            GOOGLE_SHEETS_WEBHOOK_SECRET: 'secret_at_least_32_chars_base64_',
            GEMINI_API_KEY: 'AIzaTestServerOnlyKey1234567890',
          })[k],
          createAdminClient: () => adminMock,
          rateLimitStore: rateStore,
        }
      );

    assert.strictEqual((await callStatus(null)).status, 401);
    assert.strictEqual((await callStatus(customerToken)).status, 403);
    assert.strictEqual((await callStatus(aal1Token)).status, 403);

    const aal2Res = await callStatus(superToken);
    assert.strictEqual(aal2Res.status, 200);
    const aal2Json = await aal2Res.json();
    assert.deepStrictEqual(aal2Json, {
      success: true,
      integrations: {
        resendConfigured: true,
        sheetsWebhookConfigured: true,
        geminiConfigured: true,
      },
    });
    assert.strictEqual(JSON.stringify(aal2Json).includes('AIza'), false);
    assert.strictEqual(JSON.stringify(aal2Json).includes('re_test'), false);

    // 4. neer_ai_chat uses x-goog-api-key header (never URL query parameter)
    let geminiRequestUrl = '';
    let geminiApiKeyHeader = '';
    const aiRes = await crmSyncHandler.handleCrmSyncRequest(
      new Request('https://example.supabase.co/functions/v1/crm-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.41' },
        body: JSON.stringify({ action: 'neer_ai_chat', prompt: 'What MOQ applies to 500ml glass bottles?' }),
      }),
      {
        getEnv: (k) => ({
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'srv_test_signing_material_at_least_32_bytes_long',
          GEMINI_API_KEY: 'AIzaTestServerOnlyKey1234567890',
        })[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (url, init) => {
          geminiRequestUrl = String(url);
          geminiApiKeyHeader = init?.headers?.['x-goog-api-key'] || '';
          return new Response(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Minimum 500 cases.' }] } }] }),
            { status: 200 }
          );
        },
        rateLimitStore: rateStore,
      }
    );
    assert.strictEqual(aiRes.status, 200);
    assert.strictEqual(geminiRequestUrl.includes('?key='), false);
    assert.strictEqual(geminiApiKeyHeader, 'AIzaTestServerOnlyKey1234567890');
    assert.strictEqual((await aiRes.json()).reply, 'Minimum 500 cases.');
  });

  it('SEC-API-05: google-apps-script.js enforces Script Properties fail-closed and eliminates hardcoded fallback secrets', () => {
    const gasSrc = fs.readFileSync(path.join(ROOT_DIR, 'google-apps-script.js'), 'utf8');
    assert.strictEqual(gasSrc.includes('HARIT_JAL_SECURE_SYNC_2026'), false, 'Hardcoded webhook secret fallback must be eliminated');
    assert.ok(gasSrc.includes('PropertiesService.getScriptProperties()'));
    assert.ok(gasSrc.includes("getProperty('HARIT_JAL_WEBHOOK_SECRET')"));
    assert.ok(gasSrc.includes('if (!expectedSecret)'));
    assert.ok(gasSrc.includes("status: 'error'") || gasSrc.includes('status: "error"'));
    assert.ok(gasSrc.includes('incomingSecret !== expectedSecret'));
  });

  it('SEC-API-06: Frontend services fail closed without Supabase in production, scrub legacy secrets from localStorage & eliminate third-party QR URLs', async () => {
    // 1. env.ts allowlists only safe public VITE_* variables
    const envSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'env.ts'), 'utf8');
    assert.strictEqual(envSrc.includes('VITE_RESEND'), false);
    assert.strictEqual(envSrc.includes('VITE_GEMINI'), false);
    assert.strictEqual(envSrc.includes('VITE_GOOGLE_SHEETS'), false);
    assert.strictEqual(envService.readViteEnv('VITE_RESEND_API_KEY'), '');
    assert.strictEqual(envService.readViteEnv('VITE_GEMINI_API_KEY'), '');
    assert.strictEqual(envService.readViteEnv('SUPABASE_SERVICE_ROLE_KEY'), '');

    // 2. Fail-closed in production without configured Supabase
    process.env.VITE_APP_ENV = 'production';
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;

    const prodOtpRes = await OtpService.sendOtp('test@restaurant.in', 'signup');
    assert.strictEqual(prodOtpRes.success, false);
    assert.strictEqual('otp' in prodOtpRes, false);

    const prodVerifyRes = await OtpService.verifyOtp('test@restaurant.in', '123456', 'signup');
    assert.strictEqual(prodVerifyRes.success, false);

    const prodEmailRes = await ResendService.sendConsultationConfirmation({
      restaurantName: 'Taj',
      ownerName: 'Raj',
      email: 'raj@taj.in',
      phone: '9876543210',
      preferredTime: '4 PM',
      city: 'Delhi',
    });
    assert.strictEqual(prodEmailRes.success, false);

    const prodAdminRes = await ResendService.sendAdminLeadAlert({
      customerName: 'Raj',
      email: 'raj@taj.in',
      phone: '9876543210',
      businessName: 'Taj',
    });
    assert.strictEqual(prodAdminRes.success, false);

    // 3. Automatic localStorage legacy secret scrubbing on read
    globalThis.localStorage.setItem(
      'harit_jal_automation_config_v1',
      JSON.stringify({
        adminEmail: 'info@haritjal.in',
        googleSheetsWebhookUrl: 'https://script.google.com/macros/s/leaked/exec',
        emailProviderApiKey: 're_legacy_secret',
        aiProviderApiKey: 'AIzaLegacyKey',
      })
    );
    const autoCfg = AutomationService.getConfig();
    assert.strictEqual('googleSheetsWebhookUrl' in autoCfg, false);
    assert.strictEqual('emailProviderApiKey' in autoCfg, false);
    assert.strictEqual('aiProviderApiKey' in autoCfg, false);
    const scrubbedAutoRaw = globalThis.localStorage.getItem('harit_jal_automation_config_v1') || '';
    assert.strictEqual(scrubbedAutoRaw.includes('re_legacy_secret'), false);
    assert.strictEqual(scrubbedAutoRaw.includes('script.google.com'), false);

    globalThis.localStorage.setItem(
      'harit_jal_sheets_config_v1',
      JSON.stringify({ webhookUrl: 'https://script.google.com/macros/s/legacy/exec', autoSync: true })
    );
    const sheetsCfg = StorageService.getSheetsConfig();
    assert.strictEqual('webhookUrl' in sheetsCfg, false);
    assert.strictEqual((globalThis.localStorage.getItem('harit_jal_sheets_config_v1') || '').includes('webhookUrl'), false);

    globalThis.localStorage.setItem(
      'harit_jal_neer_config_v1',
      JSON.stringify({ provider: 'gemini', geminiApiKey: 'AIzaLegacyKey123456' })
    );
    const aiCfg = NeerAIService.getAIConfig();
    assert.strictEqual('geminiApiKey' in aiCfg, false);
    assert.strictEqual((globalThis.localStorage.getItem('harit_jal_neer_config_v1') || '').includes('AIzaLegacyKey'), false);

    globalThis.localStorage.setItem('harit_jal_otp_records_v1', JSON.stringify({ test: { otp: '654321' } }));
    OtpService.getOtpRecords();
    assert.strictEqual(globalThis.localStorage.getItem('harit_jal_otp_records_v1'), null);

    // 4. TOTP service never transmits secret to external api.qrserver.com
    assert.strictEqual(TotpService.getQrCodeUrl('otpauth://totp/HaritJal:a@b.in?secret=JBSWY3DPEHPK3PXP'), '');
  });

  it('SEC-API-07: Frontend source, dist/ bundles, CSP, .gitignore & .env files contain zero secret keys, direct external secret URLs, or source maps', () => {
    // 1. Scan all frontend src/ files
    const srcFiles = collectFilesRecursive(path.join(ROOT_DIR, 'src'));
    const forbiddenSrcPatterns = [
      /VITE_RESEND_[A-Z0-9_]+/,
      /VITE_GEMINI_[A-Z0-9_]+/,
      /VITE_GOOGLE_SHEETS_[A-Z0-9_]+/,
      /SERVICE_ROLE/i,
      /HARIT_JAL_SECURE_SYNC_2026/,
      /AKfycbz_HaritJal_LiveSync/,
      /\bre_[A-Za-z0-9]{12,}/,
      /\bAIza[0-9A-Za-z_-]{15,}/,
      /generativelanguage\.googleapis\.com/,
      /api\.qrserver\.com/,
      /api\.resend\.com/,
    ];
    for (const file of srcFiles) {
      if (file.endsWith('resendService.ts')) continue; // header comment documents negative rule
      const content = fs.readFileSync(file, 'utf8');
      for (const pat of forbiddenSrcPatterns) {
        assert.strictEqual(pat.test(content), false, `Forbidden pattern ${pat} matched in ${path.relative(ROOT_DIR, file)}`);
      }
    }

    // 2. CSP tightened in index.html
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    for (const removedOrigin of ['api.qrserver.com', 'api.resend.com', 'script.google.com', 'generativelanguage.googleapis.com']) {
      assert.strictEqual(indexHtml.includes(removedOrigin), false, `index.html CSP must omit ${removedOrigin}`);
    }

    // 3. Built dist/ directory check (0 .map files & 0 leaked patterns)
    const distDir = path.join(ROOT_DIR, 'dist');
    assert.ok(fs.existsSync(distDir), 'dist/ directory must exist after build');
    const distFiles = collectFilesRecursive(distDir);
    assert.strictEqual(distFiles.some((f) => f.endsWith('.map')), false, 'Source maps (.map) must not exist in dist/');

    const forbiddenBundlePatterns = [
      /VITE_RESEND_API_KEY/,
      /VITE_GEMINI_API_KEY/,
      /VITE_GOOGLE_SHEETS_WEBHOOK_URL/,
      /RESEND_API_KEY/,
      /OTP_SIGNING_SECRET/,
      /GOOGLE_SHEETS_WEBHOOK_SECRET/,
      /GEMINI_API_KEY/,
      /SUPABASE_SERVICE_ROLE_KEY/,
      /HARIT_JAL_SECURE_SYNC_2026/,
      /AKfycbz_HaritJal_LiveSync/,
      /re_your_resend/i,
      /\bre_[A-Za-z0-9]{12,}/,
      /\bAIza[0-9A-Za-z_-]{15,}/,
      /api\.resend\.com/,
      /api\.qrserver\.com/,
      /script\.google\.com/,
      /generativelanguage\.googleapis\.com/,
    ];
    for (const file of distFiles) {
      if (!/\.(js|css|html)$/i.test(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      for (const pat of forbiddenBundlePatterns) {
        assert.strictEqual(pat.test(content), false, `Compiled artifact ${path.relative(ROOT_DIR, file)} leaked ${pat}`);
      }
    }

    // 4. .gitignore & .env / .env.example hygiene
    const gitignore = fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8');
    assert.ok(gitignore.includes('.env'));
    assert.ok(gitignore.includes('supabase/functions/.env'));

    const envExample = fs.readFileSync(path.join(ROOT_DIR, '.env.example'), 'utf8');
    assert.strictEqual(envExample.includes('RESEND'), false);
    assert.strictEqual(envExample.includes('GEMINI'), false);
    assert.strictEqual(envExample.includes('SERVICE_ROLE'), false);

    if (fs.existsSync(path.join(ROOT_DIR, '.env'))) {
      const rootEnvLines = fs.readFileSync(path.join(ROOT_DIR, '.env'), 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
      const allowedPublicKeys = new Set([
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
        'VITE_SITE_URL',
        'VITE_APP_ENV',
      ]);
      for (const line of rootEnvLines) {
        const key = line.split('=')[0].trim();
        assert.ok(allowedPublicKeys.has(key), `Root .env must not contain server/secret key: ${key}`);
      }
    }
  });
});
