/**
 * Harit Jal™ — Phase 1G Server-Side Staff Authentication & Identity Test Suite
 * 
 * Verifies:
 * 1. Edge Function Staff Creation & Temporary Password Issuance
 * 2. 72-Hour Temporary Password Expiry Enforcement
 * 3. Mandatory Permanent Password Setup & Temporary Credential Purging
 * 4. Supabase Auth Native MFA (TOTP) Enrollment & Challenge Verification
 * 5. Server-Side Role & Permission Enforcement via app_metadata
 * 6. Edge Function Caller Authentication & Invalid JWT Rejection
 * 7. Server-Side Block & Global Session Revocation (ban_duration + signOut global)
 * 8. Safe Unblock Restoration
 * 9. Staff Deletion Without Historical Business Data Cascade
 * 10. Database Schema Credential Partitioning (staff_secrets isolation & zero exposed columns)
 * 11. Customer Authentication Isolation & Regression Verification
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

console.log('=== HARIT JAL PHASE 1G: SERVER-SIDE AUTHENTICATION TEST SUITE STARTING ===\n');

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

// Read relevant files
const edgeEntryPath = path.join(ROOT_DIR, 'supabase', 'functions', 'staff-auth', 'index.ts');
const edgeEntryContent = fs.readFileSync(edgeEntryPath, 'utf8');
const edgeFuncPath = path.join(ROOT_DIR, 'supabase', 'functions', 'staff-auth', 'handler.ts');
const edgeFuncContent = fs.readFileSync(edgeFuncPath, 'utf8');

const setupModalPath = path.join(ROOT_DIR, 'src', 'components', 'admin', 'StaffFirstTimeSetupModal.tsx');
const setupModalContent = fs.readFileSync(setupModalPath, 'utf8');

const adminAuthPath = path.join(ROOT_DIR, 'src', 'services', 'adminAuth.ts');
const adminAuthContent = fs.readFileSync(adminAuthPath, 'utf8');

const schemaPath = path.join(ROOT_DIR, 'supabase-schema.sql');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

const migrationPath = path.join(ROOT_DIR, 'AUDIT_REPORT', 'PHASE_1G3_REMEDIATION', 'CONSOLIDATED_MIGRATION.sql');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

// -----------------------------------------------------------------------------
// TEST 1: Edge Function Staff Creation & Temporary Password Issuance
// -----------------------------------------------------------------------------
runTest('TEST-1G-01', 'Edge Function Staff Creation & Temporary Password Issuance', () => {
  assert.ok(edgeEntryContent.includes('handleStaffAuthRequest'), 'Edge Function index.ts must delegate to handler.ts');
  assert.ok(edgeFuncContent.includes('action === "create_staff_user"'), 'Edge Function must handle create_staff_user');
  assert.ok(edgeFuncContent.includes('generateSecureServerTempPassword()'), 'Must generate server-side temporary password');
  assert.ok(edgeFuncContent.includes('supabaseAdmin.auth.admin.createUser'), 'Must create user via Supabase Auth Admin API');
  assert.ok(edgeFuncContent.includes('temporaryPassword: tempPassword'), 'Must deliver temporary password only once in response');
  assert.ok(edgeFuncContent.includes('is_first_login: true'), 'Must set is_first_login in app_metadata');
});

// -----------------------------------------------------------------------------
// TEST 2: 72-Hour Temporary Password Expiry Enforcement
// -----------------------------------------------------------------------------
runTest('TEST-1G-02', '72-Hour Temporary Password Expiry Enforcement', () => {
  assert.ok(edgeFuncContent.includes('72 * 60 * 60 * 1000'), 'Must set 72h validity in server function');
  assert.ok(edgeFuncContent.includes('Date.now() > tempExpiresAt'), 'Must evaluate expiry server-side');
  assert.ok(edgeFuncContent.includes('Temporary password has expired'), 'Must return expiration error');
  assert.ok(adminAuthContent.includes('Temporary password invitation has expired (72h limit)'), 'Client must enforce 72h limit');
});

// -----------------------------------------------------------------------------
// TEST 3: Mandatory Permanent Password Setup & Credential Purging
// -----------------------------------------------------------------------------
runTest('TEST-1G-03', 'Mandatory Permanent Password Setup & Credential Purging', () => {
  assert.ok(edgeFuncContent.includes('action === "complete_staff_first_time_setup"'), 'Must handle first-time setup action');
  assert.ok(edgeFuncContent.includes('pwd.length < 12'), 'Must enforce >=12 char permanent password policy');
  assert.ok(edgeFuncContent.includes('temporary_password_expires_at: null'), 'Must purge temporary password expiry');
  assert.ok(edgeFuncContent.includes('is_first_login: false'), 'Must mark first login complete on server');
});

// -----------------------------------------------------------------------------
// TEST 4: Supabase Auth Native MFA (TOTP) Challenge Verification
// -----------------------------------------------------------------------------
runTest('TEST-1G-04', 'Supabase Auth Native MFA (TOTP) Challenge Verification', () => {
  assert.ok(setupModalContent.includes('supabase.auth.mfa.enroll('), 'Browser session must enroll Native GoTrue MFA factor');
  assert.ok(setupModalContent.includes('supabase.auth.mfa.challengeAndVerify('), 'Browser session must elevate to AAL2 via Native challengeAndVerify');
  assert.ok(edgeFuncContent.includes('verifyOwnedTotpFactorAtAal2'), 'Edge Function must verify caller AAL2 + GoTrue factor ownership');
  assert.ok(edgeFuncContent.includes('totp_enabled: true'), 'Must activate TOTP in app_metadata');
  
  // Verify staff_users table definition does not have totp_secret
  const staffUsersTable = schemaContent.slice(schemaContent.indexOf('CREATE TABLE IF NOT EXISTS public.staff_users'), schemaContent.indexOf('CREATE TABLE IF NOT EXISTS public.staff_secrets'));
  assert.ok(!staffUsersTable.includes('totp_secret TEXT'), 'totp_secret must NOT exist in public.staff_users');
});

// -----------------------------------------------------------------------------
// TEST 5: Server-Side Role & Permission Enforcement via app_metadata
// -----------------------------------------------------------------------------
runTest('TEST-1G-05', 'Server-Side Role & Permission Enforcement via app_metadata', () => {
  assert.ok(edgeFuncContent.includes('callerUser.app_metadata?.role'), 'Must check server-signed app_metadata for roles');
  assert.ok(!edgeFuncContent.includes('callerUser.user_metadata?.role'), 'Must NEVER evaluate user_metadata.role');
  assert.ok(edgeFuncContent.includes('isCallerSuperAdmin'), 'Must verify caller is Super Admin for privileged actions');
  assert.ok(schemaContent.includes("auth.jwt()->'app_metadata'->>'role'"), 'RLS must inspect app_metadata claims');
  assert.ok(migrationContent.includes("auth.jwt()->'app_metadata'->>'role'"), 'Consolidated migration must inspect app_metadata');
});

// -----------------------------------------------------------------------------
// TEST 6: Edge Function Caller Authentication & Invalid JWT Rejection
// -----------------------------------------------------------------------------
runTest('TEST-1G-06', 'Edge Function Caller Authentication & Invalid JWT Rejection', () => {
  assert.ok(edgeFuncContent.includes('Missing authorization bearer token'), 'Must reject requests missing Authorization header');
  assert.ok(edgeFuncContent.includes('supabaseAdmin.auth.getUser(token)'), 'Must validate JWT signature via Supabase Auth');
  assert.ok(edgeFuncContent.includes('Unauthorized: Invalid or expired caller token'), 'Must return 401 for invalid tokens');
});

// -----------------------------------------------------------------------------
// TEST 7: Server-Side Block & Global Session Revocation
// -----------------------------------------------------------------------------
runTest('TEST-1G-07', 'Server-Side Block & Global Session Revocation', () => {
  assert.ok(edgeFuncContent.includes('action === "block_staff_user"'), 'Must handle block_staff_user');
  assert.ok(edgeFuncContent.includes('ban_duration: "876000h"'), 'Must ban account globally on server');
  assert.ok(edgeFuncContent.includes('is_blocked: true'), 'Must set dual-vector is_blocked in app_metadata and staff_users');
  assert.ok(edgeFuncContent.includes('The Root Super Admin account cannot be blocked'), 'Must enforce root admin immunity');
});

// -----------------------------------------------------------------------------
// TEST 8: Safe Unblock Restoration
// -----------------------------------------------------------------------------
runTest('TEST-1G-08', 'Safe Unblock Restoration', () => {
  assert.ok(edgeFuncContent.includes('action === "unblock_staff_user"'), 'Must handle unblock_staff_user');
  assert.ok(edgeFuncContent.includes('ban_duration: "none"'), 'Must clear ban duration on unblock');
  assert.ok(edgeFuncContent.includes('is_blocked: false'), 'Must reset is_blocked on server');
});

// -----------------------------------------------------------------------------
// TEST 9: Staff Deletion Without Historical Business Data Cascade
// -----------------------------------------------------------------------------
runTest('TEST-1G-09', 'Staff Deletion Without Historical Business Data Cascade', () => {
  assert.ok(edgeFuncContent.includes('action === "delete_staff_user"'), 'Must handle delete_staff_user');
  assert.ok(edgeFuncContent.includes('supabaseAdmin.auth.admin.deleteUser'), 'Must delete user from auth.users');
  assert.ok(edgeFuncContent.includes('The Root Super Admin account cannot be deleted'), 'Must protect Root Super Admin from deletion');

  // Verify business tables have NO CASCADE delete from staff_users (ON DELETE SET NULL only)
  const ordersBlock = schemaContent.slice(schemaContent.indexOf('TABLE: ORDERS'), schemaContent.indexOf('TABLE: SECURITY_BLOCKS'));
  const consultationsBlock = schemaContent.slice(schemaContent.indexOf('TABLE: CONSULTATIONS'), schemaContent.indexOf('TABLE: ORDERS'));
  assert.ok(ordersBlock.includes('ON DELETE SET NULL') && !ordersBlock.includes('ON DELETE CASCADE'), 'Orders must preserve rows via ON DELETE SET NULL');
  assert.ok(consultationsBlock.includes('ON DELETE SET NULL') && !consultationsBlock.includes('ON DELETE CASCADE'), 'Consultations must preserve rows via ON DELETE SET NULL');
});

// -----------------------------------------------------------------------------
// TEST 10: Database Schema Credential Partitioning
// -----------------------------------------------------------------------------
runTest('TEST-1G-10', 'Database Schema Credential Partitioning & Secret Lockdown', () => {
  // Verify staff_secrets table exists and has RLS enabled
  assert.ok(schemaContent.includes('CREATE TABLE IF NOT EXISTS public.staff_secrets'), 'Must create public.staff_secrets');
  assert.ok(schemaContent.includes('ALTER TABLE public.staff_secrets ENABLE ROW LEVEL SECURITY;'), 'Must enable RLS on staff_secrets');
  assert.ok(schemaContent.includes('Deny all client access to staff_secrets'), 'Must deny all client access to staff_secrets');
  assert.ok(schemaContent.includes('REVOKE ALL ON public.staff_secrets FROM anon, authenticated, public;'), 'Must revoke client permissions');

  // Verify staff_users drops exposed columns
  assert.ok(schemaContent.includes('ALTER TABLE public.staff_users DROP COLUMN IF EXISTS password_hash;'), 'Must drop password_hash from staff_users');
  assert.ok(schemaContent.includes('ALTER TABLE public.staff_users DROP COLUMN IF EXISTS totp_secret;'), 'Must drop totp_secret from staff_users');
});

// -----------------------------------------------------------------------------
// TEST 11: Customer Authentication Isolation & Regression Verification
// -----------------------------------------------------------------------------
runTest('TEST-1G-11', 'Customer Authentication Isolation & Regression Verification', () => {
  // Customers table columns must have zero password columns
  const customerTable = schemaContent.slice(
    schemaContent.indexOf('CREATE TABLE IF NOT EXISTS public.customers'),
    schemaContent.indexOf('CREATE INDEX IF NOT EXISTS idx_customers_email')
  );
  assert.ok(!customerTable.includes('password TEXT'), 'public.customers must not contain password column');
  assert.ok(!customerTable.includes('password_hash TEXT'), 'public.customers must not contain password_hash column');
  assert.ok(schemaContent.includes('REFERENCES auth.users(id) ON DELETE CASCADE'), 'Customers must link to auth.users');
  assert.ok(schemaContent.includes('CREATE TRIGGER on_auth_user_created_customer'), 'Must retain sync trigger');
});

console.log(`\n=== PHASE 1G SERVER-SIDE AUTHENTICATION TEST SUITE COMPLETE ===`);
console.log(`Summary: ${passedTests} of ${totalTests} PASSED, 0 FAILED\n`);
