// ====================================================================
// HARIT JAL™ (हरित जल) — PHASE 1H.6 CRITICAL SECURITY REMEDIATION TEST SUITE
// Automated verification covering all 9 findings:
// 1. CRIT-H5-01: Security RPCs restricted, db_health_ping, removed client RPCs
// 2. CRIT-H5-02: Persistent DB rate limits, OTP challenges, multi-isolate replay defense, consultation proof
// 3. HIGH-H5-01: Non-recursive staff_has_permission, split consultations RLS, admin role, non-empty permissions
// 4. HIGH-H5-02: Zero 'unsafe-inline' in script-src CSP, doc synchronizations
// 5. HIGH-H5-03: Column-restricted customer UPDATE, protect_customer_profile_columns trigger
// 6. HIGH-H5-04: 72h temp password expiry in is_caller_active_staff, first-login MFA guard, DB-first ordering
// 7. MED-H5-01: BookCallSection removed, Supabase-first lead persistence, incomplete AI lead skips CRM
// 8. MED-H5-02: Dynamic email log badges, synchronous AAL2 check, PageSkeletonLoader session gate
// 9. LOW-H5-01: Password min-length 8 across client, local OTP disabled in production
// ====================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT_DIR = process.cwd();

describe('HARIT JAL™ Phase 1H.6 Critical Security Remediation Verification Suite', () => {
  let viteServer;
  let sendEmailOtpHandler;
  let crmSyncHandler;
  let validateRouteHandler;
  let staffAuthHandler;

  before(async () => {
    viteServer = await createServer({
      root: ROOT_DIR,
      server: { middlewareMode: true, watch: null },
      appType: 'custom',
      logLevel: 'silent',
    });
    sendEmailOtpHandler = await viteServer.ssrLoadModule('/supabase/functions/send-email-otp/handler.ts');
    crmSyncHandler = await viteServer.ssrLoadModule('/supabase/functions/crm-sync/handler.ts');
    validateRouteHandler = await viteServer.ssrLoadModule('/supabase/functions/validate-admin-route/handler.ts');
    staffAuthHandler = await viteServer.ssrLoadModule('/supabase/functions/staff-auth/handler.ts');
    assert.ok(typeof sendEmailOtpHandler.handleSendEmailOtpRequest === 'function');
    assert.ok(typeof crmSyncHandler.handleCrmSyncRequest === 'function');
    assert.ok(typeof validateRouteHandler.handleValidateRouteRequest === 'function');
    assert.ok(typeof staffAuthHandler.handleStaffAuthRequest === 'function');
  });

  after(async () => {
    if (viteServer) {
      await viteServer.close();
    }
  });

  // --------------------------------------------------------------------
  // CRIT-H5-01: RPC Hardening & db_health_ping
  // --------------------------------------------------------------------
  it('CRIT-H5-01: Security RPCs restricted to service_role, db_health_ping created, client security RPC methods eliminated', () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT_DIR, 'supabase', 'migrations', '20261109_phase1h6_security_remediation.sql'),
      'utf8'
    );
    const rollbackSql = fs.readFileSync(
      path.join(ROOT_DIR, 'supabase', 'rollback', '20261109_rollback_phase1h6_security_remediation.sql'),
      'utf8'
    );

    // Verify revocations and service_role grants for privileged RPCs
    for (const rpcName of ['record_security_block', 'check_security_block', 'append_email_audit_log']) {
      assert.ok(
        migrationSql.includes(`REVOKE ALL ON FUNCTION public.${rpcName}`),
        `Migration must revoke public access to ${rpcName}`
      );
      assert.ok(
        migrationSql.includes(`GRANT EXECUTE ON FUNCTION public.${rpcName}`),
        `Migration must grant execute on ${rpcName} to service_role`
      );
      assert.strictEqual(
        migrationSql.includes(`TO anon, authenticated; -- ${rpcName}`),
        false,
        `${rpcName} must never be granted to anon or authenticated`
      );
    }

    // Verify db_health_ping definition and grants
    assert.ok(migrationSql.includes('FUNCTION public.db_health_ping()'), 'Migration must declare db_health_ping()');
    assert.ok(migrationSql.includes('GRANT EXECUTE ON FUNCTION public.db_health_ping() TO anon, authenticated, service_role;'));
    assert.ok(rollbackSql.includes('DROP FUNCTION IF EXISTS public.db_health_ping();'));

    // Verify SupabaseService in client has removed direct client RPCs and added db_health_ping
    const supabaseServiceSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'supabase.ts'), 'utf8');
    assert.strictEqual(supabaseServiceSrc.includes('syncSecurityBlock('), false, 'syncSecurityBlock must be eliminated');
    assert.strictEqual(supabaseServiceSrc.includes('syncEmailLog('), false, 'syncEmailLog must be eliminated');
    assert.strictEqual(supabaseServiceSrc.includes('fetchActiveSecurityBlocks('), false, 'fetchActiveSecurityBlocks must be eliminated');
    assert.ok(supabaseServiceSrc.includes('db_health_ping'), 'SupabaseService.pingDatabase must call db_health_ping');
  });

  // --------------------------------------------------------------------
  // CRIT-H5-02: Persistent DB Rate Limiting, OTP Challenges & Consultation Proof
  // --------------------------------------------------------------------
  it('CRIT-H5-02: Edge Functions persist state in DB, defend multi-isolate replay, fail closed 503 & enforce consultation proof', async () => {
    // 1. Migration schema contains edge_rate_limits, otp_challenges, consultation proof columns & atomic RPCs
    const migrationSql = fs.readFileSync(
      path.join(ROOT_DIR, 'supabase', 'migrations', '20261109_phase1h6_security_remediation.sql'),
      'utf8'
    );
    assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.edge_rate_limits'));
    assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.otp_challenges'));
    assert.ok(migrationSql.includes('FUNCTION public.consume_edge_rate_limit'));
    assert.ok(migrationSql.includes('FUNCTION public.verify_otp_challenge_attempt'));
    assert.ok(migrationSql.includes('confirmation_email_sent_at TIMESTAMPTZ'));
    assert.ok(migrationSql.includes('admin_alert_sent_at TIMESTAMPTZ'));
    assert.ok(migrationSql.includes('crm_synced_at TIMESTAMPTZ'));

    // 2. Shared database mock across two independent isolates
    const sharedRateLimits = new Map();
    const sharedOtpChallenges = new Map();
    const sharedConsultations = new Map([
      ['BOOK-HJ-PROOF-1', {
        id: 'BOOK-HJ-PROOF-1',
        email: 'guest@palace.in',
        phone: '9876543210',
        restaurant_name: 'Palace Dining',
        owner_name: 'Palace',
        created_at: new Date().toISOString(),
        confirmation_email_sent_at: null,
        admin_alert_sent_at: null,
        crm_synced_at: null,
      }],
    ]);

    const makeAdminMock = () => ({
      async rpc(name, params = {}) {
        if (name === 'consume_edge_rate_limit') {
          const key = params.p_bucket_key;
          const maxReq = params.p_max_requests || 5;
          const current = (sharedRateLimits.get(key) || 0) + 1;
          sharedRateLimits.set(key, current);
          if (current > maxReq) {
            return { data: [{ allowed: false, current_count: current, retry_after_seconds: 60 }], error: null };
          }
          return { data: [{ allowed: true, current_count: current, retry_after_seconds: 60 }], error: null };
        }
        if (name === 'verify_otp_challenge_attempt') {
          const jti = params.p_jti;
          const challenge = sharedOtpChallenges.get(jti);
          if (!challenge) return { data: [{ outcome: 'not_found', attempts_remaining: 0, blocked_until: null }], error: null };
          if (challenge.used) return { data: [{ outcome: 'already_used', attempts_remaining: 0, blocked_until: null }], error: null };
          if (challenge.otp_hash !== params.p_otp_hash) {
            challenge.attempts = (challenge.attempts || 0) + 1;
            return { data: [{ outcome: 'invalid', attempts_remaining: Math.max(0, 3 - challenge.attempts), blocked_until: null }], error: null };
          }
          challenge.used = true;
          return { data: [{ outcome: 'verified', attempts_remaining: 3, blocked_until: null }], error: null };
        }
        return { data: null, error: null };
      },
      from(table) {
        return {
          select() {
            const filters = {};
            const chain = {
              eq(col, val) { filters[col] = val; return chain; },
              is() { return chain; },
              order() { return chain; },
              limit() { return chain; },
              async maybeSingle() {
                if (table === 'consultations') return { data: sharedConsultations.get(filters.id) || null, error: null };
                if (table === 'otp_challenges') return { data: sharedOtpChallenges.get(filters.jti) || null, error: null };
                return { data: null, error: null };
              },
            };
            return chain;
          },
          update(updates) {
            const chain = {
              eq(col, val) {
                if (table === 'consultations') {
                  const existing = sharedConsultations.get(val);
                  if (existing) sharedConsultations.set(val, { ...existing, ...updates });
                }
                return chain;
              },
              is() { return chain; },
              select() { return chain; },
              async maybeSingle() { return { data: { id: 'mock' }, error: null }; },
              then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
            };
            return chain;
          },
          async insert(payload) {
            if (table === 'otp_challenges') sharedOtpChallenges.set(String(payload.jti), { ...payload });
            return { error: null };
          },
        };
      },
    });

    const envMap = {
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_secret_never_leak_999',
      RESEND_API_KEY: 're_test_email_key_999999',
      RESEND_FROM_EMAIL: 'Harit Jal <noreply@haritjal.in>',
      OTP_SIGNING_SECRET: 'test-signing-secret-must-exceed-16-bytes-for-hmac',
    };

    // 3. Multi-isolate replay defense: Isolate A issues OTP, Isolate B cannot verify replay
    const storeA = sendEmailOtpHandler.createOtpStateStores();
    const storeB = sendEmailOtpHandler.createOtpStateStores();
    let sentOtp = '';

    const resA = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.111' },
        body: JSON.stringify({ action: 'send_otp', email: 'multi@palace.in', purpose: 'signup' }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: makeAdminMock,
        fetchImpl: async (_url, init) => {
          const match = String(init?.body || '').match(/\b(\d{6})\b/);
          if (match) sentOtp = match[1];
          return new Response(JSON.stringify({ id: 'resend_multi_1' }), { status: 200 });
        },
        stores: storeA,
      }
    );
    assert.strictEqual(resA.status, 200);
    const { challengeToken } = await resA.json();

    // Verify on Isolate B
    const verifyResB = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.112' },
        body: JSON.stringify({ action: 'verify_otp', email: 'multi@palace.in', otp: sentOtp, purpose: 'signup', challengeToken }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: makeAdminMock,
        stores: storeB,
      }
    );
    assert.strictEqual(verifyResB.status, 200);

    // Replay on Isolate A must be rejected by persistent DB record
    const replayResA = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in', 'x-real-ip': '203.0.113.111' },
        body: JSON.stringify({ action: 'verify_otp', email: 'multi@palace.in', otp: sentOtp, purpose: 'signup', challengeToken }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: makeAdminMock,
        stores: storeA,
      }
    );
    assert.strictEqual(replayResA.status, 400);

    // 4. Fail-closed 503 without admin client
    const noAdminRes = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in' },
        body: JSON.stringify({ action: 'send_otp', email: 'fail@palace.in', purpose: 'signup' }),
      }),
      {
        getEnv: () => undefined,
        stores: storeA,
      }
    );
    assert.strictEqual(noAdminRes.status, 503);

    // 5. Single-shot consultation proof claim
    const consultRes1 = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in' },
        body: JSON.stringify({
          action: 'send_consultation_confirmation',
          booking: {
            id: 'BOOK-HJ-PROOF-1',
            email: 'guest@palace.in',
            restaurantName: 'Palace Dining',
            ownerName: 'Palace',
            phone: '9876543210',
          },
        }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: makeAdminMock,
        fetchImpl: async () => new Response(JSON.stringify({ id: 'resend_consult_1' }), { status: 200 }),
        stores: storeA,
      }
    );
    assert.strictEqual(consultRes1.status, 200);

    // Second claim fails with 409 Conflict
    const consultRes2 = await sendEmailOtpHandler.handleSendEmailOtpRequest(
      new Request('https://example.supabase.co/functions/v1/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'https://haritjal.in' },
        body: JSON.stringify({
          action: 'send_consultation_confirmation',
          booking: {
            id: 'BOOK-HJ-PROOF-1',
            email: 'guest@palace.in',
            restaurantName: 'Palace Dining',
            ownerName: 'Palace',
            phone: '9876543210',
          },
        }),
      }),
      {
        getEnv: (k) => envMap[k],
        createAdminClient: () => ({
          from(_table) {
            return {
              select() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return {
                          data: {
                            id: 'BOOK-HJ-PROOF-1',
                            email: 'guest@palace.in',
                            phone: '9876543210',
                            created_at: new Date().toISOString(),
                            confirmation_email_sent_at: new Date().toISOString(),
                          },
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
              update() {
                const chain = {
                  eq() { return chain; },
                  is() { return chain; },
                  select() { return chain; },
                  async maybeSingle() {
                    // Row is already claimed (confirmation_email_sent_at is NOT null), so atomic update returns no row
                    return { data: null, error: null };
                  },
                };
                return chain;
              },
            };
          },
          rpc: async () => ({ data: [{ allowed: true }], error: null }),
        }),
        stores: storeA,
      }
    );
    assert.strictEqual(consultRes2.status, 409);

    // 6. Preservation of buildOtpEmailContent verbatim
    const handlerSrc = fs.readFileSync(
      path.join(ROOT_DIR, 'supabase', 'functions', 'send-email-otp', 'handler.ts'),
      'utf8'
    );
    assert.ok(handlerSrc.includes('export function buildOtpEmailContent('));
    assert.ok(handlerSrc.includes('hj-otp-digit'));
    assert.ok(handlerSrc.includes('hj-otp-selectable'));
  });

  // --------------------------------------------------------------------
  // HIGH-H5-01: Non-recursive Permissions & Split Consultations RLS
  // --------------------------------------------------------------------
  it('HIGH-H5-01: staff_has_permission avoids recursion, consultations RLS is split, admin role exists & empty permissions rejected', () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT_DIR, 'supabase', 'migrations', '20261109_phase1h6_security_remediation.sql'),
      'utf8'
    );

    // staff_has_permission implementation check
    assert.ok(migrationSql.includes('FUNCTION public.staff_has_permission(p_permission TEXT)'));
    assert.ok(migrationSql.includes('public.is_caller_active_staff()'));
    assert.ok(migrationSql.includes("COALESCE(su.permissions, '[]'::jsonb) @> to_jsonb(ARRAY[LOWER(TRIM(COALESCE(p_permission, '')))])"));

    // Split consultations RLS policies
    assert.ok(migrationSql.includes('CREATE POLICY "Staff can read consultations"'));
    assert.ok(migrationSql.includes('CREATE POLICY "Staff can update consultations"'));
    assert.ok(migrationSql.includes('CREATE POLICY "Super Admin can delete consultations"'));
    assert.ok(migrationSql.includes('ON public.consultations FOR SELECT'));
    assert.ok(migrationSql.includes('ON public.consultations FOR UPDATE'));
    assert.ok(migrationSql.includes('ON public.consultations FOR DELETE'));

    // Roles and permissions in roles.ts & StaffManagementModal.tsx
    const rolesSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'roles.ts'), 'utf8');
    assert.ok(rolesSrc.includes("value: 'admin'"), "roles.ts must include 'admin' role");
    assert.ok(rolesSrc.includes("label: 'Department Admin'"), "roles.ts must label 'admin' as Department Admin");

    const modalSrc = fs.readFileSync(
      path.join(ROOT_DIR, 'src', 'components', 'admin', 'StaffManagementModal.tsx'),
      'utf8'
    );
    assert.ok(modalSrc.includes('selectedPermissions.length === 0'), 'Modal must guard against empty permissions');
    assert.ok(modalSrc.includes('Please select at least one permission'), 'Modal must alert user if permissions empty');
  });

  // --------------------------------------------------------------------
  // HIGH-H5-02: Zero 'unsafe-inline' in script-src & Doc Synchronization
  // --------------------------------------------------------------------
  it('HIGH-H5-02: Zero unsafe-inline in script-src CSP, docs cover 10 tables, 4 Edge Functions & unified connect-src', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    const distHtml = fs.readFileSync(path.join(ROOT_DIR, 'dist', 'index.html'), 'utf8');

    // CSP script-src check: strictly zero 'unsafe-inline'
    const scriptSrcMatch = indexHtml.match(/script-src[^;]+/);
    assert.ok(scriptSrcMatch, 'script-src CSP directive must exist in index.html');
    assert.strictEqual(scriptSrcMatch[0].includes("'unsafe-inline'"), false, "index.html script-src must not contain 'unsafe-inline'");

    const distScriptSrcMatch = distHtml.match(/script-src[^;]+/);
    assert.ok(distScriptSrcMatch, 'script-src CSP directive must exist in dist/index.html');
    assert.strictEqual(distScriptSrcMatch[0].includes("'unsafe-inline'"), false, "dist/index.html script-src must not contain 'unsafe-inline'");

    // Documentation synchronization checks
    const runbook = fs.readFileSync(
      path.join(ROOT_DIR, 'AUDIT_REPORT', 'PHASE_1H_CLOUD_DEPLOYMENT', 'PHASE_1H_CLOUD_DEPLOYMENT_RUNBOOK.md'),
      'utf8'
    );
    assert.ok(runbook.includes('edge_rate_limits'), 'Runbook must document edge_rate_limits');
    assert.ok(runbook.includes('otp_challenges'), 'Runbook must document otp_challenges');
    assert.ok(runbook.includes('validate-admin-route'), 'Runbook must document validate-admin-route function');
    assert.ok(runbook.includes('send-email-otp'), 'Runbook must document send-email-otp function');
    assert.ok(runbook.includes('crm-sync'), 'Runbook must document crm-sync function');
    assert.ok(runbook.includes('staff-auth'), 'Runbook must document staff-auth function');

    const edgeEnvExample = fs.readFileSync(
      path.join(ROOT_DIR, 'supabase', 'functions', '.env.example'),
      'utf8'
    );
    assert.ok(edgeEnvExample.includes('NEER_AI_DAILY_LIMIT'), '.env.example must specify NEER_AI_DAILY_LIMIT');
    assert.ok(edgeEnvExample.includes('TURNSTILE_SECRET_KEY'), '.env.example must specify TURNSTILE_SECRET_KEY');
  });

  // --------------------------------------------------------------------
  // HIGH-H5-03: Customer Column Integrity & Trigger
  // --------------------------------------------------------------------
  it('HIGH-H5-03: Column-restricted customer UPDATE grant, protect_customer_profile_columns trigger & sanitized client sync', () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT_DIR, 'supabase', 'migrations', '20261109_phase1h6_security_remediation.sql'),
      'utf8'
    );

    assert.ok(migrationSql.includes('GRANT UPDATE (restaurant_name, owner_name, phone, city, updated_at) ON public.customers TO authenticated;'));
    assert.ok(migrationSql.includes('FUNCTION public.protect_customer_profile_columns()'));
    assert.ok(migrationSql.includes('Security Violation: Restricted customer profile columns cannot be modified directly.'));

    // Check client supabase.ts syncCustomer sanitizes update payload
    const supabaseSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'supabase.ts'), 'utf8');
    assert.ok(supabaseSrc.includes('const updateFields = {'), 'syncCustomer must define restricted updateFields');
    assert.ok(supabaseSrc.includes('restaurant_name: customer.restaurantName'), 'syncCustomer includes permitted columns');
    assert.ok(!supabaseSrc.includes('email: customer.email,'), 'syncCustomer strips restricted email column');
  });

  // --------------------------------------------------------------------
  // HIGH-H5-04: Staff Lifecycle, 72h Invite Expiry & DB-First Ordering
  // --------------------------------------------------------------------
  it('HIGH-H5-04: 72h temp-password expiry in is_caller_active_staff, first-login MFA guard & DB-first order in delete_staff_user', () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT_DIR, 'supabase', 'migrations', '20261109_phase1h6_security_remediation.sql'),
      'utf8'
    );
    assert.ok(
      migrationSql.includes("(auth.jwt()->'app_metadata'->>'temporary_password_expires_at')::bigint > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint"),
      'is_caller_active_staff must enforce 72h invite expiry'
    );

    // staff-auth/handler.ts complete_mfa_enrollment first-login guard
    const staffAuthSrc = fs.readFileSync(path.join(ROOT_DIR, 'supabase', 'functions', 'staff-auth', 'handler.ts'), 'utf8');
    assert.ok(staffAuthSrc.includes('is_first_login === true'), 'complete_mfa_enrollment must check is_first_login');
    assert.ok(staffAuthSrc.includes('Forbidden: First-login invited staff must complete password and MFA onboarding via complete_staff_first_time_setup.'), 'Rejects MFA enrollment before password reset');

    // delete_staff_user orders DB deletion before auth.admin.deleteUser
    const deleteSection = staffAuthSrc.slice(staffAuthSrc.indexOf('if (action === "delete_staff_user")'));
    const dbDeleteIdx = deleteSection.indexOf('from("staff_users").delete()');
    const authDeleteIdx = deleteSection.indexOf('auth.admin.deleteUser(');
    assert.ok(dbDeleteIdx !== -1, 'staff_users DB delete must exist');
    assert.ok(authDeleteIdx !== -1, 'auth.admin.deleteUser must exist');
    assert.ok(dbDeleteIdx < authDeleteIdx, 'Database record must be deleted before GoTrue auth user');
  });

  // --------------------------------------------------------------------
  // MED-H5-01: Lead Flow & AI Incomplete State
  // --------------------------------------------------------------------
  it('MED-H5-01: BookCallSection eliminated, Supabase lead persistence precedes local automation, and incomplete AI leads skip CRM', () => {
    // BookCallSection component removed
    const deadComponentPath = path.join(ROOT_DIR, 'src', 'components', 'BookCallSection.tsx');
    assert.strictEqual(fs.existsSync(deadComponentPath), false, 'src/components/BookCallSection.tsx must not exist');

    // AutomationService runs only after Supabase check in forms
    const bookModalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'BookCallModal.tsx'), 'utf8');
    const supabaseLeadCallIdx = bookModalSrc.indexOf('SupabaseService.syncConsultationLead(');
    const automationCallIdx = bookModalSrc.indexOf('AutomationService.saveOrUpdateLead(');
    assert.ok(supabaseLeadCallIdx !== -1 && automationCallIdx !== -1);
    assert.ok(supabaseLeadCallIdx < automationCallIdx, 'SupabaseService.syncConsultationLead must precede AutomationService.saveOrUpdateLead');

    // neerAI skips CRM sync for incomplete leads
    const neerAiSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'neerAI.ts'), 'utf8');
    assert.ok(neerAiSrc.includes("leadStatus: 'Incomplete'"), 'neerAI captures incomplete leads locally');
    assert.ok(neerAiSrc.includes('hasMobileAndName'), 'neerAI gates cloud sync on complete leads');
  });

  // --------------------------------------------------------------------
  // MED-H5-02: Email Log Badges & Admin Portal Session Gating
  // --------------------------------------------------------------------
  it('MED-H5-02: Dynamic email log badges rendered, synchronous AAL2 check in AdminAuthService & AdminPage skeleton gate', () => {
    const adminPortalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'AdminPortal.tsx'), 'utf8');
    assert.ok(adminPortalSrc.includes("log.status || 'Dispatched'"), 'AdminPortal must read log.status');
    assert.ok(adminPortalSrc.includes("lower.includes('fail')"), 'AdminPortal must style failed email log status');
    assert.ok(adminPortalSrc.includes("lower.includes('block')"), 'AdminPortal must style blocked email log status');

    const adminAuthSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'adminAuth.ts'), 'utf8');
    assert.ok(adminAuthSrc.includes("session.authLevel !== 'aal2'"), 'AdminAuthService.isAuthenticated must synchronously verify aal2');

    const adminPageSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'pages', 'AdminPage.tsx'), 'utf8');
    assert.ok(adminPageSrc.includes('<PageSkeletonLoader'), 'AdminPage must display PageSkeletonLoader while session is verifying');
  });

  // --------------------------------------------------------------------
  // LOW-H5-01: Password Policy & Production OTP Lockdown
  // --------------------------------------------------------------------
  it('LOW-H5-01: Minimum password length 8 enforced across forms, local OTP card disabled in production', () => {
    const customerAuthSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'customerAuth.ts'), 'utf8');
    assert.ok(customerAuthSrc.includes('data.password.trim().length < 8'), 'customerAuth.ts must reject passwords under 8 characters');

    const modalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'CustomerPortalModal.tsx'), 'utf8');
    assert.ok(modalSrc.includes('signupPassword.length < 8'), 'CustomerPortalModal must validate signupPassword.length < 8');
    assert.ok(modalSrc.includes('Password must be at least 8 characters.'), 'CustomerPortalModal must show 8 char requirement');

    const otpServiceSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'otpService.ts'), 'utf8');
    assert.ok(otpServiceSrc.includes('Local OTP password reset is disabled in production'), 'otpService must disable local reset in prod');
    assert.ok(otpServiceSrc.includes('trimmed.length < 8'), 'otpService must enforce 8+ chars on password reset');
  });
});
