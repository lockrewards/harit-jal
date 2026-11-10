// ====================================================================
// HARIT JAL™ (हरित जल) — PHASE 1H.8.3 SECURITY REMEDIATION TEST SUITE
// Automated verification covering:
// 1. Task 1: OTP Signing Secret Hardening (fail-closed, >= 32 bytes, no fallback, key rotation, generic 503)
// 2. Task 2: Cloudflare Turnstile Security Hardening (environment-specific, fail-closed, no testing secrets in prod)
// ====================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const ROOT_DIR = process.cwd();

describe('HARIT JAL™ Phase 1H.8.3 Security Remediation Verification Suite', () => {
  let viteServer;
  let sendEmailOtpHandler;
  let crmSyncHandler;

  before(async () => {
    viteServer = await createServer({
      root: ROOT_DIR,
      server: { middlewareMode: true, watch: null },
      appType: 'custom',
      logLevel: 'silent',
    });
    sendEmailOtpHandler = await viteServer.ssrLoadModule('/supabase/functions/send-email-otp/handler.ts');
    crmSyncHandler = await viteServer.ssrLoadModule('/supabase/functions/crm-sync/handler.ts');

    assert.ok(typeof sendEmailOtpHandler.handleSendEmailOtpRequest === 'function');
    assert.ok(typeof sendEmailOtpHandler.resolveHmacKeys === 'function');
    assert.ok(typeof sendEmailOtpHandler.validateAndImportSigningSecret === 'function');
    assert.ok(typeof sendEmailOtpHandler.verifyOptionalTurnstile === 'function');
    assert.ok(typeof crmSyncHandler.handleCrmSyncRequest === 'function');
    assert.ok(typeof crmSyncHandler.verifyOptionalTurnstile === 'function');
  });

  after(async () => {
    if (viteServer) {
      await viteServer.close();
    }
  });

  function createAdminMock(customRpcHandler = null) {
    const memoryBlocks = new Map();
    const memoryChallenges = new Map();

    const client = {
      from: (table) => ({
        select: (_cols) => {
          const filters = {};
          const chain = {
            eq(col, val) {
              filters[col] = val;
              return chain;
            },
            order() { return chain; },
            limit() { return chain; },
            is() { return chain; },
            gte() { return chain; },
            in(_col, values) {
              return Promise.resolve({ data: values.map((v) => memoryBlocks.get(v)).filter(Boolean), error: null });
            },
            maybeSingle: async () => {
              if (table === 'otp_challenges') {
                if (filters.jti) {
                  return { data: memoryChallenges.get(filters.jti) || null, error: null };
                }
                const matches = Array.from(memoryChallenges.values()).filter(
                  (c) => (!filters.email || c.email === filters.email) && (!filters.purpose || c.purpose === filters.purpose)
                );
                return { data: matches[0] || null, error: null };
              }
              return { data: null, error: null };
            },
            single: async () => {
              return { data: null, error: null };
            },
          };
          return chain;
        },
        insert: async (rows) => {
          if (table === 'otp_challenges') {
            const list = Array.isArray(rows) ? rows : [rows];
            for (const r of list) {
              memoryChallenges.set(r.jti, { ...r, attempts: 0, used: false });
            }
          }
          return { data: rows, error: null };
        },
        update: (updates) => ({
          eq: async (col, val) => {
            if (table === 'otp_challenges' && col === 'jti') {
              const row = memoryChallenges.get(val);
              if (row) memoryChallenges.set(val, { ...row, ...updates });
            }
            return { data: null, error: null };
          },
        }),
      }),
      rpc: async (fn, args) => {
        if (customRpcHandler) {
          const custom = await customRpcHandler(fn, args);
          if (custom !== undefined) return custom;
        }

        if (fn === 'consume_edge_rate_limit') {
          return { data: [{ allowed: true, current_tokens: 1, retry_after_seconds: 0 }], error: null };
        }
        if (fn === 'check_security_block') {
          return { data: [{ is_blocked: false, blocked_by: null, blocked_until: null, remaining_ms: 0 }], error: null };
        }
        if (fn === 'verify_otp_challenge_attempt') {
          const row = memoryChallenges.get(args.p_jti);
          if (!row) {
            return { data: [{ outcome: 'not_found', attempts_remaining: 0, blocked_until: null }], error: null };
          }
          if (row.used) {
            return { data: [{ outcome: 'already_used', attempts_remaining: 0, blocked_until: null }], error: null };
          }
          if (row.otp_hash !== args.p_otp_hash) {
            row.attempts = (row.attempts || 0) + 1;
            const remaining = Math.max(0, 3 - row.attempts);
            return { data: [{ outcome: 'wrong_code', attempts_remaining: remaining, blocked_until: null }], error: null };
          }
          row.used = true;
          return { data: [{ outcome: 'verified', attempts_remaining: 3, blocked_until: null }], error: null };
        }
        return { data: null, error: null };
      },
      auth: {
        getUser: async () => ({ data: { user: null }, error: new Error('No auth user') }),
      },
    };

    return { client, memoryChallenges, memoryBlocks };
  }

  // ====================================================================
  // TASK 1: OTP SIGNING SECRET HARDENING TESTS
  // ====================================================================

  it('SEC-OTP-01: validateAndImportSigningSecret strictly enforces >= 32 UTF-8 bytes (256 bits)', () => {
    // Missing / undefined / null
    assert.strictEqual(sendEmailOtpHandler.validateAndImportSigningSecret(undefined), null);
    assert.strictEqual(sendEmailOtpHandler.validateAndImportSigningSecret(''), null);
    assert.strictEqual(sendEmailOtpHandler.validateAndImportSigningSecret('   '), null);

    // Weak (< 32 bytes)
    assert.strictEqual(sendEmailOtpHandler.validateAndImportSigningSecret('short-secret-16b'), null);
    assert.strictEqual(sendEmailOtpHandler.validateAndImportSigningSecret('1234567890123456789012345678901'), null); // 31 chars

    // Valid (>= 32 bytes)
    const exact32 = sendEmailOtpHandler.validateAndImportSigningSecret('12345678901234567890123456789012'); // 32 chars
    assert.ok(exact32 instanceof Uint8Array);
    assert.strictEqual(exact32.byteLength, 32);

    const hex64 = sendEmailOtpHandler.validateAndImportSigningSecret('a'.repeat(64));
    assert.ok(hex64 instanceof Uint8Array);
    assert.strictEqual(hex64.byteLength, 64);
  });

  it('SEC-OTP-02: resolveHmacKeys removes all fallback derivation from SUPABASE_SERVICE_ROLE_KEY', async () => {
    // Only SUPABASE_SERVICE_ROLE_KEY provided, OTP_SIGNING_SECRET missing
    const keysFallbackAttempt = await sendEmailOtpHandler.resolveHmacKeys((key) => {
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'srv_master_key_never_fallback_derive_999999';
      return undefined;
    });
    assert.strictEqual(keysFallbackAttempt, null, 'Must return null and NEVER derive key from service role');

    // Backward-compatible resolveHmacKey also returns null
    const singleKeyFallback = await sendEmailOtpHandler.resolveHmacKey((key) => {
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'srv_master_key_never_fallback_derive_999999';
      return undefined;
    });
    assert.strictEqual(singleKeyFallback, null);
  });

  it('SEC-OTP-03: send_otp fails closed with generic 503 when OTP_SIGNING_SECRET is missing, empty, or weak', async () => {
    const { client: adminMock } = createAdminMock();

    const testCases = [
      { name: 'Missing secret', secret: undefined },
      { name: 'Empty secret', secret: '' },
      { name: 'Weak secret (16 bytes)', secret: 'weak_secret_16b' },
      { name: 'Weak secret (31 bytes)', secret: '1234567890123456789012345678901' },
    ];

    for (const tc of testCases) {
      const res = await sendEmailOtpHandler.handleSendEmailOtpRequest(
        new Request('https://example.supabase.co/functions/v1/send-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.190' },
          body: JSON.stringify({ action: 'send_otp', email: 'owner@test.in', purpose: 'signup' }),
        }),
        {
          getEnv: (k) => ({
            APP_ENV: 'test',
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'test_srv_key_must_not_be_used_for_hmac',
            OTP_SIGNING_SECRET: tc.secret,
          })[k],
          createAdminClient: () => adminMock,
        }
      );

      assert.strictEqual(res.status, 503, `${tc.name} must return HTTP 503`);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error, 'Service temporarily unavailable. Please try again shortly.');
      // Never expose secret or internal env var names
      const rawBody = JSON.stringify(json);
      assert.strictEqual(rawBody.includes('OTP_SIGNING_SECRET'), false);
      assert.strictEqual(rawBody.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
    }
  });

  it('SEC-OTP-04: send_otp and verify_otp succeed with valid 32+ byte OTP_SIGNING_SECRET', async () => {
    const { client: adminMock } = createAdminMock();
    let sentOtp = '';

    const validSecret = 'valid-256-bit-hmac-secret-for-harit-jal-production-v1';
    assert.ok(new TextEncoder().encode(validSecret).byteLength >= 32);

    const envMap = {
      APP_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test_srv_key_not_used_for_signing_9999',
      OTP_SIGNING_SECRET: validSecret,
      RESEND_API_KEY: 're_valid_test_key_12345678',
    };

    // 1. Issue OTP
    const sendRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.191' },
        body: JSON.stringify({ action: 'send_otp', email: 'partner@test.in', purpose: 'signup' }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (_url, init) => {
          const parsed = JSON.parse(String(init?.body || '{}'));
          const match = String(parsed.text || '').match(/\b(\d{6})\b/);
          if (match) sentOtp = match[1];
          return new Response(JSON.stringify({ id: 'msg_sec_01' }), { status: 200 });
        },
      }
    );

    assert.strictEqual(sendRes.status, 200);
    const sendJson = await sendRes.json();
    assert.strictEqual(sendJson.success, true);
    assert.ok(sendJson.challengeToken);
    assert.strictEqual('otp' in sendJson, false, 'OTP must never be in HTTP response');
    assert.ok(/^\d{6}$/.test(sentOtp));

    // 2. Verify OTP
    const verifyRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.191' },
        body: JSON.stringify({
          action: 'verify_otp',
          email: 'partner@test.in',
          purpose: 'signup',
          otp: sentOtp,
          challengeToken: sendJson.challengeToken,
        }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: () => adminMock,
      }
    );

    assert.strictEqual(verifyRes.status, 200);
    const verifyJson = await verifyRes.json();
    assert.strictEqual(verifyJson.success, true);
    assert.strictEqual(verifyJson.verified, true);
  });

  it('SEC-OTP-05: Rejects invalid signature and payload tampering', async () => {
    const { client: adminMock } = createAdminMock();
    const validSecret = 'valid-256-bit-hmac-secret-for-harit-jal-production-v1';

    const envMap = {
      APP_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test_srv_key',
      OTP_SIGNING_SECRET: validSecret,
      RESEND_API_KEY: 're_test_key',
    };

    // Issue a genuine token
    let challengeToken = '';
    let sentOtp = '';
    const sendRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.192' },
        body: JSON.stringify({ action: 'send_otp', email: 'tamper@test.in', purpose: 'signup' }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (_url, init) => {
          const match = String(init?.body || '').match(/\b(\d{6})\b/);
          if (match) sentOtp = match[1];
          return new Response(JSON.stringify({ id: 'msg_01' }), { status: 200 });
        },
      }
    );
    const sendJson = await sendRes.json();
    challengeToken = sendJson.challengeToken;

    // 1. Signature tampering: modify last characters of signature
    const [payloadB64, sigB64] = challengeToken.split('.');
    const tamperedSigToken = `${payloadB64}.${sigB64.slice(0, -4)}AAAA`;
    const sigTamperRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.192' },
        body: JSON.stringify({ action: 'verify_otp', email: 'tamper@test.in', purpose: 'signup', otp: sentOtp, challengeToken: tamperedSigToken }),
      }),
      { getEnv: (k) => envMap[k], createAdminClient: () => adminMock }
    );
    assert.strictEqual(sigTamperRes.status, 400);
    const sigTamperJson = await sigTamperRes.json();
    assert.strictEqual(sigTamperJson.error, 'Invalid or tampered OTP challenge token. Please request a new OTP.');

    // 2. Payload tampering: decode payload, change email, re-encode with original signature
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    decoded.email = 'attacker@evil.in';
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const tamperedPayloadToken = `${tamperedPayloadB64}.${sigB64}`;

    const payloadTamperRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.192' },
        body: JSON.stringify({ action: 'verify_otp', email: 'attacker@evil.in', purpose: 'signup', otp: sentOtp, challengeToken: tamperedPayloadToken }),
      }),
      { getEnv: (k) => envMap[k], createAdminClient: () => adminMock }
    );
    assert.strictEqual(payloadTamperRes.status, 400);
  });

  it('SEC-OTP-06: Zero-downtime key rotation via OTP_SIGNING_SECRET_PREVIOUS', async () => {
    const { client: adminMock } = createAdminMock();

    const previousKeyRaw = 'rotation-previous-key-secret-32-chars-long-01';
    const newPrimaryKeyRaw = 'rotation-new-primary-key-secret-32-chars-long-02';

    // 1. Issue token under old primary key
    let tokenIssuedUnderOldKey = '';
    let oldOtp = '';
    const oldEnv = {
      APP_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test_srv_key',
      OTP_SIGNING_SECRET: previousKeyRaw,
      RESEND_API_KEY: 're_test_key',
    };
    const oldSendRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.193' },
        body: JSON.stringify({ action: 'send_otp', email: 'rotation@test.in', purpose: 'signup' }),
      }),
      {
        getEnv: (k) => oldEnv[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (_url, init) => {
          const match = String(init?.body || '').match(/\b(\d{6})\b/);
          if (match) oldOtp = match[1];
          return new Response(JSON.stringify({ id: 'msg_rot_1' }), { status: 200 });
        },
      }
    );
    tokenIssuedUnderOldKey = (await oldSendRes.json()).challengeToken;

    // 2. Secret rotated: new key becomes OTP_SIGNING_SECRET, old key becomes OTP_SIGNING_SECRET_PREVIOUS
    const rotatedEnv = {
      APP_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test_srv_key',
      OTP_SIGNING_SECRET: newPrimaryKeyRaw,
      OTP_SIGNING_SECRET_PREVIOUS: previousKeyRaw,
      RESEND_API_KEY: 're_test_key',
    };

    // 3. Verify in-flight token issued before rotation succeeds with previousKey
    const inFlightVerifyRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.193' },
        body: JSON.stringify({
          action: 'verify_otp',
          email: 'rotation@test.in',
          purpose: 'signup',
          otp: oldOtp,
          challengeToken: tokenIssuedUnderOldKey,
        }),
      }),
      {
        getEnv: (k) => rotatedEnv[k],
        createAdminClient: () => adminMock,
      }
    );
    assert.strictEqual(inFlightVerifyRes.status, 200);
    const inFlightJson = await inFlightVerifyRes.json();
    assert.strictEqual(inFlightJson.success, true);
    assert.strictEqual(inFlightJson.verified, true);

    // 4. Token signed with an untrusted third key fails completely
    const thirdKeyRaw = 'untrusted-third-key-secret-32-chars-long-03';
    const fakeThirdToken = await sendEmailOtpHandler.signChallengePayload(
      await crypto.subtle.importKey('raw', new TextEncoder().encode(thirdKeyRaw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
      { jti: 'fake-jti', email: 'rotation@test.in', purpose: 'signup', iat: Date.now(), exp: Date.now() + 300000, otpHash: 'abc' }
    );
    const fakeVerifyRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.193' },
        body: JSON.stringify({
          action: 'verify_otp',
          email: 'rotation@test.in',
          purpose: 'signup',
          otp: '123456',
          challengeToken: fakeThirdToken,
        }),
      }),
      {
        getEnv: (k) => rotatedEnv[k],
        createAdminClient: () => adminMock,
      }
    );
    assert.strictEqual(fakeVerifyRes.status, 400);

    // 5. Newly issued challenge in rotated environment is signed with NEW primary key
    let newOtp = '';
    const newSendRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.194' },
        body: JSON.stringify({ action: 'send_otp', email: 'newprimary@test.in', purpose: 'signup' }),
      }),
      {
        getEnv: (k) => rotatedEnv[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (_url, init) => {
          const match = String(init?.body || '').match(/\b(\d{6})\b/);
          if (match) newOtp = match[1];
          return new Response(JSON.stringify({ id: 'msg_rot_2' }), { status: 200 });
        },
      }
    );
    const newChallengeToken = (await newSendRes.json()).challengeToken;
    assert.ok(/^\d{6}$/.test(newOtp));
    const ring = await sendEmailOtpHandler.resolveHmacKeys((k) => rotatedEnv[k]);
    const verified = await sendEmailOtpHandler.verifySignedToken(ring, newChallengeToken);
    assert.strictEqual(verified.usedPreviousKey, false, 'New challenges must be signed with primary key');
  });

  it('SEC-OTP-07: Single-use replay protection defense', async () => {
    const { client: adminMock } = createAdminMock();
    const validSecret = 'valid-256-bit-hmac-secret-for-harit-jal-production-v1';
    const envMap = {
      APP_ENV: 'test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test_srv_key',
      OTP_SIGNING_SECRET: validSecret,
      RESEND_API_KEY: 're_test_key',
    };

    let sentOtp = '';
    const sendRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.195' },
        body: JSON.stringify({ action: 'send_otp', email: 'replay@test.in', purpose: 'signup' }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: () => adminMock,
        fetchImpl: async (_url, init) => {
          const match = String(init?.body || '').match(/\b(\d{6})\b/);
          if (match) sentOtp = match[1];
          return new Response(JSON.stringify({ id: 'msg_01' }), { status: 200 });
        },
      }
    );
    const { challengeToken } = await sendRes.json();

    // First verify succeeds
    const firstVerify = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.195' },
        body: JSON.stringify({ action: 'verify_otp', email: 'replay@test.in', purpose: 'signup', otp: sentOtp, challengeToken }),
      }),
      { getEnv: (k) => envMap[k], createAdminClient: () => adminMock }
    );
    assert.strictEqual(firstVerify.status, 200);

    // Second verify with same token is rejected (already_used)
    const replayVerify = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.195' },
        body: JSON.stringify({ action: 'verify_otp', email: 'replay@test.in', purpose: 'signup', otp: sentOtp, challengeToken }),
      }),
      { getEnv: (k) => envMap[k], createAdminClient: () => adminMock }
    );
    assert.strictEqual(replayVerify.status, 400);
    const replayJson = await replayVerify.json();
    assert.strictEqual(replayJson.success, false);
    assert.ok(replayJson.error.includes('already been used'));
  });

  // ====================================================================
  // TASK 2: CLOUDFLARE TURNSTILE SECURITY HARDENING TESTS
  // ====================================================================

  it('SEC-TRN-01: Production fails closed when TURNSTILE_SECRET_KEY is missing or empty', async () => {
    // Both send-email-otp and crm-sync
    const mockDepsOtp = {
      getEnv: (k) => ({ APP_ENV: 'production', TURNSTILE_SECRET_KEY: '' })[k],
    };
    const mockDepsCrm = {
      getEnv: (k) => ({ APP_ENV: 'production', TURNSTILE_SECRET_KEY: undefined })[k],
    };

    const otpResult = await sendEmailOtpHandler.verifyOptionalTurnstile(mockDepsOtp, 'valid-token', '203.0.113.10');
    assert.strictEqual(otpResult, false, 'send-email-otp must fail closed when Turnstile secret is missing in production');

    const crmResult = await crmSyncHandler.verifyOptionalTurnstile(mockDepsCrm, 'valid-token', '203.0.113.10');
    assert.strictEqual(crmResult, false, 'crm-sync must fail closed when Turnstile secret is missing in production');
  });

  it('SEC-TRN-02: Production fails closed when Turnstile token is missing or empty', async () => {
    const mockDeps = {
      getEnv: (k) => ({
        APP_ENV: 'production',
        TURNSTILE_SECRET_KEY: '0x4AAAAAAAPROD_SECRET_KEY_PRODUCTION_ONLY_99999',
      })[k],
    };

    assert.strictEqual(await sendEmailOtpHandler.verifyOptionalTurnstile(mockDeps, '', '203.0.113.10'), false);
    assert.strictEqual(await sendEmailOtpHandler.verifyOptionalTurnstile(mockDeps, null, '203.0.113.10'), false);
    assert.strictEqual(await sendEmailOtpHandler.verifyOptionalTurnstile(mockDeps, undefined, '203.0.113.10'), false);
    assert.strictEqual(await crmSyncHandler.verifyOptionalTurnstile(mockDeps, '   ', '203.0.113.10'), false);
  });

  it('SEC-TRN-03: Production strictly forbids Cloudflare testing secrets (1x/2x/3x)', async () => {
    const testSecrets = [
      '1x0000000000000000000000000000000AA', // Always passes
      '2x0000000000000000000000000000000AA', // Always fails
      '3x0000000000000000000000000000000AA', // Token already spent
    ];

    for (const testSec of testSecrets) {
      const mockDeps = {
        getEnv: (k) => ({
          APP_ENV: 'production',
          TURNSTILE_SECRET_KEY: testSec,
        })[k],
        fetchImpl: async () => {
          throw new Error('fetch should never be reached in production when test secrets are provided');
        },
      };

      const otpRes = await sendEmailOtpHandler.verifyOptionalTurnstile(mockDeps, 'some-token', '203.0.113.10');
      assert.strictEqual(otpRes, false, `send-email-otp must reject testing secret ${testSec} in production`);

      const crmRes = await crmSyncHandler.verifyOptionalTurnstile(mockDeps, 'some-token', '203.0.113.10');
      assert.strictEqual(crmRes, false, `crm-sync must reject testing secret ${testSec} in production`);
    }
  });

  it('SEC-TRN-04: Production fails closed on Cloudflare rejection (invalid token)', async () => {
    const mockDeps = {
      getEnv: (k) => ({
        APP_ENV: 'production',
        TURNSTILE_SECRET_KEY: '0x4AAAAAAAPROD_REAL_SECRET_KEY_FOR_TEST',
      })[k],
      fetchImpl: async () =>
        new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 }),
    };

    const otpRes = await sendEmailOtpHandler.verifyOptionalTurnstile(mockDeps, 'invalid-token', '203.0.113.10');
    assert.strictEqual(otpRes, false);

    const crmRes = await crmSyncHandler.verifyOptionalTurnstile(mockDeps, 'invalid-token', '203.0.113.10');
    assert.strictEqual(crmRes, false);
  });

  it('SEC-TRN-05: Production fails closed on Cloudflare network timeout or HTTP 5xx error', async () => {
    // 1. Network timeout / exception
    const mockTimeoutDeps = {
      getEnv: (k) => ({
        APP_ENV: 'production',
        TURNSTILE_SECRET_KEY: '0x4AAAAAAAPROD_REAL_SECRET_KEY_FOR_TEST',
      })[k],
      fetchImpl: async () => {
        throw new Error('Cloudflare network connection timed out after 5000ms');
      },
    };
    assert.strictEqual(
      await sendEmailOtpHandler.verifyOptionalTurnstile(mockTimeoutDeps, 'some-token', '203.0.113.10'),
      false,
      'Must fail closed on network timeout'
    );
    assert.strictEqual(
      await crmSyncHandler.verifyOptionalTurnstile(mockTimeoutDeps, 'some-token', '203.0.113.10'),
      false,
      'Must fail closed on network timeout'
    );

    // 2. HTTP 500 from Cloudflare
    const mock500Deps = {
      getEnv: (k) => ({
        APP_ENV: 'production',
        TURNSTILE_SECRET_KEY: '0x4AAAAAAAPROD_REAL_SECRET_KEY_FOR_TEST',
      })[k],
      fetchImpl: async () => new Response('Internal Server Error', { status: 500 }),
    };
    assert.strictEqual(await sendEmailOtpHandler.verifyOptionalTurnstile(mock500Deps, 'some-token', '203.0.113.10'), false);
    assert.strictEqual(await crmSyncHandler.verifyOptionalTurnstile(mock500Deps, 'some-token', '203.0.113.10'), false);
  });

  it('SEC-TRN-06: Staging environment permits official Cloudflare test credentials', async () => {
    let capturedBody = null;
    const mockDeps = {
      getEnv: (k) => ({
        APP_ENV: 'staging',
        TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      })[k],
      fetchImpl: async (_url, init) => {
        capturedBody = JSON.parse(String(init?.body || '{}'));
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      },
    };

    const otpRes = await sendEmailOtpHandler.verifyOptionalTurnstile(mockDeps, 'staging-token-123', '203.0.113.10');
    assert.strictEqual(otpRes, true, 'Staging must allow official Cloudflare test secret when siteverify succeeds');
    assert.strictEqual(capturedBody.secret, '1x0000000000000000000000000000000AA');
    assert.strictEqual(capturedBody.response, 'staging-token-123');

    const crmRes = await crmSyncHandler.verifyOptionalTurnstile(mockDeps, 'staging-token-123', '203.0.113.10');
    assert.strictEqual(crmRes, true);
  });

  it('SEC-TRN-07: Development environment allows explicit bypass with safe warning', async () => {
    const mockDevDeps = {
      getEnv: (k) => ({
        APP_ENV: 'development',
        TURNSTILE_SECRET_KEY: '',
      })[k],
    };

    // Missing secret in dev -> bypass with warning
    const otpRes = await sendEmailOtpHandler.verifyOptionalTurnstile(mockDevDeps, '', '127.0.0.1');
    assert.strictEqual(otpRes, true, 'Development must allow bypass when explicitly configured');

    const crmRes = await crmSyncHandler.verifyOptionalTurnstile(mockDevDeps, '', '127.0.0.1');
    assert.strictEqual(crmRes, true);

    // Bypass token also accepted in dev
    const mockDevWithToken = {
      getEnv: (k) => ({ APP_ENV: 'development', TURNSTILE_SECRET_KEY: 'some-key' })[k],
    };
    assert.strictEqual(await sendEmailOtpHandler.verifyOptionalTurnstile(mockDevWithToken, 'dev-turnstile-bypass', '127.0.0.1'), true);
  });

  it('SEC-TRN-08: Production CANNOT use development bypass tokens', async () => {
    const mockProdDeps = {
      getEnv: (k) => ({
        APP_ENV: 'production',
        TURNSTILE_SECRET_KEY: '',
      })[k],
    };

    // Even if client passes 'dev-turnstile-bypass', production fails closed because secret is missing
    const otpRes = await sendEmailOtpHandler.verifyOptionalTurnstile(mockProdDeps, 'dev-turnstile-bypass', '203.0.113.10');
    assert.strictEqual(otpRes, false, 'Production must NEVER allow development bypass token');

    const crmRes = await crmSyncHandler.verifyOptionalTurnstile(mockProdDeps, 'dev-turnstile-bypass', '203.0.113.10');
    assert.strictEqual(crmRes, false, 'Production must NEVER allow development bypass token');
  });

  it('SEC-TRN-09: Never infers development mode merely from a missing secret', async () => {
    // Explicit environment variable resolution
    assert.strictEqual(sendEmailOtpHandler.resolveEdgeEnvironment(() => 'production'), 'production');
    assert.strictEqual(sendEmailOtpHandler.resolveEdgeEnvironment(() => 'staging'), 'staging');
    assert.strictEqual(sendEmailOtpHandler.resolveEdgeEnvironment(() => 'development'), 'development');
    assert.strictEqual(sendEmailOtpHandler.resolveEdgeEnvironment(() => 'test'), 'test');

    // Missing secret in production environment MUST fail closed and NEVER fall back to development bypass
    const prodMissingSecretDeps = {
      getEnv: (k) => ({ APP_ENV: 'production', TURNSTILE_SECRET_KEY: '' })[k],
    };
    assert.strictEqual(
      await sendEmailOtpHandler.verifyOptionalTurnstile(prodMissingSecretDeps, 'token_xyz', '198.51.100.1'),
      false,
      'Production with missing secret must never bypass Turnstile'
    );
    assert.strictEqual(
      await crmSyncHandler.verifyOptionalTurnstile(prodMissingSecretDeps, 'token_xyz', '198.51.100.1'),
      false,
      'Production with missing secret must never bypass Turnstile in CRM sync'
    );
  });
});
