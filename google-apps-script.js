/**
 * Harit Jal (हरित जल) - Google Apps Script Automation
 * 
 * Instructions to link with your Google Sheet:
 * 1. Open Google Sheets (https://sheets.google.com) and create a new sheet.
 * 2. Rename the first tab to: "HaritJal_Inquiries_Master"
 * 3. Add these headers in Row 1:
 *    [A1] Timestamp | [B1] Inquiry ID | [C1] Restaurant Name | [D1] Owner Name | 
 *    [E1] Phone | [F1] Email | [G1] City | [H1] Bottle Size | [I1] Monthly Volume | 
 *    [J1] Preferred Call Time | [K1] Status | [L1] Assigned Staff | [M1] Notes
 * 4. Go to Extensions -> Apps Script.
 * 5. Paste the code below and click "Deploy" -> "New deployment".
 * 6. Select type: "Web app" -> Set "Who has access" to "Anyone".
 * 7. Copy the Web App URL and paste it into Harit Jal Admin Portal -> Google Sheets Webhook!
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("HaritJal_Inquiries_Master");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("HaritJal_Inquiries_Master");
      sheet.appendRow([
        "Timestamp", "Inquiry ID", "Restaurant Name", "Owner Name", 
        "Phone", "Email", "City", "Bottle Size", "Monthly Volume", 
        "Preferred Call Time", "Status", "Assigned Staff", "Notes"
      ]);
    }

    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      new Date(),
      data.id || ("HJ-" + Math.floor(1000 + Math.random() * 9000)),
      data.restaurantName || "Anonymous Restaurant",
      data.ownerName || "N/A",
      data.phone || "N/A",
      data.email || "N/A",
      data.city || "N/A",
      data.bottleSize || "500ml",
      data.monthlyVolume || 1500,
      data.preferredDateTime || "Tomorrow",
      data.status || "New",
      data.assignedTo || "Pooja Verma",
      data.notes || ""
    ]);

    // Send instant Admin Email Notification
    var adminEmail = "info@haritjal.in";
    var subject = "🚨 [URGENT NEW CALL BOOKED] " + data.restaurantName + " (" + data.city + ")";
    var body = "Hello Harit Jal Team,\n\n" +
      "A new call was booked by a restaurant owner:\n\n" +
      "• Restaurant: " + data.restaurantName + "\n" +
      "• Owner: " + data.ownerName + "\n" +
      "• Phone: " + data.phone + "\n" +
      "• Email: " + data.email + "\n" +
      "• City: " + data.city + "\n" +
      "• Volume: " + data.monthlyVolume + " bottles/month\n" +
      "• Size: " + data.bottleSize + "\n" +
      "• Preferred Time: " + data.preferredDateTime + "\n\n" +
      "Please contact them promptly!";

    try {
      MailApp.sendEmail(adminEmail, subject, body);
    } catch(mailErr) {
      // Log or continue
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Recorded to Google Sheet and email dispatched!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Harit Jal Google Sheets Webhook is Active! Use POST to record inquiries.");
}

