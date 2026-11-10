#!/usr/bin/env node
/**
 * ==============================================================================
 * HARIT JAL™ (हरित जल) — SUPABASE CLI PRODUCTION SAFETY GUARD
 * Script: scripts/supabase-guard.mjs
 * Purpose: Enforces fail-closed protection against accidental production mutations.
 * 
 * Safety Rules:
 *   1. DENYLIST: Strictly blocks production reference 'doqzleqcyuymqyfjemcr'.
 *   2. EXPLICIT TARGET: Rejects any remote command that lacks an explicit --project-ref.
 *   3. CONFIG CHECK: Verifies supabase/config.toml default project_id is neutralized.
 *   4. ZERO FALLBACK: Prevents silent fallback to any default or cached project.
 * ==============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. FORBIDDEN PRODUCTION PROJECT IDENTIFIERS (DENYLIST)
export const FORBIDDEN_PRODUCTION_REFS = Object.freeze([
  'doqzleqcyuymqyfjemcr', // Primary Harit Jal Production Supabase Project
]);

// 1.1 FORBIDDEN PLACEHOLDER REFERENCES
export const FORBIDDEN_PLACEHOLDERS = Object.freeze([
  '<staging_project_ref>',
  '<staging_ref>',
  'staging_project_ref',
  'staging_ref',
  '<project_ref>',
  'your_project_ref',
  'placeholder',
  'undefined',
  'null',
]);

// 2. REMOTE SUBCOMMANDS REQUIRING EXPLICIT --project-ref
export const REMOTE_COMMANDS_REQUIRING_PROJECT_REF = Object.freeze([
  'db push',
  'db execute',
  'db query',
  'db pull',
  'db remote',
  'db dump',
  'db reset',
  'functions deploy',
  'functions list',
  'functions logs',
  'functions delete',
  'secrets set',
  'secrets list',
  'secrets unset',
  'link',
]);

/**
 * Validates the syntactic format of a Supabase project reference.
 * Supabase project references consist of exactly 20 lowercase alphanumeric characters.
 * @param {string} ref
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateProjectRefFormat(ref) {
  if (!ref || typeof ref !== 'string') {
    return { isValid: false, error: '[FATAL] Project reference is missing or empty.' };
  }
  const cleanRef = ref.trim().toLowerCase().replace(/^["']|["']$/g, '');
  if (!cleanRef) {
    return { isValid: false, error: '[FATAL] Project reference cannot be blank.' };
  }
  if (
    FORBIDDEN_PLACEHOLDERS.includes(cleanRef) ||
    cleanRef.includes('<') ||
    cleanRef.includes('>') ||
    cleanRef.includes('placeholder')
  ) {
    return {
      isValid: false,
      error: `[FATAL] Detected unreplaced placeholder reference '${ref}'. You must replace it with your confirmed 20-character staging project reference.`,
    };
  }
  if (!/^[a-z0-9]{20}$/.test(cleanRef)) {
    return {
      isValid: false,
      error: `[FATAL] Malformed project reference '${ref}'. A valid Supabase project reference must consist of exactly 20 lowercase alphanumeric characters (received: ${cleanRef.length} chars).`,
    };
  }
  return { isValid: true };
}

/**
 * Checks whether an inspected target reference matches the forbidden production denylist.
 * Default behavior: Strictly blocks production reference 'doqzleqcyuymqyfjemcr'.
 * Explicit operator approval: If environment variable HARITJAL_CONFIRM_PRODUCTION_DEPLOYMENT === 'APPROVED_BY_OPERATOR',
 * access is permitted with an auditable confirmation notice.
 * @param {string} ref
 * @param {Record<string, string | undefined>} [envOverrides]
 * @returns {{ isBlocked: boolean, approved?: boolean, error?: string, notice?: string }}
 */
export function checkProjectRefDenylist(ref, envOverrides = process.env) {
  if (!ref || typeof ref !== 'string') {
    return { isBlocked: false };
  }
  const cleanRef = ref.trim().toLowerCase();
  const operatorApproval = envOverrides.HARITJAL_CONFIRM_PRODUCTION_DEPLOYMENT;
  const isExplicitlyApproved = operatorApproval === 'APPROVED_BY_OPERATOR';

  for (const forbidden of FORBIDDEN_PRODUCTION_REFS) {
    if (cleanRef === forbidden.toLowerCase()) {
      if (isExplicitlyApproved) {
        return {
          isBlocked: false,
          approved: true,
          notice: `[OPERATOR APPROVED] Explicit production authorization verified for '${cleanRef}'. Proceeding with guarded command.`,
        };
      }
      return {
        isBlocked: true,
        error: `[FATAL] Blocked target reference '${cleanRef}'. Commands targeting production (${forbidden}) are strictly forbidden by DevSecOps isolation policy. To authorize an intentional production deployment, the operator must set environment variable HARITJAL_CONFIRM_PRODUCTION_DEPLOYMENT=APPROVED_BY_OPERATOR.`,
      };
    }
  }
  return { isBlocked: false };
}

/**
 * Verifies that supabase/config.toml does not retain the default production project_id.
 * @returns {{ safe: boolean, error?: string }}
 */
export function auditSupabaseConfigToml() {
  const configPath = path.join(ROOT_DIR, 'supabase', 'config.toml');
  if (!fs.existsSync(configPath)) {
    return { safe: true };
  }

  const content = fs.readFileSync(configPath, 'utf8');
  for (const forbidden of FORBIDDEN_PRODUCTION_REFS) {
    const activePattern = new RegExp(`^\\s*project_id\\s*=\\s*["']${forbidden}["']`, 'm');
    if (activePattern.test(content)) {
      return {
        safe: false,
        error: `[CRITICAL SAFETY RISK] supabase/config.toml has active default project_id = "${forbidden}". Unqualified CLI commands will silently target production!`,
      };
    }
  }

  return { safe: true };
}

/**
 * Verifies that no untracked local .temp file links to production.
 * Scans all files in supabase/.temp (including project-ref, pooler-url, etc.)
 * @returns {{ safe: boolean, error?: string }}
 */
export function auditSupabaseLocalTemp() {
  const tempDir = path.join(ROOT_DIR, 'supabase', '.temp');
  if (!fs.existsSync(tempDir)) {
    return { safe: true };
  }

  try {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      if (fs.statSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, 'utf8').trim().toLowerCase();
        for (const forbidden of FORBIDDEN_PRODUCTION_REFS) {
          if (content.includes(forbidden.toLowerCase())) {
            return {
              safe: false,
              error: `[CRITICAL SAFETY RISK] supabase/.temp/${file} references forbidden production project (${forbidden})!`,
            };
          }
        }
      }
    }
  } catch {
    // ignore filesystem read issues on transient temp files
  }

  return { safe: true };
}

/**
 * Validates CLI arguments before command execution.
 * @param {string[]} args
 * @param {Record<string, string | undefined>} [envOverrides]
 * @returns {{ allowed: boolean, reason?: string, notice?: string }}
 */
export function validateCliInvocation(args, envOverrides = process.env) {
  // 1. Audit repository configuration files first
  const configAudit = auditSupabaseConfigToml();
  if (!configAudit.safe) {
    return { allowed: false, reason: configAudit.error };
  }

  const tempAudit = auditSupabaseLocalTemp();
  if (!tempAudit.safe) {
    return { allowed: false, reason: tempAudit.error };
  }

  const cmdLine = args.join(' ');

  // Extract --project-ref or -p if provided (in any argument position)
  let specifiedRef = null;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--project-ref' || args[i] === '-p') && args[i + 1]) {
      specifiedRef = args[i + 1];
      break;
    } else if (args[i].startsWith('--project-ref=')) {
      specifiedRef = args[i].split('=')[1];
      break;
    } else if (args[i].startsWith('-p=')) {
      specifiedRef = args[i].split('=')[1];
      break;
    }
  }

  let approvalNotice = null;
  // Check denylist and format on specified ref
  if (specifiedRef) {
    const denylistCheck = checkProjectRefDenylist(specifiedRef, envOverrides);
    if (denylistCheck.isBlocked) {
      return { allowed: false, reason: denylistCheck.error };
    }
    if (denylistCheck.approved) {
      approvalNotice = denylistCheck.notice;
    }
    const formatCheck = validateProjectRefFormat(specifiedRef);
    if (!formatCheck.isValid) {
      return { allowed: false, reason: formatCheck.error };
    }
  }

  // Check if a remote command was invoked without --project-ref
  const isRemoteCommand = REMOTE_COMMANDS_REQUIRING_PROJECT_REF.some(rc => {
    const parts = rc.split(' ');
    return parts.every(part => args.includes(part));
  });

  if (isRemoteCommand && !specifiedRef) {
    return {
      allowed: false,
      reason: `[FATAL] Remote command '${cmdLine}' lacks explicit '--project-ref <STAGING_REF>'. Unqualified remote execution is rejected to prevent silent fallback to production.`,
    };
  }

  return { allowed: true, notice: approvalNotice };
}

// CLI Execution Entry Point
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cliArgs = process.argv.slice(2);

  if (cliArgs.length === 0 || cliArgs[0] === 'check') {
    console.log('[Supabase Guard] Running local configuration safety audit...');
    const configCheck = auditSupabaseConfigToml();
    const tempCheck = auditSupabaseLocalTemp();

    if (!configCheck.safe) {
      console.error(configCheck.error);
      process.exit(1);
    }
    if (!tempCheck.safe) {
      console.error(tempCheck.error);
      process.exit(1);
    }

    console.log('✅ [Supabase Guard] Repository config is safe: default project_id is neutralized.');
    console.log('✅ [Supabase Guard] Production reference denylist active: doqzleqcyuymqyfjemcr');
    process.exit(0);
  }

  if (cliArgs[0] === 'verify-ref') {
    const testRef = cliArgs[1];
    const check = checkProjectRefDenylist(testRef);
    if (check.isBlocked) {
      console.error(check.error);
      process.exit(1);
    }
    if (check.approved) {
      console.log(`⚠️  ${check.notice}`);
      process.exit(0);
    }
    console.log(`✅ [Supabase Guard] Reference '${testRef}' is permitted (not in production denylist).`);
    process.exit(0);
  }

  // Validate generic supabase command
  const validation = validateCliInvocation(cliArgs);
  if (!validation.allowed) {
    console.error(`\n❌ ${validation.reason}\n`);
    process.exit(1);
  }

  if (validation.notice) {
    console.log(`⚠️  ${validation.notice}`);
  }

  console.log(`✅ [Supabase Guard] Command verified safe: ${cliArgs.join(' ')}`);
}
