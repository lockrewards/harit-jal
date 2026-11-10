/**
 * ==============================================================================
 * HARIT JAL™ (हरित जल) — PHASE 1H.8.4.1 AUTOMATED SAFETY & AUDIT SUITE
 * Test File: tests/phase1h8-4-1-safety-audit.test.mjs
 * Purpose: Verifies production CLI default neutralization, denylist enforcement,
 *          migration dependencies, and staging environment template safety.
 * ==============================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkProjectRefDenylist,
  auditSupabaseConfigToml,
  auditSupabaseLocalTemp,
  validateCliInvocation,
  FORBIDDEN_PRODUCTION_REFS,
} from '../scripts/supabase-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

describe('HARIT JAL™ Phase 1H.8.4.1 Production Isolation & Safety Audit Suite', () => {

  // --------------------------------------------------------------------
  // 1. PRODUCTION CLI DEFAULT PROTECTION (TASK 1)
  // --------------------------------------------------------------------
  it('TEST-1H841-01: supabase/config.toml has neutralized default project_id', () => {
    const configPath = path.join(ROOT_DIR, 'supabase', 'config.toml');
    const content = fs.readFileSync(configPath, 'utf8');

    // Must NOT have active project_id = "doqzleqcyuymqyfjemcr"
    const activeMatch = content.match(/^\s*project_id\s*=\s*["']doqzleqcyuymqyfjemcr["']/m);
    assert.strictEqual(activeMatch, null, 'supabase/config.toml must NOT contain active production project_id');

    const audit = auditSupabaseConfigToml();
    assert.strictEqual(audit.safe, true, 'auditSupabaseConfigToml must report safe');
  });

  it('TEST-1H841-02: Stale local .temp project-ref to production is purged and ignored', () => {
    const tempAudit = auditSupabaseLocalTemp();
    assert.strictEqual(tempAudit.safe, true, 'auditSupabaseLocalTemp must report safe');

    const gitignorePath = path.join(ROOT_DIR, '.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    assert.ok(gitignoreContent.includes('supabase/.temp/'), '.gitignore must ignore supabase/.temp/');
  });

  it('TEST-1H841-03: Production project ref is strictly blocked by denylist (case-insensitive)', () => {
    assert.ok(FORBIDDEN_PRODUCTION_REFS.includes('doqzleqcyuymqyfjemcr'));

    const checkLower = checkProjectRefDenylist('doqzleqcyuymqyfjemcr');
    assert.strictEqual(checkLower.isBlocked, true, 'Must block lowercase production ref');
    assert.ok(checkLower.error?.includes('[FATAL]'));

    const checkUpper = checkProjectRefDenylist('DOQZLEQCYUYMQYFJEMCR');
    assert.strictEqual(checkUpper.isBlocked, true, 'Must block uppercase production ref');

    const checkWhitespace = checkProjectRefDenylist('  doqzleqcyuymqyfjemcr  ');
    assert.strictEqual(checkWhitespace.isBlocked, true, 'Must block padded production ref');

    const checkStaging = checkProjectRefDenylist('haritjalstaging12345');
    assert.strictEqual(checkStaging.isBlocked, false, 'Must allow non-production ref');
  });

  it('TEST-1H841-04: Unqualified remote commands are rejected without --project-ref', () => {
    const resDbPush = validateCliInvocation(['db', 'push']);
    assert.strictEqual(resDbPush.allowed, false);
    assert.ok(resDbPush.reason?.includes("lacks explicit '--project-ref"));

    const resFuncDeploy = validateCliInvocation(['functions', 'deploy', 'staff-auth']);
    assert.strictEqual(resFuncDeploy.allowed, false);

    const resSecretsSet = validateCliInvocation(['secrets', 'set', '--env-file', 'some-file']);
    assert.strictEqual(resSecretsSet.allowed, false);
  });

  it('TEST-1H841-05: Remote command targeting production via flag is strictly rejected', () => {
    const resProdDeploy = validateCliInvocation([
      'functions', 'deploy', 'staff-auth',
      '--project-ref', 'doqzleqcyuymqyfjemcr',
    ]);
    assert.strictEqual(resProdDeploy.allowed, false);
    assert.ok(resProdDeploy.reason?.includes('strictly forbidden'));

    const resProdDb = validateCliInvocation([
      'db', 'push',
      '--project-ref=doqzleqcyuymqyfjemcr',
    ]);
    assert.strictEqual(resProdDb.allowed, false);
    assert.ok(resProdDb.reason?.includes('strictly forbidden'));
  });

  it('TEST-1H841-06: Remote command with valid staging ref is permitted', () => {
    const res = validateCliInvocation([
      'functions', 'deploy', 'staff-auth',
      '--project-ref', 'haritjalstaging99999',
    ]);
    assert.strictEqual(res.allowed, true);
  });

  // --------------------------------------------------------------------
  // 2. MIGRATION DEPENDENCY AUDIT (TASK 2)
  // --------------------------------------------------------------------
  it('TEST-1H841-07: Migration 1 safely handles fresh database via ALTER TABLE IF EXISTS', () => {
    const mig1Path = path.join(ROOT_DIR, 'supabase', 'migrations', '20261108_customer_supabase_auth_sync.sql');
    const content = fs.readFileSync(mig1Path, 'utf8');

    assert.ok(
      content.includes('ALTER TABLE IF EXISTS public.customers DROP COLUMN IF EXISTS password;'),
      'Migration 1 must use ALTER TABLE IF EXISTS on customers to support fresh databases'
    );
    assert.ok(
      content.includes('ALTER TABLE IF EXISTS public.customers DROP COLUMN IF EXISTS password_hash;'),
      'Migration 1 must use ALTER TABLE IF EXISTS for password_hash'
    );
    assert.ok(content.includes('BEGIN;'), 'Migration 1 must open transaction');
    assert.ok(content.includes('COMMIT;'), 'Migration 1 must commit transaction');
  });

  it('TEST-1H841-08: All four migrations exist and have valid transaction blocks', () => {
    const migrations = [
      '20261108_customer_supabase_auth_sync.sql',
      '20261108_harden_rls_policies.sql',
      '20261109_phase1h4_security_remediation.sql',
      '20261109_phase1h6_security_remediation.sql',
    ];

    for (const mig of migrations) {
      const p = path.join(ROOT_DIR, 'supabase', 'migrations', mig);
      assert.ok(fs.existsSync(p), `Migration file ${mig} must exist`);
      const sql = fs.readFileSync(p, 'utf8');
      assert.ok(sql.includes('BEGIN;'), `${mig} must include BEGIN;`);
      assert.ok(sql.includes('COMMIT;'), `${mig} must include COMMIT;`);
    }
  });

  it('TEST-1H841-09: Rollback scripts exist safely isolated in supabase/rollback/', () => {
    const rollbackScripts = [
      '20261108_rollback_customer_supabase_auth_sync.sql',
      '20261108_rollback_rls_policies.sql',
      '20261109_rollback_phase1h6_security_remediation.sql',
    ];

    for (const rb of rollbackScripts) {
      const p = path.join(ROOT_DIR, 'supabase', 'rollback', rb);
      assert.ok(fs.existsSync(p), `Rollback script ${rb} must exist in supabase/rollback/`);
      const sql = fs.readFileSync(p, 'utf8');
      assert.ok(sql.includes('BEGIN;'), `${rb} must include BEGIN;`);
      assert.ok(!/CREATE\s+POLICY[\s\S]*?USING\s*\(\s*true\s*\)/i.test(sql), `${rb} must never create permissive anon policy`);
    }
  });

  // --------------------------------------------------------------------
  // 3. STAGING ENVIRONMENT TEMPLATE VALIDATION (TASK 3)
  // --------------------------------------------------------------------
  it('TEST-1H841-10: .env.staging.example contains placeholders and zero production values', () => {
    const envStaging = fs.readFileSync(path.join(ROOT_DIR, '.env.staging.example'), 'utf8');
    assert.ok(envStaging.includes('https://<STAGING_PROJECT_REF>.supabase.co'));
    assert.ok(envStaging.includes('staging_anon_key_placeholder'));
    assert.ok(envStaging.includes('VITE_APP_ENV=staging'));
    assert.ok(envStaging.includes('https://staging.haritjal.in'));
    // Must not have active production URL
    assert.ok(!envStaging.includes('https://doqzleqcyuymqyfjemcr.supabase.co'));
  });

  it('TEST-1H841-11: supabase/functions/.env.staging.example contains staging credentials and test keys', () => {
    const edgeEnv = fs.readFileSync(path.join(ROOT_DIR, 'supabase', 'functions', '.env.staging.example'), 'utf8');
    assert.ok(edgeEnv.includes('APP_ENV=staging'));
    assert.ok(edgeEnv.includes('re_staging_test_api_key_placeholder'));
    assert.ok(edgeEnv.includes('replace_with_distinct_staging_64_char_hex_secret'));
    assert.ok(edgeEnv.includes('TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA'));
    assert.ok(edgeEnv.includes('ALLOWED_ORIGINS=https://staging.haritjal.in,http://localhost:5173,http://127.0.0.1:5173'));
    // Must not contain production URLs or secrets
    assert.ok(!edgeEnv.includes('https://doqzleqcyuymqyfjemcr.supabase.co'));
  });

  // --------------------------------------------------------------------
  // 4. DEPLOYMENT COMMAND SAFETY (TASK 4)
  // --------------------------------------------------------------------
  it('TEST-1H841-12: STAGING_DEPLOYMENT_COMMANDS.md uses explicit --project-ref for all operations', () => {
    const docPath = path.join(ROOT_DIR, 'docs', 'security', 'phase-1h8-4', 'STAGING_DEPLOYMENT_COMMANDS.md');
    const doc = fs.readFileSync(docPath, 'utf8');

    // Every remote CLI invocation in code blocks must specify --project-ref
    const codeBlocks = doc.match(/```bash[\s\S]*?```/g) || [];
    for (const block of codeBlocks) {
      const lines = block.split('\n').filter(l => l.startsWith('supabase '));
      for (const line of lines) {
        assert.ok(
          line.includes('--project-ref'),
          `Command line '${line}' in STAGING_DEPLOYMENT_COMMANDS.md must include explicit --project-ref`
        );
        assert.ok(
          !line.includes('doqzleqcyuymqyfjemcr'),
          `Command line '${line}' must NOT contain production ref`
        );
      }
    }
  });
});
