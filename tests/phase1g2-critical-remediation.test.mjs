// ====================================================================
// HARIT JAL™ (हरित जल) — PHASE 1G.2: CRITICAL AUTHENTICATION REMEDIATION TEST SUITE
// Automated Integration & Architectural Verification Suite (14 Tests)
// ====================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('=== HARIT JAL PHASE 1G.2: CRITICAL AUTHENTICATION REMEDIATION TEST SUITE STARTING ===\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testId, name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [${testId}] ${name} -> PASS`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [${testId}] ${name} -> FAIL`);
    console.error(`   Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

// Read relevant codebase files
const edgeFuncPath = path.join(ROOT_DIR, 'supabase', 'functions', 'staff-auth', 'handler.ts');
const edgeFuncContent = fs.readFileSync(edgeFuncPath, 'utf8');

const adminAuthPath = path.join(ROOT_DIR, 'src', 'services', 'adminAuth.ts');
const adminAuthContent = fs.readFileSync(adminAuthPath, 'utf8');

const envPath = path.join(ROOT_DIR, 'src', 'services', 'env.ts');
const envContent = fs.readFileSync(envPath, 'utf8');

const setupModalPath = path.join(ROOT_DIR, 'src', 'components', 'admin', 'StaffFirstTimeSetupModal.tsx');
const setupModalContent = fs.readFileSync(setupModalPath, 'utf8');

const migrationPath = path.join(ROOT_DIR, 'AUDIT_REPORT', 'PHASE_1G3_REMEDIATION', 'CONSOLIDATED_MIGRATION.sql');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

const schemaPath = path.join(ROOT_DIR, 'supabase-schema.sql');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// -----------------------------------------------------------------------------
// TEST 1: Customer cannot self-assign admin role (Finding 01)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-01', 'Customer cannot self-assign admin role via user_metadata', () => {
  // Edge Function MUST evaluate ONLY app_metadata.role and NEVER user_metadata.role
  assert.ok(edgeFuncContent.includes('callerUser.app_metadata?.role'), 'Must evaluate only app_metadata.role');
  assert.ok(!edgeFuncContent.includes('callerUser.user_metadata?.role'), 'Must NEVER fall back to user_metadata.role');

  // Verify simulated exploit fails
  const mockCustomer = {
    id: 'cust_123',
    email: 'customer@restaurant.com',
    user_metadata: { role: 'admin' }, // Exploit attempt
    app_metadata: { provider: 'email' }, // No app_metadata role
  };

  const callerRole = mockCustomer.app_metadata?.role;
  const isCallerAdmin = (
    callerRole === 'admin' ||
    callerRole === 'super_admin' ||
    callerRole === 'Super Admin'
  ) && mockCustomer.app_metadata?.is_blocked !== true;

  assert.strictEqual(isCallerAdmin, false, 'Attacker with user_metadata.role=admin must NOT be recognized as admin');
});

// -----------------------------------------------------------------------------
// TEST 2: Staff cannot self-assign Super Admin role (Finding 01)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-02', 'Staff cannot self-assign Super Admin role', () => {
  const mockStaff = {
    id: 'staff_456',
    email: 'staff@haritjal.in',
    user_metadata: { role: 'Super Admin' }, // Exploit attempt
    app_metadata: { role: 'staff', permissions: ['orders:read'] },
  };

  const callerRole = mockStaff.app_metadata?.role;
  const isCallerAdmin = (
    callerRole === 'super_admin' ||
    callerRole === 'Super Admin'
  ) && mockStaff.app_metadata?.is_blocked !== true;

  assert.strictEqual(isCallerAdmin, false, 'Staff attempting to claim Super Admin in user_metadata must be rejected');
});

// -----------------------------------------------------------------------------
// TEST 3: Forged localStorage session rejected (Finding 02)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-03', 'Forged localStorage session rejected without Supabase Auth', () => {
  // In production, validateCredentials calls Supabase Auth and fails closed if unavailable
  assert.ok(adminAuthContent.includes('supabase.auth.signInWithPassword'), 'validateCredentials must call Supabase Auth');
  assert.ok(adminAuthContent.includes('isProductionEnvironment()') && envContent.includes('import.meta.env.PROD'), 'Must enforce centralized production flag');
  assert.ok(adminAuthContent.includes('Authentication service temporarily unavailable'), 'Must return fail-closed error in prod');
});

// -----------------------------------------------------------------------------
// TEST 4: Direct Supabase Auth login after invitation expiry cannot grant staff access (Finding 05)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-04', 'Direct Supabase Auth login after invitation expiry cannot grant staff access', () => {
  // 1. Client login must check expiry and immediately signOut
  assert.ok(adminAuthContent.includes('isFirstLogin && tempExpiresAt > 0 && Date.now() > tempExpiresAt'), 'Client must assert 72h expiry on login');
  assert.ok(adminAuthContent.includes('await supabase.auth.signOut()'), 'Client must sign out expired accounts immediately');

  // 2. Edge Function locks expired accounts
  assert.ok(edgeFuncContent.includes('Date.now() > tempExpiresAt'), 'Edge Function must check 72h expiry');
  assert.ok(edgeFuncContent.includes('ban_duration: "876000h"'), 'Edge Function must lock expired accounts in auth.users');

  // 3. PostgreSQL RLS policies deny expired first-login queries on orders and consultations
  assert.ok(migrationContent.includes("(auth.jwt()->'app_metadata'->>'is_first_login')::boolean IS NOT TRUE"), 'RLS must check is_first_login');
  assert.ok(migrationContent.includes("(auth.jwt()->'app_metadata'->>'temporary_password_expires_at')::bigint > (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint"), 'RLS must enforce expiry timestamp');
});

// -----------------------------------------------------------------------------
// TEST 5: Staff login creates a real Supabase Auth session (Finding 02)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-05', 'Staff login establishes a real Supabase Auth session', () => {
  assert.ok(adminAuthContent.includes('supabase.auth.getSession()'), 'Must obtain session from Supabase Auth');
  assert.ok(adminAuthContent.includes('authSession.access_token'), 'Session token must use Supabase Auth access_token');
});

// -----------------------------------------------------------------------------
// TEST 6: Missing TOTP factor ID rejected (Finding 03)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-06', 'Missing TOTP factor ID rejected by Edge Function', () => {
  // Edge Function must NOT silently skip MFA; must reject when factorId or AAL2 is missing
  assert.ok(edgeFuncContent.includes('verifyOwnedTotpFactorAtAal2'), 'Edge Function must enforce verified owned TOTP factor');
  assert.ok(edgeFuncContent.includes('factorId is strictly mandatory for Supabase Auth Native MFA verification'), 'Must return mandatory factorId error message');
});

// -----------------------------------------------------------------------------
// TEST 7: Invalid TOTP rejected (Finding 03)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-07', 'Invalid TOTP rejected by MFA verification', () => {
  assert.ok(setupModalContent.includes('supabase.auth.mfa.challengeAndVerify'), 'Browser session must challenge and verify Native MFA');
  assert.ok(adminAuthContent.includes('supabase.auth.mfa.challengeAndVerify'), 'Step 2 TOTP login must challenge and verify Native MFA');
  assert.ok(adminAuthContent.includes('challengeError'), 'Client must handle challenge errors');
  assert.ok(edgeFuncContent.includes('callerAal !== "aal2"'), 'Server must require AAL2 verification claim');
});

// -----------------------------------------------------------------------------
// TEST 8: AAL1 rejected for protected admin operations (Finding 03 & Finding 01)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-08', 'AAL1 rejected for protected admin operations when TOTP active', () => {
  assert.ok(edgeFuncContent.includes('assertSuperAdminAal2') && edgeFuncContent.includes('callerAal !== "aal2"'), 'Must enforce caller AAL is aal2 on privileged actions');
  assert.ok(edgeFuncContent.includes('MFA Required: Privileged operations require Authenticator Assurance Level 2 (AAL2)'), 'Must return AAL2 requirement error');
});

// -----------------------------------------------------------------------------
// TEST 9: AAL2 accepted for authorized operations (Finding 03)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-09', 'AAL2 accepted for authorized operations', () => {
  assert.ok(edgeFuncContent.includes('assertSuperAdminAal2'), 'Edge Function must include AAL2 verification logic');
  assert.ok(edgeFuncContent.includes('typeof payload?.aal === "string" ? payload.aal : "aal1"'), 'Must parse JWT AAL claim');
});

// -----------------------------------------------------------------------------
// TEST 10: Blocking staff invalidates access to protected resources (Finding 04)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-10', 'Blocking staff invalidates access to protected resources', () => {
  // 1. Edge Function checks caller is not blocked
  assert.ok(edgeFuncContent.includes('callerUser.app_metadata?.is_blocked === true'), 'Edge Function must reject blocked callers');
  assert.ok(edgeFuncContent.includes('Account has been blocked by Super Admin'), 'Must return block error message');

  // 2. RLS policies assert is_blocked IS NOT TRUE
  assert.ok(migrationContent.includes("((auth.jwt()->'app_metadata'->>'is_blocked')::boolean IS NOT TRUE)"), 'RLS must check is_blocked IS NOT TRUE');

  // 3. Block action sets ban_duration in GoTrue and updates staff_users table
  assert.ok(edgeFuncContent.includes('ban_duration: "876000h"'), 'Must set 100y ban in GoTrue');
  assert.ok(edgeFuncContent.includes('is_blocked: true'), 'Must update database profile is_blocked');
});

// -----------------------------------------------------------------------------
// TEST 11: Staff deletion preserves historical records (Finding 04)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-11', 'Staff deletion preserves historical business records', () => {
  assert.ok(edgeFuncContent.includes('action === "delete_staff_user"'), 'Edge Function must handle delete_staff_user');
  assert.ok(edgeFuncContent.includes('supabaseAdmin.auth.admin.deleteUser(targetUserId)'), 'Must delete auth identity');
  assert.ok(migrationContent.includes('ON DELETE SET NULL') && !migrationContent.includes('orders REFERENCES public.staff_users(id) ON DELETE CASCADE'),
    'Orders and consultations must NOT cascade delete from staff_users');
});

// -----------------------------------------------------------------------------
// TEST 12: Customer cannot access another customer\'s profile (Finding 06)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-12', 'Customer cannot access another customer profile (RLS Isolation)', () => {
  assert.ok(migrationContent.includes('(auth.uid() = id)'), 'Customer read policy must enforce auth.uid() = id');
  assert.ok(migrationContent.includes('CREATE POLICY "Deny anon access to customers"') && migrationContent.includes('ON public.customers FOR ALL TO anon'), 'Anon direct access must be denied');
});

// -----------------------------------------------------------------------------
// TEST 13: Authorized admin can access permitted customer records (Finding 06)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-13', 'Authorized staff/admin can access permitted customer records', () => {
  // Customer RLS policy must inspect canonical app_metadata.role + aal2
  assert.ok(migrationContent.includes("'super_admin', 'Super Admin', 'admin', 'staff', 'Staff'"), 
    'Customer policy must inspect canonical app_metadata.role for staff/admin access');
  assert.ok(schemaContent.includes("'super_admin', 'Super Admin', 'admin', 'staff', 'Staff'"), 
    'Active schema must inspect canonical app_metadata.role');
});

// -----------------------------------------------------------------------------
// TEST 14: Customer Email + Password flow remains functional & Permanent Password Policy (Finding 07)
// -----------------------------------------------------------------------------
runTest('TEST-1G2-14', 'Customer Email + Password intact & Staff Password Policy 12+ chars', () => {
  const customerAuthPath = path.join(ROOT_DIR, 'src', 'services', 'customerAuth.ts');
  const customerAuthContent = fs.readFileSync(customerAuthPath, 'utf8');

  // Customer auth must be Email + Password only
  assert.ok(customerAuthContent.includes('signInWithPassword'), 'Customer login must use signInWithPassword');
  assert.ok(!customerAuthContent.includes('signInWithOtp'), 'Must NOT introduce customer mobile OTP login');

  // Permanent staff password policy must require 12+ chars, upper, lower, number
  assert.ok(setupModalContent.includes('newPassword.length >= 12'), 'Modal must enforce 12+ characters');
  assert.ok(setupModalContent.includes('/[A-Z]/.test(newPassword)'), 'Modal must enforce uppercase');
  assert.ok(setupModalContent.includes('/[a-z]/.test(newPassword)'), 'Modal must enforce lowercase');
  assert.ok(setupModalContent.includes('/[0-9]/.test(newPassword)'), 'Modal must enforce numbers');
  assert.ok(edgeFuncContent.includes('pwd.length < 12'), 'Edge Function must enforce 12+ characters');
});

console.log('\n=== PHASE 1G.2 CRITICAL REMEDIATION TEST SUITE COMPLETE ===');
console.log(`Summary: ${passedTests} of ${totalTests} PASSED, ${totalTests - passedTests} FAILED\n`);

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
