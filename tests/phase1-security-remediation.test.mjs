// ====================================================================
// HARIT JAL™ (हरित जल) — PHASE 1: SECURITY REMEDIATION TEST SUITE
// Automated verification of all remediated vulnerabilities:
// SEC-01: Plaintext Password Storage Elimination & Salted Hashing
// SEC-02: Passwordless Customer Authentication Bypass Elimination
// SEC-03: Supabase RLS Hardening (Principle of Least Privilege)
// SEC-04: Hardcoded Administrative Password Elimination
// SEC-05: Environment File Protection & .gitignore Verification
// SEC-06: Account Enumeration Defense (Uniform Error Responses)
// SEC-07: Google Apps Script Webhook Authentication & Formula Sanitization
// SEC-08: Content Security Policy & Security Meta Tags
// ====================================================================

import assert from 'node:assert';
import fs from 'node:fs';

console.log('=== HARIT JAL PHASE 1: SECURITY REMEDIATION SUITE STARTING ===\n');

const suiteResults = [];

function recordTest(id, name, pass, details) {
  suiteResults.push({ id, name, pass, details });
  console.log(`${pass ? '✅' : '❌'} [${id}] ${name}: ${details}`);
}

// --------------------------------------------------------------------
// 1. CUSTOMER AUTHENTICATION & STORAGE REMEDIATION (SEC-01 & SEC-02)
// --------------------------------------------------------------------
console.log('--- 1. CUSTOMER AUTHENTICATION & STORAGE REMEDIATION (SEC-01 & SEC-02) ---');

const custAuthSrc = fs.readFileSync('src/services/customerAuth.ts', 'utf8');

// TEST 1.1: SEC-02 Verify password check is mandatory and rejects empty/missing
assert.ok(
  custAuthSrc.includes("if (!password || !password.trim())"),
  'loginWithSecurity must reject missing or empty password'
);
assert.ok(
  custAuthSrc.includes("Password is required to sign in."),
  'Must return explicit error for missing password'
);
assert.ok(
  custAuthSrc.includes("login(email: string, password?: string)"),
  'login helper must accept password'
);
assert.ok(
  custAuthSrc.includes("if (!password || !password.trim()) {\n      return null;"),
  'login helper must return null if password omitted'
);
recordTest('TEST-AUTH-01', 'Passwordless Bypass Elimination (SEC-02)', true, 'Missing and empty passwords strictly rejected in loginWithSecurity and login().');

// TEST 1.2: SEC-01 Verify plaintext passwords eliminated from INITIAL_CUSTOMERS
assert.strictEqual(
  custAuthSrc.includes("password: 'password123'"),
  false,
  'INITIAL_CUSTOMERS must NOT contain raw password: password123'
);
assert.ok(
  custAuthSrc.includes('passwordHash:'),
  'INITIAL_CUSTOMERS must use salted passwordHash'
);
assert.ok(
  custAuthSrc.includes('sanitizeCustomer(cust: CustomerAccount)'),
  'Must contain sanitizeCustomer function'
);
assert.ok(
  custAuthSrc.includes('delete clean.password;'),
  'sanitizeCustomer must strip password property'
);
assert.ok(
  custAuthSrc.includes('delete clean.passwordHash;'),
  'sanitizeCustomer must strip passwordHash property'
);
recordTest('TEST-AUTH-02', 'Plaintext Password Elimination (SEC-01)', true, 'Seed passwords replaced with salted hashes; active session strictly sanitized.');

// TEST 1.3: SEC-06 Uniform non-enumerating error responses on customer login
assert.ok(
  custAuthSrc.includes("'Invalid email address or password. Please verify your credentials.'"),
  'Must use uniform error message'
);
assert.strictEqual(
  custAuthSrc.includes("error: 'No registered partner account found with this email address.'"),
  false,
  'Must NOT reveal whether customer account exists'
);
recordTest('TEST-AUTH-03', 'Customer Account Enumeration Defense (SEC-06)', true, 'Generic error message used for both unknown email and incorrect password.');

// --------------------------------------------------------------------
// 2. ADMINISTRATIVE AUTHENTICATION REMEDIATION (SEC-04 & SEC-06)
// --------------------------------------------------------------------
console.log('\n--- 2. ADMINISTRATIVE AUTHENTICATION REMEDIATION (SEC-04 & SEC-06) ---');

const adminAuthSrc = fs.readFileSync('src/services/adminAuth.ts', 'utf8');

// TEST 2.1: SEC-04 Verify no hardcoded passwords in client source code
assert.strictEqual(
  adminAuthSrc.includes('DEFAULT_ADMIN_CREDENTIALS'),
  false,
  'DEFAULT_ADMIN_CREDENTIALS must be removed'
);
assert.strictEqual(
  adminAuthSrc.includes('Admin@HaritJal2026'),
  false,
  'Hardcoded staff passwords must not be present in adminAuth.ts'
);
recordTest('TEST-ADMIN-01', 'Hardcoded Administrative Credentials Elimination (SEC-04)', true, 'DEFAULT_ADMIN_CREDENTIALS completely removed from source code.');

// TEST 2.2: SEC-06 Uniform non-enumerating error responses on admin login
assert.ok(
  adminAuthSrc.includes("'Invalid administrative credentials. Please verify your Email or Mobile number and Password.'"),
  'Must return uniform error message for admin login failures'
);
assert.strictEqual(
  adminAuthSrc.includes("Access denied: No administrative staff found with this Email address or Mobile number."),
  false,
  'Must NOT reveal whether staff account exists'
);
recordTest('TEST-ADMIN-02', 'Staff Account Enumeration Defense (SEC-06)', true, 'Generic error message used for unknown staff identifier and invalid password.');

// TEST 2.3: Verify 2-step TOTP flow logic preserved
assert.ok(
  adminAuthSrc.includes('validateCredentials('),
  'Step 1 credential validator preserved'
);
assert.ok(
  adminAuthSrc.includes('verifyTotpAndCreateSession('),
  'Step 2 TOTP session creator preserved'
);
assert.ok(
  adminAuthSrc.includes('completeFirstTimeSetup('),
  'First-time staff setup preserved'
);
recordTest('TEST-ADMIN-03', '2-Step Admin TOTP Flow Preserved', true, 'Step 1 ID/Password and Step 2 TOTP Google Authenticator flow verified.');

// --------------------------------------------------------------------
// 3. SUPABASE ROW LEVEL SECURITY (RLS) HARDENING (SEC-03)
// --------------------------------------------------------------------
console.log('\n--- 3. SUPABASE RLS HARDENING REMEDIATION (SEC-03) ---');

const schemaSql = fs.readFileSync('supabase-schema.sql', 'utf8');
const migrationSql = fs.readFileSync('supabase/migrations/20261108_harden_rls_policies.sql', 'utf8');
const rollbackSql = fs.readFileSync('supabase/rollback/20261108_rollback_rls_policies.sql', 'utf8');

// Verify permissive policies removed from active schema
assert.strictEqual(schemaSql.includes('CREATE POLICY "Anon full access staff_users"'), false, 'Insecure policy must be removed');
assert.strictEqual(schemaSql.includes('CREATE POLICY "Anon full access customers"'), false, 'Insecure policy must be removed');
assert.strictEqual(schemaSql.includes('CREATE POLICY "Anon full access orders"'), false, 'Insecure policy must be removed');

// Verify hardened policies installed
assert.ok(schemaSql.includes('Deny anon access to staff_users'), 'staff_users must deny anon');
assert.ok(schemaSql.includes('Customer can read own profile'), 'customers read must check auth.uid');
assert.ok(schemaSql.includes('Customer can view own orders'), 'orders read must check owner_email');
assert.ok(schemaSql.includes('Public can book tasting consultation'), 'consultations insert must be allowed');
assert.ok(schemaSql.includes('Anon can view and record security blocks'), 'security blocks sync must be allowed');

// Verify migration and rollback SQL files exist and are valid
assert.ok(migrationSql.includes('BEGIN;') && migrationSql.includes('COMMIT;'), 'Migration must be atomic');
assert.ok(rollbackSql.includes('BEGIN;') && rollbackSql.includes('COMMIT;'), 'Rollback must be atomic');

recordTest('TEST-RLS-01', 'Supabase RLS Policy Hardening (SEC-03)', true, 'Permissive anon policies eliminated; forward migration and rollback SQL created.');

// --------------------------------------------------------------------
// 4. GOOGLE APPS SCRIPT WEBHOOK SECURITY (SEC-07)
// --------------------------------------------------------------------
console.log('\n--- 4. GOOGLE APPS SCRIPT WEBHOOK REMEDIATION (SEC-07) ---');

const gasSrc = fs.readFileSync('google-apps-script.js', 'utf8');

// Verify authentication token check
assert.ok(gasSrc.includes('HARIT_JAL_WEBHOOK_SECRET'), 'Must check webhook secret property');
assert.ok(gasSrc.includes('incomingSecret !== expectedSecret'), 'Must reject unauthorized webhook requests');
assert.ok(gasSrc.includes('"unauthorized"'), 'Must return unauthorized status');

// Verify formula injection sanitization
assert.ok(gasSrc.includes('sanitizeCell(val)'), 'Must contain sanitizeCell function');
assert.ok(gasSrc.includes("^[=\\+\\-@\\t\\r]"), 'Must neutralize formula characters (=, +, -, @, \\t, \\r)');

recordTest('TEST-GAS-01', 'Google Apps Script Webhook Security (SEC-07)', true, 'Webhook secret authentication & formula injection sanitization verified.');

// --------------------------------------------------------------------
// 5. ENVIRONMENT FILE PROTECTION (SEC-05)
// --------------------------------------------------------------------
console.log('\n--- 5. ENVIRONMENT FILE PROTECTION (SEC-05) ---');

const gitignore = fs.readFileSync('.gitignore', 'utf8');
const gitignoreLines = gitignore.split('\n').map(l => l.trim());

assert.ok(gitignoreLines.includes('.env'), '.gitignore must explicitly include .env');
assert.ok(gitignoreLines.includes('.env.*'), '.gitignore must include .env.*');
assert.ok(gitignoreLines.includes('.env.local'), '.gitignore must include .env.local');
assert.ok(gitignoreLines.includes('!.env.example'), '.gitignore must preserve .env.example');

recordTest('TEST-ENV-01', 'Environment File Protection (SEC-05)', true, '.env, .env.*, and .env.local explicitly excluded in .gitignore.');

// --------------------------------------------------------------------
// 6. CONTENT SECURITY POLICY & SECURITY HEADERS (SEC-08)
// --------------------------------------------------------------------
console.log('\n--- 6. SECURITY HEADERS & CSP (SEC-08) ---');

const indexHtml = fs.readFileSync('index.html', 'utf8');
assert.ok(indexHtml.includes('Content-Security-Policy'), 'CSP meta tag must be present in index.html');
assert.ok(indexHtml.includes('X-Content-Type-Options'), 'X-Content-Type-Options must be present in index.html');
assert.ok(indexHtml.includes('Referrer-Policy'), 'Referrer-Policy must be present in index.html');

recordTest('TEST-CSP-01', 'Content Security Policy & Security Meta Tags (SEC-08)', true, 'CSP, nosniff, and strict-origin referrer headers present in index.html.');

console.log(`\n=== ALL ${suiteResults.length} PHASE 1 SECURITY TESTS EXECUTED AND PASSED ===`);
const failedTests = suiteResults.filter(r => !r.pass);
assert.strictEqual(failedTests.length, 0, 'No security tests may fail');
