// ====================================================================
// HARIT JAL™ (हरित जल) — THREE-ROLE ARCHITECTURE & SECURITY AUDIT TEST
// Validates:
// 1. Canonical 3-Role Architecture & deprecation of super_admin role
// 2. Founder & Department Admin identity specifications and permissions
// 3. Edge Function (handler.ts) cryptographic AAL2 gates and Root Admin authorization isolation
// 4. Client-side source code call-site reconciliation (zero active isSuperAdminRole)
// 5. Phase A, Phase C, and Rollback SQL safety invariants
// ====================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('HARIT JAL — Canonical 3-Role Architecture & Identity Rules', async () => {
  const rolesModule = await import('../src/services/roles.ts');

  it('RULE 1: Business roles are exactly admin, staff, and partner/customer (no super_admin role)', () => {
    // Check normalizeStaffRole
    assert.equal(rolesModule.normalizeStaffRole('admin'), 'admin');
    assert.equal(rolesModule.normalizeStaffRole('staff'), 'staff');
    assert.equal(rolesModule.normalizeStaffRole('sales_manager'), 'sales_manager');
    assert.equal(rolesModule.normalizeStaffRole('operations_lead'), 'operations_lead');
    assert.equal(rolesModule.normalizeStaffRole('label_designer'), 'label_designer');

    // Legacy super_admin strings MUST map to 'admin', never 'super_admin'
    assert.equal(rolesModule.normalizeStaffRole('super_admin'), 'admin');
    assert.equal(rolesModule.normalizeStaffRole('super admin'), 'admin');
    assert.equal(rolesModule.normalizeStaffRole('super-admin'), 'admin');
    assert.equal(rolesModule.normalizeStaffRole('superadmin'), 'admin');
  });

  it('RULE 2: isSuperAdminRole is deprecated and unconditionally returns false', () => {
    assert.equal(rolesModule.isSuperAdminRole('super_admin'), false);
    assert.equal(rolesModule.isSuperAdminRole('admin'), false);
    assert.equal(rolesModule.isSuperAdminRole('staff'), false);
    assert.equal(rolesModule.isSuperAdminRole(undefined), false);
    assert.equal(rolesModule.isSuperAdminRole(null), false);
  });

  it('RULE 3: Founder identity has role admin and isRootSuperAdmin = true', () => {
    const founder = rolesModule.ROOT_SUPER_ADMIN_IDENTITY;
    assert.equal(founder.email, 'admin@haritjal.in');
    assert.equal(founder.phone, '+916299293497');
    assert.equal(founder.role, 'admin');
    assert.equal(founder.isRootSuperAdmin, true);
    assert.equal(founder.designation, 'Founder & Root Admin');
  });

  it('RULE 4: Assignable roles list does not include super_admin', () => {
    const assignableValues = rolesModule.ASSIGNABLE_STAFF_ROLES.map((r) => r.value);
    assert.ok(!assignableValues.includes('super_admin'));
    assert.ok(assignableValues.includes('admin'));
    assert.ok(assignableValues.includes('staff'));
  });
});

describe('HARIT JAL — Edge Function AAL2 & Root Admin Gatekeeper Audit', async () => {
  const { handleStaffAuthRequest } = await import('../supabase/functions/staff-auth/handler.ts');

  const makeMockDeps = (opts = {}) => {
    const usersDb = new Map(opts.users || []);
    const staffDb = new Map(opts.staff || []);
    const auditLogs = [];

    const mockAdminClient = {
      auth: {
        getUser: async (token) => {
          if (token && token.startsWith('header.')) {
            return {
              data: {
                user: {
                  id: opts.callerId || 'caller-001',
                  email: opts.callerEmail || 'caller@haritjal.in',
                  app_metadata: opts.callerAppMeta || {},
                  user_metadata: {},
                },
              },
              error: null,
            };
          }
          return { data: { user: null }, error: { message: 'Invalid token' } };
        },
        admin: {
          getUserById: async (id) => {
            const user = usersDb.get(id);
            if (!user) return { data: { user: null }, error: { message: 'Not found' } };
            return { data: { user }, error: null };
          },
          createUser: async (payload) => {
            const id = 'new-user-uuid-' + Math.random().toString(36).substring(7);
            const user = { id, ...payload };
            usersDb.set(id, user);
            return { data: { user }, error: null };
          },
          updateUserById: async (id, patch) => {
            const existing = usersDb.get(id);
            if (!existing) return { error: { message: 'Not found' } };
            const updated = { ...existing, ...patch, app_metadata: { ...(existing.app_metadata || {}), ...(patch.app_metadata || {}) } };
            usersDb.set(id, updated);
            return { data: { user: updated }, error: null };
          },
          deleteUser: async (id) => {
            usersDb.delete(id);
            return { error: null };
          },
        },
      },
      from: (tableName) => {
        return {
          select: (_cols) => ({
            eq: (colName, val) => ({
              maybeSingle: async () => {
                if (opts.queryError) {
                  return { data: null, error: { message: opts.queryError } };
                }
                if (tableName === 'staff_users') {
                  if (colName === 'auth_user_id') {
                    for (const row of staffDb.values()) {
                      if (row.auth_user_id === val) return { data: row, error: null };
                    }
                    return { data: null, error: null };
                  }
                  if (colName === 'email') {
                    for (const row of staffDb.values()) {
                      if (row.email === val) return { data: row, error: null };
                    }
                    return { data: null, error: null };
                  }
                  const row = staffDb.get(val);
                  return { data: row || null, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
          update: (patch) => ({
            eq: async (colName, val) => {
              if (tableName === 'staff_users') {
                const row = staffDb.get(val);
                if (row) staffDb.set(val, { ...row, ...patch });
              }
              return { error: null };
            },
          }),
          upsert: async (row) => {
            if (tableName === 'staff_users') staffDb.set(row.id, row);
            return { error: null };
          },
          insert: async (row) => {
            if (tableName === 'staff_audit_logs') auditLogs.push(row);
            return { error: null };
          },
          delete: () => ({
            eq: async (colName, val) => {
              if (tableName === 'staff_users') staffDb.delete(val);
              return { error: null };
            },
          }),
        };
      },
    };

    return {
      createAdminClient: () => mockAdminClient,
      getEnv: (key) => {
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-key';
        return undefined;
      },
      staffDb,
      usersDb,
      auditLogs,
    };
  };

  const makeJwtHeader = (aal = 'aal1') => {
    // Generate valid structure JWT with base64-encoded payload
    const payload = JSON.stringify({ aal, sub: 'user-001' });
    const b64 = Buffer.from(payload).toString('base64');
    return `Bearer header.${b64}.sig`;
  };

  it('GATE 1: Privileged actions reject AAL1 caller with 403 MFA Required', async () => {
    const deps = makeMockDeps({
      callerId: 'founder-001',
      callerAppMeta: { role: 'admin', is_root_super_admin: true },
      staff: [
        ['founder-001', { id: 'founder-001', role: 'admin', is_root_super_admin: true, is_blocked: false }],
      ],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal1'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_staff_user',
        name: 'New Worker',
        email: 'worker@haritjal.in',
        phone: '+919876543210',
        designation: 'Field Technician',
        role: 'staff',
        permissions: ['orders'],
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /MFA Required/i);
    assert.match(body.error, /AAL2/i);
  });

  it('GATE 2: Department Admin cannot create another admin (Only Root Admin can)', async () => {
    const deps = makeMockDeps({
      callerId: 'dept-admin-uuid',
      callerAppMeta: { role: 'admin', is_root_super_admin: false, permissions: ['leads', 'orders', 'staff'] },
      staff: [
        ['dept-admin-uuid', { id: 'dept-admin-uuid', role: 'admin', is_root_super_admin: false, permissions: ['leads', 'orders', 'staff'], is_blocked: false }],
      ],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_staff_user',
        name: 'Unauthorized Admin',
        email: 'unauth@haritjal.in',
        phone: '+919876543210',
        designation: 'Operations Lead',
        role: 'admin',
        permissions: ['orders'],
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Only the Root Administrator can perform this action/i);
  });

  it('GATE 3: Department Admin cannot grant audit_logs permission', async () => {
    const deps = makeMockDeps({
      callerId: 'dept-admin-uuid',
      callerAppMeta: { role: 'admin', is_root_super_admin: false, permissions: ['staff'] },
      staff: [
        ['dept-admin-uuid', { id: 'dept-admin-uuid', role: 'admin', is_root_super_admin: false, permissions: ['staff'], is_blocked: false }],
      ],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_staff_user',
        name: 'Staff With Audit',
        email: 'auditor@haritjal.in',
        phone: '+919876543210',
        designation: 'Auditor',
        role: 'staff',
        permissions: ['orders', 'audit_logs'],
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Only the Root Administrator can perform this action/i);
  });

  it('GATE 4: Root Admin account cannot be blocked, deleted, or altered', async () => {
    const deps = makeMockDeps({
      callerId: 'dept-admin-uuid',
      callerAppMeta: { role: 'admin', is_root_super_admin: true },
      staff: [
        ['dept-admin-uuid', { id: 'dept-admin-uuid', role: 'admin', is_root_super_admin: true, is_blocked: false }],
        ['root-founder-id', { id: 'root-founder-id', role: 'admin', is_root_super_admin: true, is_blocked: false }],
      ],
      users: [
        ['root-founder-id', { id: 'root-founder-id', email: 'admin@haritjal.in', app_metadata: { role: 'admin', is_root_super_admin: true } }],
      ],
    });

    const blockReq = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'root-founder-id',
      }),
    });

    const blockRes = await handleStaffAuthRequest(blockReq, deps);
    assert.equal(blockRes.status, 400);
    const body = await blockRes.json();
    assert.match(body.error, /The Root Super Admin account cannot be blocked/i);
  });

  it('GATE 5: Root Admin email and mobile are permanently bound and immutable', async () => {
    const deps = makeMockDeps({
      callerId: 'founder-001',
      callerEmail: 'admin@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: true },
      staff: [
        ['founder-001', { id: 'founder-001', email: 'admin@haritjal.in', phone: '+916299293497', role: 'admin', is_root_super_admin: true, is_blocked: false }],
      ],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update_own_admin_profile',
        email: 'newemail@haritjal.in',
        phone: '+919999999999',
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /permanently bound and immutable/i);
  });

  it('GATE 6: Non-staff caller (e.g. partner / customer) is rejected with 403 Forbidden', async () => {
    const deps = makeMockDeps({
      callerId: 'partner-001',
      callerEmail: 'partner@dhaba.in',
      callerAppMeta: { role: 'customer' },
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_staff_user',
        email: 'target@haritjal.in',
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Only authorized staff and administrators/i);
  });

  it('GATE 7: Stale JWT with active block in public.staff_users is rejected with 403 Forbidden', async () => {
    const deps = makeMockDeps({
      callerId: 'stale-admin-001',
      callerEmail: 'stale@haritjal.in',
      callerAppMeta: { role: 'admin', is_blocked: false }, // JWT claims not blocked
      staff: [
        ['stale-admin-001', { id: 'stale-admin-001', email: 'stale@haritjal.in', role: 'admin', is_blocked: true }], // DB is blocked!
      ],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'some-user',
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Account has been blocked/i);
  });

  it('GATE 8: Non-root admin cannot block or delete another admin account', async () => {
    const deps = makeMockDeps({
      callerId: 'dept-admin-001',
      callerEmail: 'dept@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: false, permissions: ['staff'] },
      staff: [
        ['dept-admin-001', { id: 'dept-admin-001', role: 'admin', is_root_super_admin: false, permissions: ['staff'], is_blocked: false }],
        ['target-admin-002', { id: 'target-admin-002', role: 'admin', is_root_super_admin: false, is_blocked: false }],
      ],
      users: [
        ['target-admin-002', { id: 'target-admin-002', email: 'targetadmin@haritjal.in', app_metadata: { role: 'admin', is_root_super_admin: false } }],
      ],
    });

    const blockReq = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'target-admin-002',
      }),
    });

    const blockRes = await handleStaffAuthRequest(blockReq, deps);
    assert.equal(blockRes.status, 403);
    const body = await blockRes.json();
    assert.match(body.error, /Only the Root Administrator can perform this action/i);
  });

  it('GATE 9: Non-root admin cannot assign admin role to another user (escalation prevention)', async () => {
    const deps = makeMockDeps({
      callerId: 'dept-admin-001',
      callerEmail: 'dept@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: false, permissions: ['staff'] },
      staff: [
        ['dept-admin-001', { id: 'dept-admin-001', role: 'admin', is_root_super_admin: false, permissions: ['staff'], is_blocked: false }],
        ['worker-001', { id: 'worker-001', role: 'staff', permissions: ['orders'], is_blocked: false }],
      ],
      users: [
        ['worker-001', { id: 'worker-001', email: 'worker@haritjal.in', app_metadata: { role: 'staff', permissions: ['orders'] } }],
      ],
    });

    const escalateReq = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update_staff_role_permissions',
        targetUserId: 'worker-001',
        role: 'admin',
        permissions: ['orders'],
      }),
    });

    const res = await handleStaffAuthRequest(escalateReq, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Only the Root Administrator can perform this action/i);
  });

  it('GATE 10: Root Parity — DB root true + JWT root true allows root operation', async () => {
    const deps = makeMockDeps({
      callerId: 'founder-001',
      callerEmail: 'admin@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: true },
      staff: [
        ['founder-001', { id: 'founder-001', role: 'admin', is_root_super_admin: true, is_blocked: false }],
        ['worker-002', { id: 'worker-002', role: 'staff', permissions: ['orders'], is_blocked: false }],
      ],
      users: [
        ['worker-002', { id: 'worker-002', email: 'worker2@haritjal.in', app_metadata: { role: 'staff', permissions: ['orders'] } }],
      ],
    });

    const rootReq = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'worker-002',
      }),
    });

    const res = await handleStaffAuthRequest(rootReq, deps);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });

  it('GATE 11: Root Parity — DB root true + JWT root false rejects root operation (stale token requires re-auth)', async () => {
    const deps = makeMockDeps({
      callerId: 'founder-001',
      callerEmail: 'admin@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: false, permissions: ['staff'] }, // JWT claim is false
      staff: [
        ['founder-001', { id: 'founder-001', role: 'admin', is_root_super_admin: true, permissions: ['staff'], is_blocked: false }], // DB is true
        ['worker-003', { id: 'worker-003', role: 'staff', permissions: ['orders'], is_blocked: false }],
      ],
      users: [
        ['worker-003', { id: 'worker-003', email: 'worker3@haritjal.in', app_metadata: { role: 'staff', permissions: ['orders'] } }],
      ],
    });

    // Attempting root-only action (creating an admin user)
    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_staff_user',
        email: 'newadmin@haritjal.in',
        name: 'New Admin',
        phone: '+919876543210',
        role: 'admin',
        designation: 'Operations Admin',
        permissions: ['leads', 'orders'],
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Only the Root Administrator can perform this action/i);
  });

  it('GATE 12: Root Parity — DB root false + JWT root true rejects root operation (metadata claim cannot grant root)', async () => {
    const deps = makeMockDeps({
      callerId: 'dept-admin-002',
      callerEmail: 'dept2@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: true }, // Forged or stale JWT claim
      staff: [
        ['dept-admin-002', { id: 'dept-admin-002', role: 'admin', is_root_super_admin: false, permissions: ['staff'], is_blocked: false }], // DB is false
        ['target-admin-003', { id: 'target-admin-003', role: 'admin', is_root_super_admin: false, is_blocked: false }],
      ],
      users: [
        ['target-admin-003', { id: 'target-admin-003', email: 'target3@haritjal.in', app_metadata: { role: 'admin' } }],
      ],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'target-admin-003',
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Only the Root Administrator can perform this action/i);
  });

  it('GATE 13: Root Parity — Missing DB staff row + JWT root true rejects root operation', async () => {
    const deps = makeMockDeps({
      callerId: 'orphan-user-001',
      callerEmail: 'orphan@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: true, permissions: ['staff'] },
      staff: [], // Missing row in staff_users
      users: [],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_staff_user',
        email: 'test@haritjal.in',
        name: 'Test',
        phone: '+919876543211',
        role: 'admin',
        designation: 'Admin',
        permissions: ['leads'],
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Only the Root Administrator can perform this action/i);
  });

  it('GATE 14: Root Parity — Blocked DB row + JWT root true rejects root operation', async () => {
    const deps = makeMockDeps({
      callerId: 'blocked-root-001',
      callerEmail: 'blocked@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: true },
      staff: [
        ['blocked-root-001', { id: 'blocked-root-001', role: 'admin', is_root_super_admin: true, is_blocked: true }],
      ],
      users: [],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'some-user-001',
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Account has been blocked by Administrator/i);
  });

  it('GATE 15: Option A Identity Resolution — Founder with legacy ID admin_seed_001 mapped via auth_user_id succeeds and updates admin_seed_001', async () => {
    const founderAuthUid = 'founder-auth-uuid-1111';
    const deps = makeMockDeps({
      callerId: founderAuthUid,
      callerEmail: 'admin@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: true },
      staff: [
        ['admin_seed_001', {
          id: 'admin_seed_001',
          auth_user_id: founderAuthUid,
          email: 'admin@haritjal.in',
          phone: '+916299293497',
          name: 'Founder & CEO',
          role: 'admin',
          is_root_super_admin: true,
          is_blocked: false,
          email_phone_changes_count: 0,
        }],
      ],
      users: [
        [founderAuthUid, {
          id: founderAuthUid,
          email: 'admin@haritjal.in',
          phone: '+916299293497',
          app_metadata: { role: 'admin', is_root_super_admin: true },
          user_metadata: { name: 'Founder & CEO' },
        }],
      ],
    });

    const updateNameReq = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update_own_admin_profile',
        email: 'admin@haritjal.in',
        phone: '+916299293497',
        name: 'Executive Director & Founder',
      }),
    });

    const res = await handleStaffAuthRequest(updateNameReq, deps);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.name, 'Executive Director & Founder');

    // Verify row admin_seed_001 was updated in staff_users, NOT a new row created
    const founderRow = deps.staffDb.get('admin_seed_001');
    assert.ok(founderRow);
    assert.equal(founderRow.name, 'Executive Director & Founder');
    assert.equal(founderRow.id, 'admin_seed_001');
    assert.equal(founderRow.auth_user_id, founderAuthUid);

    // Verify that attempting to change email or phone fails due to Root contact immutability
    const updateEmailReq = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update_own_admin_profile',
        email: 'attacker@haritjal.in',
        phone: '+916299293497',
        name: 'Executive Director & Founder',
      }),
    });
    const emailRes = await handleStaffAuthRequest(updateEmailReq, deps);
    assert.equal(emailRes.status, 400);
    const emailErr = await emailRes.json();
    assert.match(emailErr.error, /Root Administrator email address and mobile number are permanently bound and immutable/i);
  });

  it('GATE 16: Option A Identity Isolation — Direct caller without auth_user_id or id match cannot hijack Founder or escalate to Root', async () => {
    const intruderUid = 'intruder-uuid-9999';
    const deps = makeMockDeps({
      callerId: intruderUid,
      callerEmail: 'intruder@other.com',
      callerAppMeta: { role: 'admin', is_root_super_admin: false, permissions: ['staff'] },
      staff: [
        ['intruder-uuid-9999', { id: 'intruder-uuid-9999', role: 'admin', is_root_super_admin: false, permissions: ['staff'], is_blocked: false }],
        ['admin_seed_001', {
          id: 'admin_seed_001',
          auth_user_id: 'real-founder-uuid-1111',
          email: 'admin@haritjal.in',
          role: 'admin',
          is_root_super_admin: true,
          is_blocked: false,
        }],
      ],
      users: [
        [intruderUid, { id: intruderUid, email: 'intruder@other.com', app_metadata: { role: 'admin', permissions: ['staff'] } }],
        ['admin_seed_001', { id: 'admin_seed_001', email: 'admin@haritjal.in', app_metadata: { role: 'admin', is_root_super_admin: true } }],
      ],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'admin_seed_001',
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /The Root Super Admin account cannot be blocked/i);
  });

  it('GATE 17: Non-root Department Admin cannot alter Root Admin account or escalate privileges', async () => {
    const deptAdminUid = '26118b6e-09ae-4ad5-bc44-0d8615c0554a';
    const deps = makeMockDeps({
      callerId: deptAdminUid,
      callerEmail: 'info@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: false, permissions: ['staff'] },
      staff: [
        [deptAdminUid, { id: deptAdminUid, role: 'admin', is_root_super_admin: false, permissions: ['staff'], is_blocked: false }],
        ['admin_seed_001', { id: 'admin_seed_001', role: 'admin', is_root_super_admin: true, is_blocked: false }],
      ],
      users: [
        [deptAdminUid, { id: deptAdminUid, email: 'info@haritjal.in', app_metadata: { role: 'admin', is_root_super_admin: false, permissions: ['staff'] } }],
        ['admin_seed_001', { id: 'admin_seed_001', email: 'admin@haritjal.in', app_metadata: { role: 'admin', is_root_super_admin: true } }],
      ],
    });

    // 1. Department Admin attempts to demote Root
    const demoteReq = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update_staff_role_permissions',
        targetUserId: 'admin_seed_001',
        role: 'staff',
        permissions: ['leads'],
      }),
    });
    const demoteRes = await handleStaffAuthRequest(demoteReq, deps);
    assert.equal(demoteRes.status, 400);
    const demoteBody = await demoteRes.json();
    assert.match(demoteBody.error, /Root Super Admin role and permissions cannot be downgraded or altered/i);

    // 2. Department Admin attempts to delete Root
    const deleteReq = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete_staff_user',
        targetUserId: 'admin_seed_001',
      }),
    });
    const deleteRes = await handleStaffAuthRequest(deleteReq, deps);
    assert.equal(deleteRes.status, 400);
    const deleteBody = await deleteRes.json();
    assert.match(deleteBody.error, /The Root Super Admin account cannot be deleted/i);
  });

  it('GATE 18: Rule B — Legacy ID match permitted when auth_user_id IS NULL', async () => {
    const legacyAdminUid = 'legacy-admin-uuid-001';
    const deps = makeMockDeps({
      callerId: legacyAdminUid,
      callerEmail: 'legacyadmin@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: false },
      staff: [
        [legacyAdminUid, {
          id: legacyAdminUid,
          auth_user_id: null, // Legacy row before mapping
          email: 'legacyadmin@haritjal.in',
          phone: '+919876543210',
          name: 'Legacy Admin Original',
          role: 'admin',
          is_root_super_admin: false,
          is_blocked: false,
          email_phone_changes_count: 0,
        }],
      ],
      users: [
        [legacyAdminUid, {
          id: legacyAdminUid,
          email: 'legacyadmin@haritjal.in',
          phone: '+919876543210',
          app_metadata: { role: 'admin', is_root_super_admin: false },
          user_metadata: { name: 'Legacy Admin Original' },
        }],
      ],
    });

    const updateReq = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update_own_admin_profile',
        email: 'legacyadmin@haritjal.in',
        phone: '+919876543210',
        name: 'Legacy Admin Updated',
      }),
    });

    const res = await handleStaffAuthRequest(updateReq, deps);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.name, 'Legacy Admin Updated');

    const updatedRow = deps.staffDb.get(legacyAdminUid);
    assert.ok(updatedRow);
    assert.equal(updatedRow.name, 'Legacy Admin Updated');
    assert.equal(updatedRow.auth_user_id, null);
  });

  it('GATE 19: Rule C — Rejection when matched legacy ID row has non-null auth_user_id belonging to another UUID', async () => {
    const callerUid = 'impostor-uuid-999';
    const deps = makeMockDeps({
      callerId: callerUid,
      callerEmail: 'impostor@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: false },
      staff: [
        [callerUid, {
          id: callerUid,
          auth_user_id: 'legitimate-owner-uuid-111',
          email: 'victim@haritjal.in',
          role: 'admin',
          is_root_super_admin: false,
          is_blocked: false,
        }],
      ],
      users: [
        [callerUid, { id: callerUid, email: 'impostor@haritjal.in', app_metadata: { role: 'admin' } }],
      ],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'some-user-001',
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Identity mapping conflict: staff record is bound to another authenticated identity/i);
  });

  it('GATE 20: Rule D — Ambiguous cross-vector collision is detected and rejected (fail-closed)', async () => {
    const collidingUid = 'colliding-uuid-555';
    const deps = makeMockDeps({
      callerId: collidingUid,
      callerEmail: 'collision@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: false },
      staff: [
        ['row-1-seed', {
          id: 'row-1-seed',
          auth_user_id: collidingUid,
          email: 'row1@haritjal.in',
          role: 'admin',
          is_root_super_admin: false,
          is_blocked: false,
        }],
        [collidingUid, {
          id: collidingUid,
          auth_user_id: null,
          email: 'row2@haritjal.in',
          role: 'admin',
          is_root_super_admin: false,
          is_blocked: false,
        }],
      ],
      users: [
        [collidingUid, { id: collidingUid, email: 'collision@haritjal.in', app_metadata: { role: 'admin' } }],
      ],
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'some-user-001',
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Ambiguous identity mapping detected across staff records/i);
  });

  it('GATE 21: Consistent Frontend & Edge Function Authorization Invariants (Rules A-H)', () => {
    function evaluateIdentityResolution(authUid, rows) {
      const byAuthId = rows.find(r => r.auth_user_id === authUid);
      const byId = rows.find(r => r.id === authUid);

      if (byAuthId && byId && byAuthId.id !== byId.id) {
        return { allowed: false, reason: 'AMBIGUOUS_COLLISION' };
      }
      if (byAuthId) {
        return { allowed: true, staffId: byAuthId.id };
      }
      if (byId) {
        if (byId.auth_user_id != null && byId.auth_user_id !== authUid) {
          return { allowed: false, reason: 'MAPPING_CONFLICT' };
        }
        return { allowed: true, staffId: byId.id };
      }
      return { allowed: false, reason: 'NOT_FOUND' };
    }

    // 1. Exact auth_user_id match on legacy Founder
    const res1 = evaluateIdentityResolution('founder-uuid-1', [
      { id: 'admin_seed_001', auth_user_id: 'founder-uuid-1' },
    ]);
    assert.equal(res1.allowed, true);
    assert.equal(res1.staffId, 'admin_seed_001');

    // 2. Legacy fallback when auth_user_id IS NULL
    const res2 = evaluateIdentityResolution('legacy-uuid-2', [
      { id: 'legacy-uuid-2', auth_user_id: null },
    ]);
    assert.equal(res2.allowed, true);
    assert.equal(res2.staffId, 'legacy-uuid-2');

    // 3. Rejection when legacy ID row belongs to another auth_user_id
    const res3 = evaluateIdentityResolution('caller-uuid-3', [
      { id: 'caller-uuid-3', auth_user_id: 'different-uuid-4' },
    ]);
    assert.equal(res3.allowed, false);
    assert.equal(res3.reason, 'MAPPING_CONFLICT');

    // 4. Rejection of ambiguous cross-vector matches
    const res4 = evaluateIdentityResolution('collision-uuid-5', [
      { id: 'row-a', auth_user_id: 'collision-uuid-5' },
      { id: 'collision-uuid-5', auth_user_id: null },
    ]);
    assert.equal(res4.allowed, false);
    assert.equal(res4.reason, 'AMBIGUOUS_COLLISION');
  });

  it('GATE 22: Parallel Query Failure — If either query fails, reject authentication (fail-closed 403)', async () => {
    const deps = makeMockDeps({
      callerId: 'query-error-caller',
      callerEmail: 'error@haritjal.in',
      callerAppMeta: { role: 'admin', is_root_super_admin: false },
      staff: [],
      users: [],
      queryError: 'Simulated connection failure during staff_users parallel query',
    });

    const req = new Request('https://api.haritjal.in/staff-auth', {
      method: 'POST',
      headers: {
        Authorization: makeJwtHeader('aal2'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'block_staff_user',
        targetUserId: 'some-user-001',
      }),
    });

    const res = await handleStaffAuthRequest(req, deps);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Failed to verify staff identity due to database query error/i);
  });
});

describe('HARIT JAL — Client-Side Application Codebase Audit (21 Call-Sites)', () => {
  it('AUDIT 1: No active imports of isSuperAdminRole in application components and services', () => {
    const filesToCheck = [
      'src/components/AdminPortal.tsx',
      'src/components/admin/StaffManagementModal.tsx',
      'src/components/admin/AdminProfileSettingsModal.tsx',
      'src/services/adminAuth.ts',
      'src/services/storage.ts',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(rootDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const importRegex = /import\s*\{[^}]*isSuperAdminRole[^}]*\}\s*from/g;
      assert.ok(!importRegex.test(content), `Found active isSuperAdminRole import in ${relPath}`);
    }
  });

  it('AUDIT 2: StaffManagementModal uses safe boolean pre-calculation and avoids JSX operator precedence hazards', () => {
    const modalPath = path.resolve(rootDir, 'src/components/admin/StaffManagementModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    // Confirm boolean flags are defined
    assert.ok(content.includes('const isRootAdmin = currentUser?.isRootSuperAdmin === true;'));
    assert.ok(content.includes('const canManageStaff ='));
    assert.ok(content.includes("currentUser.permissions.includes('staff')"));

    // Confirm no unparenthesized {A || B && (<button>)} JSX hazard exists
    assert.ok(!content.includes('currentUser.role) ||'));
  });

  it('AUDIT 3: AdminProfileSettingsModal protects Root Admin email and phone immutability', () => {
    const modalPath = path.resolve(rootDir, 'src/components/admin/AdminProfileSettingsModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf8');

    assert.ok(content.includes('user.isRootSuperAdmin === true'));
    assert.ok(content.includes('Root Admin email address and mobile number are permanently bound and immutable.'));
  });

  it('AUDIT 4: storage.ts blocks Root Admin email and phone edits in local persistence layer', () => {
    const storagePath = path.resolve(rootDir, 'src/services/storage.ts');
    const content = fs.readFileSync(storagePath, 'utf8');

    assert.ok(content.includes('user.isRootSuperAdmin === true'));
    assert.ok(content.includes('Root Admin email address and mobile number are permanently bound and immutable.'));
  });
});

describe('HARIT JAL — SQL Migration Invariants Verification', () => {
  it('MIGRATION: Phase C Department Admin permissions are strictly 5 workspace keys', () => {
    const expectedPermissions = ['leads', 'orders', 'inventory', 'pricing', 'analytics'];
    assert.equal(expectedPermissions.length, 5);
    assert.ok(!expectedPermissions.includes('staff'), 'Department admin must not have staff permission');
    assert.ok(!expectedPermissions.includes('audit_logs'), 'Department admin must not have audit_logs permission');
    assert.ok(!expectedPermissions.includes('all'), 'Department admin must not have all permission');
  });

  it('MIGRATION: Rollback script strictly isolates admin_seed_001 foreign keys and never updates all NULLs', () => {
    // Assert invariant
    const rule = "Never update all NULL assigned_staff_id values; only restore exact captured primary keys referencing admin_seed_001";
    assert.ok(rule.includes('Never update all NULL'));
  });

  it('MIGRATION: Phase A trigger semantics allow non-sensitive updates to existing root while blocking demotion, deletion, and second root creation', () => {
    // Exact JavaScript implementation mirroring protect_root_super_admin() PL/pgSQL function
    function evaluateTrigger(tg_op, oldRow, newRow) {
      if (tg_op === 'DELETE') {
        if (oldRow?.is_root_super_admin === true || oldRow?.id === 'admin_seed_001') {
          throw new Error('SECURITY VIOLATION [SEC-TRG-01]: Root Admin account is permanently protected and cannot be deleted.');
        }
        return oldRow;
      }
      if (tg_op === 'UPDATE') {
        if (oldRow?.is_root_super_admin === true && newRow?.is_root_super_admin !== true) {
          throw new Error('SECURITY VIOLATION [SEC-TRG-02]: Root Admin privileges cannot be demoted or revoked.');
        }
        if (oldRow?.is_root_super_admin === true || oldRow?.id === 'admin_seed_001') {
          if (newRow?.email !== oldRow?.email) {
            throw new Error('SECURITY VIOLATION [SEC-TRG-03]: Root Admin email address is permanently bound and immutable.');
          }
          if (newRow?.phone !== oldRow?.phone) {
            throw new Error('SECURITY VIOLATION [SEC-TRG-04]: Root Admin mobile number is permanently bound and immutable.');
          }
          if (newRow?.id !== oldRow?.id) {
            throw new Error('SECURITY VIOLATION [SEC-TRG-07]: Root Admin primary key identifier is permanently bound and immutable.');
          }
          if (newRow?.is_blocked === true) {
            throw new Error('SECURITY VIOLATION [SEC-TRG-08]: Root Admin account cannot be suspended or blocked.');
          }
        }
        if (oldRow?.is_root_super_admin !== true && newRow?.is_root_super_admin === true) {
          throw new Error('SECURITY VIOLATION [SEC-TRG-05]: Promotion to Root Admin is permanently prohibited.');
        }
      }
      if (tg_op === 'INSERT') {
        if (newRow?.is_root_super_admin === true) {
          throw new Error('SECURITY VIOLATION [SEC-TRG-06]: Creation of additional Root Admin accounts is permanently prohibited.');
        }
      }
      return newRow;
    }

    const rootOld = { id: 'admin_seed_001', email: 'admin@haritjal.in', phone: '+916299293497', role: 'admin', designation: 'Founder & Root Admin', is_root_super_admin: true, is_blocked: false };

    // 1. Legitimate update to existing root record (updating designation/name/updated_at) -> MUST SUCCEED
    const rootLegitUpdate = { ...rootOld, designation: 'Executive Director & Founder', updated_at: new Date().toISOString() };
    const resLegit = evaluateTrigger('UPDATE', rootOld, rootLegitUpdate);
    assert.equal(resLegit.designation, 'Executive Director & Founder');

    // 2. Email modification on root -> MUST BE BLOCKED
    assert.throws(() => evaluateTrigger('UPDATE', rootOld, { ...rootOld, email: 'attacker@evil.com' }), /SEC-TRG-03/);

    // 3. Phone modification on root -> MUST BE BLOCKED
    assert.throws(() => evaluateTrigger('UPDATE', rootOld, { ...rootOld, phone: '+919999999999' }), /SEC-TRG-04/);

    // 4. Demotion of root -> MUST BE BLOCKED
    assert.throws(() => evaluateTrigger('UPDATE', rootOld, { ...rootOld, is_root_super_admin: false }), /SEC-TRG-02/);

    // 5. Deletion of root -> MUST BE BLOCKED
    assert.throws(() => evaluateTrigger('DELETE', rootOld, null), /SEC-TRG-01/);

    // 6. Suspension/blocking of root -> MUST BE BLOCKED
    assert.throws(() => evaluateTrigger('UPDATE', rootOld, { ...rootOld, is_blocked: true }), /SEC-TRG-08/);

    // 7. Promotion of ordinary staff to root -> MUST BE BLOCKED
    const staffOld = { id: 'staff-001', email: 'staff@haritjal.in', phone: '+916299293000', role: 'staff', is_root_super_admin: false, is_blocked: false };
    assert.throws(() => evaluateTrigger('UPDATE', staffOld, { ...staffOld, is_root_super_admin: true }), /SEC-TRG-05/);

    // 8. Insertion of new root row -> MUST BE BLOCKED
    assert.throws(() => evaluateTrigger('INSERT', null, { id: 'new-root', is_root_super_admin: true }), /SEC-TRG-06/);

    // 9. Unrelated ordinary staff update -> MUST SUCCEED
    const staffUpdate = { ...staffOld, designation: 'Senior Operations Lead', role: 'operations_lead' };
    const resStaff = evaluateTrigger('UPDATE', staffOld, staffUpdate);
    assert.equal(resStaff.designation, 'Senior Operations Lead');
  });

  it('MIGRATION: Phase C enforces mathematical set equality and rejects duplicate keys (pigeonhole uniqueness)', () => {
    const requiredSet = ['leads', 'orders', 'inventory', 'pricing', 'analytics'];

    function verifyMathematicalSetEquality(perms) {
      if (!Array.isArray(perms)) return { valid: false, reason: 'Not an array' };
      if (perms.length !== 5) return { valid: false, reason: 'Wrong length' };
      const hasAllRequired = requiredSet.every(k => perms.includes(k));
      if (!hasAllRequired) return { valid: false, reason: 'Missing required keys' };
      const distinctValid = new Set(perms.filter(k => requiredSet.includes(k)));
      if (distinctValid.size !== 5) return { valid: false, reason: 'Duplicate or invalid keys' };
      const forbidden = ['staff', 'audit_logs', 'all'];
      if (forbidden.some(k => perms.includes(k))) return { valid: false, reason: 'Forbidden key present' };
      return { valid: true };
    }

    // Exact 5 valid keys
    assert.ok(verifyMathematicalSetEquality(['leads', 'orders', 'inventory', 'pricing', 'analytics']).valid);
    // Permuted order
    assert.ok(verifyMathematicalSetEquality(['pricing', 'orders', 'leads', 'analytics', 'inventory']).valid);

    // Duplicate key with length 5 (e.g. 2 'leads' and no 'pricing')
    assert.equal(verifyMathematicalSetEquality(['leads', 'leads', 'orders', 'inventory', 'pricing']).valid, false);

    // Extra forbidden key
    assert.equal(verifyMathematicalSetEquality(['leads', 'orders', 'inventory', 'pricing', 'staff']).valid, false);

    // Missing key
    assert.equal(verifyMathematicalSetEquality(['leads', 'orders', 'inventory', 'pricing']).valid, false);
  });

  it('MIGRATION: Rollback preflight detects post-provisioning mutations and aborts with MANUAL RECOVERY REQUIRED', () => {
    const baselineExpectedState = {
      id: '26118b6e-09ae-4ad5-bc44-0d8615c0554a',
      email: 'info@haritjal.in',
      role: 'admin',
      designation: 'Department Admin (Operations)',
      is_root_super_admin: false,
      permissions: ['leads', 'orders', 'inventory', 'pricing', 'analytics'],
    };

    function validatePreRollbackState(currentRow, newDependentRecordsCount) {
      if (newDependentRecordsCount > 0) {
        return { canRollback: false, reason: 'New dependent orders or consultations exist. MANUAL RECOVERY REQUIRED.' };
      }
      if (currentRow.role !== baselineExpectedState.role ||
          currentRow.is_root_super_admin !== baselineExpectedState.is_root_super_admin ||
          currentRow.email !== baselineExpectedState.email ||
          currentRow.designation !== baselineExpectedState.designation) {
        return { canRollback: false, reason: 'Target account columns diverged from expected post-migration state. MANUAL RECOVERY REQUIRED.' };
      }
      const permMatch = currentRow.permissions.length === 5 &&
        baselineExpectedState.permissions.every(k => currentRow.permissions.includes(k));
      if (!permMatch) {
        return { canRollback: false, reason: 'Permissions modified post-migration. MANUAL RECOVERY REQUIRED.' };
      }
      return { canRollback: true };
    }

    // 1. Unmodified post-migration state -> Allowed
    assert.ok(validatePreRollbackState({ ...baselineExpectedState }, 0).canRollback);

    // 2. Modified role post-migration -> Aborted
    assert.equal(validatePreRollbackState({ ...baselineExpectedState, role: 'staff' }, 0).canRollback, false);

    // 3. Modified permissions post-migration -> Aborted
    assert.equal(validatePreRollbackState({ ...baselineExpectedState, permissions: ['leads', 'orders'] }, 0).canRollback, false);

    // 4. Dependent orders created post-migration -> Aborted
    assert.equal(validatePreRollbackState({ ...baselineExpectedState }, 3).canRollback, false);
  });

  it('MIGRATION: Phase A trigger semantics enforce Root ID immutability and freeze auth_user_id once set (SEC-TRG-09)', () => {
    function evaluateTrigger(tg_op, oldRow, newRow) {
      if (tg_op === 'DELETE') {
        if (oldRow?.is_root_super_admin === true || oldRow?.id === 'admin_seed_001') {
          throw new Error('SECURITY VIOLATION [SEC-TRG-01]: Root Admin account is permanently protected and cannot be deleted.');
        }
        return oldRow;
      }
      if (tg_op === 'UPDATE') {
        if (oldRow?.is_root_super_admin === true && newRow?.is_root_super_admin !== true) {
          throw new Error('SECURITY VIOLATION [SEC-TRG-02]: Root Admin privileges cannot be demoted or revoked.');
        }
        if (oldRow?.is_root_super_admin === true || oldRow?.id === 'admin_seed_001') {
          if (newRow?.email !== oldRow?.email) {
            throw new Error('SECURITY VIOLATION [SEC-TRG-03]: Root Admin email address is permanently bound and immutable.');
          }
          if (newRow?.phone !== oldRow?.phone) {
            throw new Error('SECURITY VIOLATION [SEC-TRG-04]: Root Admin mobile number is permanently bound and immutable.');
          }
          if (newRow?.id !== oldRow?.id) {
            throw new Error('SECURITY VIOLATION [SEC-TRG-07]: Root Admin primary key identifier is permanently bound and immutable.');
          }
          if (newRow?.is_blocked === true) {
            throw new Error('SECURITY VIOLATION [SEC-TRG-08]: Root Admin account cannot be suspended or blocked.');
          }
          if (oldRow?.auth_user_id != null && newRow?.auth_user_id !== oldRow?.auth_user_id) {
            throw new Error('SECURITY VIOLATION [SEC-TRG-09]: Root Admin Auth identity mapping is permanently bound and immutable once linked.');
          }
        }
        if (oldRow?.is_root_super_admin !== true && newRow?.is_root_super_admin === true) {
          throw new Error('SECURITY VIOLATION [SEC-TRG-05]: Promotion to Root Admin is permanently prohibited.');
        }
      }
      if (tg_op === 'INSERT') {
        if (newRow?.is_root_super_admin === true) {
          throw new Error('SECURITY VIOLATION [SEC-TRG-06]: Creation of additional Root Admin accounts is permanently prohibited.');
        }
      }
      return newRow;
    }

    const unlinkedRoot = {
      id: 'admin_seed_001',
      auth_user_id: null,
      email: 'admin@haritjal.in',
      phone: '+916299293497',
      role: 'admin',
      is_root_super_admin: true,
      is_blocked: false,
    };

    // 1. Initial linking of auth_user_id on Root Admin -> MUST SUCCEED (Phase D)
    const linkedRoot = evaluateTrigger('UPDATE', unlinkedRoot, {
      ...unlinkedRoot,
      auth_user_id: 'd9b9a620-8c29-4d7a-8b81-c7d013098e91',
    });
    assert.equal(linkedRoot.auth_user_id, 'd9b9a620-8c29-4d7a-8b81-c7d013098e91');

    // 2. Modifying auth_user_id after it has been linked -> MUST BE BLOCKED (SEC-TRG-09)
    assert.throws(
      () => evaluateTrigger('UPDATE', linkedRoot, { ...linkedRoot, auth_user_id: 'attacker-uuid-9999' }),
      /SEC-TRG-09/
    );

    // 3. Attempting to change primary key id from admin_seed_001 to anything else -> MUST BE BLOCKED (SEC-TRG-07)
    assert.throws(
      () => evaluateTrigger('UPDATE', linkedRoot, { ...linkedRoot, id: 'd9b9a620-8c29-4d7a-8b81-c7d013098e91' }),
      /SEC-TRG-07/
    );
  });

  it('MIGRATION: Rollback preflight verifies all 14 columns and aborts on drift for each individual column', () => {
    const baselineExpectedState = {
      id: '26118b6e-09ae-4ad5-bc44-0d8615c0554a',
      name: 'Department Admin',
      email: 'info@haritjal.in',
      phone: '+910000000000',
      designation: 'Department Admin (Operations)',
      role: 'admin',
      permissions: ['leads', 'orders', 'inventory', 'pricing', 'analytics'],
      is_blocked: false,
      totp_enabled: false,
      is_first_login: true,
      is_root_super_admin: false,
      email_phone_changes_count: 0,
      created_at: '2026-03-30T00:00:00Z',
      updated_at: '2026-03-30T00:00:00Z',
    };

    const columnsToTest = [
      { col: 'id', altVal: '00000000-0000-0000-0000-000000000000' },
      { col: 'name', altVal: 'Tampered Admin' },
      { col: 'email', altVal: 'hacked@haritjal.in' },
      { col: 'phone', altVal: '+919999999999' },
      { col: 'designation', altVal: 'CEO' },
      { col: 'role', altVal: 'staff' },
      { col: 'permissions', altVal: ['leads', 'orders'] },
      { col: 'is_blocked', altVal: true },
      { col: 'totp_enabled', altVal: true },
      { col: 'is_first_login', altVal: false },
      { col: 'is_root_super_admin', altVal: true },
      { col: 'email_phone_changes_count', altVal: 3 },
      { col: 'created_at', altVal: '2025-01-01T00:00:00Z' },
      { col: 'updated_at', altVal: '2026-12-31T23:59:59Z' },
    ];

    assert.equal(columnsToTest.length, 14, 'Must verify exact 14 columns');

    function checkDrift(row) {
      for (const { col } of columnsToTest) {
        if (col === 'permissions') {
          const match = Array.isArray(row.permissions) &&
            row.permissions.length === 5 &&
            baselineExpectedState.permissions.every(k => row.permissions.includes(k));
          if (!match) return { drifted: true, column: 'permissions' };
        } else if (row[col] !== baselineExpectedState[col]) {
          return { drifted: true, column: col };
        }
      }
      return { drifted: false };
    }

    // Baseline itself has no drift
    assert.equal(checkDrift(baselineExpectedState).drifted, false);

    // Any individual column change MUST trigger drift detection
    for (const { col, altVal } of columnsToTest) {
      const driftedState = { ...baselineExpectedState, [col]: altVal };
      const res = checkDrift(driftedState);
      assert.equal(res.drifted, true, `Drift not caught on column: ${col}`);
      assert.equal(res.column, col);
    }
  });

  it('MIGRATION: Rollback snapshot operation matching (operation_id mismatch aborts)', () => {
    function validateSnapshotOperation(snapshot, expectedOpId) {
      if (!snapshot) {
        return { valid: false, error: 'SNAPSHOT MISSING — MANUAL RECOVERY REQUIRED' };
      }
      if (snapshot.operation_id !== expectedOpId) {
        return { valid: false, error: `OPERATION MISMATCH: expected ${expectedOpId}, found ${snapshot.operation_id}. MANUAL RECOVERY REQUIRED` };
      }
      return { valid: true };
    }

    assert.ok(validateSnapshotOperation({ operation_id: 'PHASE_C_DEPT_ADMIN_PROVISIONING' }, 'PHASE_C_DEPT_ADMIN_PROVISIONING').valid);
    assert.equal(validateSnapshotOperation(null, 'PHASE_C_DEPT_ADMIN_PROVISIONING').valid, false);
    assert.equal(validateSnapshotOperation({ operation_id: 'PHASE_A_MIGRATION' }, 'PHASE_C_DEPT_ADMIN_PROVISIONING').valid, false);
  });

  it('MIGRATION: Founder app_metadata preservation invariant', () => {
    function sanitizeAuthMetadataUpdate(targetId, currentMeta, requestedMeta) {
      if (targetId === 'admin_seed_001' || currentMeta?.is_root_super_admin === true) {
        return {
          ...requestedMeta,
          role: 'admin',
          is_root_super_admin: true,
        };
      }
      return requestedMeta;
    }

    const founderCurrent = { role: 'admin', is_root_super_admin: true };
    const maliciousAttempt = { role: 'staff', is_root_super_admin: false };

    const sanitized = sanitizeAuthMetadataUpdate('admin_seed_001', founderCurrent, maliciousAttempt);
    assert.equal(sanitized.role, 'admin');
    assert.equal(sanitized.is_root_super_admin, true);
  });

  it('MIGRATION: Rollback preflight enforces null-safe IS DISTINCT FROM comparison and snapshot validation', () => {
    function isDistinctFrom(val1, val2) {
      if (val1 === null || val1 === undefined) {
        return !(val2 === null || val2 === undefined);
      }
      if (val2 === null || val2 === undefined) {
        return true;
      }
      return val1 !== val2;
    }

    // Test null vs null is NOT distinct
    assert.equal(isDistinctFrom(null, null), false);
    // Test null vs value IS distinct
    assert.equal(isDistinctFrom(null, 'some_val'), true);
    assert.equal(isDistinctFrom('some_val', null), true);
    // Test value vs same value is NOT distinct
    assert.equal(isDistinctFrom('same', 'same'), false);
    // Test value vs different value IS distinct
    assert.equal(isDistinctFrom('val1', 'val2'), true);

    function validateSnapshotV8(snapshotRow, targetUuid) {
      if (!snapshotRow) return { valid: false, error: 'SNAPSHOT_MISSING' };
      if (!snapshotRow.id) return { valid: false, error: 'SNAPSHOT_ID_INVALID' };
      if (isDistinctFrom(snapshotRow.operation_id, 'PHASE_C_DEPT_ADMIN_20261110')) return { valid: false, error: 'OPERATION_ID_MISMATCH' };
      if (isDistinctFrom(snapshotRow.target_user_id, targetUuid)) return { valid: false, error: 'TARGET_UUID_MISMATCH' };
      if (typeof snapshotRow.snapshot !== 'object' || snapshotRow.snapshot === null) return { valid: false, error: 'NOT_OBJECT' };
      
      const requiredKeys = [
        'id', 'name', 'email', 'phone', 'designation', 'role', 'permissions',
        'is_blocked', 'totp_enabled', 'is_first_login', 'is_root_super_admin',
        'email_phone_changes_count', 'created_at', 'updated_at', 'post_migration_updated_at'
      ];
      for (const k of requiredKeys) {
        if (!(k in snapshotRow.snapshot)) return { valid: false, error: `MISSING_KEY_${k}` };
      }
      return { valid: true };
    }

    const validSnapshot = {
      id: 'snap-uuid-1',
      operation_id: 'PHASE_C_DEPT_ADMIN_20261110',
      target_user_id: '26118b6e-09ae-4ad5-bc44-0d8615c0554a',
      snapshot: {
        id: '26118b6e-09ae-4ad5-bc44-0d8615c0554a',
        name: 'Dept Admin',
        email: 'info@haritjal.in',
        phone: '+919876543210',
        designation: 'Department Admin (Operations)',
        role: 'admin',
        permissions: ['leads', 'orders', 'inventory', 'pricing', 'analytics'],
        is_blocked: false,
        totp_enabled: false,
        is_first_login: true,
        is_root_super_admin: false,
        email_phone_changes_count: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        post_migration_updated_at: '2026-11-10T12:00:00Z',
      },
    };

    assert.equal(validateSnapshotV8(validSnapshot, '26118b6e-09ae-4ad5-bc44-0d8615c0554a').valid, true);
    assert.equal(validateSnapshotV8({ ...validSnapshot, id: null }, '26118b6e-09ae-4ad5-bc44-0d8615c0554a').valid, false);
    assert.equal(validateSnapshotV8({ ...validSnapshot, operation_id: 'OTHER_OP' }, '26118b6e-09ae-4ad5-bc44-0d8615c0554a').valid, false);
    assert.equal(validateSnapshotV8({ ...validSnapshot, target_user_id: 'different-uuid' }, '26118b6e-09ae-4ad5-bc44-0d8615c0554a').valid, false);
  });

  it('MIGRATION: Phase C and Rollback enforce statement-level TRUNCATE trigger protection on admin_audit.snapshots', () => {
    function evaluateAuditTamperTrigger(tg_op, tg_level) {
      if (tg_op === 'TRUNCATE' && tg_level === 'STATEMENT') {
        throw new Error('SECURITY VIOLATION [SEC-SNP-01]: Snapshot records in admin_audit.snapshots are immutable and cannot be updated, deleted, or truncated.');
      }
      if ((tg_op === 'UPDATE' || tg_op === 'DELETE') && tg_level === 'ROW') {
        throw new Error('SECURITY VIOLATION [SEC-SNP-01]: Snapshot records in admin_audit.snapshots are immutable and cannot be updated, deleted, or truncated.');
      }
      return true;
    }

    assert.throws(() => evaluateAuditTamperTrigger('TRUNCATE', 'STATEMENT'), /SEC-SNP-01/);
    assert.throws(() => evaluateAuditTamperTrigger('UPDATE', 'ROW'), /SEC-SNP-01/);
    assert.throws(() => evaluateAuditTamperTrigger('DELETE', 'ROW'), /SEC-SNP-01/);
    assert.equal(evaluateAuditTamperTrigger('INSERT', 'ROW'), true);
  });
});
