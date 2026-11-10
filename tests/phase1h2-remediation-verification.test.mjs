// ====================================================================
// HARIT JAL™ (हरित जल) — PHASE 1H.2: BLOCKER-DRIVEN RUNTIME SECURITY SUITE
// Verifies BLOCKER-01 through BLOCKER-07 and High/Medium/Low findings
// by executing actual Edge Function handlers and frontend TypeScript modules.
// ZERO Supabase Cloud mutations; all HTTP requests are intercepted locally.
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

function createStatefulMockSupabaseAdmin(seedUsers = [], options = {}) {
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
            return { data: { user: null }, error: { message: 'Duplicate email in auth.users' } };
          }
          const email = String(params.email || '').toLowerCase();
          for (const existing of users.values()) {
            if (existing.email === email) {
              return { data: { user: null }, error: { message: 'User already registered' } };
            }
          }
          const id = `00000000-0000-4000-8000-00000000010${nextId++}`;
          const rec = {
            id,
            email,
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
          const found = users.get(userId);
          if (!found) {
            return { data: { user: null }, error: { message: 'Not found' } };
          }
          if (params.app_metadata) {
            found.app_metadata = { ...params.app_metadata };
          }
          if (params.ban_duration) {
            found.ban_duration = params.ban_duration;
          }
          if (params.password) {
            found.passwordUpdated = true;
          }
          return { data: { user: found }, error: null };
        },
        async deleteUser(userId) {
          operationTrace.push('auth:deleteUser');
          if (!users.has(userId)) {
            return { error: { message: 'Auth user not found' } };
          }
          users.delete(userId);
          return { error: null };
        },
      },
    },
    from(table) {
      return {
        select(_columns) {
          return {
            eq(_col, value) {
              return {
                async maybeSingle() {
                  if (table === 'staff_users') {
                    return { data: staffTable.get(String(value)) || null, error: null };
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
            return { error: { message: 'Simulated staff_users upsert failure' } };
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
              if (table === 'staff_users' && staffTable.has(String(value))) {
                staffTable.set(String(value), { ...staffTable.get(String(value)), ...payload });
              }
              return { error: null };
            },
          };
        },
        async insert(payload) {
          operationTrace.push(`db:insert:${table}`);
          if (table === 'staff_audit_logs') {
            auditLogs.push({ ...payload });
          }
          return { error: null };
        },
        delete() {
          return {
            async eq(_col, value) {
              operationTrace.push(`db:delete:${table}`);
              if (options.failStaffDelete && table === 'staff_users') {
                return { error: { message: 'Security Violation: Root Super Admin account cannot be deleted.' } };
              }
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

describe('Phase 1H.2 Blocker-Driven Security Remediation Verification', () => {
  let viteServer;
  let originalFetch;
  let originalViteAppEnv;
  let originalNodeEnv;
  let roles;
  let staffHandler;
  let routeHandler;
  let AdminAuthService;
  let CustomerAuthService;
  let DynamicAdminRouter;
  let StorageService;
  let fetchStub;

  before(async () => {
    originalFetch = globalThis.fetch;
    originalViteAppEnv = process.env.VITE_APP_ENV;
    originalNodeEnv = process.env.NODE_ENV;

    globalThis.localStorage = createMemoryStorage();
    globalThis.sessionStorage = createMemoryStorage();
    globalThis.window = {
      location: { origin: 'https://haritjal.in', pathname: '/' },
      dispatchEvent: () => true,
    };

    // Strict network blocker by default so zero real Supabase requests can ever happen
    fetchStub = async () => {
      throw new Error('Network blocked in offline verification test');
    };
    globalThis.fetch = (...args) => fetchStub(...args);

    viteServer = await createServer({
      root: ROOT_DIR,
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
      optimizeDeps: { noDiscovery: true },
      logLevel: 'silent',
    });

    roles = await viteServer.ssrLoadModule('/src/services/roles.ts');
    staffHandler = await viteServer.ssrLoadModule('/supabase/functions/staff-auth/handler.ts');
    routeHandler = await viteServer.ssrLoadModule('/supabase/functions/validate-admin-route/handler.ts');
    ({ AdminAuthService } = await viteServer.ssrLoadModule('/src/services/adminAuth.ts'));
    ({ CustomerAuthService } = await viteServer.ssrLoadModule('/src/services/customerAuth.ts'));
    ({ DynamicAdminRouter } = await viteServer.ssrLoadModule('/src/services/dynamicAdminRouter.ts'));
    ({ StorageService } = await viteServer.ssrLoadModule('/src/services/storage.ts'));
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (originalViteAppEnv === undefined) {
      delete process.env.VITE_APP_ENV;
    } else {
      process.env.VITE_APP_ENV = originalViteAppEnv;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
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
      throw new Error('Network blocked in offline verification test');
    };
  });

  it('BLOCKER-01 & BLOCKER-07: Gateway verify_jwt=true, TypeScript functions config, and CORS whitelist enforcement', async () => {
    const configToml = fs.readFileSync(path.join(ROOT_DIR, 'supabase', 'config.toml'), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    const staffIdx = fs.readFileSync(path.join(ROOT_DIR, 'supabase', 'functions', 'staff-auth', 'index.ts'), 'utf8');

    assert.match(configToml, /\[functions\.staff-auth\]\s+verify_jwt\s*=\s*true/);
    assert.match(configToml, /\[functions\.validate-admin-route\]\s+verify_jwt\s*=\s*true/);
    assert.ok(pkg.scripts.build.includes('tsconfig.functions.json'), 'Build script must typecheck Edge Functions');
    assert.strictEqual((staffIdx.match(/const\s+targetEmail\b/g) || []).length, 0, 'Duplicate targetEmail in index.ts must not recur');

    // Runtime CORS check
    const envLookup = () => undefined;
    const preflightAllowed = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' },
      }),
      { createAdminClient: () => { throw new Error('Should not initialize admin client on OPTIONS'); }, getEnv: envLookup }
    );
    assert.strictEqual(preflightAllowed.status, 200);
    assert.strictEqual(preflightAllowed.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');

    const preflightEvil = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil-attacker.example' },
      }),
      { createAdminClient: () => { throw new Error('Should not initialize admin client on OPTIONS'); }, getEnv: envLookup }
    );
    assert.strictEqual(preflightEvil.headers.get('Access-Control-Allow-Origin'), 'https://haritjal.in');
  });

  it('BLOCKER-02: Non-root staff delete succeeds in DB-first order while Root Super Admin remains protected in handler and SQL', async () => {
    const rootId = '00000000-0000-4000-8000-000000000001';
    const staffId = '00000000-0000-4000-8000-000000000202';
    const aal2Jwt = makeFakeJwt({ sub: rootId, aal: 'aal2', role: 'authenticated' });

    const rootUser = {
      id: rootId,
      email: 'admin@haritjal.in',
      app_metadata: { role: 'super_admin', is_root_super_admin: true, is_blocked: false, totp_enabled: true },
      factors: [{ id: 'fac_root', factor_type: 'totp', status: 'verified' }],
      staffRow: { id: rootId, role: 'super_admin', is_blocked: false, is_root_super_admin: true },
    };
    const staffUser = {
      id: staffId,
      email: 'staff.ops@haritjal.in',
      app_metadata: { role: 'staff', is_root_super_admin: false, is_blocked: false, totp_enabled: true },
      staffRow: { id: staffId, email: 'staff.ops@haritjal.in', role: 'staff', is_blocked: false, is_root_super_admin: false },
    };

    const mockDb = createStatefulMockSupabaseAdmin([rootUser, staffUser], {
      tokenMap: new Map([[aal2Jwt, rootUser]]),
    });
    const deps = {
      createAdminClient: () => mockDb.client,
      getEnv: (k) => (k === 'SUPABASE_URL' ? 'https://mock.supabase.co' : k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'mock_srv' : undefined),
    };

    // 1. Self-delete blocked
    const selfDelRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${aal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_staff_user', targetUserId: rootId }),
      }),
      deps
    );
    assert.strictEqual(selfDelRes.status, 400);

    // 2. Even if called by another Super Admin, Root flag protects Root Super Admin
    const fakeSecondAdminId = '00000000-0000-4000-8000-000000000099';
    const secondAdmin = {
      id: fakeSecondAdminId,
      email: 'co@haritjal.in',
      app_metadata: { role: 'super_admin', is_root_super_admin: false, is_blocked: false },
      staffRow: { id: fakeSecondAdminId, role: 'super_admin', is_blocked: false, is_root_super_admin: false },
    };
    mockDb.users.set(fakeSecondAdminId, secondAdmin);
    const secondJwt = makeFakeJwt({ sub: fakeSecondAdminId, aal: 'aal2' });
    const tokenMap = new Map([
      [aal2Jwt, rootUser],
      [secondJwt, secondAdmin],
    ]);
    const deps2 = {
      createAdminClient: () => createStatefulMockSupabaseAdmin([rootUser, staffUser, secondAdmin], { tokenMap }).client,
      getEnv: deps.getEnv,
    };
    const rootProtectRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secondJwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_staff_user', targetUserId: rootId }),
      }),
      deps2
    );
    assert.strictEqual(rootProtectRes.status, 400);
    const rootProtectJson = await rootProtectRes.json();
    assert.match(rootProtectJson.error, /Root Super Admin account cannot be deleted/);

    // 3. If SQL DB delete raises error, auth.deleteUser is NOT called
    const dbErrMock = createStatefulMockSupabaseAdmin([rootUser, staffUser], {
      tokenMap: new Map([[aal2Jwt, rootUser]]),
      failStaffDelete: true,
    });
    const dbErrRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${aal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_staff_user', targetUserId: staffId }),
      }),
      { createAdminClient: () => dbErrMock.client, getEnv: deps.getEnv }
    );
    assert.strictEqual(dbErrRes.status, 500);
    assert.strictEqual(dbErrMock.operationTrace.includes('auth:deleteUser'), false, 'Must abort auth delete when DB trigger rejects');

    // 4. Legitimate non-root staff delete removes staff_users BEFORE auth.users and preserves audit trail
    const delRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${aal2Jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_staff_user', targetUserId: staffId }),
      }),
      deps
    );
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(mockDb.staffTable.has(staffId), false);
    assert.strictEqual(mockDb.users.has(staffId), false);
    const dbDelIdx = mockDb.operationTrace.indexOf('db:delete:staff_users');
    const authDelIdx = mockDb.operationTrace.indexOf('auth:deleteUser');
    assert.ok(dbDelIdx !== -1 && authDelIdx !== -1 && dbDelIdx < authDelIdx, 'Must delete staff_users row before deleting auth.users identity');
    assert.strictEqual(mockDb.auditLogs.at(-1)?.action, 'DELETE_STAFF');

    // Verify SQL trigger actually returns OLD on non-root DELETE
    const migrationSql = fs.readFileSync(
      path.join(ROOT_DIR, 'AUDIT_REPORT', 'PHASE_1G3_REMEDIATION', 'CONSOLIDATED_MIGRATION.sql'),
      'utf8'
    );
    const triggerMatch = migrationSql.match(/CREATE OR REPLACE FUNCTION public\.protect_root_super_admin\(\)[\s\S]*?\$\$;/);
    assert.ok(triggerMatch, 'protect_root_super_admin trigger must exist');
    assert.match(triggerMatch[0], /IF\s*\(TG_OP\s*=\s*'DELETE'\)\s*THEN\s+RETURN OLD;/);
  });

  it('BLOCKER-03: Server strictly enforces AAL2 & GoTrue TOTP factor ownership, 72h expiry lock, and compensating rollback', async () => {
    const rootId = '00000000-0000-4000-8000-000000000001';
    const newStaffId = '00000000-0000-4000-8000-000000000303';
    const customerId = '00000000-0000-4000-8000-000000000404';
    const adminUserId = '00000000-0000-4000-8000-000000000505';

    const rootUser = {
      id: rootId,
      email: 'admin@haritjal.in',
      app_metadata: { role: 'super_admin', is_root_super_admin: true, is_blocked: false, totp_enabled: true },
      factors: [{ id: 'fac_root', factor_type: 'totp', status: 'verified' }],
      staffRow: { id: rootId, role: 'super_admin', is_blocked: false, is_root_super_admin: true },
    };
    const firstLoginStaff = {
      id: newStaffId,
      email: 'new.staff@haritjal.in',
      app_metadata: {
        role: 'staff',
        is_first_login: true,
        temporary_password_expires_at: Date.now() + 60 * 60 * 1000,
        is_blocked: false,
        totp_enabled: false,
      },
      factors: [{ id: 'fac_verified_staff', factor_type: 'totp', status: 'verified' }],
      staffRow: { id: newStaffId, role: 'staff', is_blocked: false, is_first_login: true },
    };
    const expiredStaff = {
      id: '00000000-0000-4000-8000-000000000606',
      email: 'expired.staff@haritjal.in',
      app_metadata: {
        role: 'staff',
        is_first_login: true,
        temporary_password_expires_at: Date.now() - 5000,
        is_blocked: false,
      },
      factors: [{ id: 'fac_exp', factor_type: 'totp', status: 'verified' }],
      staffRow: { id: '00000000-0000-4000-8000-000000000606', role: 'staff', is_blocked: false, is_first_login: true },
    };
    const customerUser = {
      id: customerId,
      email: 'buyer@hotel.com',
      user_metadata: { role: 'super_admin' },
      app_metadata: { role: 'customer' },
      factors: [{ id: 'fac_cust', factor_type: 'totp', status: 'verified' }],
    };
    const nonRootAdmin = {
      id: adminUserId,
      email: 'ops.admin@haritjal.in',
      app_metadata: { role: 'admin', is_blocked: false, is_root_super_admin: false },
      factors: [{ id: 'fac_adm', factor_type: 'totp', status: 'verified' }],
      staffRow: { id: adminUserId, role: 'admin', is_blocked: false, is_root_super_admin: false },
    };

    const jwtRootAal1 = makeFakeJwt({ sub: rootId, aal: 'aal1' });
    const jwtRootAal2 = makeFakeJwt({ sub: rootId, aal: 'aal2' });
    const jwtStaffAal1 = makeFakeJwt({ sub: newStaffId, aal: 'aal1' });
    const jwtStaffAal2 = makeFakeJwt({ sub: newStaffId, aal: 'aal2' });
    const jwtExpiredAal2 = makeFakeJwt({ sub: expiredStaff.id, aal: 'aal2' });
    const jwtCustAal2 = makeFakeJwt({ sub: customerId, aal: 'aal2' });
    const jwtAdminAal2 = makeFakeJwt({ sub: adminUserId, aal: 'aal2' });

    const tokenMap = new Map([
      [jwtRootAal1, rootUser],
      [jwtRootAal2, rootUser],
      [jwtStaffAal1, firstLoginStaff],
      [jwtStaffAal2, firstLoginStaff],
      [jwtExpiredAal2, expiredStaff],
      [jwtCustAal2, customerUser],
      [jwtAdminAal2, nonRootAdmin],
    ]);

    const mockDb = createStatefulMockSupabaseAdmin(
      [rootUser, firstLoginStaff, expiredStaff, customerUser, nonRootAdmin],
      { tokenMap }
    );
    const deps = {
      createAdminClient: () => mockDb.client,
      getEnv: (k) => (k === 'SUPABASE_URL' ? 'https://mock.supabase.co' : k === 'SUPABASE_SERVICE_ROLE_KEY' ? 'mock_srv' : undefined),
    };

    // 1. AAL1 Super Admin rejected from create_staff_user
    const aal1Create = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtRootAal1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_staff_user',
          name: 'Test',
          designation: 'Staff',
          email: 't@haritjal.in',
          phone: '9876543210',
          role: 'staff',
        }),
      }),
      deps
    );
    assert.strictEqual(aal1Create.status, 403);

    // 2. Non-Super-Admin (`role: 'admin'`) EVEN AT AAL2 rejected from create_staff_user
    const nonSuperCreate = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtAdminAal2}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_staff_user',
          name: 'Test',
          designation: 'Staff',
          email: 't@haritjal.in',
          phone: '9876543210',
          role: 'staff',
        }),
      }),
      deps
    );
    assert.strictEqual(nonSuperCreate.status, 403);

    // 3. Super Admin AAL2 CANNOT mint another `super_admin`
    const escalateRoleCreate = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtRootAal2}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_staff_user',
          name: 'Fake Root',
          designation: 'Director',
          email: 'fake.root@haritjal.in',
          phone: '9876543210',
          role: 'super_admin',
          permissions: ['leads'],
        }),
      }),
      deps
    );
    assert.strictEqual(escalateRoleCreate.status, 400);

    // 4. Customer with user_metadata.role=super_admin at AAL2 CANNOT call complete_mfa_enrollment or setup
    const custMfaRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtCustAal2}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_mfa_enrollment', factorId: 'fac_cust' }),
      }),
      deps
    );
    assert.strictEqual(custMfaRes.status, 403);

    // 5. Staff first-login at AAL1 (unverified MFA) rejected
    const setupAal1Res = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtStaffAal1}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_staff_first_time_setup',
          newPassword: 'StrongPassword123',
          factorId: 'fac_verified_staff',
        }),
      }),
      deps
    );
    assert.strictEqual(setupAal1Res.status, 403);

    // 6. Staff first-login at AAL2 with unowned/wrong factorId rejected
    const setupWrongFactorRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtStaffAal2}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_staff_first_time_setup',
          newPassword: 'StrongPassword123',
          factorId: 'fac_root',
        }),
      }),
      deps
    );
    assert.strictEqual(setupWrongFactorRes.status, 403);

    // 7. Expired invitation is locked on server (`ban_duration: "876000h"`, `invitation_expired: true`)
    const expiredRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtExpiredAal2}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_staff_first_time_setup',
          newPassword: 'StrongPassword123',
          factorId: 'fac_exp',
        }),
      }),
      deps
    );
    assert.strictEqual(expiredRes.status, 403);
    assert.strictEqual(mockDb.users.get(expiredStaff.id)?.ban_duration, '876000h');
    assert.strictEqual(mockDb.users.get(expiredStaff.id)?.app_metadata?.invitation_expired, true);

    // 8. Valid first-login setup succeeds & invalidates temp window permanently
    const validSetupRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtStaffAal2}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_staff_first_time_setup',
          newPassword: 'StrongPassword123',
          factorId: 'fac_verified_staff',
        }),
      }),
      deps
    );
    assert.strictEqual(validSetupRes.status, 200);
    assert.strictEqual(mockDb.users.get(newStaffId)?.app_metadata?.is_first_login, false);
    assert.strictEqual(mockDb.users.get(newStaffId)?.app_metadata?.temporary_password_expires_at, null);
    assert.strictEqual(mockDb.users.get(newStaffId)?.app_metadata?.totp_enabled, true);

    // 9. Compensating rollback if staff_users upsert fails during create_staff_user
    const rollbackDb = createStatefulMockSupabaseAdmin([rootUser], {
      tokenMap: new Map([[jwtRootAal2, rootUser]]),
      failStaffUpsert: true,
    });
    const rollbackRes = await staffHandler.handleStaffAuthRequest(
      new Request('https://edge.local/staff-auth', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtRootAal2}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_staff_user',
          name: 'Rollback Check',
          designation: 'Staff',
          email: 'rollback@haritjal.in',
          phone: '9876543210',
          role: 'sales_manager',
          permissions: ['leads'],
        }),
      }),
      { createAdminClient: () => rollbackDb.client, getEnv: deps.getEnv }
    );
    assert.strictEqual(rollbackRes.status, 500);
    assert.ok(rollbackDb.operationTrace.includes('auth:deleteUser'), 'Must rollback orphaned auth.users identity if staff_users upsert fails');
  });

  it('BLOCKER-04: Canonical Role Helpers, Fail-Closed Staff Login & Removal of users[0] / Hardcoded Roots', async () => {
    assert.strictEqual(roles.isSuperAdminRole('super_admin'), true);
    assert.strictEqual(roles.isSuperAdminRole('Super Admin'), true);
    assert.strictEqual(roles.isSuperAdminRole('admin'), false);
    assert.strictEqual(roles.isStaffRole('customer'), false);
    assert.strictEqual(roles.formatRoleDisplay('super_admin'), 'Super Admin');
    assert.strictEqual(roles.formatRoleDisplay('operations_lead'), 'Operations Lead');
    assert.strictEqual(
      roles.ASSIGNABLE_STAFF_ROLES.some((r) => r.value === 'super_admin'),
      false,
      'Super Admin must not be selectable in assignable staff roles'
    );

    process.env.VITE_APP_ENV = 'production';
    assert.deepStrictEqual(StorageService.getUsers(), [], 'Production mode must not seed local demo staff accounts');

    // AdminPortal must not contain users[0] fallback
    const adminPortalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'AdminPortal.tsx'), 'utf8');
    assert.strictEqual(adminPortalSrc.includes('users[0]'), false);

    // Client login fails closed when network/GoTrue is unreachable in production
    const failedStaffLogin = await AdminAuthService.validateCredentials('admin@haritjal.in', 'SomePassword123!');
    assert.strictEqual(failedStaffLogin.success, false);
    assert.match(failedStaffLogin.error || '', /unavailable|Supabase Auth/i);

    // Client TOTP check fails closed on missing/invalid code or when Supabase network fails in production
    const failedTotp = await AdminAuthService.verifyTotpAndCreateSession(
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Root',
        email: 'admin@haritjal.in',
        role: 'super_admin',
        status: 'Active',
        inquiriesAssigned: 0,
      },
      '123456'
    );
    assert.strictEqual(failedTotp.success, false);
  });

  it('BLOCKER-05: Customer Onboarding Trigger, Schema Reconciliation & Hardened Rollback SQL', () => {
    const migrationSql = fs.readFileSync(
      path.join(ROOT_DIR, 'AUDIT_REPORT', 'PHASE_1G3_REMEDIATION', 'CONSOLIDATED_MIGRATION.sql'),
      'utf8'
    );
    const rollbackDoc = fs.readFileSync(
      path.join(ROOT_DIR, 'AUDIT_REPORT', 'PHASE_1G3_REMEDIATION', 'UPDATED_ROLLBACK_AND_INCIDENT_RECOVERY_PLAN.md'),
      'utf8'
    );

    assert.ok(migrationSql.includes('CREATE OR REPLACE FUNCTION public.handle_new_customer()'));
    assert.ok(migrationSql.includes('CREATE TRIGGER on_auth_user_created_customer'));
    assert.ok(migrationSql.includes('CREATE POLICY "Customer can insert own profile"'));
    assert.ok(migrationSql.includes('CREATE POLICY "Customer can place own order"'));
    assert.ok(migrationSql.includes('CREATE POLICY "Customer can book tasting consultation"'));
    assert.ok(migrationSql.includes('ALTER TABLE public.security_blocks ADD COLUMN IF NOT EXISTS source_vector'));
    assert.ok(migrationSql.includes('ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS template_type'));
    assert.ok(migrationSql.includes('idx_staff_single_root_super_admin'));
    assert.strictEqual(migrationSql.includes('vikram@haritjal.in'), false);
    assert.strictEqual(rollbackDoc.includes('staff_users_uuid_new'), false, 'Fake non-existent column rollback must be eliminated');
  });

  it('BLOCKER-06: Customer Production Login & Registration Fail Closed + Zero Mock/Passwordless Fallbacks', async () => {
    process.env.VITE_APP_ENV = 'production';

    // 1. Seeded demo credentials must NEVER authenticate when cloud GoTrue fails in production
    const loginAttempt = await CustomerAuthService.loginWithSupabaseAuth('darbar@royalhospitality.in', 'password123');
    assert.strictEqual(loginAttempt.success, false);
    assert.match(loginAttempt.error || '', /temporarily unavailable/);

    // 2. Passwordless CustomerAuthService.login(email) must return null
    assert.strictEqual(CustomerAuthService.login('darbar@royalhospitality.in'), null);
    assert.strictEqual(CustomerAuthService.login('darbar@royalhospitality.in', '   '), null);

    // 3. Registration failure in production must leave zero local customer session
    const regAttempt = await CustomerAuthService.signUpWithSupabaseAuth({
      restaurantName: 'Test Hotel',
      ownerName: 'Tester',
      email: 'tester@hotel.in',
      phone: '9876543210',
      city: 'Delhi',
      password: 'StrongPassword123',
    });
    assert.strictEqual(regAttempt.success, false);
    assert.strictEqual(CustomerAuthService.getCurrentCustomer(), null);

    // 4. UI files must have zero hardcoded demo credentials active in production and zero loginWithSecurity fallback
    for (const relPath of [
      'src/pages/ContactPage.tsx',
      'src/components/BookCallModal.tsx',
      'src/components/CustomerPortalModal.tsx',
      'src/pages/TrackPage.tsx',
      'src/App.tsx',
    ]) {
      const content = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
      assert.strictEqual(content.includes('loginWithSecurity('), false, `${relPath} must not bypass to loginWithSecurity`);
    }
    const contactSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'pages', 'ContactPage.tsx'), 'utf8');
    assert.strictEqual(contactSrc.includes('password123'), false, 'ContactPage must not create accounts with hardcoded password123');
  });

  it('HIGH-01 / MEDIUM: validate-admin-route uses safe IP hop, enforces 10/min rate limit, and fails closed in production', async () => {
    // 1. Proxy header priority tests
    assert.strictEqual(
      routeHandler.deriveClientKey(
        new Request('https://edge.local/validate-admin-route', {
          headers: { 'x-forwarded-for': '1.2.3.4, 198.51.100.2', 'cf-connecting-ip': '203.0.113.5' },
        })
      ),
      'cf:203.0.113.5'
    );
    assert.strictEqual(
      routeHandler.deriveClientKey(
        new Request('https://edge.local/validate-admin-route', {
          headers: { 'x-forwarded-for': 'spoofed.ip, 198.51.100.77' },
        })
      ),
      'xff:198.51.100.77'
    );

    // 2. Server IST route validation & rate limiter
    const fixedNow = new Date('2026-11-09T03:30:00.000Z'); // 09:00 IST on 09/11/26 -> 0911260900
    const expectedToken = routeHandler.getISTToken(fixedNow);
    assert.strictEqual(expectedToken, '0911260900');

    const rateLimits = new Map();
    const adminMock = {
      async rpc(name, params = {}) {
        if (name === 'consume_edge_rate_limit') {
          const key = params.p_bucket_key;
          const maxReq = params.p_max_requests || 10;
          const current = (rateLimits.get(key) || 0) + 1;
          rateLimits.set(key, current);
          if (current > maxReq) {
            return { data: [{ allowed: false, current_count: current, retry_after_seconds: 60 }], error: null };
          }
          return { data: [{ allowed: true, current_count: current, retry_after_seconds: 60 }], error: null };
        }
        return { data: null, error: null };
      },
    };
    const deps = {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test_service_role_secret_never_leak_999',
      })[k],
      createAdminClient: () => adminMock,
      now: () => fixedNow,
    };

    const okRes = await routeHandler.handleValidateRouteRequest(
      new Request('https://edge.local/validate-admin-route', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.9', origin: 'https://haritjal.in', 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeToken: '0911260900' }),
      }),
      deps
    );
    assert.strictEqual(okRes.status, 200);
    assert.strictEqual((await okRes.json()).valid, true);

    const expiredRes = await routeHandler.handleValidateRouteRequest(
      new Request('https://edge.local/validate-admin-route', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.9', origin: 'https://haritjal.in', 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeToken: '0911260859' }),
      }),
      deps
    );
    assert.strictEqual(expiredRes.status, 403);

    // Remaining requests up to 10 allowed; 11th returns 429
    for (let i = 3; i <= 10; i++) {
      const r = await routeHandler.handleValidateRouteRequest(
        new Request('https://edge.local/validate-admin-route', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '203.0.113.9', origin: 'https://haritjal.in', 'Content-Type': 'application/json' },
          body: JSON.stringify({ routeToken: '0911260900' }),
        }),
        deps
      );
      assert.strictEqual(r.status, 200);
    }
    const throttledRes = await routeHandler.handleValidateRouteRequest(
      new Request('https://edge.local/validate-admin-route', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.9', origin: 'https://haritjal.in', 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeToken: '0911260900' }),
      }),
      deps
    );
    assert.strictEqual(throttledRes.status, 429);

    // 3. Frontend authoritative router fails closed when server Edge Function is unreachable in production
    process.env.VITE_APP_ENV = 'production';
    const currentIst = DynamicAdminRouter.generateISTToken();
    const failClosedRoute = await DynamicAdminRouter.validateRouteAuthoritative(currentIst);
    assert.strictEqual(failClosedRoute.isValid, false);
    assert.strictEqual(failClosedRoute.serverVerified, false);
  });

  it('PRODUCTION BUNDLE HYGIENE: Compiled dist/assets contain zero leaked secrets, legacy OTP secret, or legacy email seeds', () => {
    const assetsDir = path.join(ROOT_DIR, 'dist', 'assets');
    assert.ok(fs.existsSync(assetsDir), 'dist/assets must exist from build');

    const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    assert.ok(jsFiles.length >= 5, 'Expected code-split JS bundles');

    for (const file of jsFiles) {
      const bundle = fs.readFileSync(path.join(assetsDir, file), 'utf8');
      assert.strictEqual(bundle.includes('JBSWY3DPEHPK3PXP'), false, `${file} must not leak legacy hardcoded TOTP seed`);
      assert.strictEqual(bundle.includes('service_role'), false, `${file} must not reference service_role`);
      assert.strictEqual(bundle.includes('vikram@haritjal.in'), false, `${file} must not include retired secondary seed email`);
    }
  });
});

