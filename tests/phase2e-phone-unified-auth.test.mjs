/**
 * ====================================================================
 * HARIT JAL™ (हरित जल) — PHASE 2E TEST SUITE
 * PHONE/EMAIL LOGIN RESOLUTION & UNIFIED LOGIN UI VERIFICATION
 * ====================================================================
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT_DIR = process.cwd();

// Setup in-memory Web Storage polyfill on globalThis before loading Vite modules
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, val) => memoryStorage.set(key, String(val)),
  removeItem: (key) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
};
globalThis.sessionStorage = {
  getItem: (key) => memoryStorage.get(key) ?? null,
  setItem: (key, val) => memoryStorage.set(key, String(val)),
  removeItem: (key) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
};

describe('HARIT JAL™ Phase 2E Phone/Email Login Resolution & Unified UI Suite', () => {
  let viteServer;
  let phoneUtils;
  let staffAuthHandler;
  let _UnifiedAuthService;
  let AdminAuthService;
  let CustomerAuthService;
  let roles;

  before(async () => {
    viteServer = await createServer({
      root: ROOT_DIR,
      server: { middlewareMode: true, watch: null },
      appType: 'custom',
      logLevel: 'silent',
    });

    phoneUtils = await viteServer.ssrLoadModule('/src/services/phoneUtils.ts');
    const unifiedAuthMod = await viteServer.ssrLoadModule('/src/services/unifiedAuth.ts');
    _UnifiedAuthService = unifiedAuthMod.UnifiedAuthService;
    const adminAuthMod = await viteServer.ssrLoadModule('/src/services/adminAuth.ts');
    AdminAuthService = adminAuthMod.AdminAuthService;
    const custAuthMod = await viteServer.ssrLoadModule('/src/services/customerAuth.ts');
    CustomerAuthService = custAuthMod.CustomerAuthService;
    const rolesMod = await viteServer.ssrLoadModule('/src/services/roles.ts');
    roles = rolesMod;

    // Load staff-auth handler
    const handlerPath = path.join(ROOT_DIR, 'supabase', 'functions', 'staff-auth', 'handler.ts');
    staffAuthHandler = await viteServer.ssrLoadModule(handlerPath);

    // Seed test directory in memoryStorage for offline resolution tests
    const storageMod = await viteServer.ssrLoadModule('/src/services/storage.ts');
    if (storageMod.StorageService && storageMod.DEV_SEED_USERS) {
      storageMod.StorageService.setUsers(storageMod.DEV_SEED_USERS);
    }
  });

  after(async () => {
    if (viteServer) {
      await viteServer.close();
    }
  });

  // --------------------------------------------------------------------
  // TEST 1: Indian Mobile Number Normalization & E.164 Standards
  // --------------------------------------------------------------------
  it('TEST-2E-01: Correctly normalizes Indian mobile numbers according to E.164 & TRAI standards', () => {
    const validCases = [
      { input: '9811234567', expectedE164: '+919811234567', expectedDigits: '9811234567' },
      { input: '+919811234567', expectedE164: '+919811234567', expectedDigits: '9811234567' },
      { input: '+91 98112 34567', expectedE164: '+919811234567', expectedDigits: '9811234567' },
      { input: '09811234567', expectedE164: '+919811234567', expectedDigits: '9811234567' },
      { input: '919811234567', expectedE164: '+919811234567', expectedDigits: '9811234567' },
      { input: '0919811234567', expectedE164: '+919811234567', expectedDigits: '9811234567' },
      { input: '+91 (98112) 34567', expectedE164: '+919811234567', expectedDigits: '9811234567' },
      { input: '6299293497', expectedE164: '+916299293497', expectedDigits: '6299293497' },
      { input: '7823456789', expectedE164: '+917823456789', expectedDigits: '7823456789' },
      { input: '8923456789', expectedE164: '+918923456789', expectedDigits: '8923456789' },
    ];

    for (const testCase of validCases) {
      const res = phoneUtils.normalizeIndianPhoneNumber(testCase.input);
      assert.strictEqual(res.isValid, true, `Should be valid: ${testCase.input}`);
      assert.strictEqual(res.e164, testCase.expectedE164);
      assert.strictEqual(res.digits10, testCase.expectedDigits);
    }

    const invalidCases = [
      '1234567890', // Starts with 1 (not mobile)
      '5811234567', // Starts with 5 (not mobile)
      '98112345',   // Too short (8 digits)
      '9811234567890123', // Too long
      'abc@haritjal.in',  // Email
      '',                 // Empty
    ];

    for (const testCase of invalidCases) {
      const res = phoneUtils.normalizeIndianPhoneNumber(testCase);
      assert.strictEqual(res.isValid, false, `Should be invalid: ${testCase}`);
    }
  });

  // --------------------------------------------------------------------
  // TEST 2: Admin Email Resolution
  // --------------------------------------------------------------------
  it('TEST-2E-02: Admin user resolution by email confirms identity and admin role', () => {
    const user = AdminAuthService.findUserByIdentifier('admin@haritjal.in');
    assert.ok(user, 'Admin must be found by email identifier');
    assert.strictEqual(user.role, 'admin');
    assert.strictEqual(roles.isAdminRole(user.role), true, 'Role must satisfy isAdminRole');
  });

  // --------------------------------------------------------------------
  // TEST 3: Admin Mobile Number Resolution
  // --------------------------------------------------------------------
  it('TEST-2E-03: Admin login with registered mobile number resolves identity and requires next-step TOTP', () => {
    const user = AdminAuthService.findUserByIdentifier('+916299293497');
    assert.ok(user, 'Admin must be found by registered mobile number');
    assert.strictEqual(user.email, 'admin@haritjal.in');
    assert.strictEqual(roles.isAdminRole(user.role), true);
  });

  // --------------------------------------------------------------------
  // TEST 4: Staff Member Email Resolution
  // --------------------------------------------------------------------
  it('TEST-2E-04: Staff member user resolution by email confirms identity and staff role', () => {
    const user = AdminAuthService.findUserByIdentifier('rohit.ops@haritjal.in');
    assert.ok(user, 'Staff must be found by email identifier');
    assert.strictEqual(user.role, 'operations_lead');
    assert.strictEqual(roles.isStaffMemberRole(user.role), true, 'Role must satisfy isStaffMemberRole');
  });

  // --------------------------------------------------------------------
  // TEST 5: Staff Member Mobile Number Resolution
  // --------------------------------------------------------------------
  it('TEST-2E-05: Staff member login with registered mobile number resolves identity and requires next-step TOTP', () => {
    const user = AdminAuthService.findUserByIdentifier('9822345678');
    assert.ok(user, 'Staff must be found by 10-digit mobile number');
    assert.strictEqual(user.email, 'rohit.ops@haritjal.in');
    assert.strictEqual(roles.isStaffMemberRole(user.role), true);
  });

  // --------------------------------------------------------------------
  // TEST 6: Partner Email + Password grants access WITHOUT TOTP
  // --------------------------------------------------------------------
  it('TEST-2E-06: Partner login with email grants access WITHOUT TOTP requirement', async () => {
    const partner = CustomerAuthService.register({
      restaurantName: 'Grand Murthal Haveli',
      ownerName: 'Harpreet Singh',
      email: 'haveli@murthal.com',
      phone: '+91 99887 76655',
      city: 'Murthal',
      password: 'PartnerSecure#2026',
    });
    assert.ok(partner);

    const res = CustomerAuthService.loginWithSecurity('haveli@murthal.com', 'PartnerSecure#2026');
    assert.strictEqual(res.success, true);
    assert.ok(res.customer, 'Must return authenticated partner profile');
    assert.strictEqual(res.customer.restaurantName, 'Grand Murthal Haveli');
  });

  // --------------------------------------------------------------------
  // TEST 7: Partner Mobile Number + Password grants access WITHOUT TOTP
  // --------------------------------------------------------------------
  it('TEST-2E-07: Partner login with registered mobile number grants access WITHOUT TOTP requirement', async () => {
    const res = CustomerAuthService.loginWithSecurity('+91 99887 76655', 'PartnerSecure#2026');
    assert.strictEqual(res.success, true);
    assert.ok(res.customer, 'Must return authenticated partner profile');
    assert.strictEqual(res.customer.email, 'haveli@murthal.com');
  });

  // --------------------------------------------------------------------
  // TEST 8: Server-Side Phone Login with Unregistered Mobile (Generic 401)
  // --------------------------------------------------------------------
  it('TEST-2E-08: Server-side phone_login action fails closed with generic 401 for unregistered mobile', async () => {
    const mockAdmin = {
      from: (_table) => ({
        select: (_cols) => ({
          eq: (_col, _val) => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      auth: {
        getUser: async () => ({ data: { user: null }, error: { message: 'no user' } }),
      },
    };

    const req = new Request('https://example.supabase.co/functions/v1/staff-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://haritjal.in' },
      body: JSON.stringify({
        action: 'phone_login',
        phone: '+91 91234 56789',
        password: 'SomePassword123',
        accountType: 'admin',
      }),
    });

    const res = await staffAuthHandler.handleStaffAuthRequest(req, {
      createAdminClient: () => mockAdmin,
      getEnv: (k) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' })[k],
    });

    assert.strictEqual(res.status, 401, 'Unregistered phone number must yield generic 401');
    const json = await res.json();
    assert.ok(json.error.includes('Invalid mobile number or password'), 'Generic non-enumerating error message required');
  });

  // --------------------------------------------------------------------
  // TEST 9: Server-Side Phone Login with Incorrect Password (Generic 401)
  // --------------------------------------------------------------------
  it('TEST-2E-09: Server-side phone_login action yields identical generic 401 when password fails', async () => {
    const mockAdmin = {
      from: (_table) => ({
        select: (_cols) => ({
          eq: (_col, _val) => ({
            maybeSingle: async () => ({
              data: { id: 'admin-1', email: 'admin@haritjal.in', phone: '+919811234567', role: 'super_admin', is_blocked: false },
              error: null,
            }),
          }),
        }),
      }),
      auth: {
        signInWithPassword: async () => ({
          data: { session: null, user: null },
          error: { message: 'Invalid login credentials' },
        }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    };

    const req = new Request('https://example.supabase.co/functions/v1/staff-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://haritjal.in' },
      body: JSON.stringify({
        action: 'phone_login',
        phone: '+919811234567',
        password: 'WrongPassword#123',
        accountType: 'admin',
      }),
    });

    const res = await staffAuthHandler.handleStaffAuthRequest(req, {
      createAdminClient: () => mockAdmin,
      getEnv: (k) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' })[k],
    });

    assert.strictEqual(res.status, 401, 'Invalid password must yield generic 401');
    const json = await res.json();
    assert.ok(json.error.includes('Invalid mobile number or password'), 'Must return uniform generic error');
  });

  // --------------------------------------------------------------------
  // TEST 10: Duplicate Mobile Number Rejection (Ambiguity Defense)
  // --------------------------------------------------------------------
  it('TEST-2E-10: Server-side phone_login rejects multiple accounts sharing same mobile number', async () => {
    const mockAdmin = {
      from: (_table) => ({
        select: (_cols) => ({
          eq: (_col, _val) => Promise.resolve({
            data: [
              { id: 'admin-1', email: 'admin1@haritjal.in', phone: '+919811234567', role: 'admin', is_blocked: false },
              { id: 'admin-2', email: 'admin2@haritjal.in', phone: '+919811234567', role: 'admin', is_blocked: false },
            ],
            error: null,
          }),
        }),
      }),
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    };

    const req = new Request('https://example.supabase.co/functions/v1/staff-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://haritjal.in' },
      body: JSON.stringify({
        action: 'phone_login',
        phone: '+919811234567',
        password: 'AnyPassword#123',
        accountType: 'admin',
      }),
    });

    const res = await staffAuthHandler.handleStaffAuthRequest(req, {
      createAdminClient: () => mockAdmin,
      getEnv: (k) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' })[k],
    });

    assert.strictEqual(res.status, 400, 'Duplicate mobile number matches must be rejected with 400');
    const json = await res.json();
    assert.ok(json.error.includes('Multiple accounts match this mobile number'), 'Must instruct user to use email');
  });

  // --------------------------------------------------------------------
  // TEST 11: Blocked Account Access Revocation
  // --------------------------------------------------------------------
  it('TEST-2E-11: Suspended / Blocked staff account fails closed via phone login', async () => {
    const mockAdmin = {
      from: (_table) => ({
        select: (_cols) => ({
          eq: (_col, _val) => ({
            maybeSingle: async () => ({
              data: { id: 'blocked-staff-1', email: 'blocked@haritjal.in', phone: '+919811234567', role: 'staff', is_blocked: true },
              error: null,
            }),
          }),
        }),
      }),
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    };

    const req = new Request('https://example.supabase.co/functions/v1/staff-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://haritjal.in' },
      body: JSON.stringify({
        action: 'phone_login',
        phone: '+919811234567',
        password: 'ValidPassword#123',
        accountType: 'staff',
      }),
    });

    const res = await staffAuthHandler.handleStaffAuthRequest(req, {
      createAdminClient: () => mockAdmin,
      getEnv: (k) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' })[k],
    });

    assert.strictEqual(res.status, 403, 'Blocked staff account must return HTTP 403 Forbidden');
    const json = await res.json();
    assert.ok(json.error.includes('blocked or suspended'), 'Error must specify account suspension');
  });

  // --------------------------------------------------------------------
  // TEST 12: Successful Server-Side Phone Login returns GoTrue Session
  // --------------------------------------------------------------------
  it('TEST-2E-12: Valid mobile login issues authentic GoTrue session without revealing email beforehand', async () => {
    const mockAdmin = {
      from: (_table) => ({
        select: (_cols) => ({
          eq: (_col, _val) => ({
            maybeSingle: async () => ({
              data: { id: 'super-admin-1', email: 'superadmin@haritjal.in', phone: '+919811234567', role: 'super_admin', is_blocked: false },
              error: null,
            }),
          }),
        }),
      }),
      auth: {
        signInWithPassword: async ({ email, password }) => {
          assert.strictEqual(email, 'superadmin@haritjal.in');
          assert.strictEqual(password, 'CorrectPassword#2026');
          return {
            data: {
              session: { access_token: 'valid_access_jwt', refresh_token: 'valid_refresh_token' },
              user: { id: 'super-admin-1', email: 'superadmin@haritjal.in', app_metadata: { role: 'super_admin' } },
            },
            error: null,
          };
        },
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    };

    const req = new Request('https://example.supabase.co/functions/v1/staff-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': 'https://haritjal.in' },
      body: JSON.stringify({
        action: 'phone_login',
        phone: '+91 98112 34567',
        password: 'CorrectPassword#2026',
        accountType: 'admin',
      }),
    });

    const res = await staffAuthHandler.handleStaffAuthRequest(req, {
      createAdminClient: () => mockAdmin,
      getEnv: (k) => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' })[k],
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.session?.access_token, 'valid_access_jwt');
    assert.strictEqual(json.user?.email, 'superadmin@haritjal.in');
  });

  // --------------------------------------------------------------------
  // TEST 13: Cross-Role Boundary Protection
  // --------------------------------------------------------------------
  it('TEST-2E-13: Admin identity attempting Staff portal is rejected with role mismatch', async () => {
    const adminUser = AdminAuthService.findUserByIdentifier('admin@haritjal.in');
    assert.ok(adminUser);
    assert.strictEqual(roles.isStaffMemberRole(adminUser.role), false);
    assert.strictEqual(roles.isAdminRole(adminUser.role), true);
  });

  // --------------------------------------------------------------------
  // TEST 14: Unified Login Card Integration in AdminPage & CustomerPortalModal
  // --------------------------------------------------------------------
  it('TEST-2E-14: AdminPage.tsx and CustomerPortalModal.tsx embed UnifiedLoginCard without duplicate forms', () => {
    const adminPageSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'pages', 'AdminPage.tsx'), 'utf8');
    const customerModalSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'CustomerPortalModal.tsx'), 'utf8');

    // AdminPage integration
    assert.ok(adminPageSrc.includes('<UnifiedLoginCard'), 'AdminPage must render UnifiedLoginCard');
    assert.ok(!adminPageSrc.includes('handleVerifyCredentials'), 'AdminPage must not contain legacy handleVerifyCredentials');
    assert.ok(!adminPageSrc.includes('handleVerifyTotp'), 'AdminPage must not contain legacy handleVerifyTotp');

    // CustomerPortalModal integration
    assert.ok(customerModalSrc.includes('<UnifiedLoginCard'), 'CustomerPortalModal must render UnifiedLoginCard');
    assert.ok(!customerModalSrc.includes('handleLogin ='), 'CustomerPortalModal must not retain legacy duplicate handleLogin');
  });

  // --------------------------------------------------------------------
  // TEST 15: Zero Plaintext Demo Credentials in UI
  // --------------------------------------------------------------------
  it('TEST-2E-15: Zero demo credentials exist in UnifiedLoginCard or login pages', () => {
    const unifiedCardSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'auth', 'UnifiedLoginCard.tsx'), 'utf8');
    assert.ok(!unifiedCardSrc.includes('admin@demo.com'), 'Must not contain demo emails');
    assert.ok(!unifiedCardSrc.includes('password123'), 'Must not contain demo passwords');
  });
});
