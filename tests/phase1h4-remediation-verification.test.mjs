// ====================================================================
// HARIT JAL™ (हरित जल) — PHASE 1H.4: CRITICAL REMEDIATION VERIFICATION SUITE
// Verifies resolution of BLOCKER-H3-01..04, HIGH-H3-01..04, and MED-H3-01..05
// using Vite SSR real module loading, local fetch HTTP interception, stateful
// GoTrue/PostgREST mock transports, and SQL/UI/bundle integrity checks.
// ZERO live Supabase Cloud requests or mutations ever occur.
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

function createStatefulEdgeMock(seedUsers = [], options = {}) {
  const users = new Map();
  const staffTable = new Map();
  const auditLogs = [];
  const operationTrace = [];

  for (const u of seedUsers) {
    users.set(u.id, {
      id: u.id,
      email: u.email,
      phone: u.phone || '',
      user_metadata: { ...(u.user_metadata || {}) },
      app_metadata: { ...(u.app_metadata || {}) },
      factors: [...(u.factors || [])],
      ban_duration: u.ban_duration || 'none',
    });
    if (u.staffRow) {
      staffTable.set(u.id, { ...u.staffRow });
    }
  }

  let nextId = 1;

  const client = {
    auth: {
      async getUser(jwt) {
        const caller = options.tokenMap?.get(jwt) || null;
        if (!caller) {
          return { data: { user: null }, error: { message: 'Invalid JWT' } };
        }
        return { data: { user: users.get(caller.id) || caller }, error: null };
      },
      admin: {
        async createUser(params) {
          operationTrace.push('auth:createUser');
          if (options.failCreateAuth) {
            return { data: { user: null }, error: { message: 'Duplicate user' } };
          }
          const id = `00000000-0000-4000-8000-00000000070${nextId++}`;
          const rec = {
            id,
            email: String(params.email || '').toLowerCase(),
            phone: params.phone || '',
            user_metadata: { ...(params.user_metadata || {}) },
            app_metadata: { ...(params.app_metadata || {}) },
            factors: [],
            ban_duration: 'none',
          };
          users.set(id, rec);
          return { data: { user: rec }, error: null };
        },
        async getUserById(userId) {
          const found = users.get(userId) || null;
          if (!found) {
            return { data: { user: null }, error: { message: 'Not found' } };
          }
          return { data: { user: found }, error: null };
        },
        async updateUserById(userId, params) {
          operationTrace.push(`auth:updateUserById:${userId}`);
          if (options.failAuthUpdate) {
            return { data: { user: null }, error: { message: 'Simulated GoTrue update error' } };
          }
          const found = users.get(userId);
          if (!found) {
            return { data: { user: null }, error: { message: 'Not found' } };
          }
          if (params.email) found.email = String(params.email).toLowerCase();
          if (params.phone) found.phone = String(params.phone);
          if (params.user_metadata) found.user_metadata = { ...params.user_metadata };
          if (params.app_metadata) found.app_metadata = { ...params.app_metadata };
          if (params.ban_duration) found.ban_duration = params.ban_duration;
          if (params.password) found.passwordUpdated = true;
          return { data: { user: found }, error: null };
        },
        async deleteUser(userId) {
          operationTrace.push(`auth:deleteUser:${userId}`);
          if (options.failDeleteAuth) {
            return { error: { message: 'Simulated auth.deleteUser failure' } };
          }
          users.delete(userId);
          return { error: null };
        },
        mfa: {
          async listFactors({ userId }) {
            operationTrace.push(`auth:mfa.listFactors:${userId}`);
            const found = users.get(userId);
            return { data: { factors: [...(found?.factors || [])] }, error: null };
          },
          async deleteFactor({ id, userId }) {
            operationTrace.push(`auth:mfa.deleteFactor:${userId}:${id}`);
            const found = users.get(userId);
            if (found) {
              found.factors = (found.factors || []).filter((f) => f.id !== id);
            }
            return { data: { id }, error: null };
          },
        },
      },
    },
    from(table) {
      return {
        select(_cols) {
          return {
            eq(col, value) {
              return {
                async maybeSingle() {
                  if (table === 'staff_users') {
                    if (col === 'id') {
                      return { data: staffTable.get(String(value)) || null, error: null };
                    }
                    if (col === 'email') {
                      const match = [...staffTable.values()].find(
                        (r) => String(r.email || '').toLowerCase() === String(value).toLowerCase()
                      );
                      return { data: match || null, error: null };
                    }
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        async upsert(payload) {
          operationTrace.push(`db:upsert:${table}`);
          if (options.failStaffUpsert && table === 'staff_users') {
            return { error: { message: 'Simulated staff_users upsert error' } };
          }
          if (table === 'staff_users') {
            staffTable.set(String(payload.id), { ...payload });
          }
          return { error: null };
        },
        update(payload) {
          return {
            async eq(_col, value) {
              operationTrace.push(`db:update:${table}`);
              if (options.failStaffUpdate && table === 'staff_users') {
                return { error: { message: 'Simulated staff_users update error' } };
              }
              if (table === 'staff_users' && staffTable.has(String(value))) {
                staffTable.set(String(value), { ...staffTable.get(String(value)), ...payload });
              }
              return { error: null };
            },
          };
        },
        async insert(payload) {
          operationTrace.push(`db:insert:${table}`);
          if (options.failAuditInsert && table === 'staff_audit_logs') {
            return { error: { message: 'Simulated audit log persistence error' } };
          }
          if (table === 'staff_audit_logs') {
            auditLogs.push({ ...payload });
          }
          return { error: null };
        },
        delete() {
          return {
            async eq(_col, value) {
              operationTrace.push(`db:delete:${table}`);
              if (table === 'staff_users') {
                staffTable.delete(String(value));
              }
              return { error: null };
            },
          };
        },
      };
    },
  };

  return { client, users, staffTable, auditLogs, operationTrace };
}

describe('Phase 1H.4 Critical Database, Authentication & Workflow Remediation Verification', () => {
  let viteServer;
  let originalFetch;
  let originalViteAppEnv;
  let originalNodeEnv;
  let originalSupabaseUrl;
  let originalSupabaseKey;
  let fetchStub;
  let staffHandler;
  let SupabaseService;
  let isSupabaseConfigured;
  let OtpService;
  let CustomerAuthService;
  let AdminAuthService;
  let StorageService;

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

    // Offline default network blocker
    fetchStub = async () => {
      throw new Error('Network blocked in offline Phase 1H.4 verification test');
    };
    globalThis.fetch = (...args) => fetchStub(...args);

    viteServer = await createServer({
      root: ROOT_DIR,
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      logLevel: 'silent',
    });

    staffHandler = await viteServer.ssrLoadModule('/supabase/functions/staff-auth/handler.ts');
    ({ SupabaseService, isSupabaseConfigured } = await viteServer.ssrLoadModule('/src/services/supabase.ts'));
    ({ OtpService } = await viteServer.ssrLoadModule('/src/services/otpService.ts'));
    ({ CustomerAuthService } = await viteServer.ssrLoadModule('/src/services/customerAuth.ts'));
    ({ AdminAuthService } = await viteServer.ssrLoadModule('/src/services/adminAuth.ts'));
    ({ StorageService } = await viteServer.ssrLoadModule('/src/services/storage.ts'));

    // Ensure local Supabase client initializes against mock transport if env is unset
    if (!isSupabaseConfigured()) {
      process.env.VITE_SUPABASE_URL = 'https://mock-project.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'mock_anon_key_for_offline_test';
    }
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

    if (viteServer) {
      await viteServer.close();
    }
  });

  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    delete process.env.VITE_APP_ENV;
    delete process.env.NODE_ENV;
    fetchStub = async () => {
      throw new Error('Network blocked in offline Phase 1H.4 verification test');
    };
  });

  it('BLOCKER-H3-01 & HIGH-H3-04: Zero recursive staff_users subqueries inside RLS policies across all SQL artifacts & hardened validation SQL', () => {
    const sqlArtifacts = [
      'AUDIT_REPORT/PHASE_1G3_REMEDIATION/CONSOLIDATED_MIGRATION.sql',
      'supabase-schema.sql',
      'supabase/schema.sql',
      'supabase/migrations/20261108_harden_rls_policies.sql',
      'supabase/migrations/20261109_phase1h4_security_remediation.sql',
      'AUDIT_REPORT/PHASE_1G3_REMEDIATION/UPDATED_ROLLBACK_AND_INCIDENT_RECOVERY_PLAN.md',
    ];

    for (const rel of sqlArtifacts) {
      const sql = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
      assert.ok(
        sql.includes('CREATE OR REPLACE FUNCTION public.is_caller_active_staff()'),
        `${rel} must define non-recursive public.is_caller_active_staff()`
      );
      assert.match(
        sql,
        /CREATE OR REPLACE FUNCTION public\.is_caller_active_staff\(\)[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog, public/i,
        `${rel} helper must run SECURITY DEFINER with fixed search_path`
      );
      assert.ok(
        sql.includes('REVOKE ALL ON FUNCTION public.is_caller_active_staff() FROM PUBLIC, anon;') &&
          sql.includes('GRANT EXECUTE ON FUNCTION public.is_caller_active_staff() TO authenticated;'),
        `${rel} must restrict is_caller_active_staff() execute grants`
      );

      const policyMatches = sql.match(/CREATE POLICY[\s\S]*?;/g) || [];
      assert.ok(policyMatches.length >= 16, `${rel} must contain hardened CREATE POLICY statements`);
      for (const policyStmt of policyMatches) {
        assert.strictEqual(
          /FROM\s+public\.staff_users/i.test(policyStmt) || /FROM\s+staff_users/i.test(policyStmt),
          false,
          `${rel} must NEVER query staff_users directly inside RLS policy:\n${policyStmt}`
        );
      }
    }

    const validationSql = fs.readFileSync(
      path.join(ROOT_DIR, 'AUDIT_REPORT', 'PHASE_1H_CLOUD_DEPLOYMENT', 'PHASE_1H_POST_DEPLOYMENT_VALIDATION_QUERIES.sql'),
      'utf8'
    );
    assert.strictEqual(
      validationSql.includes("p.with_check NOT LIKE '%staff_users.is_blocked = true%'"),
      false,
      'Validation SQL must not enforce recursive raw staff_users subquery'
    );
    assert.ok(validationSql.includes('is_caller_active_staff'), 'Validation Query 5 must require non-recursive helper');
    assert.ok(validationSql.includes('5.1 Verify ZERO raw inline `staff_users` subqueries'), 'Query 5.1 recursion guard required');
    assert.ok(validationSql.includes('SET LOCAL ROLE authenticated'), 'Query 10 must include runtime SET LOCAL ROLE probes');
    assert.ok(validationSql.includes('on_auth_user_email_updated_customer'), 'Customer email continuity trigger check required');
  });

  it('BLOCKER-H3-03: supabase/migrations/ contains zero rollback or USING(true) footguns and supabase/schema.sql is synced', () => {
    const migrationsDir = path.join(ROOT_DIR, 'supabase', 'migrations');
    const rollbackDir = path.join(ROOT_DIR, 'supabase', 'rollback');
    const migrationFiles = fs.readdirSync(migrationsDir);
    const rollbackFiles = fs.readdirSync(rollbackDir);

    assert.strictEqual(
      migrationFiles.some((f) => /rollback/i.test(f)),
      false,
      'supabase/migrations/ must NEVER contain rollback scripts'
    );
    assert.ok(migrationFiles.includes('20261108_customer_supabase_auth_sync.sql'));
    assert.ok(migrationFiles.includes('20261108_harden_rls_policies.sql'));
    assert.ok(migrationFiles.includes('20261109_phase1h4_security_remediation.sql'));
    assert.ok(rollbackFiles.includes('20261108_rollback_rls_policies.sql'));
    assert.ok(rollbackFiles.includes('20261108_rollback_customer_supabase_auth_sync.sql'));

    const hardenSql = fs.readFileSync(path.join(migrationsDir, '20261108_harden_rls_policies.sql'), 'utf8');
    const hardenNoComments = hardenSql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    assert.strictEqual(hardenNoComments.includes("auth.jwt()->>'role'"), false, 'Must use app_metadata.role, never top-level role');
    const customerPolicies = (hardenNoComments.match(/CREATE POLICY[\s\S]*?;/g) || []).filter((p) =>
      p.includes('ON public.customers')
    );
    assert.ok(customerPolicies.length >= 4, 'Expected customer RLS policies');
    for (const stmt of customerPolicies) {
      assert.strictEqual(
        stmt.includes('auth.uid()::text'),
        false,
        `Customer policy must use UUID auth.uid() = id, never auth.uid()::text:\n${stmt}`
      );
    }
    assert.ok(hardenNoComments.includes('CREATE TABLE IF NOT EXISTS public.staff_users'), 'Migration must be replay-safe on empty DB');
    assert.strictEqual(/CREATE POLICY[\s\S]*?USING\s*\(\s*true\s*\)/i.test(hardenNoComments), false);

    const cliSchema = fs.readFileSync(path.join(ROOT_DIR, 'supabase', 'schema.sql'), 'utf8');
    const rootSchema = fs.readFileSync(path.join(ROOT_DIR, 'supabase-schema.sql'), 'utf8');
    assert.strictEqual(cliSchema.includes("SELECT 'NOTICE: Apply"), false, 'supabase/schema.sql must no longer be a stub');
    assert.ok(cliSchema.length > 10000, 'supabase/schema.sql must be full synchronized schema');
    assert.ok(rootSchema.includes('on_auth_user_email_updated_customer'), 'Customer email continuity trigger must exist in root schema');
    assert.ok(cliSchema.includes('on_auth_user_email_updated_customer'), 'Customer email continuity trigger must exist in supabase/schema.sql');
  });

  it('BLOCKER-H3-02 & MED-H3-05: SupabaseService avoids .upsert(), uses INSERT-only orders/leads, RPCs & fail-closed UI rollback', async () => {
    const supabaseSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'supabase.ts'), 'utf8');
    const supabaseNoComments = supabaseSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.strictEqual(supabaseNoComments.includes('.upsert('), false, 'SupabaseService must not execute .upsert() calls anywhere');

    const requests = [];
    let forceRlsReject = false;

    fetchStub = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init.method || 'GET').toUpperCase();
      const headers = new Headers(init.headers || {});
      const prefer = headers.get('prefer') || '';
      requests.push({ url, method, prefer, body: init.body });

      if (url.includes('/rest/v1/rpc/check_security_block')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/rest/v1/rpc/record_security_block') || url.includes('/rest/v1/rpc/append_email_audit_log')) {
        return new Response(JSON.stringify(true), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/rest/v1/orders') || url.includes('/rest/v1/consultations')) {
        if (forceRlsReject) {
          return new Response(
            JSON.stringify({ code: '42501', message: 'new row violates row-level security policy' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('', { status: 201 });
      }
      if (url.includes('/rest/v1/email_logs') && method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              id: 'el-1',
              recipient: 'partner@hotel.in',
              subject: '[Harit Jal] Password Recovery',
              body: 'Recovery dispatched [REDACTED]',
              template_type: 'otp_verification',
              sent_at: '2026-11-09T09:00:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const healthOk = await SupabaseService.testConnection();
    assert.strictEqual(healthOk.connected, true);
    assert.ok(requests.some((r) => r.url.includes('/rest/v1/rpc/db_health_ping')));

    const leadOk = await SupabaseService.syncConsultationLead({
      id: 'LEAD-1',
      restaurantName: 'Spice Route',
      ownerName: 'Aarav',
      phone: '9876543210',
      email: 'aarav@spiceroute.in',
      city: 'Delhi',
      preferredTime: 'Morning',
      bottleTypes: ['500ml'],
    });
    assert.strictEqual(leadOk, true);
    const leadReq = requests.find((r) => r.url.includes('/rest/v1/consultations'));
    assert.strictEqual(leadReq?.method, 'POST');
    assert.strictEqual(leadReq?.prefer.includes('resolution=merge-duplicates'), false, 'Consultations must use pure INSERT, not upsert');

    const orderOk = await SupabaseService.syncOrder({
      id: 'ORD-101',
      restaurantName: 'Spice Route',
      ownerEmail: 'aarav@spiceroute.in',
      bottleSize: '500ml',
      quantity: 48,
      status: 'Order Confirmed',
      orderedAt: '2026-11-09T09:00:00Z',
    });
    assert.strictEqual(orderOk, true);
    const orderReq = requests.find((r) => r.url.includes('/rest/v1/orders'));
    assert.strictEqual(orderReq?.method, 'POST');
    assert.strictEqual(orderReq?.prefer.includes('resolution=merge-duplicates'), false, 'Orders must use pure INSERT, not upsert');

    // Simulate RLS 42501 rejection -> service must return false cleanly
    forceRlsReject = true;
    const rejectedOrder = await SupabaseService.syncOrder({
      id: 'ORD-102',
      restaurantName: 'Spice Route',
      ownerEmail: 'aarav@spiceroute.in',
      quantity: 48,
      status: 'Order Confirmed',
      orderedAt: '2026-11-09T09:00:00Z',
    });
    assert.strictEqual(rejectedOrder, false);

    // CRIT-H5-01: Verify anonymous/client RPC methods have been stripped from SupabaseService
    assert.strictEqual(typeof SupabaseService.syncSecurityBlock, 'undefined', 'syncSecurityBlock must be removed from client service');
    assert.strictEqual(typeof SupabaseService.fetchActiveSecurityBlocks, 'undefined', 'fetchActiveSecurityBlocks must be removed from client service');
    assert.strictEqual(typeof SupabaseService.syncEmailLog, 'undefined', 'syncEmailLog must be removed from client service');

    const cloudEmailLogs = await SupabaseService.fetchEmailLogs();
    assert.strictEqual(cloudEmailLogs?.length, 1);
    assert.strictEqual(cloudEmailLogs?.[0].type, 'otp_verification');

    // UI rollback verification on all 4 customer submission files
    for (const rel of [
      'src/pages/TrackPage.tsx',
      'src/components/CustomerPortalModal.tsx',
      'src/components/BookCallModal.tsx',
      'src/pages/ContactPage.tsx',
    ]) {
      const uiSrc = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
      assert.match(uiSrc, /isSupabaseConfigured\(\)\s*&&\s*!synced|isSupabaseConfigured\(\)\s*&&\s*!leadSynced|isSupabaseConfigured\(\)\s*&&\s*!orderSynced/);
    }
  });

  it('BLOCKER-H3-04 & MED-H3-02: Edge handler rollbacks, Reset MFA, Reissue 72h Invite, Role/Permissions & Modal Recovery', async () => {
    const rootId = '00000000-0000-4000-8000-000000000001';
    const staffId = '00000000-0000-4000-8000-000000000222';
    const rootUser = {
      id: rootId,
      email: 'admin@haritjal.in',
      phone: '+916299293497',
      app_metadata: { role: 'super_admin', is_root_super_admin: true, is_blocked: false, totp_enabled: true },
      factors: [{ id: 'fac_root', factor_type: 'totp', status: 'verified' }],
      staffRow: {
        id: rootId,
        name: 'Atal Pandey',
        email: 'admin@haritjal.in',
        phone: '+916299293497',
        role: 'super_admin',
        is_blocked: false,
        is_root_super_admin: true,
        totp_enabled: true,
        email_phone_changes_count: 0,
      },
    };
    const opsStaff = {
      id: staffId,
      email: 'ops@haritjal.in',
      app_metadata: {
        role: 'staff',
        permissions: ['leads'],
        is_root_super_admin: false,
        is_blocked: false,
        is_first_login: false,
        totp_enabled: true,
      },
      factors: [{ id: 'fac_ops_1', factor_type: 'totp', status: 'verified' }],
      staffRow: {
        id: staffId,
        email: 'ops@haritjal.in',
        role: 'staff',
        permissions: ['leads'],
        is_blocked: false,
        is_first_login: false,
        is_root_super_admin: false,
        totp_enabled: true,
      },
    };

    const rootAal2Jwt = makeFakeJwt({ sub: rootId, aal: 'aal2', role: 'authenticated' });
    const rootAal1Jwt = makeFakeJwt({ sub: rootId, aal: 'aal1', role: 'authenticated' });
    const envGetter = (k) =>
      k === 'SUPABASE_URL' ? 'https://mock.supabase.co' : k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'mock_srv' : undefined;

    // 1. reset_staff_mfa deletes verified GoTrue factors and syncs metadata + DB + audit log
    const mock1 = createStatefulEdgeMock([rootUser, opsStaff], {
      tokenMap: new Map([
        [rootAal2Jwt, rootUser],
        [rootAal1Jwt, rootUser],
      ]),
    });
    const resetRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rootAal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_staff_mfa', targetUserId: staffId }),
      }),
      { createAdminClient: () => mock1.client, getEnv: envGetter }
    );
    assert.strictEqual(resetRes.status, 200);
    const resetJson = await resetRes.json();
    assert.strictEqual(resetJson.removedFactors, 1);
    assert.strictEqual(mock1.users.get(staffId)?.factors.length, 0);
    assert.strictEqual(mock1.staffTable.get(staffId)?.totp_enabled, false);
    assert.strictEqual(mock1.auditLogs.at(-1)?.action, 'RESET_STAFF_MFA');

    // Root Super Admin MFA cannot be reset via bulk handler
    const rootResetDenied = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rootAal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_staff_mfa', targetUserId: rootId }),
      }),
      { createAdminClient: () => mock1.client, getEnv: envGetter }
    );
    assert.strictEqual(rootResetDenied.status, 400);

    // 2. reissue_staff_invite issues fresh 72h CSPRNG temp password, clears block/expired lock
    mock1.users.get(staffId).app_metadata.is_blocked = true;
    mock1.users.get(staffId).app_metadata.invitation_expired = true;
    mock1.users.get(staffId).ban_duration = '876000h';
    mock1.staffTable.get(staffId).is_blocked = true;
    const reissueRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rootAal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reissue_staff_invite', targetUserId: staffId, resetMfa: true }),
      }),
      { createAdminClient: () => mock1.client, getEnv: envGetter }
    );
    assert.strictEqual(reissueRes.status, 200);
    const reissueJson = await reissueRes.json();
    assert.match(reissueJson.temporaryPassword, /^HaritStaff#.{8}$/);
    assert.strictEqual(mock1.staffTable.get(staffId)?.is_blocked, false);
    assert.strictEqual(mock1.staffTable.get(staffId)?.is_first_login, true);
    assert.strictEqual(mock1.users.get(staffId)?.ban_duration, 'none');
    assert.strictEqual(mock1.auditLogs.at(-1)?.action, 'REISSUE_STAFF_INVITE');

    // 3. update_staff_role_permissions updates allowed permissions & rejects super_admin escalation
    const badPermRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rootAal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_staff_role_permissions',
          targetUserId: staffId,
          role: 'super_admin',
          permissions: ['orders'],
        }),
      }),
      { createAdminClient: () => mock1.client, getEnv: envGetter }
    );
    assert.strictEqual(badPermRes.status, 400);

    const permRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rootAal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_staff_role_permissions',
          targetUserId: staffId,
          role: 'operations_lead',
          permissions: ['orders', 'analytics', 'unknown_bad_perm'],
        }),
      }),
      { createAdminClient: () => mock1.client, getEnv: envGetter }
    );
    assert.strictEqual(permRes.status, 200);
    const permJson = await permRes.json();
    assert.deepStrictEqual(permJson.permissions, ['orders', 'analytics']);
    assert.strictEqual(mock1.staffTable.get(staffId)?.role, 'operations_lead');
    assert.strictEqual(mock1.auditLogs.at(-1)?.action, 'UPDATE_STAFF_PERMISSIONS');

    // 4. update_own_admin_profile persists phone/email/name and rejects AAL1
    const aal1ProfileRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rootAal1Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_own_admin_profile',
          email: 'admin@haritjal.in',
          phone: '+919999999999',
        }),
      }),
      { createAdminClient: () => mock1.client, getEnv: envGetter }
    );
    assert.strictEqual(aal1ProfileRes.status, 403);

    const profileRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rootAal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_own_admin_profile',
          email: 'admin@haritjal.in',
          phone: '+919876500001',
          name: 'Atal Pandey HQ',
        }),
      }),
      { createAdminClient: () => mock1.client, getEnv: envGetter }
    );
    assert.strictEqual(profileRes.status, 200);
    assert.strictEqual(mock1.staffTable.get(rootId)?.phone, '+919876500001');
    assert.strictEqual(mock1.staffTable.get(rootId)?.email_phone_changes_count, 1);

    // 5. Compensating rollbacks: delete_staff_user restores snapshot if auth.deleteUser fails; block_staff_user reverts GoTrue if DB fails
    const delRollbackMock = createStatefulEdgeMock([rootUser, opsStaff], {
      tokenMap: new Map([[rootAal2Jwt, rootUser]]),
      failDeleteAuth: true,
    });
    const delRollbackRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rootAal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_staff_user', targetUserId: staffId }),
      }),
      { createAdminClient: () => delRollbackMock.client, getEnv: envGetter }
    );
    assert.strictEqual(delRollbackRes.status, 500);
    assert.ok(delRollbackMock.staffTable.has(staffId), 'Must restore deleted staff_users snapshot when auth.deleteUser fails');

    const blockRollbackMock = createStatefulEdgeMock([rootUser, opsStaff], {
      tokenMap: new Map([[rootAal2Jwt, rootUser]]),
      failStaffUpdate: true,
    });
    const blockRollbackRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rootAal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'block_staff_user', targetUserId: staffId }),
      }),
      { createAdminClient: () => blockRollbackMock.client, getEnv: envGetter }
    );
    assert.strictEqual(blockRollbackRes.status, 500);
    assert.strictEqual(blockRollbackMock.users.get(staffId)?.ban_duration, 'none', 'Must revert GoTrue ban_duration on DB failure');

    // 6. Both enrollment modals handle verified-factor recovery instead of 422 deadlock
    for (const rel of [
      'src/components/admin/StaffFirstTimeSetupModal.tsx',
      'src/components/admin/MfaEnrollmentModal.tsx',
    ]) {
      const modalSrc = fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');
      assert.ok(modalSrc.includes('existingVerified'), `${rel} must detect already-verified factors to avoid 422 deadlock`);
      assert.ok(modalSrc.includes('staleUnverified') && modalSrc.includes('supabase.auth.mfa.unenroll'), `${rel} must purge stale unverified factors`);
      assert.ok(modalSrc.includes('recoveredVerified') && modalSrc.includes('hasExistingVerifiedFactor'), `${rel} must support completing setup using recovered verified factor`);
    }
  });

  it('HIGH-H3-01: OtpService redacts OTP in production, avoids console.log leaks & routes password reset via Supabase Auth', async () => {
    const otpSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'services', 'otpService.ts'), 'utf8');
    assert.strictEqual(otpSrc.includes('console.log'), false, 'OtpService must NEVER console.log OTPs');
    assert.ok(otpSrc.includes('crypto.getRandomValues'), 'OtpService must use Web Crypto CSPRNG');

    // Mock RPC endpoint for email logging
    const resetCalls = [];
    fetchStub = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/functions/v1/send-email-otp')) {
        return new Response(
          JSON.stringify({
            success: true,
            challengeToken: 'hdr.mock_server_challenge_sig',
            expiresAt: Date.now() + 5 * 60 * 1000,
            resendAvailableAt: Date.now() + 60 * 1000,
            resendInSeconds: 60,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/rest/v1/rpc/append_email_audit_log')) {
        return new Response(JSON.stringify(true), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/auth/v1/recover')) {
        resetCalls.push(JSON.parse(String(init.body || '{}')));
        return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/auth/v1/user')) {
        return new Response(
          JSON.stringify({ id: '00000000-0000-4000-8000-000000000888', email: 'partner@hotel.in' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    process.env.VITE_APP_ENV = 'production';
    const sendRes = await OtpService.sendOtp('partner@hotel.in', 'signup');
    assert.strictEqual(sendRes.success, true);
    assert.strictEqual('otp' in sendRes, false, 'Production sendOtp must not return plaintext OTP to UI');
    const activeInfo = OtpService.getActiveOtp('partner@hotel.in', 'signup');
    assert.strictEqual('otp' in activeInfo, false, 'Production getActiveOtp must redact plaintext OTP');
    const emailLogs = StorageService.getEmailLogs();
    assert.strictEqual(/\b\d{6}\b/.test(emailLogs[0]?.body || ''), false, 'Production email log must redact 6-digit OTP');

    const cloudResetRes = await OtpService.requestSupabasePasswordReset('partner@hotel.in');
    assert.strictEqual(cloudResetRes.success, true);
    assert.strictEqual(cloudResetRes.recoveryEmailSent, true);
    assert.strictEqual(resetCalls[0]?.email, 'partner@hotel.in');

    // App.tsx & TrackPage.tsx handle PASSWORD_RECOVERY redirect & hash/query parsing
    const appSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'App.tsx'), 'utf8');
    const trackSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'pages', 'TrackPage.tsx'), 'utf8');
    assert.ok(appSrc.includes('PASSWORD_RECOVERY') && appSrc.includes("'/track?mode=recovery'"));
    assert.ok(appSrc.includes("currentPath.split('?')[0].split('#')[0]"));
    assert.ok(trackSrc.includes('completeSupabasePasswordReset') && trackSrc.includes("mode === 'recovery'"));
  });

  it('HIGH-H3-02: Customer Email Update syncs Supabase Auth + JWT continuity, and Confirm-Email mode handles session === null', async () => {
    // 1. Signup when GoTrue Confirm Email is enabled -> session === null -> must NOT leave fake logged-in local user
    fetchStub = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/auth/v1/signup')) {
        return new Response(
          JSON.stringify({
            id: '00000000-0000-4000-8000-000000000901',
            email: 'confirm@hotel.in',
            confirmation_sent_at: '2026-11-09T09:00:00Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const signUpRes = await CustomerAuthService.signUpWithSupabaseAuth({
      restaurantName: 'Royal Courtyard',
      ownerName: 'Riya',
      email: 'confirm@hotel.in',
      phone: '9876543210',
      city: 'Jaipur',
      password: 'StrongPassword123',
    });
    assert.strictEqual(signUpRes.success, true);
    assert.strictEqual(signUpRes.requiresEmailConfirmation, true);
    assert.strictEqual(CustomerAuthService.getCurrentCustomer(), null, 'No fake local customer session when session === null');

    // 2. Profile email update when GoTrue returns confirmation pending -> keeps customers email matched to active JWT email
    const custId = '00000000-0000-4000-8000-000000000902';
    const customerSeed = {
      id: custId,
      restaurantName: 'Amber Palace',
      ownerName: 'Karan',
      email: 'old@amber.in',
      phone: '9876543211',
      city: 'Udaipur',
      createdAt: '2026-11-09T08:00:00Z',
      emailPhoneChangesCount: 0,
    };
    globalThis.localStorage.setItem('harit_jal_customers_v1', JSON.stringify([customerSeed]));
    globalThis.localStorage.setItem('harit_jal_current_customer_v1', JSON.stringify(customerSeed));

    const mockAuthJwt = makeFakeJwt({
      sub: custId,
      email: 'old@amber.in',
      role: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    // Install fetch interceptor BEFORE setSession() because GoTrue setSession() fetches /auth/v1/user
    fetchStub = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init.method || 'GET').toUpperCase();
      if (url.includes('/auth/v1/user') && method === 'GET') {
        return new Response(
          JSON.stringify({ id: custId, email: 'old@amber.in', app_metadata: { role: 'customer' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/auth/v1/user') && method === 'PUT') {
        // Simulate Supabase Email Change Confirmation pending (active user email still old@amber.in)
        return new Response(
          JSON.stringify({ id: custId, email: 'old@amber.in', new_email: 'new@amber.in' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/rest/v1/customers') && method === 'PATCH') {
        const body = JSON.parse(String(init.body || '{}'));
        syncedDbFields = body;
        return new Response(JSON.stringify([{ id: custId }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    let syncedDbFields = {};
    const supabaseClientModule = await viteServer.ssrLoadModule('/src/services/supabase.ts');
    const client = supabaseClientModule.getSupabaseClient();
    await client.auth.setSession({ access_token: mockAuthJwt, refresh_token: 'mock_refresh' });

    const profileUpdateRes = await CustomerAuthService.updateCustomerProfile(
      custId,
      'new@amber.in',
      '9876543211',
      'Karan',
      'Amber Palace',
      'Udaipur'
    );
    assert.strictEqual(profileUpdateRes.success, true, `Unexpected updateCustomerProfile error: ${profileUpdateRes.error}`);
    assert.strictEqual(profileUpdateRes.emailConfirmationPending, true);
    // HIGH-H5-03: Restricted columns stripped from UPDATE payload
    assert.strictEqual(typeof syncedDbFields.email, 'undefined', 'PATCH /customers must strip restricted email column');
    assert.strictEqual(typeof syncedDbFields.dpdp_consent, 'undefined', 'PATCH /customers must strip dpdp_consent');
    assert.strictEqual(typeof syncedDbFields.email_phone_changes_count, 'undefined', 'PATCH /customers must strip email_phone_changes_count');
    assert.strictEqual(syncedDbFields.phone, '9876543211');
    assert.strictEqual(syncedDbFields.owner_name, 'Karan');

    const profileModalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'CustomerProfileSettingsModal.tsx'), 'utf8');
    assert.ok(profileModalSrc.includes('await CustomerAuthService.updateCustomerProfile('));
    assert.ok(profileModalSrc.includes('emailConfirmationPending'));

    // Verify SQL email-change trigger syncs historical orders/consultations upon GoTrue email verification
    for (const sqlRel of [
      'supabase-schema.sql',
      'supabase/schema.sql',
      'supabase/migrations/20261109_phase1h4_security_remediation.sql',
      'AUDIT_REPORT/PHASE_1G3_REMEDIATION/CONSOLIDATED_MIGRATION.sql',
    ]) {
      const sqlBody = fs.readFileSync(path.join(ROOT_DIR, sqlRel), 'utf8');
      assert.ok(
        sqlBody.includes('handle_customer_email_sync') && sqlBody.includes('on_auth_user_email_updated_customer'),
        `${sqlRel} must define handle_customer_email_sync and on_auth_user_email_updated_customer trigger`
      );
    }
  });

  it('HIGH-H3-03, MED-H3-01 & MED-H3-04: Admin Portal RBAC gating, live session check, AdminProfile persistence & CSP hygiene', async () => {
    const adminPortalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'AdminPortal.tsx'), 'utf8');
    assert.ok(adminPortalSrc.includes('AdminAuthService.hasPermission'));
    assert.ok(adminPortalSrc.includes('No Workspace Permissions Assigned'));
    assert.ok(adminPortalSrc.includes('denyUnauthorizedAction('));
    assert.ok(adminPortalSrc.includes('SupabaseService.fetchEmailLogs()'));

    const adminPageSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'pages', 'AdminPage.tsx'), 'utf8');
    assert.ok(adminPageSrc.includes('AdminAuthService.verifyLiveSession'));
    assert.ok(adminPageSrc.includes("window.addEventListener('focus'"));

    const adminProfileModalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'admin', 'AdminProfileSettingsModal.tsx'), 'utf8');
    assert.ok(adminProfileModalSrc.includes('AdminAuthService.updateOwnAdminProfile'));
    assert.strictEqual(adminProfileModalSrc.includes('StorageService.updateAdminProfile'), false);

    const staffMgmtSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'admin', 'StaffManagementModal.tsx'), 'utf8');
    assert.ok(staffMgmtSrc.includes("'analytics'"));
    assert.ok(staffMgmtSrc.includes('handleResetMfa') && staffMgmtSrc.includes('handleReissueInvite'));
    assert.ok(staffMgmtSrc.includes('handleSavePermissions'));

    // Runtime check for AdminAuthService.hasPermission and verifyLiveSession blocked eviction
    const staffSession = {
      adminId: '00000000-0000-4000-8000-000000000223',
      name: 'Lead Designer',
      email: 'designer@haritjal.in',
      role: 'label_designer',
      permissions: ['inventory'],
      loginAt: new Date().toISOString(),
      token: 'sess_tok',
      expiresAt: Date.now() + 60_000,
    };
    globalThis.sessionStorage.setItem('harit_jal_admin_session_v1', JSON.stringify(staffSession));
    assert.strictEqual(AdminAuthService.hasPermission('inventory'), true);
    assert.strictEqual(AdminAuthService.hasPermission('orders'), false);
    assert.strictEqual(AdminAuthService.hasPermission('staff'), false);

    process.env.VITE_APP_ENV = 'production';
    const blockedRes = await AdminAuthService.verifyLiveSession();
    assert.strictEqual(blockedRes.valid, false, 'Production verifyLiveSession must fail closed without live Supabase AAL2 session');

    // CSP meta tag hygiene
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('Content-Security-Policy'));
    assert.strictEqual(indexHtml.includes('frame-ancestors'), false, 'frame-ancestors is invalid in HTML <meta> CSP and must be set via HTTP headers');
  });
});
