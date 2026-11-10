// ====================================================================
// HARIT JAL™ — CRM-SYNC RESPONSE VALIDATION & UPSTREAM INTEGRITY SUITE
// Tests fail-closed validation of Google Sheets upstream responses,
// exact 32-character Base64URL secret enforcement, and claim rollback.
// ====================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const VALID_32_SECRET = 'k8F_m9X-p2R_w5T-z7Y_q1N-v4L_j0Sb';
const DUMMY_SERVICE_ROLE = 'srv_test_signing_material_at_least_32_bytes_long';

function makeFakeJwt(payload) {
  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const SUPER_STAFF_TOKEN = makeFakeJwt({ sub: 'staff-uuid', aal: 'aal2' });

function makeMockAdmin(claimedConsultationId = 'lead-uuid-1234') {
  const updates = [];
  return {
    updates,
    auth: {
      getUser: async (token) => {
        if (token === SUPER_STAFF_TOKEN) {
          return {
            data: {
              user: {
                id: 'staff-uuid',
                app_metadata: { role: 'super_admin' },
              },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: { message: 'Invalid JWT' } };
      },
    },
    rpc: async () => {
      return { data: { allowed: true, retry_after_seconds: 0, current_count: 1 }, error: null };
    },
    from: (table) => {
      if (table === 'consultations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: claimedConsultationId,
                  name: 'Taj Dining',
                  phone: '+919876543210',
                  city: 'New Delhi',
                  email: 'taj@dining.in',
                  notes: 'Need 5000 bottles/month',
                  created_at: new Date().toISOString(),
                  crm_synced_at: null,
                },
                error: null,
              }),
            }),
          }),
          update: (payload) => {
            updates.push({ table, payload });
            return {
              eq: (col, val) => {
                updates[updates.length - 1].where = { [col]: val };
                return {
                  is: () => ({
                    select: () => ({
                      maybeSingle: async () => ({
                        data: { id: claimedConsultationId, crm_synced_at: new Date().toISOString() },
                        error: null,
                      }),
                    }),
                  }),
                  then: (resolve) => resolve({ error: null }),
                };
              },
            };
          },
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    },
  };
}

describe('CRM-Sync Upstream Response Validation & Webhook Hardening', async () => {
  const handlerPath = pathToFileURL(path.join(ROOT_DIR, 'supabase', 'functions', 'crm-sync', 'handler.ts')).href;
  const crmSyncModule = await import(handlerPath);

  const makeRequest = (leadId = 'lead-uuid-1234', extraBody = {}) =>
    new Request('https://doqzleqcyuymqyfjemcr.supabase.co/functions/v1/crm-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'https://haritjal.in',
        'x-real-ip': '203.0.113.195',
      },
      body: JSON.stringify({
        action: 'sync_lead',
        turnstileToken: 'test-turnstile-token',
        lead: {
          id: leadId,
          restaurantName: 'The Imperial Bistro',
          contactPerson: 'Arun Verma',
          phone: '+919876543210',
          city: 'New Delhi',
          email: 'taj@dining.in',
          monthlyVolume: 2500,
        },
        ...extraBody,
      }),
    });

  // SCENARIO 1: HTTP 200 + success: true -> sync succeeded
  it('Scenario 1: Upstream returns HTTP 200 with success: true -> succeeds with synced: true', async () => {
    const admin = makeMockAdmin('lead-uuid-1234');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('lead-uuid-1234'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response(JSON.stringify({ success: true, status: 'success', columnsAppended: 18 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.synced, true);
    assert.strictEqual(body.configured, true);
  });

  // SCENARIO 2: HTTP 200 + success: false -> failure and rollback
  it('Scenario 2: Upstream returns HTTP 200 with success: false -> fails closed with 502 and rolls back claim', async () => {
    const admin = makeMockAdmin('claim-abc-001');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-abc-001'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response(JSON.stringify({ success: false, status: 'error', message: 'Spreadsheet quota exceeded' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Spreadsheet quota exceeded'));
    const rollback = admin.updates.find((u) => u.payload.crm_synced_at === null);
    assert.ok(rollback, 'Consultation claim was rolled back to null');
    assert.strictEqual(rollback.where.id, 'claim-abc-001');
  });

  // SCENARIO 3: HTTP 200 + missing success field -> failure and rollback
  it('Scenario 3: Upstream returns HTTP 200 with missing success property -> fails closed with 502', async () => {
    const admin = makeMockAdmin('claim-abc-002');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-abc-002'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response(JSON.stringify({ status: 'pending', rows: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    const rollback = admin.updates.find((u) => u.payload.crm_synced_at === null);
    assert.ok(rollback, 'Missing success property triggers claim rollback');
    assert.strictEqual(rollback.where.id, 'claim-abc-002');
  });

  // SCENARIO 4: HTTP 200 + malformed JSON -> failure and rollback
  it('Scenario 4: Upstream returns HTTP 200 with malformed/non-JSON text -> fails closed with 502', async () => {
    const admin = makeMockAdmin('claim-abc-003');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-abc-003'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response('<html><body>Redirecting to login...</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    const rollback = admin.updates.find((u) => u.payload.crm_synced_at === null);
    assert.ok(rollback, 'Malformed JSON triggers claim rollback');
    assert.strictEqual(rollback.where.id, 'claim-abc-003');
  });

  // SCENARIO 5: HTTP 401/403 -> failure and rollback
  it('Scenario 5: Upstream returns HTTP 401/403 unauthorized -> fails closed with 502 and rolls back', async () => {
    const admin = makeMockAdmin('claim-abc-004');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-abc-004'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response(JSON.stringify({
        success: false,
        status: 'unauthorized',
        message: 'Forbidden: Invalid or missing webhook authentication secret.',
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    const rollback = admin.updates.find((u) => u.payload.crm_synced_at === null);
    assert.ok(rollback, '403 Forbidden triggers claim rollback');
    assert.strictEqual(rollback.where.id, 'claim-abc-004');
  });

  // SCENARIO 6: HTTP 500 -> failure and rollback
  it('Scenario 6: Upstream returns HTTP 500 error -> fails closed with 502 and rolls back', async () => {
    const admin = makeMockAdmin('claim-abc-005');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-abc-005'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response(JSON.stringify({
        success: false,
        status: 'error',
        message: 'Internal Google Sheets engine error.',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    const rollback = admin.updates.find((u) => u.payload.crm_synced_at === null);
    assert.ok(rollback, 'HTTP 500 triggers claim rollback');
    assert.strictEqual(rollback.where.id, 'claim-abc-005');
  });

  // SCENARIO 7: Network exception -> failure and rollback
  it('Scenario 7: Upstream network timeout / exception -> fails closed with 502 and rolls back', async () => {
    const admin = makeMockAdmin('claim-abc-006');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-abc-006'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => {
        throw new Error('Connection reset by peer');
      },
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Connection reset by peer'));
    const rollback = admin.updates.find((u) => u.payload.crm_synced_at === null);
    assert.ok(rollback, 'Network exception triggers claim rollback');
    assert.strictEqual(rollback.where.id, 'claim-abc-006');
  });

  // SCENARIO 8: Ambiguous response with success: true but status: "error" -> must fail
  it('Scenario 8: Ambiguous response with success: true but status: "error" -> rejected fail-closed', async () => {
    const admin = makeMockAdmin('claim-abc-007');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-abc-007'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response(JSON.stringify({
        success: true,
        status: 'error',
        message: 'Partial write anomaly',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    const rollback = admin.updates.find((u) => u.payload.crm_synced_at === null);
    assert.ok(rollback, 'Ambiguous status: "error" triggers claim rollback');
    assert.strictEqual(rollback.where.id, 'claim-abc-007');
  });

  // SCENARIO 9: Exact 32-character Base64URL secret format validation
  it('Scenario 9: Exact 32-character Base64URL secret is accepted by BASE64URL_32_REGEX and integration_status', async () => {
    assert.strictEqual(crmSyncModule.BASE64URL_32_REGEX.test(VALID_32_SECRET), true);
    assert.strictEqual(VALID_32_SECRET.length, 32);

    const admin = makeMockAdmin();
    const req = new Request('https://doqzleqcyuymqyfjemcr.supabase.co/functions/v1/crm-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + SUPER_STAFF_TOKEN,
        origin: 'https://haritjal.in',
        'x-real-ip': '203.0.113.195',
      },
      body: JSON.stringify({ action: 'integration_status' }),
    });

    const res = await crmSyncModule.handleCrmSyncRequest(req, {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        RESEND_API_KEY: 're_valid_key_123456789',
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
        GEMINI_API_KEY: 'AIzaValidKey123',
      })[k],
      createAdminClient: () => admin,
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.integrations.sheetsWebhookConfigured, true);
  });

  // SCENARIO 10: Invalid secret formats rejected fail-closed
  it('Scenario 10: Invalid webhook secrets (too short, too long, invalid chars) are rejected with 503', async () => {
    const invalidSecrets = [
      'too_short',                                 // 9 chars
      'k8F_m9X-p2R_w5T-z7Y_q1N-v4L_j0',            // 31 chars
      'k8F_m9X-p2R_w5T-z7Y_q1N-v4L_j0Sbb',         // 33 chars
      'k8F_m9X-p2R_w5T-z7Y_q1N-v4L_j0S$',         // invalid character '$'
      'k8F_m9X+p2R/w5T=z7Y_q1N-v4L_j0Sb',         // '+' and '=' not in Base64URL
      '',                                          // empty
    ];

    for (const badSecret of invalidSecrets) {
      assert.strictEqual(
        crmSyncModule.BASE64URL_32_REGEX.test(badSecret),
        false,
        `Secret ${badSecret} must fail regex validation`
      );

      const admin = makeMockAdmin();
      const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('lead-uuid-1234'), {
        getEnv: (k) => ({
          SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
          GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
          GOOGLE_SHEETS_WEBHOOK_SECRET: badSecret,
        })[k],
        createAdminClient: () => admin,
        fetchImpl: async () => new Response('{}', { status: 200 }),
      });

      assert.strictEqual(
        res.status,
        503,
        `Expected 503 for invalid secret format [${badSecret}], got ${res.status}`
      );
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.configured, false);
    }
  });

  // SCENARIO 11: Upstream failure + rollback error -> fails closed with HTTP 500 and rollbackFailed: true
  it('Scenario 11: Upstream failure + rollback DB error -> returns HTTP 500 with rollbackFailed: true', async () => {
    const admin = makeMockAdmin('claim-rollback-err-01');
    // Force rollback update to return an error
    const originalFrom = admin.from;
    admin.from = (table) => {
      const chain = originalFrom(table);
      if (table === 'consultations') {
        const origUpdate = chain.update;
        chain.update = (payload) => {
          const ret = origUpdate(payload);
          if (payload.crm_synced_at === null) {
            return {
              eq: () => Promise.resolve({ error: { message: 'Database connection dropped during rollback' } }),
            };
          }
          return ret;
        };
      }
      return chain;
    };

    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-rollback-err-01'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response(JSON.stringify({ success: false, status: 'error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.rollbackFailed, true);
    assert.ok(body.error.includes('rollback could not be confirmed'));
  });

  // SCENARIO 12: Network exception + rollback error -> fails closed with HTTP 500 and rollbackFailed: true
  it('Scenario 12: Network exception + rollback DB error -> returns HTTP 500 with rollbackFailed: true', async () => {
    const admin = makeMockAdmin('claim-rollback-err-02');
    const originalFrom = admin.from;
    admin.from = (table) => {
      const chain = originalFrom(table);
      if (table === 'consultations') {
        const origUpdate = chain.update;
        chain.update = (payload) => {
          const ret = origUpdate(payload);
          if (payload.crm_synced_at === null) {
            return {
              eq: () => Promise.resolve({ error: { message: 'Lock acquisition failure during rollback' } }),
            };
          }
          return ret;
        };
      }
      return chain;
    };

    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-rollback-err-02'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => {
        throw new Error('ETIMEDOUT to script.google.com');
      },
    });

    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.rollbackFailed, true);
    assert.ok(body.error.includes('rollback could not be confirmed'));
  });

  // SCENARIO 13: Upstream returns success: true with unexpected status ("pending") -> rejected fail-closed
  it('Scenario 13: Upstream returns success: true with unexpected status ("pending") -> rejected fail-closed with 502', async () => {
    const admin = makeMockAdmin('claim-abc-013');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-abc-013'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response(JSON.stringify({
        success: true,
        status: 'pending',
        message: 'Queued but not yet appended',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    const rollback = admin.updates.find((u) => u.payload.crm_synced_at === null);
    assert.ok(rollback, 'Unexpected status ("pending") triggers claim rollback');
    assert.strictEqual(rollback.where.id, 'claim-abc-013');
  });

  // SCENARIO 14: Upstream returns success: true with missing status property -> rejected fail-closed
  it('Scenario 14: Upstream returns success: true with missing status property -> rejected fail-closed with 502', async () => {
    const admin = makeMockAdmin('claim-abc-014');
    const res = await crmSyncModule.handleCrmSyncRequest(makeRequest('claim-abc-014'), {
      getEnv: (k) => ({
        SUPABASE_URL: 'https://doqzleqcyuymqyfjemcr.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: DUMMY_SERVICE_ROLE,
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://script.google.com/macros/s/exec_script/exec',
        GOOGLE_SHEETS_WEBHOOK_SECRET: VALID_32_SECRET,
      })[k],
      createAdminClient: () => admin,
      fetchImpl: async () => new Response(JSON.stringify({
        success: true,
        columnsAppended: 18,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    assert.strictEqual(res.status, 502);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    const rollback = admin.updates.find((u) => u.payload.crm_synced_at === null);
    assert.ok(rollback, 'Missing status triggers claim rollback');
    assert.strictEqual(rollback.where.id, 'claim-abc-014');
  });
});
