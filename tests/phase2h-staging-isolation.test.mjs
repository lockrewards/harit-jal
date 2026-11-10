/**
 * ==============================================================================
 * HARIT JAL™ (हरित जल) — PHASE 2H: STAGING ISOLATION & PRECHECK VERIFICATION SUITE
 * Test File: tests/phase2h-staging-isolation.test.mjs
 * Purpose: Independently verifies staging environment isolation, guard protections,
 *          CLI linking safety, template integrity, and migration safety.
 * ==============================================================================
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORBIDDEN_PRODUCTION_REFS,
  FORBIDDEN_PLACEHOLDERS,
  auditSupabaseConfigToml,
  auditSupabaseLocalTemp,
  validateCliInvocation,
} from '../scripts/supabase-guard.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PROD_REF = 'doqzleqcyuymqyfjemcr';
const DUMMY_STAGING_REF = 'abcdefghijklmnopqrst'; // 20 chars lowercase alphanumeric

describe('HARIT JAL™ Phase 2H Staging Isolation & Migration Precheck Suite', () => {

  it('TEST-2H-01: Production reference is strictly denylisted across all subcommands', () => {
    assert.ok(FORBIDDEN_PRODUCTION_REFS.includes(PROD_REF));
    const subcommands = ['link', 'db push', 'functions deploy staff-auth', 'secrets set'];
    for (const subcmd of subcommands) {
      const args = [...subcmd.split(' '), '--project-ref', PROD_REF];
      const result = validateCliInvocation(args);
      assert.strictEqual(result.allowed, false, `Must reject production targeting for: ${subcmd}`);
      assert.ok(result.reason?.includes(PROD_REF));
    }
  });

  it('TEST-2H-02: Missing project reference is rejected fail-closed for remote commands', () => {
    const subcommands = ['link', 'db push', 'functions deploy staff-auth', 'secrets set'];
    for (const subcmd of subcommands) {
      const args = subcmd.split(' ');
      const result = validateCliInvocation(args);
      assert.strictEqual(result.allowed, false, `Must reject unqualified invocation: ${subcmd}`);
      assert.ok(result.reason?.includes('lacks explicit'));
    }
  });

  it('TEST-2H-03: Placeholder project references fail closed', () => {
    for (const ph of FORBIDDEN_PLACEHOLDERS) {
      const result = validateCliInvocation(['link', '--project-ref', ph]);
      assert.strictEqual(result.allowed, false, `Must reject placeholder: ${ph}`);
    }
  });

  it('TEST-2H-04: Valid 20-character non-production staging reference is permitted', () => {
    const result = validateCliInvocation(['link', '--project-ref', DUMMY_STAGING_REF]);
    assert.strictEqual(result.allowed, true, 'Valid staging ref must be permitted');
  });

  it('TEST-2H-05: supabase/config.toml default project_id is neutralized', () => {
    const audit = auditSupabaseConfigToml();
    assert.strictEqual(audit.safe, true, 'Config audit must be safe');
    const configPath = path.join(ROOT_DIR, 'supabase', 'config.toml');
    const content = fs.readFileSync(configPath, 'utf8');
    assert.ok(!content.includes(`project_id = "${PROD_REF}"`), 'Must not have active production project_id');
  });

  it('TEST-2H-06: supabase/.temp directory contains zero files referencing production', () => {
    const tempAudit = auditSupabaseLocalTemp();
    assert.strictEqual(tempAudit.safe, true, 'auditSupabaseLocalTemp must report safe');

    const tempDir = path.join(ROOT_DIR, 'supabase', '.temp');
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        if (fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
          assert.ok(
            !content.includes(PROD_REF.toLowerCase()),
            `supabase/.temp/${file} must NOT contain production reference`
          );
        }
      }
    }
  });

  it('TEST-2H-07: .gitignore ignores .env.staging, supabase/functions/.env.staging, and supabase/.temp/', () => {
    const gitignorePath = path.join(ROOT_DIR, '.gitignore');
    const content = fs.readFileSync(gitignorePath, 'utf8');
    assert.ok(content.includes('.env.*'), 'Must ignore .env.*');
    assert.ok(content.includes('supabase/functions/.env.*'), 'Must ignore supabase/functions/.env.*');
    assert.ok(content.includes('supabase/.temp/'), 'Must ignore supabase/.temp/');
  });

  it('TEST-2H-08: Staging example templates contain valid placeholders and zero production keys', () => {
    const feExamplePath = path.join(ROOT_DIR, '.env.staging.example');
    const fnExamplePath = path.join(ROOT_DIR, 'supabase', 'functions', '.env.staging.example');

    assert.ok(fs.existsSync(feExamplePath), '.env.staging.example must exist');
    assert.ok(fs.existsSync(fnExamplePath), 'supabase/functions/.env.staging.example must exist');

    const feContent = fs.readFileSync(feExamplePath, 'utf8');
    const fnContent = fs.readFileSync(fnExamplePath, 'utf8');

    // Extract key=value pairs and ensure none assign production ref
    const getAssignments = (content) => {
      return content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && l.includes('='))
        .map(l => l.split('=')[1].trim());
    };

    const feValues = getAssignments(feContent);
    const fnValues = getAssignments(fnContent);

    for (const v of [...feValues, ...fnValues]) {
      assert.ok(!v.includes(PROD_REF), `Template value '${v}' must not contain production reference`);
    }
  });

  it('TEST-2H-09: All 4 production migrations contain ZERO DROP TABLE statements', () => {
    const migrationsDir = path.join(ROOT_DIR, 'supabase', 'migrations');
    const migrationFiles = [
      '20261108_customer_supabase_auth_sync.sql',
      '20261108_harden_rls_policies.sql',
      '20261109_phase1h4_security_remediation.sql',
      '20261109_phase1h6_security_remediation.sql',
    ];

    for (const mf of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, mf), 'utf8');
      const lines = sql.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('--')) continue; // Skip comments
        assert.ok(!line.match(/\bDROP\s+TABLE\b/i), `File ${mf} line ${i + 1} contains forbidden DROP TABLE`);
      }
    }
  });

  it('TEST-2H-10: All DROP COLUMN operations strictly target obsolete credentials with IF EXISTS', () => {
    const migrationsDir = path.join(ROOT_DIR, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

    const allowedDroppedColumns = new Set([
      'password',
      'password_hash',
      'temporary_password',
      'temporary_password_hash',
      'temporary_password_expires_at',
      'totp_secret',
    ]);

    for (const mf of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, mf), 'utf8');
      const dropColRegex = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([^\s]+)\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi;
      let match;
      while ((match = dropColRegex.exec(sql)) !== null) {
        const table = match[1];
        const col = match[2].toLowerCase();
        assert.ok(
          allowedDroppedColumns.has(col),
          `Unexpected DROP COLUMN '${col}' on table '${table}' in ${mf}`
        );
        assert.ok(
          match[0].toUpperCase().includes('IF EXISTS'),
          `DROP COLUMN on '${col}' must include IF EXISTS in ${mf}`
        );
      }
    }
  });

});
