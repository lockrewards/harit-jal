// ====================================================================
// HARIT JAL™ (हरित जल) — 18-COLUMN MASTER GOOGLE SHEETS SCHEMA TEST SUITE
// Tests google-apps-script.js against all 18 columns, field mappings,
// optional fallbacks, formula injection sanitization, fail-closed auth,
// container-bound sheet behavior, and duplicate email policy.
// ====================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT_DIR = process.cwd();
const gasSrc = fs.readFileSync(path.join(ROOT_DIR, 'google-apps-script.js'), 'utf8');

/**
 * Standard 32-character Base64URL test secret (192-bit cryptographic entropy)
 */
const TEST_BASE64URL_32_SECRET = 'k8F_m9X-p2R_w5T-z7Y_q1N-v4L_j0Sb';

/**
 * Creates an isolated mock execution context for Google Apps Script runtime.
 */
function createMockGasContext(options = {}) {
  const {
    scriptSecret = TEST_BASE64URL_32_SECRET,
    enableMailApp = null, // null means property not set
    existingRows = 0,
    sheetExists = true,
    customProperties = {},
  } = options;

  const appendedRows = [];
  const state = {
    insertedSheetName: null,
  };
  const sentEmails = [];

  const mockSheet = {
    getLastRow() {
      return appendedRows.length + existingRows;
    },
    appendRow(row) {
      appendedRows.push(row);
    },
  };

  const mockSpreadsheet = {
    getSheetByName(_name) {
      return sheetExists ? mockSheet : null;
    },
    insertSheet(name) {
      state.insertedSheetName = name;
      return mockSheet;
    },
  };

  const scriptProperties = new Map();
  if (scriptSecret !== null) {
    scriptProperties.set('HARIT_JAL_WEBHOOK_SECRET', scriptSecret);
  }
  if (enableMailApp !== null) {
    scriptProperties.set('ENABLE_MAILAPP_NOTIFICATION', String(enableMailApp));
  }
  for (const [key, val] of Object.entries(customProperties)) {
    scriptProperties.set(key, String(val));
  }

  const context = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return mockSpreadsheet;
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return scriptProperties.has(key) ? scriptProperties.get(key) : null;
          },
          setProperty(key, val) {
            scriptProperties.set(key, String(val));
          },
        };
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(content) {
        let mime = 'text/plain';
        return {
          setMimeType(m) {
            mime = m;
            return this;
          },
          getContent() {
            return content;
          },
          getMimeType() {
            return mime;
          },
        };
      },
    },
    MailApp: {
      sendEmail(to, subject, body) {
        sentEmails.push({ to, subject, body });
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(gasSrc, context);

  return {
    context,
    appendedRows,
    state,
    sentEmails,
    mockSheet,
  };
}

describe('Harit Jal™ Google Apps Script 18-Column Master Schema Suite', () => {
  const EXPECTED_18_HEADERS = [
    'Timestamp',
    'Inquiry ID',
    'Restaurant Name',
    'Owner Name',
    'Phone',
    'Email',
    'City',
    'Business Category',
    'Bottle Size',
    'Bottle Material',
    'Monthly Volume',
    'Preferred Call Time',
    'Status',
    'Assigned Staff',
    'Source Page',
    'Conversation Summary',
    'Customer Notes',
    'Last Updated',
  ];

  // --------------------------------------------------------------------
  // 1. Static Source Code & Hygiene Verification
  // --------------------------------------------------------------------
  it('GAS-01: Verifies exact 18 headers defined in HEADERS_18 in strict order', () => {
    const { context } = createMockGasContext();
    assert.ok(context.HEADERS_18);
    const headers = Array.from(context.HEADERS_18);
    assert.strictEqual(headers.length, 18, 'Must contain exactly 18 headers');
    assert.deepStrictEqual(headers, EXPECTED_18_HEADERS);
  });

  it('GAS-02: Zero hardcoded secrets, passwords, or fallback secrets in source code', () => {
    assert.strictEqual(gasSrc.includes('HARIT_JAL_SECURE_SYNC_2026'), false);
    assert.strictEqual(gasSrc.includes('AIzaSy'), false);
    assert.strictEqual(gasSrc.includes('re_'), false);
    assert.ok(gasSrc.includes("scriptProps.getProperty('HARIT_JAL_WEBHOOK_SECRET')"));
  });

  it('GAS-03: Formula injection sanitization prepends single quote on dangerous characters', () => {
    const { context } = createMockGasContext();
    const sanitize = context.sanitizeCell;
    assert.strictEqual(typeof sanitize, 'function');

    // Safe inputs
    assert.strictEqual(sanitize('The Royal Dining'), 'The Royal Dining');
    assert.strictEqual(sanitize(null), '');
    assert.strictEqual(sanitize(undefined), '');
    assert.strictEqual(sanitize(1500), '1500');

    // Injection prefixes neutralized with leading '
    assert.strictEqual(sanitize("=cmd|'/C calc'!A0"), "'=cmd|'/C calc'!A0");
    assert.strictEqual(sanitize('+1+1'), "'+1+1");
    assert.strictEqual(sanitize('-5+5'), "'-5+5");
    assert.strictEqual(sanitize('@SUM(A1:A10)'), "'@SUM(A1:A10)");
    assert.strictEqual(sanitize('\tTABBED'), "'\tTABBED");
    assert.strictEqual(sanitize('\rRETURNED'), "'\rRETURNED");

    // Max length truncation (300 chars)
    const longString = 'A'.repeat(500);
    assert.strictEqual(sanitize(longString).length, 300);
  });

  // --------------------------------------------------------------------
  // 2. Webhook Authentication (Fail-Closed)
  // --------------------------------------------------------------------
  it('GAS-04: Fails closed with error if HARIT_JAL_WEBHOOK_SECRET Script Property is missing', () => {
    const { context, appendedRows } = createMockGasContext({ scriptSecret: null });
    const req = {
      postData: {
        contents: JSON.stringify({
          webhookSecret: 'any_secret',
          restaurantName: 'The Taj',
          phone: '+919876543210',
        }),
      },
    };
    const res = context.doPost(req);
    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'error');
    assert.ok(json.message.includes('Server Misconfiguration'));
    assert.strictEqual(appendedRows.length, 0, 'No row must be appended on server misconfiguration');
  });

  it('GAS-05: Rejects unauthorized requests with missing or invalid webhookSecret', () => {
    const { context, appendedRows } = createMockGasContext({ scriptSecret: TEST_BASE64URL_32_SECRET });

    // Missing secret
    const reqMissing = {
      postData: {
        contents: JSON.stringify({
          restaurantName: 'The Taj',
          phone: '+919876543210',
        }),
      },
    };
    const resMissing = context.doPost(reqMissing);
    const jsonMissing = JSON.parse(resMissing.getContent());
    assert.strictEqual(jsonMissing.status, 'unauthorized');
    assert.strictEqual(appendedRows.length, 0);

    // Invalid secret
    const reqInvalid = {
      postData: {
        contents: JSON.stringify({
          webhookSecret: 'wrong_secret',
          restaurantName: 'The Taj',
          phone: '+919876543210',
        }),
      },
    };
    const resInvalid = context.doPost(reqInvalid);
    const jsonInvalid = JSON.parse(resInvalid.getContent());
    assert.strictEqual(jsonInvalid.status, 'unauthorized');
    assert.strictEqual(appendedRows.length, 0);
  });

  // --------------------------------------------------------------------
  // 3. Container-Bound Spreadsheet & Header Initialization
  // --------------------------------------------------------------------
  it('GAS-06: Automatically creates HaritJal_Inquiries_Master tab with 18 headers if absent', () => {
    const { context, appendedRows, state } = createMockGasContext({
      sheetExists: false,
      existingRows: 0,
    });

    const req = {
      postData: {
        contents: JSON.stringify({
          webhookSecret: TEST_BASE64URL_32_SECRET,
          restaurantName: 'Grand Hyatt',
          phone: '+919876543210',
        }),
      },
    };

    const res = context.doPost(req);
    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'success');
    assert.strictEqual(state.insertedSheetName, 'HaritJal_Inquiries_Master');
    // First appended row must be the 18 headers, second row is the data
    assert.strictEqual(appendedRows.length, 2);
    assert.deepStrictEqual(Array.from(appendedRows[0]), EXPECTED_18_HEADERS);
    assert.strictEqual(appendedRows[1].length, 18);
  });

  it('GAS-07: Injects 18 headers if existing HaritJal_Inquiries_Master tab is empty (0 rows)', () => {
    const { context, appendedRows } = createMockGasContext({
      sheetExists: true,
      existingRows: 0,
    });

    const req = {
      postData: {
        contents: JSON.stringify({
          webhookSecret: TEST_BASE64URL_32_SECRET,
          restaurantName: 'Grand Hyatt',
          phone: '+919876543210',
        }),
      },
    };

    const res = context.doPost(req);
    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'success');
    assert.strictEqual(appendedRows.length, 2);
    assert.deepStrictEqual(Array.from(appendedRows[0]), EXPECTED_18_HEADERS);
    assert.strictEqual(appendedRows[1].length, 18);
  });

  it('GAS-08: Preserves existing sheet data and appends new inquiry without re-adding headers', () => {
    const { context, appendedRows } = createMockGasContext({
      sheetExists: true,
      existingRows: 5, // Already has headers + 4 rows
    });

    const req = {
      postData: {
        contents: JSON.stringify({
          webhookSecret: TEST_BASE64URL_32_SECRET,
          restaurantName: 'The Leela',
          phone: '+919876543210',
        }),
      },
    };

    const res = context.doPost(req);
    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'success');
    // Only 1 row appended (the data row, headers not duplicated)
    assert.strictEqual(appendedRows.length, 1);
    assert.strictEqual(appendedRows[0].length, 18);
  });

  // --------------------------------------------------------------------
  // 4. Complete Field Mapping Verification (crm-sync Outbound Payload)
  // --------------------------------------------------------------------
  it('GAS-09: Successfully maps all 18 fields from exact crm-sync outbound payload', () => {
    const { context, appendedRows, sentEmails } = createMockGasContext({ existingRows: 1 });

    const crmSyncPayload = {
      action: 'upsert_lead',
      webhookSecret: TEST_BASE64URL_32_SECRET,
      spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      sheetName: 'HaritJal_Customer_Leads',
      id: 'LEAD-HJ-2026-X88',
      leadId: 'LEAD-HJ-2026-X88',
      createdDate: '2026-11-09T08:00:00.000Z',
      customerName: 'Vikramaditya Singhania',
      ownerName: 'Vikramaditya Singhania',
      email: 'vikram@rajputana-palace.in',
      phone: '+919876543210',
      businessName: 'Rajputana Heritage Haveli',
      restaurantName: 'Rajputana Heritage Haveli',
      businessCategory: 'Heritage Hotel & Fine Dining',
      location: 'Udaipur, Rajasthan',
      city: 'Udaipur, Rajasthan',
      bottleSize: '750ml_glass',
      bottleMaterial: 'Borosilicate Glass',
      estimatedQuantity: '2500',
      monthlyVolume: 2500,
      customerRequirements: 'Custom engraved silver crest on bottle shoulder.',
      notes: 'Custom engraved silver crest on bottle shoulder.',
      conversationSummary: 'Concierge discussed wedding banquet water service.',
      sourcePage: '/collections/heritage',
      leadStatus: 'VIP Call Scheduled',
      status: 'VIP Call Scheduled',
      lastUpdated: '2026-11-09T08:15:00.000Z',
    };

    const res = context.doPost({
      postData: { contents: JSON.stringify(crmSyncPayload) },
    });

    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'success');
    assert.strictEqual(json.columnsAppended, 18);
    assert.strictEqual(json.inquiryId, 'LEAD-HJ-2026-X88');

    assert.strictEqual(appendedRows.length, 1);
    const row = appendedRows[0];
    assert.strictEqual(row.length, 18);

    // Verify each column value
    assert.ok(Object.prototype.toString.call(row[0]) === '[object Date]', 'Col 1 Timestamp must be a Date object');
    assert.strictEqual(row[1], 'LEAD-HJ-2026-X88', 'Col 2 Inquiry ID');
    assert.strictEqual(row[2], 'Rajputana Heritage Haveli', 'Col 3 Restaurant Name');
    assert.strictEqual(row[3], 'Vikramaditya Singhania', 'Col 4 Owner Name');
    assert.strictEqual(row[4], "'+919876543210", 'Col 5 Phone (Prepend quote to neutralize + prefix)');
    assert.strictEqual(row[5], 'vikram@rajputana-palace.in', 'Col 6 Email');
    assert.strictEqual(row[6], 'Udaipur, Rajasthan', 'Col 7 City');
    assert.strictEqual(row[7], 'Heritage Hotel & Fine Dining', 'Col 8 Business Category');
    assert.strictEqual(row[8], '750ml_glass', 'Col 9 Bottle Size');
    assert.strictEqual(row[9], 'Borosilicate Glass', 'Col 10 Bottle Material');
    assert.strictEqual(row[10], 2500, 'Col 11 Monthly Volume (Number)');
    assert.strictEqual(row[11], 'Tomorrow', 'Col 12 Preferred Call Time');
    assert.strictEqual(row[12], 'VIP Call Scheduled', 'Col 13 Status');
    assert.strictEqual(row[13], 'Pooja Verma', 'Col 14 Assigned Staff (Default)');
    assert.strictEqual(row[14], '/collections/heritage', 'Col 15 Source Page');
    assert.strictEqual(row[15], 'Concierge discussed wedding banquet water service.', 'Col 16 Conversation Summary');
    assert.strictEqual(row[16], 'Custom engraved silver crest on bottle shoulder.', 'Col 17 Customer Notes');
    assert.strictEqual(row[17], '2026-11-09T08:15:00.000Z', 'Col 18 Last Updated');

    // MailApp check: Rich notification sent
    assert.strictEqual(sentEmails.length, 1);
    assert.strictEqual(sentEmails[0].to, 'info@haritjal.in');
    assert.ok(sentEmails[0].subject.includes('Rajputana Heritage Haveli'));
    assert.ok(sentEmails[0].body.includes('Heritage Hotel & Fine Dining'));
    assert.ok(sentEmails[0].body.includes('Borosilicate Glass'));
  });

  // --------------------------------------------------------------------
  // 5. Missing Optional Fields & Fallbacks Verification
  // --------------------------------------------------------------------
  it('GAS-10: Applies safe defaults when optional fields are missing', () => {
    const { context, appendedRows } = createMockGasContext({ existingRows: 1 });

    const minimalPayload = {
      webhookSecret: TEST_BASE64URL_32_SECRET,
      restaurantName: 'Minimal Cafe',
      phone: '+919999999999',
    };

    const res = context.doPost({
      postData: { contents: JSON.stringify(minimalPayload) },
    });

    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'success');

    const row = appendedRows[0];
    assert.strictEqual(row.length, 18);
    assert.ok(Object.prototype.toString.call(row[0]) === '[object Date]');
    assert.match(row[1], /^HJ-\d{4}$/, 'Col 2 Generated fallback HJ-XXXX ID');
    assert.strictEqual(row[2], 'Minimal Cafe', 'Col 3 Restaurant Name');
    assert.strictEqual(row[3], 'N/A', 'Col 4 Owner Name default');
    assert.strictEqual(row[4], "'+919999999999", 'Col 5 Phone neutralized');
    assert.strictEqual(row[5], 'N/A', 'Col 6 Email default');
    assert.strictEqual(row[6], 'N/A', 'Col 7 City default');
    assert.strictEqual(row[7], 'Restaurant / Hospitality', 'Col 8 Business Category default');
    assert.strictEqual(row[8], '500ml', 'Col 9 Bottle Size default');
    assert.strictEqual(row[9], 'Glass / Premium', 'Col 10 Bottle Material default');
    assert.strictEqual(row[10], 1500, 'Col 11 Monthly Volume default');
    assert.strictEqual(row[11], 'Tomorrow', 'Col 12 Preferred Call Time default');
    assert.strictEqual(row[12], 'New', 'Col 13 Status default');
    assert.strictEqual(row[13], 'Pooja Verma', 'Col 14 Assigned Staff default');
    assert.strictEqual(row[14], 'Website', 'Col 15 Source Page default');
    assert.strictEqual(row[15], 'Direct Enquiry', 'Col 16 Conversation Summary default');
    assert.strictEqual(row[16], '', 'Col 17 Customer Notes default empty');
    assert.ok(typeof row[17] === 'string' && row[17].length > 0, 'Col 18 Last Updated default ISO string');
  });

  // --------------------------------------------------------------------
  // 6. Validation Error Behavior
  // --------------------------------------------------------------------
  it('GAS-11: Rejects payload with validation error if both restaurant/business name and phone are missing', () => {
    const { context, appendedRows } = createMockGasContext();

    const emptyPayload = {
      webhookSecret: TEST_BASE64URL_32_SECRET,
      email: 'anonymous@hotel.in',
    };

    const res = context.doPost({
      postData: { contents: JSON.stringify(emptyPayload) },
    });

    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'error');
    assert.ok(json.message.includes('Validation Error'));
    assert.strictEqual(appendedRows.length, 0);
  });

  // --------------------------------------------------------------------
  // 7. Duplicate Email Policy & Operator Toggle Verification
  // --------------------------------------------------------------------
  it('GAS-12: Preserves MailApp alert by default, and allows suppression when ENABLE_MAILAPP_NOTIFICATION = false', () => {
    // A: Default behavior (not set) -> MailApp sends email
    const defaultCtx = createMockGasContext({ existingRows: 1 });
    defaultCtx.context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: TEST_BASE64URL_32_SECRET,
          restaurantName: 'Alert Bistro',
          phone: '+919876543210',
        }),
      },
    });
    assert.strictEqual(defaultCtx.sentEmails.length, 1);

    // B: Explicit suppression (ENABLE_MAILAPP_NOTIFICATION = 'false') -> Sheet appends, MailApp skipped
    const suppressedCtx = createMockGasContext({ existingRows: 1, enableMailApp: 'false' });
    const suppressedRes = suppressedCtx.context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: TEST_BASE64URL_32_SECRET,
          restaurantName: 'Alert Bistro',
          phone: '+919876543210',
        }),
      },
    });
    const suppressedJson = JSON.parse(suppressedRes.getContent());
    assert.strictEqual(suppressedJson.status, 'success');
    assert.strictEqual(suppressedCtx.appendedRows.length, 1);
    assert.strictEqual(suppressedCtx.sentEmails.length, 0, 'MailApp must be skipped when ENABLE_MAILAPP_NOTIFICATION is false');
  });

  // --------------------------------------------------------------------
  // 8. doGet Web App Compatibility Verification
  // --------------------------------------------------------------------
  it('GAS-13: doGet returns expected health message for Google Apps Script Web App', () => {
    const { context } = createMockGasContext();
    const res = context.doGet({});
    const content = res.getContent();
    assert.ok(content.includes('Harit Jal Secure Google Sheets Webhook Gateway Active'));
  });

  // --------------------------------------------------------------------
  // 9. Hard Cutover & 32-Character Base64URL Authentication Suite
  // --------------------------------------------------------------------
  it('GAS-14: Valid new secret authentication with 32-character Base64URL format', () => {
    // Standard 32-character Base64URL secret (192-bit entropy)
    const base64UrlSecret = 'k8F_m9X-p2R_w5T-z7Y_q1N-v4L_j0Sb';
    assert.strictEqual(base64UrlSecret.length, 32);
    assert.match(base64UrlSecret, /^[A-Za-z0-9_-]{32}$/);

    const { context, appendedRows } = createMockGasContext({
      scriptSecret: base64UrlSecret,
      existingRows: 1,
    });

    const req = {
      postData: {
        contents: JSON.stringify({
          webhookSecret: base64UrlSecret,
          restaurantName: 'Base64URL Grand Palace',
          phone: '+919876543210',
        }),
      },
    };

    const res = context.doPost(req);
    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'success');
    assert.strictEqual(appendedRows.length, 1);
    assert.strictEqual(appendedRows[0][2], 'Base64URL Grand Palace');
  });

  it('GAS-15: Fails closed when HARIT_JAL_WEBHOOK_SECRET is empty string or whitespace', () => {
    // A: Empty string
    const emptyCtx = createMockGasContext({ scriptSecret: '' });
    const emptyRes = emptyCtx.context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: 'any_secret',
          restaurantName: 'Test Diner',
          phone: '+919876543210',
        }),
      },
    });
    const emptyJson = JSON.parse(emptyRes.getContent());
    assert.strictEqual(emptyJson.status, 'error');
    assert.ok(emptyJson.message.includes('Server Misconfiguration'));
    assert.strictEqual(emptyCtx.appendedRows.length, 0);

    // B: Whitespace-only string
    const spaceCtx = createMockGasContext({ scriptSecret: '     ' });
    const spaceRes = spaceCtx.context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: 'any_secret',
          restaurantName: 'Test Diner',
          phone: '+919876543210',
        }),
      },
    });
    const spaceJson = JSON.parse(spaceRes.getContent());
    assert.strictEqual(spaceJson.status, 'error');
    assert.ok(spaceJson.message.includes('Server Misconfiguration'));
    assert.strictEqual(spaceCtx.appendedRows.length, 0);
  });

  it('GAS-16: Strictly rejects previously exposed secret', () => {
    const freshSecret = TEST_BASE64URL_32_SECRET;
    const exposedLegacySecret = 'HARIT_JAL_COMPROMISED_HEX_SECRET_1234567890abcdef1234567890abcdef';

    const { context, appendedRows } = createMockGasContext({
      scriptSecret: freshSecret,
      existingRows: 1,
    });

    const req = {
      postData: {
        contents: JSON.stringify({
          webhookSecret: exposedLegacySecret,
          restaurantName: 'Intruder Bistro',
          phone: '+919876543210',
        }),
      },
    };

    const res = context.doPost(req);
    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'unauthorized');
    assert.strictEqual(json.message, 'Forbidden: Invalid or missing webhook authentication secret.');
    assert.strictEqual(appendedRows.length, 0, 'No row appended on compromised legacy secret');
  });

  it('GAS-17: Completely ignores HARIT_JAL_WEBHOOK_SECRET_PREVIOUS Script Property if present (Strict Hard Cutover)', () => {
    const primarySecret = TEST_BASE64URL_32_SECRET;
    const legacyPreviousSecret = 'OLD_LEGACY_WEBHOOK_SECRET_FALLBACK_TEST';

    // Even if an operator accidentally configured HARIT_JAL_WEBHOOK_SECRET_PREVIOUS in Script Properties,
    // the code MUST completely ignore it and fail closed on attempts to use it.
    const { context, appendedRows } = createMockGasContext({
      scriptSecret: primarySecret,
      customProperties: {
        HARIT_JAL_WEBHOOK_SECRET_PREVIOUS: legacyPreviousSecret,
      },
      existingRows: 1,
    });

    const req = {
      postData: {
        contents: JSON.stringify({
          webhookSecret: legacyPreviousSecret,
          restaurantName: 'Fallback Tester',
          phone: '+919876543210',
        }),
      },
    };

    const res = context.doPost(req);
    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'unauthorized');
    assert.strictEqual(appendedRows.length, 0, 'Must NOT accept fallback previous secret');
  });

  it('GAS-18: Fails closed on malformed JSON payload without appending rows', () => {
    const { context, appendedRows } = createMockGasContext();

    // Malformed JSON syntax
    const badJsonReq = {
      postData: { contents: '{ "webhookSecret": "unclosed_json...' },
    };
    const resBad = context.doPost(badJsonReq);
    const jsonBad = JSON.parse(resBad.getContent());
    assert.strictEqual(jsonBad.status, 'error');
    assert.ok(jsonBad.message.includes('Invalid JSON formatting'));
    assert.strictEqual(appendedRows.length, 0);

    // Missing postData entirely
    const resEmpty = context.doPost({});
    const jsonEmpty = JSON.parse(resEmpty.getContent());
    assert.strictEqual(jsonEmpty.status, 'error');
    assert.ok(jsonEmpty.message.includes('Missing request payload'));
    assert.strictEqual(appendedRows.length, 0);
  });

  it('GAS-19: Comprehensive unauthorized requests audit: zero rows appended on any auth failure', () => {
    const testSecret = TEST_BASE64URL_32_SECRET;
    const { context, appendedRows } = createMockGasContext({ scriptSecret: testSecret });

    const unauthorizedPayloads = [
      {}, // missing secret
      { webhookSecret: '' }, // empty secret
      { webhookSecret: 'wrong_value' }, // wrong secret
      { webhookSecret: 12345 }, // non-string type
      { webhookSecret: null }, // null
      { webhookSecret: ['secret_array'] }, // array
    ];

    for (const payload of unauthorizedPayloads) {
      const res = context.doPost({
        postData: {
          contents: JSON.stringify({
            ...payload,
            restaurantName: 'Attacker Lounge',
            phone: '+919876543210',
          }),
        },
      });
      const json = JSON.parse(res.getContent());
      assert.strictEqual(json.status, 'unauthorized');
    }

    assert.strictEqual(appendedRows.length, 0, 'Zero rows appended across all 6 unauthorized attempts');
  });

  it('GAS-20: Error response security: zero secret leakage in error messages', () => {
    const secretValue = TEST_BASE64URL_32_SECRET;
    const badSecretAttempt = 'ATTACKER_INCOMING_SECRET_VALUE_TRY';

    const { context } = createMockGasContext({ scriptSecret: secretValue });

    // Unauthorized attempt
    const resAuth = context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: badSecretAttempt,
          restaurantName: 'Audit Cafe',
          phone: '+919876543210',
        }),
      },
    });
    const authContent = resAuth.getContent();
    assert.strictEqual(authContent.includes(secretValue), false, 'Must never reveal expected secret in auth error');
    assert.strictEqual(authContent.includes(badSecretAttempt), false, 'Must never echo incoming secret in auth error');

    // Missing property error
    const noPropCtx = createMockGasContext({ scriptSecret: null });
    const resNoProp = noPropCtx.context.doPost({
      postData: { contents: JSON.stringify({ webhookSecret: badSecretAttempt }) },
    });
    const noPropContent = resNoProp.getContent();
    assert.strictEqual(noPropContent.includes(badSecretAttempt), false);
  });

  // --------------------------------------------------------------------
  // 10. Strict 32-Character Base64URL & Body-Only Authentication Tests
  // --------------------------------------------------------------------
  it('GAS-21: Query parameter authentication (?secret=...) is strictly rejected when body secret is missing', () => {
    const { context, appendedRows } = createMockGasContext({ scriptSecret: TEST_BASE64URL_32_SECRET });

    // Client passes valid secret in query parameter (?secret=...), but NOT in JSON body
    const reqWithQueryOnly = {
      parameter: { secret: TEST_BASE64URL_32_SECRET },
      postData: {
        contents: JSON.stringify({
          restaurantName: 'Query Param Bistro',
          phone: '+919876543210',
        }),
      },
    };

    const res = context.doPost(reqWithQueryOnly);
    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'unauthorized');
    assert.strictEqual(json.message, 'Forbidden: Invalid or missing webhook authentication secret.');
    assert.strictEqual(appendedRows.length, 0, 'Zero rows must be appended when secret is only in query params');
  });

  it('GAS-22: Webhook authentication is strictly accepted via data.webhookSecret in JSON body', () => {
    const { context, appendedRows } = createMockGasContext({
      scriptSecret: TEST_BASE64URL_32_SECRET,
      existingRows: 1,
    });

    const validBodyReq = {
      postData: {
        contents: JSON.stringify({
          webhookSecret: TEST_BASE64URL_32_SECRET,
          restaurantName: 'Body Auth Dining',
          phone: '+919876543210',
        }),
      },
    };

    const res = context.doPost(validBodyReq);
    const json = JSON.parse(res.getContent());
    assert.strictEqual(json.status, 'success');
    assert.strictEqual(appendedRows.length, 1);
    assert.strictEqual(appendedRows[0][2], 'Body Auth Dining');
  });

  it('GAS-23: Rejects both configured and incoming secrets with invalid length (non-32 characters)', () => {
    // A: Configured secret with length 31 (short)
    const shortConfigCtx = createMockGasContext({ scriptSecret: 'short_secret_length_is_31_char' });
    const shortConfigRes = shortConfigCtx.context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: 'short_secret_length_is_31_char',
          restaurantName: 'Length Test',
          phone: '+919876543210',
        }),
      },
    });
    const shortConfigJson = JSON.parse(shortConfigRes.getContent());
    assert.strictEqual(shortConfigJson.status, 'error');
    assert.ok(shortConfigJson.message.includes('must be exactly 32 Base64URL characters'));
    assert.strictEqual(shortConfigCtx.appendedRows.length, 0);

    // B: Configured secret with length 64 (long hex)
    const longConfigCtx = createMockGasContext({ scriptSecret: 'a'.repeat(64) });
    const longConfigRes = longConfigCtx.context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: 'a'.repeat(64),
          restaurantName: 'Length Test',
          phone: '+919876543210',
        }),
      },
    });
    const longConfigJson = JSON.parse(longConfigRes.getContent());
    assert.strictEqual(longConfigJson.status, 'error');
    assert.ok(longConfigJson.message.includes('must be exactly 32 Base64URL characters'));
    assert.strictEqual(longConfigCtx.appendedRows.length, 0);

    // C: Incoming secret with length 31 against valid 32-char configured secret
    const validCtx = createMockGasContext({ scriptSecret: TEST_BASE64URL_32_SECRET });
    const incomingShortRes = validCtx.context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: TEST_BASE64URL_32_SECRET.slice(0, 31),
          restaurantName: 'Length Test',
          phone: '+919876543210',
        }),
      },
    });
    const incomingShortJson = JSON.parse(incomingShortRes.getContent());
    assert.strictEqual(incomingShortJson.status, 'unauthorized');
    assert.strictEqual(validCtx.appendedRows.length, 0);

    // D: Incoming secret with length 64 against valid 32-char configured secret
    const incomingLongRes = validCtx.context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: 'a'.repeat(64),
          restaurantName: 'Length Test',
          phone: '+919876543210',
        }),
      },
    });
    const incomingLongJson = JSON.parse(incomingLongRes.getContent());
    assert.strictEqual(incomingLongJson.status, 'unauthorized');
    assert.strictEqual(validCtx.appendedRows.length, 0);
  });

  it('GAS-24: Rejects both configured and incoming secrets with invalid characters (non-Base64URL)', () => {
    // Non-Base64URL chars: +, /, =, @, $, spaces, etc.
    // A: Configured secret contains '+' (32 chars)
    const plusConfigSecret = 'k8F+m9X-p2R_w5T-z7Y_q1N-v4L_j0Sb';
    assert.strictEqual(plusConfigSecret.length, 32);
    const plusConfigCtx = createMockGasContext({ scriptSecret: plusConfigSecret });
    const plusRes = plusConfigCtx.context.doPost({
      postData: {
        contents: JSON.stringify({
          webhookSecret: plusConfigSecret,
          restaurantName: 'Char Test',
          phone: '+919876543210',
        }),
      },
    });
    const plusJson = JSON.parse(plusRes.getContent());
    assert.strictEqual(plusJson.status, 'error');
    assert.ok(plusJson.message.includes('must be exactly 32 Base64URL characters'));
    assert.strictEqual(plusConfigCtx.appendedRows.length, 0);

    // B: Incoming secret contains spaces or forbidden characters (32 chars)
    const validCtx = createMockGasContext({ scriptSecret: TEST_BASE64URL_32_SECRET });
    const invalidCharSecrets = [
      'k8F m9X-p2R_w5T-z7Y_q1N-v4L_j0Sb', // space
      'k8F/m9X-p2R_w5T-z7Y_q1N-v4L_j0Sb', // slash
      'k8F=m9X-p2R_w5T-z7Y_q1N-v4L_j0Sb', // equal
      'k8F@m9X-p2R_w5T-z7Y_q1N-v4L_j0Sb', // at-sign
      'k8F$m9X-p2R_w5T-z7Y_q1N-v4L_j0Sb', // dollar
    ];

    for (const badSecret of invalidCharSecrets) {
      const badRes = validCtx.context.doPost({
        postData: {
          contents: JSON.stringify({
            webhookSecret: badSecret,
            restaurantName: 'Char Test',
            phone: '+919876543210',
          }),
        },
      });
      const badJson = JSON.parse(badRes.getContent());
      assert.strictEqual(badJson.status, 'unauthorized');
    }
    assert.strictEqual(validCtx.appendedRows.length, 0, 'Zero rows appended on non-Base64URL characters');
  });

  it('GAS-25: Rejects missing, empty, null, and non-string credentials fail-closed', () => {
    const validCtx = createMockGasContext({ scriptSecret: TEST_BASE64URL_32_SECRET });

    const malformedPayloads = [
      {}, // missing webhookSecret
      { webhookSecret: null },
      { webhookSecret: undefined },
      { webhookSecret: '' },
      { webhookSecret: 123456789 }, // number
      { webhookSecret: true }, // boolean
      { webhookSecret: { token: TEST_BASE64URL_32_SECRET } }, // object
      { webhookSecret: [TEST_BASE64URL_32_SECRET] }, // array
    ];

    for (const p of malformedPayloads) {
      const res = validCtx.context.doPost({
        postData: {
          contents: JSON.stringify({
            ...p,
            restaurantName: 'Malformed Test',
            phone: '+919876543210',
          }),
        },
      });
      const json = JSON.parse(res.getContent());
      assert.strictEqual(json.status, 'unauthorized');
    }

    assert.strictEqual(validCtx.appendedRows.length, 0);
  });

  it('GAS-26: Comprehensive defense: zero unauthorized requests can append rows', () => {
    const validCtx = createMockGasContext({ scriptSecret: TEST_BASE64URL_32_SECRET });

    // Mix of query-param-only, invalid length, invalid chars, malformed types
    const attackVectors = [
      { postData: { contents: JSON.stringify({ restaurantName: 'Attacker' }) } },
      { parameter: { secret: TEST_BASE64URL_32_SECRET }, postData: { contents: JSON.stringify({ restaurantName: 'Attacker' }) } },
      { postData: { contents: JSON.stringify({ webhookSecret: 'wrong', restaurantName: 'Attacker' }) } },
      { postData: { contents: JSON.stringify({ webhookSecret: '123456789012345678901234567890123', restaurantName: 'Attacker' }) } },
      { postData: { contents: '{ malformed json ' } },
    ];

    for (const vector of attackVectors) {
      const res = validCtx.context.doPost(vector);
      const json = JSON.parse(res.getContent());
      assert.ok(json.status === 'unauthorized' || json.status === 'error');
    }

    assert.strictEqual(validCtx.appendedRows.length, 0, 'Guaranteed zero rows appended across all attack vectors');
  });
});
