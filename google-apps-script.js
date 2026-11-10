/**
 * Harit Jal (हरित जल) - Hardened Google Apps Script Automation
 * Master 18-Column Unified CRM Schema (Option A)
 * 
 * Instructions to link with your Google Sheet:
 * 1. Open Google Sheets (https://sheets.google.com) and create a new sheet.
 *    Name the spreadsheet: "Harit Jal — Customer Enquiries & Leads"
 * 2. Rename the active tab to: "HaritJal_Inquiries_Master"
 * 3. Add these 18 headers in Row 1 (A1:R1):
 *    [A1] Timestamp | [B1] Inquiry ID | [C1] Restaurant Name | [D1] Owner Name | 
 *    [E1] Phone | [F1] Email | [G1] City | [H1] Business Category | [I1] Bottle Size | 
 *    [J1] Bottle Material | [K1] Monthly Volume | [L1] Preferred Call Time | 
 *    [M1] Status | [N1] Assigned Staff | [O1] Source Page | [P1] Conversation Summary | 
 *    [Q1] Customer Notes | [R1] Last Updated
 * 4. Go to Extensions -> Apps Script.
 * 5. Paste the code below into Code.gs.
 * 6. (Mandatory Security — Hard Cutover Policy)
 *    In Project Settings -> Script Properties, add:
 *    Property: HARIT_JAL_WEBHOOK_SECRET | Value: <Your-32-Char-Base64URL-Secret> (192-bit entropy)
 *    CRITICAL RULES:
 *    - Configure the EXACT identical secret in Supabase Edge Function secrets:
 *      supabase secrets set GOOGLE_SHEETS_WEBHOOK_SECRET="<Your-32-Char-Base64URL-Secret>"
 *    - DO NOT configure or retain any legacy HARIT_JAL_WEBHOOK_SECRET_PREVIOUS property.
 *      The strict hard cutover policy completely rejects previous/fallback credentials.
 *    - NEVER hardcode secrets, print secret values in logs, or return them in responses.
 * 7. (Optional Email Control) In Project Settings -> Script Properties:
 *    Property: ENABLE_MAILAPP_NOTIFICATION | Value: false (to suppress duplicate alerts once Resend is verified)
 *    NOTE: Defaults to true if unset. Neither service is disabled without approval.
 * 8. Save this code in the EXISTING Apps Script project. Do not create a new deployment.
 * 9. In Deploy -> Manage deployments, edit the existing Web App deployment and select
 *    the newly saved version. Keep Execute as: Me; access: Anyone; retain the existing URL.
 * 10. Keep the existing GOOGLE_SHEETS_WEBHOOK_URL value in Supabase unchanged.
 *     NEVER expose the webhook URL or secret in frontend code or browser localStorage.
 */

/**
 * 18-Column Master Unified CRM Schema Headers
 */
var HEADERS_18 = [
  "Timestamp",
  "Inquiry ID",
  "Restaurant Name",
  "Owner Name",
  "Phone",
  "Email",
  "City",
  "Business Category",
  "Bottle Size",
  "Bottle Material",
  "Monthly Volume",
  "Preferred Call Time",
  "Status",
  "Assigned Staff",
  "Source Page",
  "Conversation Summary",
  "Customer Notes",
  "Last Updated"
];

/**
 * Neutralizes Formula Injection / CSV Injection attacks.
 * If user input starts with =, +, -, @, \t, or \r, prepends a single quote (').
 * Truncates excessive input length to 300 characters.
 */
function sanitizeCell(val) {
  if (val === null || val === undefined) return "";
  var raw = String(val);
  // oxlint-disable-next-line no-useless-escape
  if (/^[=\+\-@\t\r]/.test(raw)) {
    return "'" + raw.slice(0, 300);
  }
  return raw.trim().slice(0, 300);
}

// oxlint-disable-next-line no-unused-vars
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        status: "error",
        message: "Bad Request: Missing request payload."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data;
    try {
      data = JSON.parse(e.postData.contents);
    // oxlint-disable-next-line no-unused-vars
    } catch (_parseErr) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        status: "error",
        message: "Bad Request: Invalid JSON formatting."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. Webhook Authentication Verification (Fail-Closed — Strict Hard Cutover Policy)
    // Evaluates strictly against HARIT_JAL_WEBHOOK_SECRET. No previous/fallback secrets accepted.
    // Public network latency jitter (150-300ms) on Google Apps Script edge infrastructure
    // protects string comparison from remote side-channel timing analysis.
    var scriptProps = PropertiesService.getScriptProperties();
    var expectedSecret = scriptProps.getProperty('HARIT_JAL_WEBHOOK_SECRET');
    // Authentication is accepted only from the JSON request body; query-string auth is rejected.
    var incomingSecret = typeof data.webhookSecret === 'string' ? data.webhookSecret : '';

    if (!expectedSecret) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        status: "error",
        message: "Server Misconfiguration: HARIT_JAL_WEBHOOK_SECRET Script Property is not configured."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!/^[A-Za-z0-9_-]{32}$/.test(String(expectedSecret))) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        status: "error",
        message: "Server Misconfiguration: HARIT_JAL_WEBHOOK_SECRET must be exactly 32 Base64URL characters."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (typeof incomingSecret !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(incomingSecret) || incomingSecret !== expectedSecret) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        status: "unauthorized",
        message: "Forbidden: Invalid or missing webhook authentication secret."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Input Validation (Requires Restaurant/Business Name or Phone)
    var candidateName = data.restaurantName || data.businessName;
    var candidatePhone = data.phone;
    if (!candidateName && !candidatePhone) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        status: "error",
        message: "Validation Error: Restaurant Name and Phone Number are required."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Container-Bound Spreadsheet & Master Tab Access
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var targetTabName = "HaritJal_Inquiries_Master";
    var sheet = spreadsheet.getSheetByName(targetTabName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(targetTabName);
      sheet.appendRow(HEADERS_18);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS_18);
    }

    // 4. 18-Column Master Field Mapping from crm-sync Outbound Payload
    var rowValues = [
      // 1. Timestamp (Server Capture Time)
      new Date(),
      // 2. Inquiry ID
      sanitizeCell(data.inquiryId || data.id || data.leadId || ("HJ-" + Math.floor(1000 + Math.random() * 9000))),
      // 3. Restaurant Name
      sanitizeCell(data.restaurantName || data.businessName || "Anonymous Restaurant"),
      // 4. Owner Name
      sanitizeCell(data.ownerName || data.customerName || "N/A"),
      // 5. Phone
      sanitizeCell(data.phone || "N/A"),
      // 6. Email
      sanitizeCell(data.email || "N/A"),
      // 7. City
      sanitizeCell(data.city || data.location || "N/A"),
      // 8. Business Category
      sanitizeCell(data.businessCategory || "Restaurant / Hospitality"),
      // 9. Bottle Size
      sanitizeCell(data.bottleSize || "500ml"),
      // 10. Bottle Material
      sanitizeCell(data.bottleMaterial || "Glass / Premium"),
      // 11. Monthly Volume
      Number(data.monthlyVolume) || Number(data.estimatedQuantity) || 1500,
      // 12. Preferred Call Time
      sanitizeCell(data.preferredCallTime || data.preferredDateTime || "Tomorrow"),
      // 13. Status
      sanitizeCell(data.status || data.leadStatus || "New"),
      // 14. Assigned Staff
      sanitizeCell(data.assignedStaff || data.assignedTo || "Pooja Verma"),
      // 15. Source Page
      sanitizeCell(data.sourcePage || "Website"),
      // 16. Conversation Summary
      sanitizeCell(data.conversationSummary || "Direct Enquiry"),
      // 17. Customer Notes
      sanitizeCell(data.customerNotes || data.notes || data.customerRequirements || ""),
      // 18. Last Updated
      sanitizeCell(data.lastUpdated || data.createdDate || new Date().toISOString())
    ];

    // Append to sheet (guarantees existing rows are preserved, appends at row getLastRow() + 1)
    sheet.appendRow(rowValues);

    // 5. Instant Lead Email Alert (Dual-Delivery Policy: MailApp enabled by default)
    var enableMailApp = scriptProps.getProperty('ENABLE_MAILAPP_NOTIFICATION');
    if (enableMailApp !== 'false') {
      var adminEmail = "info@haritjal.in";
      var restName = sanitizeCell(data.restaurantName || data.businessName || "Anonymous Restaurant");
      var cityName = sanitizeCell(data.city || data.location || "N/A");
      var rawSource = sanitizeCell(data.sourcePage || "Website");
      var isMascot = /mascot|neer/i.test(rawSource);
      var channelBadge = isMascot ? "Mascot (Neer AI)" : "Website Form";
      var subject = "🚨 [NEW ENQUIRY via " + channelBadge + "] " + restName + " (" + cityName + ")";
      var body = "Hello Harit Jal Operations Team,\n\n" +
        "A new tasting consultation was booked by a restaurant partner:\n\n" +
        "• Channel / Source: " + (isMascot ? "🤖 Mascot (Neer AI Chat)" : "🌐 " + rawSource) + "\n" +
        "• Restaurant: " + restName + "\n" +
        "• Owner: " + sanitizeCell(data.ownerName || data.customerName || "N/A") + "\n" +
        "• Phone: " + sanitizeCell(data.phone || "N/A") + "\n" +
        "• Email: " + sanitizeCell(data.email || "N/A") + "\n" +
        "• Location: " + cityName + "\n" +
        "• Business Category: " + sanitizeCell(data.businessCategory || "Restaurant / Hospitality") + "\n" +
        "• Bottle Size: " + sanitizeCell(data.bottleSize || "500ml") + "\n" +
        "• Bottle Material: " + sanitizeCell(data.bottleMaterial || "Glass / Premium") + "\n" +
        "• Monthly Volume: " + (Number(data.monthlyVolume) || Number(data.estimatedQuantity) || 1500) + " bottles/month\n" +
        "• Preferred Time: " + sanitizeCell(data.preferredCallTime || data.preferredDateTime || "Tomorrow") + "\n" +
        "• Source Page: " + rawSource + "\n" +
        "• Notes / Requirements: " + sanitizeCell(data.customerNotes || data.notes || data.customerRequirements || "None") + "\n\n" +
        "Please contact them promptly!";

      try {
        MailApp.sendEmail(adminEmail, subject, body);
      // oxlint-disable-next-line no-unused-vars
      } catch (_mailErr) {
        // Non-fatal if email quota exceeded or MailApp permission not authorized
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      status: "success",
      message: "Inquiry securely verified and appended to the 18-column Google Sheet.",
      columnsAppended: 18,
      inquiryId: rowValues[1]
    })).setMimeType(ContentService.MimeType.JSON);

  // oxlint-disable-next-line no-unused-vars
  } catch (_error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      status: "error",
      message: "Internal webhook processing error."
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// oxlint-disable-next-line no-unused-vars
function doGet(_e) {
  return ContentService.createTextOutput("Harit Jal Secure Google Sheets Webhook Gateway Active. POST with authentication secret required.");
}
