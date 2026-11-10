/**
 * ==============================================================================
 * HARIT JAL™ (हरित जल) — PHASE 1H.8.4.2 FINAL STAGING SAFETY VERIFICATION SUITE
 * Test File: tests/phase1h8-4-2-final-safety.test.mjs
 * Purpose: Tests advanced guard edge cases, malformed references, placeholder
 *          detection, argument positioning, and rollback script risk analysis.
 * ==============================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateProjectRefFormat,
  validateCliInvocation,
} from '../scripts/supabase-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('HARIT JAL™ Phase 1H.8.4.2 Final Staging Safety Verification Suite', () => {

  // --------------------------------------------------------------------
  // TASK 1: SUPABASE GUARD ENFORCEMENT & EDGE CASES
  // --------------------------------------------------------------------
  it('TEST-1H842-01: Rejects unreplaced placeholder references (<STAGING_PROJECT_REF>)', () => {
    const resPlaceholder1 = validateCliInvocation([
      'db', 'push',
      '--project-ref', '<STAGING_PROJECT_REF>',
    ]);
    assert.strictEqual(resPlaceholder1.allowed, false);
    assert.ok(resPlaceholder1.reason?.includes('unreplaced placeholder'));

    const resPlaceholder2 = validateCliInvocation([
      'functions', 'deploy', 'staff-auth',
      '--project-ref=<STAGING_REF>',
    ]);
    assert.strictEqual(resPlaceholder2.allowed, false);
    assert.ok(resPlaceholder2.reason?.includes('unreplaced placeholder'));
  });

  it('TEST-1H842-02: Rejects malformed project references (length != 20 or non-alphanumeric)', () => {
    // Too short
    const resShort = validateProjectRefFormat('abc123');
    assert.strictEqual(resShort.isValid, false);
    assert.ok(resShort.error?.includes('Malformed project reference'));

    // Special characters
    const resSpecial = validateProjectRefFormat('haritjal!staging#123');
    assert.strictEqual(resSpecial.isValid, false);
    assert.ok(resSpecial.error?.includes('Malformed project reference'));

    // Too long (25 chars)
    const resLong = validateProjectRefFormat('haritjalstaginglongref123');
    assert.strictEqual(resLong.isValid, false);

    // Empty string
    const resEmpty = validateProjectRefFormat('');
    assert.strictEqual(resEmpty.isValid, false);
  });

  it('TEST-1H842-03: Accepts valid 20-character staging project references', () => {
    const valid = validateProjectRefFormat('haritjalstaging99999');
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.error, undefined);
  });

  it('TEST-1H842-04: Handles --project-ref in different argument positions', () => {
    // Flag at the beginning
    const resLeading = validateCliInvocation([
      '--project-ref', 'haritjalstaging99999',
      'db', 'push',
    ]);
    assert.strictEqual(resLeading.allowed, true);

    // Flag at the end
    const resTrailing = validateCliInvocation([
      'functions', 'deploy', 'staff-auth',
      '--project-ref', 'haritjalstaging99999',
    ]);
    assert.strictEqual(resTrailing.allowed, true);

    // Short flag -p
    const resShortFlag = validateCliInvocation([
      'db', 'push',
      '-p', 'haritjalstaging99999',
    ]);
    assert.strictEqual(resShortFlag.allowed, true);

    // Inline equals flag --project-ref=...
    const resInline = validateCliInvocation([
      'secrets', 'set',
      '--project-ref=haritjalstaging99999',
      '--env-file', 'some-file',
    ]);
    assert.strictEqual(resInline.allowed, true);
  });

  it('TEST-1H842-05: Handles shell quotes around project reference', () => {
    const resDoubleQuote = validateCliInvocation([
      'db', 'push',
      '--project-ref', '"haritjalstaging99999"',
    ]);
    assert.strictEqual(resDoubleQuote.allowed, true);

    const resSingleQuote = validateCliInvocation([
      'db', 'push',
      '--project-ref', "'haritjalstaging99999'",
    ]);
    assert.strictEqual(resSingleQuote.allowed, true);
  });

  it('TEST-1H842-06: Production reference denylist is impenetrable across casing, whitespace, and flag format', () => {
    const vectors = [
      ['db', 'push', '--project-ref', 'doqzleqcyuymqyfjemcr'],
      ['db', 'push', '--project-ref=doqzleqcyuymqyfjemcr'],
      ['db', 'push', '-p', 'doqzleqcyuymqyfjemcr'],
      ['db', 'push', '--project-ref', 'DOQZLEQCYUYMQYFJEMCR'],
      ['db', 'push', '--project-ref', '  doqzleqcyuymqyfjemcr  '],
      ['--project-ref', 'doqzleqcyuymqyfjemcr', 'functions', 'deploy', 'staff-auth'],
    ];

    for (const vec of vectors) {
      const res = validateCliInvocation(vec);
      assert.strictEqual(res.allowed, false, `Vector ${vec.join(' ')} must be blocked`);
      assert.ok(res.reason?.includes('strictly forbidden'), `Vector ${vec.join(' ')} must report forbidden`);
    }
  });

  // --------------------------------------------------------------------
  // TASK 2 & 3: MIGRATIONS & ROLLBACK SCRIPTS ANALYSIS
  // --------------------------------------------------------------------
  it('TEST-1H842-07: Static verification confirms zero DROP TABLE in production migrations', () => {
    const migrations = [
      '20261108_customer_supabase_auth_sync.sql',
      '20261108_harden_rls_policies.sql',
      '20261109_phase1h4_security_remediation.sql',
      '20261109_phase1h6_security_remediation.sql',
    ];

    for (const mig of migrations) {
      const sql = fs.readFileSync(path.join(ROOT_DIR, 'supabase', 'migrations', mig), 'utf8');
      assert.ok(!/DROP\s+TABLE/i.test(sql), `Migration ${mig} must never contain DROP TABLE`);
    }
  });

  it('TEST-1H842-08: Identifies destructive DROP TABLE in rollback script 20261109_rollback_phase1h6', () => {
    const rbPath = path.join(ROOT_DIR, 'supabase', 'rollback', '20261109_rollback_phase1h6_security_remediation.sql');
    const sql = fs.readFileSync(rbPath, 'utf8');

    // Rollback script contains DROP TABLE on otp_challenges and edge_rate_limits
    const dropsOtp = /DROP\s+TABLE\s+(IF\s+EXISTS\s+)?public\.otp_challenges/i.test(sql);
    const dropsRate = /DROP\s+TABLE\s+(IF\s+EXISTS\s+)?public\.edge_rate_limits/i.test(sql);

    assert.ok(dropsOtp, 'Rollback script drops otp_challenges (data-loss risk documented)');
    assert.ok(dropsRate, 'Rollback script drops edge_rate_limits (state-loss risk documented)');
  });

  // --------------------------------------------------------------------
  // TASK 4: STAGING SECRET ISOLATION
  // --------------------------------------------------------------------
  it('TEST-1H842-09: Verifies zero production URLs or keys across staging example templates', () => {
    const stagingTemplates = [
      '.env.staging.example',
      'supabase/functions/.env.staging.example',
    ];

    for (const tpl of stagingTemplates) {
      const content = fs.readFileSync(path.join(ROOT_DIR, tpl), 'utf8');
      assert.ok(!content.includes('https://doqzleqcyuymqyfjemcr.supabase.co'));
      assert.ok(!content.includes('doqzleqcyuymqyfjemcr.supabase.co'));
    }
  });
});
