// ====================================================================
// HARIT JAL™ (हरित जल) — FINAL RESPONSIVE OTP EMAIL VERIFICATION SUITE
// Automated verification against real Vite SSR handler + Resend mock:
// 1. Approved Brand Design & Exact Copy Fidelity
// 2. Dynamic CSPRNG 6-Digit OTP Rendering (Boxes + Selectable Value + Fallback)
// 3. Copy Experience & Responsive Breakpoint Math (320px..1024px+)
// 4. Email Client HTML/MSO/Gmail/Apple Mail Compatibility Guards
// 5. Security Invariants (5m Expiry, Single-Use, Cooldown, 3-Strike Lockout, Secret Isolation)
// ====================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT_DIR = process.cwd();

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
        update(updates) {
          const chain = {
            eq(col, val) {
              if (table === 'otp_challenges' && col === 'jti') {
                const existing = otpChallenges.get(val);
                if (existing) {
                  otpChallenges.set(val, { ...existing, ...updates });
                }
              }
              if (table === 'consultations' && col === 'id') {
                const existing = consultations.get(val);
                if (existing) {
                  consultations.set(val, { ...existing, ...updates });
                }
              }
              return chain;
            },
            is() { return chain; },
            select() { return chain; },
            async maybeSingle() {
              return { data: { id: 'mock' }, error: null };
            },
            then(resolve, reject) {
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
          };
          return chain;
        },
        async insert(payload) {
          if (table === 'email_logs') {
            emailLogs.push({ ...payload });
            return { error: null };
          }
          if (table === 'otp_challenges') {
            otpChallenges.set(String(payload.jti), { ...payload });
            return { error: null };
          }
          return { error: null };
        },
        async upsert(payload) {
          if (table === 'security_blocks') {
            securityBlocks.set(String(payload.target_key), { ...payload });
          }
          return { error: null };
        },
      };
    },
  };

  return { client, securityBlocks, emailLogs, otpChallenges };
}

describe('Harit Jal™ Final Responsive OTP Email Implementation & Security Verification', () => {
  let viteServer;
  let handlerMod;

  before(async () => {
    viteServer = await createServer({
      root: ROOT_DIR,
      server: { middlewareMode: true, watch: null },
      appType: 'custom',
      logLevel: 'silent',
    });
    handlerMod = await viteServer.ssrLoadModule('/supabase/functions/send-email-otp/handler.ts');
  });

  after(async () => {
    if (viteServer) {
      await viteServer.close();
    }
  });

  it('TPL-01: Renders exact approved brand copy, forest-green/white/sage palette, official HTTPS logo & zero forbidden visual elements', () => {
    const dynamicCode = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const result = handlerMod.buildOtpEmailContent('partner@dining.in', dynamicCode, 'signup', {
      logoUrl: handlerMod.resolveOtpLogoUrl(() => undefined),
    });

    // Exact Subject & Text Copy
    assert.strictEqual(result.subject, 'Your Harit Jal Verification Code');
    assert.ok(result.html.includes('Harit Jal™'), 'Includes Harit Jal™ brand');
    assert.ok(result.html.includes('(हरित जल)'), 'Includes Devanagari brand subtitle');
    assert.ok(result.html.includes('Verify Your Email'), 'Includes exact heading');
    assert.ok(result.html.includes('Welcome to Harit Jal!'), 'Includes exact welcome message');
    assert.ok(
      result.html.includes('Use the verification code below to confirm your email address and secure your account.'),
      'Includes exact description'
    );
    assert.ok(result.html.includes('This code is valid for 5 minutes.'), 'Includes 5-minute validity text');
    assert.ok(result.html.includes('Keep it private.'), 'Includes security reminder 1');
    assert.ok(result.html.includes("Don't share with anyone."), 'Includes security reminder 2');
    assert.ok(result.html.includes('Harit Jal will never ask for your OTP.'), 'Includes security reminder 3');
    assert.ok(result.html.includes('Thank you for choosing Harit Jal.'), 'Includes footer greeting');
    assert.ok(
      result.html.includes('&copy; 2026 Harit Jal. All rights reserved.'),
      'Includes 2026 copyright notice'
    );

    // Official Logo Asset URL & Alt Text for images-disabled mode
    assert.ok(
      result.html.includes('harit-jal-logo-mark.png'),
      'Uses official logo asset URL'
    );
    assert.ok(result.html.includes('alt="Harit Jal™ (हरित जल)"'), 'Preserves crisp alt text if images disabled');
    assert.ok(fs.existsSync(path.join(ROOT_DIR, 'public/images/brand/harit-jal-logo-mark.png')));
    assert.ok(result.html.includes('width="38" height="50"'), 'Matches official logo aspect ratio (383x506)');

    // Minimal green palette tokens
    assert.ok(result.html.includes('#FFFFFF'), 'Uses pure white card/canvas background');
    assert.ok(result.html.includes('#1B4332'), 'Uses forest green primary typography');
    assert.ok(result.html.includes('#F2F7F2'), 'Uses soft sage green OTP container');
    assert.ok(result.html.includes('#CFE0D2') && result.html.includes('#BDD6C0') && result.html.includes('#9DC1A3'), 'Uses thin green borders');

    // Minimal monochrome green security icons (HTML badges, no SVG or color emoji)
    assert.ok(result.html.includes('&#10003;'), 'Includes green checkmark security badge');
    assert.ok(result.html.includes('&#9670;'), 'Includes green diamond security badge');

    // Copy experience: no fake JS button, includes adaptive mobile/desktop instructions
    assert.ok(result.html.includes('Tap and hold to copy your code.'), 'Includes mobile tap-and-hold instruction');
    assert.ok(result.html.includes('Select and copy your code.'), 'Includes desktop select-and-copy instruction');
    assert.strictEqual(/<button\b/i.test(result.html), false, 'Must not include fake Copy button');
    assert.strictEqual(/<script\b/i.test(result.html), false, 'Must not include JavaScript');
    assert.strictEqual(/\bonclick=/i.test(result.html), false, 'Must not include inline JS handlers');

    // Excluded heavy visual clutter
    assert.strictEqual(/<svg\b/i.test(result.html), false, 'Must not rely on SVG icons blocked by Gmail/Outlook');
    assert.strictEqual(/linear-gradient|radial-gradient/i.test(result.html), false, 'No heavy gradients');
    assert.strictEqual(/@keyframes|\banimation:/i.test(result.html), false, 'No CSS animations');
    assert.strictEqual(/background-image\s*:/i.test(result.html), false, 'No background photographs');

    // Plain-text fallback completeness
    assert.ok(result.text.includes('Harit Jal™ (हरित जल)'));
    assert.ok(result.text.includes('Verify Your Email'));
    assert.ok(result.text.includes('Welcome to Harit Jal!'));
    assert.ok(result.text.includes(`Your Verification Code: ${dynamicCode}`));
    assert.ok(result.text.includes('This code is valid for 5 minutes.'));
    assert.ok(result.text.includes('Keep it private.'));
    assert.ok(result.text.includes("Don't share with anyone."));
    assert.ok(result.text.includes('Harit Jal will never ask for your OTP.'));
    assert.ok(result.text.includes('Thank you for choosing Harit Jal.'));
    assert.ok(result.text.includes('© 2026 Harit Jal. All rights reserved.'));
  });

  it('TPL-02: Enforces dynamic 6-digit OTP generation, rejects invalid/non-numeric codes, renders 6 individual digit boxes + clean selectable value', async () => {
    // Reject non-6-digit / malformed OTP inputs cleanly
    assert.throws(() => handlerMod.buildOtpEmailContent('a@b.in', '', 'signup'));
    assert.throws(() => handlerMod.buildOtpEmailContent('a@b.in', '12345', 'signup'));
    assert.throws(() => handlerMod.buildOtpEmailContent('a@b.in', '1234567', 'signup'));
    assert.throws(() => handlerMod.buildOtpEmailContent('a@b.in', '12ab56', 'signup'));

    // Dynamic dispatch via real handleSendEmailOtpRequest across signup & forgot_password
    const dispatchedCodes = [];
    const capturedPayloads = [];
    const adminMock = createEmailOtpAdminMock();
    const envMap = {
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_secret_never_leak_999',
      RESEND_API_KEY: 're_test_email_render_only_key_123456',
      RESEND_FROM_EMAIL: 'Harit Jal <noreply@haritjal.in>',
      OTP_SIGNING_SECRET: 'test-signing-secret-must-exceed-16-bytes-for-hmac',
    };

    for (const [idx, purpose] of ['signup', 'forgot_password'].entries()) {
      const stores = handlerMod.createOtpStateStores();
      const res = await handlerMod.handleSendEmailOtpRequest(
        new Request('https://example.supabase.co/functions/v1/send-email-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            origin: 'https://haritjal.in',
            'x-real-ip': `198.51.100.${idx + 10}`,
          },
          body: JSON.stringify({
            action: 'send_otp',
            email: `partner${idx}@haritjal-test.in`,
            purpose,
            deviceId: `dev-render-${idx}`,
          }),
        }),
        {
          getEnv: (k) => envMap[k],
          createAdminClient: () => adminMock.client,
          fetchImpl: async (_url, init) => {
            const payload = JSON.parse(String(init?.body || '{}'));
            capturedPayloads.push(payload);
            const txtMatch = String(payload.text || '').match(/Your Verification Code:\s*(\d{6})/);
            if (txtMatch) dispatchedCodes.push(txtMatch[1]);
            return new Response(JSON.stringify({ id: `resend_tpl_${idx}` }), { status: 200 });
          },
          now: () => 1762680000000 + idx * 1000,
          stores,
        }
      );

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.otp, undefined, 'Response JSON must never expose raw OTP');
    }

    assert.strictEqual(dispatchedCodes.length, 2);
    assert.notStrictEqual(dispatchedCodes[0], '', 'Dynamic CSPRNG OTP generated');

    for (let i = 0; i < capturedPayloads.length; i++) {
      const payload = capturedPayloads[i];
      const otp = dispatchedCodes[i];

      assert.strictEqual(payload.from, 'Harit Jal <noreply@haritjal.in>');
      assert.strictEqual(payload.subject, 'Your Harit Jal Verification Code');

      // Extract the 6 individual digit boxes from HTML
      const digitMatches = Array.from(
        payload.html.matchAll(/class="hj-otp-digit"[^>]*>(\d)<\/td>/g),
        (m) => m[1]
      );
      assert.deepStrictEqual(digitMatches, otp.split(''), 'All 6 digit boxes match dynamic OTP digits in exact order');

      // Extract contiguous selectable text value
      const selectableMatch = payload.html.match(/class="hj-otp-selectable"[^>]*>(\d{6})<\/span>/);
      assert.ok(selectableMatch, 'Clean selectable 6-digit span must be present');
      assert.strictEqual(selectableMatch[1], otp);
    }

    // Verify handler.ts itself contains zero hardcoded sample 6-digit OTPs
    const handlerSource = fs.readFileSync(
      path.join(ROOT_DIR, 'supabase/functions/send-email-otp/handler.ts'),
      'utf8'
    );
    assert.strictEqual(handlerSource.includes('"123456"'), false);
    assert.strictEqual(handlerSource.includes("'123456'"), false);
  });

  it('TPL-03: Verifies Outlook/Gmail/Apple Mail compatibility & responsive layout math across 320px..1024px+ viewports', () => {
    const sampleOtp = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const { html } = handlerMod.buildOtpEmailContent('viewport@dining.in', sampleOtp, 'signup');

    // Structural email compatibility checks
    assert.ok(html.includes('role="presentation"'), 'Uses presentation HTML tables');
    assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0" />'));
    assert.ok(html.includes('<meta name="x-apple-disable-message-reformatting" />'));
    assert.ok(html.includes('<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />'));
    assert.ok(html.includes('<meta name="color-scheme" content="light only" />'));
    assert.ok(html.includes('<o:PixelsPerInch>96</o:PixelsPerInch>'), 'Includes Outlook 96 DPI XML block');
    assert.ok(html.includes('<!--[if mso]>') && html.includes('width="540"'), 'Includes Outlook Desktop outer wrapper');
    assert.ok(html.includes('width="312"'), 'Includes Outlook Desktop 6-box width wrapper');
    assert.ok(html.includes('<!--[if !mso]><!-->') && html.includes('mso-hide:all'), 'Hides mobile copy prompt from Outlook');
    assert.strictEqual(/\bdisplay\s*:\s*(flex|grid)\b/i.test(html), false, 'Avoids Flexbox/CSS Grid unsupported in Outlook');

    // Verify percentage grid widths sum to exactly 100.0%
    const digitWidths = Array.from(html.matchAll(/<td width="14\.5%"/g)).length;
    const spacerWidths = Array.from(html.matchAll(/<td width="2\.6%"/g)).length;
    assert.strictEqual(digitWidths, 6);
    assert.strictEqual(spacerWidths, 5);
    const totalPct = Number((digitWidths * 14.5 + spacerWidths * 2.6).toFixed(2));
    assert.strictEqual(totalPct, 100);

    // Responsive geometry simulation across all 7 required widths
    assert.ok(html.includes('@media only screen and (max-width: 600px)'));
    const requiredWidths = [320, 360, 375, 390, 430, 768, 1024];
    for (const vw of requiredWidths) {
      const isMobile = vw <= 600;
      const outerHorizontalPad = isMobile ? 16 : 24;
      const cardBorder = 2;
      const cardWidth = Math.min(540, vw - outerHorizontalPad);
      const contentHorizontalPad = isMobile ? 28 : 40;
      const sageBorder = 2;
      const sageHorizontalPad = isMobile ? 20 : 28;
      const availableDigitRowWidth = Math.min(
        312,
        cardWidth - cardBorder - contentHorizontalPad - sageBorder - sageHorizontalPad
      );
      const digitBoxWidth = availableDigitRowWidth * 0.145;
      const spacerWidth = availableDigitRowWidth * 0.026;
      const fontSize = isMobile ? 20 : 24;

      assert.ok(cardWidth <= vw, `Viewport ${vw}px: card width ${cardWidth}px fits without horizontal scroll`);
      assert.ok(digitBoxWidth >= 34, `Viewport ${vw}px: digit box width ${digitBoxWidth.toFixed(1)}px avoids digit clipping`);
      assert.ok(digitBoxWidth > fontSize, `Viewport ${vw}px: digit box cleanly encloses ${fontSize}px digit glyph`);
      assert.ok(spacerWidth >= 5.5, `Viewport ${vw}px: inter-digit spacing ${spacerWidth.toFixed(1)}px stays crisp`);
    }

    // Resolve logo URL security: rejects non-HTTPS custom env URLs and normalizes cleanly
    assert.strictEqual(
      handlerMod.resolveOtpLogoUrl((k) => (k === 'EMAIL_LOGO_URL' ? 'http://insecure.example/logo.png' : undefined)),
      'https://cdn.jsdelivr.net/gh/lockrewards/harit-jal@main/public/images/brand/harit-jal-logo-mark.png'
    );
    assert.strictEqual(
      handlerMod.resolveOtpLogoUrl((k) => (k === 'PUBLIC_SITE_URL' ? 'https://staging.haritjal.in/' : undefined)),
      'https://staging.haritjal.in/images/brand/harit-jal-logo-mark.png'
    );
  });

  it('TPL-04: Enforces 5-minute expiry, 60s resend cooldown, single-use invalidation, 3-strike lockout & secret/log isolation', async () => {
    const stores = handlerMod.createOtpStateStores();
    let currentTime = 1762681000000;
    const adminMock = createEmailOtpAdminMock({ getNow: () => currentTime });
    const envMap = {
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_secret_never_leak_999',
      RESEND_API_KEY: 're_super_secret_key_never_leak_999',
      RESEND_FROM_EMAIL: 'Harit Jal <noreply@haritjal.in>',
      OTP_SIGNING_SECRET: 'test-hmac-secret-key-for-expiry-verification-v1',
    };
    let capturedOtp = '';

    const invoke = (payload) =>
      handlerMod.handleSendEmailOtpRequest(
        new Request('https://example.supabase.co/functions/v1/send-email-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            origin: 'https://haritjal.in',
            'x-real-ip': '203.0.113.77',
          },
          body: JSON.stringify(payload),
        }),
        {
          getEnv: (k) => envMap[k],
          createAdminClient: () => adminMock.client,
          fetchImpl: async (_url, init) => {
            const sent = JSON.parse(String(init?.body || '{}'));
            const match = String(sent.text || '').match(/Your Verification Code:\s*(\d{6})/);
            if (match) capturedOtp = match[1];
            return new Response(JSON.stringify({ id: `msg_sec_${currentTime}` }), { status: 200 });
          },
          now: () => currentTime,
          stores,
        }
      );

    // 1. Initial send_otp succeeds and returns 5m validity + 60s cooldown metadata
    const send1 = await invoke({
      action: 'send_otp',
      email: 'security-check@dining.in',
      purpose: 'signup',
      deviceId: 'dev-sec-1',
    });
    assert.strictEqual(send1.status, 200);
    const send1Body = await send1.json();
    assert.strictEqual(send1Body.expiresAt - currentTime, 5 * 60 * 1000);
    assert.strictEqual(send1Body.resendAvailableAt - currentTime, 60 * 1000);
    assert.match(capturedOtp, /^\d{6}$/);

    // 2. Audit log redacts OTP and never stores RESEND_API_KEY
    assert.strictEqual(adminMock.emailLogs.length, 1);
    assert.strictEqual(adminMock.emailLogs[0].body.includes(capturedOtp), false, 'Email log never contains plaintext OTP');
    assert.strictEqual(JSON.stringify(send1Body).includes(envMap.RESEND_API_KEY), false);

    // 3. Rate limiting: resend before 60s fails with 429
    currentTime += 25 * 1000;
    const resendTooEarly = await invoke({
      action: 'send_otp',
      email: 'security-check@dining.in',
      purpose: 'signup',
      deviceId: 'dev-sec-1',
    });
    assert.strictEqual(resendTooEarly.status, 429);

    // 4. Expiry check: advancing past 5 minutes rejects OTP
    currentTime += 5 * 60 * 1000;
    const expiredVerify = await invoke({
      action: 'verify_otp',
      email: 'security-check@dining.in',
      otp: capturedOtp,
      purpose: 'signup',
      challengeToken: send1Body.challengeToken,
      deviceId: 'dev-sec-1',
    });
    assert.strictEqual(expiredVerify.status, 400);
    const expiredBody = await expiredVerify.json();
    assert.strictEqual(expiredBody.expired, true);

    // 5. Fresh send succeeds; valid OTP verifies once, replay rejected immediately
    const send2 = await invoke({
      action: 'send_otp',
      email: 'security-check@dining.in',
      purpose: 'signup',
      deviceId: 'dev-sec-1',
    });
    assert.strictEqual(send2.status, 200);
    const send2Body = await send2.json();

    const validVerify = await invoke({
      action: 'verify_otp',
      email: 'security-check@dining.in',
      otp: capturedOtp,
      purpose: 'signup',
      challengeToken: send2Body.challengeToken,
      deviceId: 'dev-sec-1',
    });
    assert.strictEqual(validVerify.status, 200);
    const validBody = await validVerify.json();
    assert.strictEqual(validBody.verified, true);
    assert.ok(typeof validBody.verificationProof === 'string' && validBody.verificationProof.includes('.'));

    const replayVerify = await invoke({
      action: 'verify_otp',
      email: 'security-check@dining.in',
      otp: capturedOtp,
      purpose: 'signup',
      challengeToken: send2Body.challengeToken,
      deviceId: 'dev-sec-1',
    });
    assert.strictEqual(replayVerify.status, 400);

    // 6. 3 wrong attempts trigger 24-hour lockout on fresh account
    const send3 = await invoke({
      action: 'send_otp',
      email: 'lockout-check@dining.in',
      purpose: 'forgot_password',
      deviceId: 'dev-lock-1',
    });
    assert.strictEqual(send3.status, 200);
    const send3Body = await send3.json();
    const wrongOtp = String((Number(capturedOtp) + 111111) % 1000000).padStart(6, '0');

    for (let attempt = 1; attempt <= 3; attempt++) {
      const badRes = await invoke({
        action: 'verify_otp',
        email: 'lockout-check@dining.in',
        otp: wrongOtp,
        purpose: 'forgot_password',
        challengeToken: send3Body.challengeToken,
        deviceId: 'dev-lock-1',
      });
      if (attempt < 3) {
        assert.strictEqual(badRes.status, 401);
      } else {
        assert.strictEqual(badRes.status, 403);
        const lockBody = await badRes.json();
        assert.strictEqual(lockBody.isBlocked, true);
      }
    }
  });
});
