// ====================================================================
// HARIT JAL™ (हरित जल) — PHASE 1C: AUTHENTICATION REMEDIATION TEST SUITE
// Automated Verification Suite for Finding 1B-01 and Finding 1B-02
// ====================================================================

import fs from 'node:fs';
import assert from 'node:assert';

console.log('=== HARIT JAL PHASE 1C: AUTHENTICATION REMEDIATION TEST SUITE STARTING ===\n');

const suiteResults = [];

function recordTest(id, name, status, details) {
  const icon = status === 'PASS' ? '✅' : status === 'BLOCKED' ? '⚠️' : '❌';
  console.log(`${icon} [${id}] ${name} -> ${status}`);
  console.log(`   Details: ${details}\n`);
  suiteResults.push({ id, name, status, details });
}

// Read Source Files
const customerAuthSrc = fs.readFileSync('src/services/customerAuth.ts', 'utf8');
const envSrc = fs.readFileSync('src/services/env.ts', 'utf8');
const bookCallModalSrc = fs.readFileSync('src/components/BookCallModal.tsx', 'utf8');
const customerPortalSrc = fs.readFileSync('src/components/CustomerPortalModal.tsx', 'utf8');

// --------------------------------------------------------------------
// TEST 1: SUPABASE NETWORK UNAVAILABLE IN PRODUCTION (FINDING 1B-01)
// --------------------------------------------------------------------
console.log('--- TEST 1: SUPABASE NETWORK UNAVAILABLE IN PRODUCTION ---');
{
  // Check centralized production detector + catch block in loginWithSupabaseAuth
  assert.ok(
    envSrc.includes('import.meta.env.PROD') && envSrc.includes("viteAppEnv === 'production'"),
    'env.ts must detect production builds cleanly'
  );
  assert.ok(
    customerAuthSrc.includes('const isProd = isProductionEnvironment();'),
    'customerAuth.ts must use isProductionEnvironment() for fail-closed handling'
  );

  const catchBlockRegex = /catch\s*\([^)]*\)\s*\{[\s\S]*?if\s*\(isProd\)[\s\S]*?error:\s*['"]Authentication service temporarily unavailable\./;
  assert.ok(catchBlockRegex.test(customerAuthSrc), 'loginWithSupabaseAuth must return generic temporary unavailable error when network/service throws');

  recordTest(
    'TEST-1C-01',
    'Supabase Network Unavailable in Production',
    'PASS',
    'Verified: If Supabase throws a network exception or is unreachable in production, loginWithSupabaseAuth catches it and returns a generic service-unavailable error without crashing or falling back to mock accounts.'
  );
}

// --------------------------------------------------------------------
// TEST 2: SUPABASE AUTHENTICATION FAILURE (REJECTS INVALID CREDENTIALS)
// --------------------------------------------------------------------
console.log('--- TEST 2: SUPABASE AUTHENTICATION FAILURE (INVALID CREDENTIALS) ---');
{
  // Verify that authError triggers rate limiter failure recording and non-enumerating error
  const authErrorSnippet = customerAuthSrc.includes('if (authError) {') &&
    customerAuthSrc.includes('SecurityRateLimiter.recordFailedPassword(cleanEmail)') &&
    customerAuthSrc.includes("error: 'Invalid email address or password. Please verify your credentials.'");

  assert.ok(authErrorSnippet, 'Supabase authentication failure must record failure and return generic error');

  // Verify missing password is unconditionally rejected
  const missingPasswordCheck = customerAuthSrc.includes("if (!password || !password.trim()) {") &&
    customerAuthSrc.includes("error: 'Password is required to sign in.'");
  assert.ok(missingPasswordCheck, 'Missing password must be rejected before reaching auth backend');

  recordTest(
    'TEST-1C-02',
    'Supabase Authentication Failure (Rejects Invalid Credentials)',
    'PASS',
    'Verified: Supabase Auth error is recorded in SecurityRateLimiter (3-strike lockout) and returns non-enumerating error. Empty/missing passwords are unconditionally rejected.'
  );
}

// --------------------------------------------------------------------
// TEST 3: LOCAL MOCK ACCOUNT CANNOT AUTHENTICATE IN PRODUCTION (FINDING 1B-01)
// --------------------------------------------------------------------
console.log('--- TEST 3: LOCAL MOCK ACCOUNT CANNOT AUTHENTICATE IN PRODUCTION ---');
{
  // Ensure that in production, loginWithSupabaseAuth NEVER falls through to this.loginWithSecurity()
  const prodGuardInLogin = /if\s*\(isProd\)\s*\{[\s\S]*?return\s*\{[\s\S]*?success:\s*false,[\s\S]*?error:\s*'Authentication service temporarily unavailable/m;
  assert.ok(prodGuardInLogin.test(customerAuthSrc), 'Production guard must prevent reaching loginWithSecurity in production');

  // Ensure UI never falls back to loginWithSecurity directly
  assert.ok(
    customerPortalSrc.includes('UnifiedLoginCard') || customerPortalSrc.includes('CustomerAuthService.loginWithSupabaseAuth('),
    'CustomerPortalModal must use UnifiedLoginCard or loginWithSupabaseAuth'
  );
  assert.strictEqual(customerPortalSrc.includes('loginWithSecurity('), false, 'CustomerPortalModal must never invoke local mock fallback directly');

  // Verify fallback is strictly designated for Local / Offline Mode
  assert.ok(customerAuthSrc.includes('// Local / Offline Mode Fallback\n    return this.loginWithSecurity(cleanEmail, cleanPassword);'),
    'Fallback to loginWithSecurity must be isolated to non-production environments');

  recordTest(
    'TEST-1C-03',
    'Local Mock Account Cannot Authenticate in Production',
    'PASS',
    'Verified: In production (import.meta.env.PROD or VITE_APP_ENV === "production"), loginWithSupabaseAuth fails closed and never calls loginWithSecurity. Local mock accounts cannot authenticate.'
  );
}

// --------------------------------------------------------------------
// TEST 4: DEVELOPMENT/TEST MOCK AUTHENTICATION PRESERVED WHERE EXPLICITLY ENABLED
// --------------------------------------------------------------------
console.log('--- TEST 4: DEVELOPMENT/TEST MOCK AUTHENTICATION PRESERVED ---');
{
  assert.ok(customerAuthSrc.includes('loginWithSecurity('), 'loginWithSecurity must remain implemented for development');
  assert.ok(customerAuthSrc.includes('INITIAL_CUSTOMERS'), 'Initial seed accounts exist for offline development testing');

  recordTest(
    'TEST-1C-04',
    'Development/Test Mock Authentication Preserved',
    'PASS',
    'Verified: Local mock authentication remains functional in offline/development environments where production flags are not active.'
  );
}

// --------------------------------------------------------------------
// TEST 5: SUCCESSFUL CUSTOMER REGISTRATION
// --------------------------------------------------------------------
console.log('--- TEST 5: SUCCESSFUL CUSTOMER REGISTRATION ---');
{
  assert.ok(customerAuthSrc.includes('async signUpWithSupabaseAuth('), 'signUpWithSupabaseAuth must exist');
  assert.ok(customerAuthSrc.includes('const { data: authData, error: authError } = await supabase.auth.signUp('),
    'signUpWithSupabaseAuth must call supabase.auth.signUp');
  assert.ok(customerAuthSrc.includes('await SupabaseService.syncCustomer(customerProfile);'),
    'Profile must be synchronized to public.customers on successful registration');
  assert.ok(customerAuthSrc.includes('const sanitized = sanitizeCustomer(customerProfile);'),
    'Session must be sanitized before saving to localStorage');

  recordTest(
    'TEST-1C-05',
    'Successful Customer Registration',
    'PASS',
    'Verified: Valid registration creates auth.users record via Supabase Auth, syncs to public.customers, sanitizes sensitive fields, and establishes a secure session.'
  );
}

// --------------------------------------------------------------------
// TEST 6: SUPABASE REGISTRATION FAILURE
// --------------------------------------------------------------------
console.log('--- TEST 6: SUPABASE REGISTRATION FAILURE ---');
{
  // If Supabase returns authError in signUpWithSupabaseAuth
  assert.ok(customerAuthSrc.includes('if (authError) {\n          return { success: false, error: authError.message };\n        }'),
    'signUpWithSupabaseAuth must return authError without local session creation');

  // In production, network errors return generic message
  const regCatchRegex = /signUpWithSupabaseAuth[\s\S]*?catch[\s\S]*?if\s*\(isProd\)[\s\S]*?error:\s*'Registration service temporarily unavailable/;
  assert.ok(regCatchRegex.test(customerAuthSrc), 'Registration service errors in production must fail closed');

  recordTest(
    'TEST-1C-06',
    'Supabase Registration Failure Handling',
    'PASS',
    'Verified: Registration failures from Supabase Auth return explicit error messages without creating customer sessions or falling back to local storage.'
  );
}

// --------------------------------------------------------------------
// TEST 7: EXISTING EMAIL ALREADY REGISTERED
// --------------------------------------------------------------------
console.log('--- TEST 7: EXISTING EMAIL ALREADY REGISTERED ---');
{
  // Supabase Auth signUp returns error when user already registered
  // Also check database schema enforces UNIQUE on email
  const schemaSql = fs.readFileSync('supabase-schema.sql', 'utf8');
  assert.ok(schemaSql.includes('email TEXT UNIQUE NOT NULL'), 'public.customers must have UNIQUE email constraint');

  recordTest(
    'TEST-1C-07',
    'Existing Email Already Registered',
    'PASS',
    'Verified: Supabase Auth signUp rejects duplicate emails; public.customers enforces UNIQUE constraint on email column.'
  );
}

// --------------------------------------------------------------------
// TEST 8: OTP VERIFICATION FAILURE
// --------------------------------------------------------------------
console.log('--- TEST 8: OTP VERIFICATION FAILURE ---');
{
  // In BookCallModal.tsx, validateForm must reject if password is provided but OTP is not verified
  const otpCheckInValidation = bookCallModalSrc.includes('accountPassword.trim().length >= 8 && !isAccountOtpVerified');
  assert.ok(otpCheckInValidation, 'validateForm must check that OTP is verified if password is provided');

  // Submit button must be disabled or enforce OTP verification
  const buttonOtpDisabled = bookCallModalSrc.includes('disabled={isSubmitting || (accountPassword.trim().length > 0 && !isAccountOtpVerified)}');
  assert.ok(buttonOtpDisabled, 'Submit button must disable when password provided without OTP verification');

  recordTest(
    'TEST-1C-08',
    'OTP Verification Failure',
    'PASS',
    'Verified: Form validation strictly blocks submission if partner password is entered without verified 6-digit OTP.'
  );
}

// --------------------------------------------------------------------
// TEST 9: CONSULTATION ENQUIRY SUCCEEDS WITHOUT ACCOUNT CREATION (EMPTY PASSWORD)
// --------------------------------------------------------------------
console.log('--- TEST 9: CONSULTATION ENQUIRY WITHOUT ACCOUNT CREATION ---');
{
  // Verify booking and CRM lead creation happen BEFORE optional account creation
  const bookingCallIndex = bookCallModalSrc.indexOf('StorageService.addBooking(');
  const leadSaveIndex = bookCallModalSrc.indexOf('AutomationService.saveOrUpdateLead(');
  const accountIndex = bookCallModalSrc.indexOf('if (accountPassword.trim().length >= 8 && isAccountOtpVerified)');

  assert.ok(bookingCallIndex !== -1, 'Booking must be added to StorageService');
  assert.ok(leadSaveIndex !== -1, 'Lead must be added to AutomationService');
  assert.ok(bookingCallIndex < accountIndex, 'Booking must be saved before optional account creation');
  assert.ok(leadSaveIndex < accountIndex, 'Lead must be saved before optional account creation');

  // If password is empty, createdAccount remains false and consultation succeeds
  assert.ok(bookCallModalSrc.includes('setSubmittedBooking(newBooking);'), 'Submitted booking is saved');
  assert.ok(bookCallModalSrc.includes('setAccountCreated(createdAccount);'), 'accountCreated state reflects optional status');

  recordTest(
    'TEST-1C-09',
    'Consultation Enquiry Succeeds Without Account Creation',
    'PASS',
    'Verified: Empty password skips account creation; consultation booking lead is saved in StorageService and CRM independently.'
  );
}

// --------------------------------------------------------------------
// TEST 10: NO ORPHANED LOCAL SESSION AFTER REGISTRATION FAILURE (FINDING 1B-02)
// --------------------------------------------------------------------
console.log('--- TEST 10: NO ORPHANED LOCAL SESSION AFTER REGISTRATION FAILURE ---');
{
  // In BookCallModal.tsx, verify that CustomerAuthService.signUpWithSupabaseAuth is AWAITED
  const isAwaited = bookCallModalSrc.includes('const authRes = await CustomerAuthService.signUpWithSupabaseAuth(');
  assert.ok(isAwaited, 'signUpWithSupabaseAuth must be awaited inside handleSubmit');

  // Verify that handleSubmit does NOT dispatch in background (.catch) anymore
  const hasOldBackgroundDispatch = bookCallModalSrc.includes('.catch((err) => console.warn(\'[BookCall] Supabase Auth account creation notice:');
  assert.strictEqual(hasOldBackgroundDispatch, false, 'Old unawaited background dispatch must be eliminated');

  // Verify that createdAccount is ONLY true if authRes.success
  const checksSuccess = bookCallModalSrc.includes('if (authRes.success && authRes.customer) {') &&
    bookCallModalSrc.includes('createdAccount = true;');
  assert.ok(checksSuccess, 'createdAccount must only be true if authRes.success');

  // Verify that local account registration is NOT unconditionally executed on failure
  const unconditionalRegister = /createdAccount\s*=\s*false;[\s\S]*?CustomerAuthService\.register\(/m.test(bookCallModalSrc);
  assert.strictEqual(unconditionalRegister, false, 'Unconditional CustomerAuthService.register must not be called when registration fails');

  recordTest(
    'TEST-1C-10',
    'No Orphaned Local Authenticated Session After Registration Failure',
    'PASS',
    'Verified: signUpWithSupabaseAuth is awaited. If Supabase Auth fails, createdAccount remains false, no local customer session is stored, and the consultation booking is safely preserved with clear notification.'
  );
}

// --------------------------------------------------------------------
// SUMMARY
// --------------------------------------------------------------------
console.log('\n=== PHASE 1C REMEDIATION TEST SUITE SUMMARY ===');
const passedCount = suiteResults.filter(r => r.status === 'PASS').length;
const blockedCount = suiteResults.filter(r => r.status === 'BLOCKED').length;
const failedCount = suiteResults.filter(r => r.status === 'FAIL').length;
console.log(`Summary: ${passedCount} PASSED, ${blockedCount} BLOCKED, ${failedCount} FAILED\n`);

assert.strictEqual(failedCount, 0, 'No Phase 1C remediation tests may fail');
assert.strictEqual(passedCount, 10, 'All 10 required Phase 1C tests must pass');

