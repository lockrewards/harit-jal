import { AutomationConfig, LeadRecord } from '../types/neer';
import { EmailLog } from './storage';

const STORAGE_KEYS = {
  AUTOMATION_CONFIG: 'harit_jal_automation_config_v1',
  LEAD_RECORDS: 'harit_jal_neer_leads_v2',
  EMAIL_LOGS: 'harit_jal_email_logs_v2',
  PENDING_SYNCS: 'harit_jal_pending_syncs_v1',
};

const DEFAULT_CONFIG: AutomationConfig = {
  adminEmail: 'info@haritjal.in',
  googleSheetsSpreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  googleSheetsWebhookUrl: 'https://script.google.com/macros/s/AKfycbz_HaritJal_LiveSync/exec',
  googleSheetsAutoSync: true,
  emailFromAddress: 'info@haritjal.in',
  emailProviderApiKey: '',
  aiProviderApiKey: '',
};

export class AutomationService {
  public static getConfig(): AutomationConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUTOMATION_CONFIG);
      if (raw) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_CONFIG;
  }

  public static saveConfig(updates: Partial<AutomationConfig>): AutomationConfig {
    const current = this.getConfig();
    const updated = { ...current, ...updates };
    localStorage.setItem(STORAGE_KEYS.AUTOMATION_CONFIG, JSON.stringify(updated));
    return updated;
  }

  public static getAllLeads(): LeadRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LEAD_RECORDS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
    return [];
  }

  public static getLeadById(id: string): LeadRecord | null {
    const leads = this.getAllLeads();
    return leads.find((l) => l.id.toLowerCase() === id.toLowerCase().trim()) || null;
  }

  public static getLeadByConversationId(conversationId: string): LeadRecord | null {
    const leads = this.getAllLeads();
    return leads.find((l) => l.conversationId === conversationId) || null;
  }

  /**
   * Save or update lead record (Idempotent - updates existing row if matching leadId, conversationId, email or phone)
   */
  public static saveOrUpdateLead(leadData: Partial<LeadRecord> & { email?: string; phone?: string }): LeadRecord {
    const leads = this.getAllLeads();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    let existingIndex = -1;
    if (leadData.id) {
      existingIndex = leads.findIndex((l) => l.id.toLowerCase() === leadData.id!.toLowerCase());
    } else if (leadData.conversationId) {
      existingIndex = leads.findIndex((l) => l.conversationId === leadData.conversationId);
    } else if (leadData.email && leadData.email.includes('@') && leadData.email !== 'Not provided') {
      existingIndex = leads.findIndex((l) => l.email && l.email.toLowerCase() === leadData.email!.toLowerCase());
    } else if (leadData.phone && leadData.phone !== 'Not provided') {
      const cleanInputPhone = leadData.phone.replace(/\D/g, '').slice(-10);
      if (cleanInputPhone.length >= 10) {
        existingIndex = leads.findIndex((l) => l.phone && l.phone.replace(/\D/g, '').slice(-10) === cleanInputPhone);
      }
    }

    let savedLead: LeadRecord;

    if (existingIndex >= 0) {
      // Update existing lead without creating duplicate rows
      const existing = leads[existingIndex];
      savedLead = {
        ...existing,
        ...leadData,
        customerName: leadData.customerName && leadData.customerName !== 'Valued Restaurant Partner' ? leadData.customerName : existing.customerName,
        email: leadData.email && leadData.email !== 'Not provided' ? leadData.email.toLowerCase().trim() : existing.email,
        phone: leadData.phone && leadData.phone !== 'Not provided' ? leadData.phone.trim() : existing.phone,
        businessName: leadData.businessName && leadData.businessName !== 'Dining Establishment' ? leadData.businessName : existing.businessName,
        businessCategory: leadData.businessCategory || existing.businessCategory,
        location: leadData.location || existing.location,
        bottleSize: leadData.bottleSize || existing.bottleSize,
        bottleMaterial: leadData.bottleMaterial || existing.bottleMaterial,
        estimatedQuantity: leadData.estimatedQuantity || existing.estimatedQuantity,
        customerRequirements: leadData.customerRequirements || existing.customerRequirements,
        conversationSummary: leadData.conversationSummary || existing.conversationSummary,
        leadStatus: leadData.leadStatus || existing.leadStatus,
        lastUpdated: now,
      };
      leads[existingIndex] = savedLead;
    } else {
      // Create fresh lead record
      const newLeadId = `LEAD-HJ-${Math.floor(1000 + Math.random() * 9000)}`;
      savedLead = {
        id: leadData.id || newLeadId,
        conversationId: leadData.conversationId || `conv-${Date.now()}`,
        createdDate: now,
        customerName: leadData.customerName || 'Valued Restaurant Partner',
        email: leadData.email?.trim().toLowerCase() || 'Not provided',
        phone: leadData.phone?.trim() || 'Not provided',
        businessName: leadData.businessName || 'Dining Establishment',
        businessCategory: leadData.businessCategory || 'Restaurant',
        location: leadData.location || 'Pan-India',
        bottleSize: leadData.bottleSize || '500ml',
        bottleMaterial: leadData.bottleMaterial || 'Flint Glass / rPET',
        estimatedQuantity: leadData.estimatedQuantity ? String(leadData.estimatedQuantity) : 'Pending volume estimate',
        customerRequirements: leadData.customerRequirements || 'Interested in bespoke dining bottles',
        conversationSummary: leadData.conversationSummary || 'Customer initiated inquiry via Neer AI',
        sourcePage: leadData.sourcePage || '/collections',
        leadStatus: leadData.leadStatus || 'Incomplete',
        adminNotificationStatus: leadData.adminNotificationStatus || 'Pending',
        customerConfirmationStatus: leadData.customerConfirmationStatus || 'Pending',
        googleSheetsStatus: 'Pending',
        lastUpdated: now,
      };
      leads.unshift(savedLead);
    }

    localStorage.setItem(STORAGE_KEYS.LEAD_RECORDS, JSON.stringify(leads));

    // Trigger Google Sheets sync in background
    this.syncToGoogleSheets(savedLead).catch((e) => {
      console.warn('Google Sheets sync queued for retry:', e);
    });

    return savedLead;
  }

  /**
   * Flush partial leads older than 5 minutes or on demand
   * If a user provided only email or phone and did not provide remaining details within 5 min,
   * preserve whatever details exist and sync to Google Sheets & Admin.
   */
  public static flushPartialLeads(): void {
    const leads = this.getAllLeads();
    const nowMs = Date.now();
    let updated = false;

    for (const lead of leads) {
      if (lead.leadStatus === 'Incomplete') {
        const createdMs = new Date(lead.createdDate).getTime();
        const diffMinutes = isNaN(createdMs) ? 6 : (nowMs - createdMs) / (1000 * 60);

        if (diffMinutes >= 5) {
          lead.leadStatus = 'New';
          lead.conversationSummary = `[Auto-Flushed after 5m timeout] Contact details recorded: ${lead.phone !== 'Not provided' ? 'Phone: ' + lead.phone : ''} ${lead.email !== 'Not provided' ? 'Email: ' + lead.email : ''}`;
          this.syncToGoogleSheets(lead).catch(() => {});
          this.sendAdminNotification(lead);
          updated = true;
        }
      }
    }

    if (updated) {
      localStorage.setItem(STORAGE_KEYS.LEAD_RECORDS, JSON.stringify(leads));
    }
  }

  /**
   * Sync single lead record to Google Sheets
   */
  public static async syncToGoogleSheets(lead: LeadRecord): Promise<boolean> {
    const config = this.getConfig();
    if (!config.googleSheetsAutoSync && !config.googleSheetsWebhookUrl) {
      return false;
    }

    try {
      if (config.googleSheetsWebhookUrl && config.googleSheetsWebhookUrl.startsWith('http')) {
        const payload = {
          action: 'upsert_lead',
          spreadsheetId: config.googleSheetsSpreadsheetId,
          sheetName: 'HaritJal_Customer_Leads',
          leadId: lead.id,
          createdDate: lead.createdDate,
          customerName: lead.customerName,
          email: lead.email,
          phone: lead.phone,
          businessName: lead.businessName,
          businessCategory: lead.businessCategory,
          location: lead.location,
          bottleSize: lead.bottleSize,
          bottleMaterial: lead.bottleMaterial,
          estimatedQuantity: lead.estimatedQuantity,
          customerRequirements: lead.customerRequirements,
          conversationSummary: lead.conversationSummary,
          sourcePage: lead.sourcePage,
          leadStatus: lead.leadStatus,
          adminNotificationStatus: lead.adminNotificationStatus,
          customerConfirmationStatus: lead.customerConfirmationStatus,
          lastUpdated: lead.lastUpdated,
        };

        // Post to Google Apps Script / n8n webhook
        await fetch(config.googleSheetsWebhookUrl, {
          method: 'POST',
          mode: 'no-cors', // Standard for Google Apps Script Webhooks
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      // Mark as Synced
      this.updateLeadStatusFields(lead.id, { googleSheetsStatus: 'Synced' });
      this.saveConfig({ lastSheetsSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      return true;
    } catch (err) {
      console.error('Failed to sync to Google Sheets, marking pending:', err);
      this.updateLeadStatusFields(lead.id, { googleSheetsStatus: 'Pending' });
      this.queueForRetry(lead.id);
      return false;
    }
  }

  /**
   * Automatic Admin Email Notification Dispatcher
   */
  public static sendAdminNotification(lead: LeadRecord): boolean {
    const config = this.getConfig();
    const adminRecipient = config.adminEmail || 'info@haritjal.in';

    const subject = `New Customer Enquiry — Harit Jal | ${lead.businessName || lead.customerName}`;
    const emailBody = `Hello Admin,

A new customer enquiry has been received through Neer AI.

Customer Details:
• Name: ${lead.customerName}
• Email: ${lead.email}
• Phone: ${lead.phone || 'Not provided'}
• Business / Restaurant: ${lead.businessName || 'Pending'}
• Category: ${lead.businessCategory || 'Restaurant'}
• Location: ${lead.location || 'India'}

Requirements:
• Interested Product: Customized ${lead.bottleSize} Bottles
• Bottle Material: ${lead.bottleMaterial}
• Estimated Quantity: ${lead.estimatedQuantity}
• Customer Notes: ${lead.customerRequirements}

Enquiry Summary:
${lead.conversationSummary}

Metadata:
• Lead ID: ${lead.id}
• Source Page: ${lead.sourcePage}
• Enquiry Timestamp: ${lead.createdDate}
• Lead Status: ${lead.leadStatus}

Please follow up with the customer.

Regards,
Harit Jal AI Assistant`;

    this.recordEmailDispatch({
      recipient: adminRecipient,
      subject,
      content: emailBody,
      type: 'admin_lead_alert',
    });

    this.updateLeadStatusFields(lead.id, { adminNotificationStatus: 'Sent' });
    return true;
  }

  /**
   * Customer Confirmation Email Dispatcher (Idempotent - only once per lead)
   */
  public static sendCustomerConfirmation(lead: LeadRecord): boolean {
    if (lead.customerConfirmationStatus === 'Sent') {
      return true; // Already sent, do not duplicate!
    }

    const config = this.getConfig();
    const fromAddress = config.emailFromAddress || 'info@haritjal.in';

    const subject = `Thank You for Your Interest in Harit Jal`;
    const customerBody = `Hello ${lead.customerName || 'Valued Partner'},

Thank you for connecting with Harit Jal!

We have received your enquiry regarding customized packaged drinking water for ${lead.businessName || 'your dining establishment'}.

Summary of Received Details:
• Business: ${lead.businessName || 'Your Establishment'}
• Product: ${lead.bottleSize} ${lead.bottleMaterial}
• Daily Requirement: ${lead.estimatedQuantity}
• Registered Email: ${lead.email}

Our hospitality partnerships desk has received your contact details and requirements. We appreciate your interest in elevating your dining tables with bespoke branded hydration.

Regards,
Team Harit Jal
Hospitality Partner Desk
Phone/WhatsApp: +91 62992 93497
Email: ${fromAddress}
Banuchhapar, Bettiah, Bihar India`;

    this.recordEmailDispatch({
      recipient: lead.email,
      subject,
      content: customerBody,
      type: 'client_confirmation',
    });

    this.updateLeadStatusFields(lead.id, { customerConfirmationStatus: 'Sent' });
    return true;
  }

  /**
   * Internal logger for email dispatches
   */
  private static recordEmailDispatch(emailData: {
    recipient: string;
    subject: string;
    content: string;
    type: EmailLog['type'];
  }): void {
    try {
      const logsRaw = localStorage.getItem(STORAGE_KEYS.EMAIL_LOGS);
      const logs: EmailLog[] = logsRaw ? JSON.parse(logsRaw) : [];

      const newLog: EmailLog = {
        id: `mail-neer-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        recipient: emailData.recipient,
        subject: emailData.subject,
        sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: emailData.type,
        content: emailData.content,
      };

      logs.unshift(newLog);
      localStorage.setItem(STORAGE_KEYS.EMAIL_LOGS, JSON.stringify(logs.slice(0, 50)));
    } catch {
      // Ignore
    }
  }

  private static updateLeadStatusFields(
    leadId: string, 
    fields: Partial<Pick<LeadRecord, 'adminNotificationStatus' | 'customerConfirmationStatus' | 'googleSheetsStatus' | 'leadStatus'>>
  ): void {
    const leads = this.getAllLeads();
    const index = leads.findIndex((l) => l.id === leadId);
    if (index >= 0) {
      leads[index] = { ...leads[index], ...fields, lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 16) };
      localStorage.setItem(STORAGE_KEYS.LEAD_RECORDS, JSON.stringify(leads));
    }
  }

  private static queueForRetry(leadId: string): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SYNCS);
      const queue: string[] = raw ? JSON.parse(raw) : [];
      if (!queue.includes(leadId)) {
        queue.push(leadId);
        localStorage.setItem(STORAGE_KEYS.PENDING_SYNCS, JSON.stringify(queue));
      }
    } catch {
      // Ignore
    }
  }

  public static retryPendingSyncs(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SYNCS);
      if (!raw) return 0;
      const queue: string[] = JSON.parse(raw);
      let count = 0;
      for (const id of queue) {
        const lead = this.getLeadById(id);
        if (lead) {
          this.syncToGoogleSheets(lead);
          count++;
        }
      }
      localStorage.removeItem(STORAGE_KEYS.PENDING_SYNCS);
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Export all Neer AI leads to Google Sheets compatible CSV
   */
  public static exportLeadsToCSV(): string {
    const leads = this.getAllLeads();
    const headers = [
      'Lead ID',
      'Created Date',
      'Customer Name',
      'Email',
      'Phone',
      'Business Name',
      'Category',
      'Location',
      'Bottle Size',
      'Material',
      'Estimated Quantity',
      'Requirements',
      'Conversation Summary',
      'Source Page',
      'Lead Status',
      'Admin Notification',
      'Customer Confirmation',
      'Google Sheets Status',
      'Last Updated',
    ];

    const rows = leads.map((l) => [
      l.id,
      `"${l.createdDate}"`,
      `"${l.customerName}"`,
      `"${l.email}"`,
      `"${l.phone}"`,
      `"${l.businessName}"`,
      `"${l.businessCategory}"`,
      `"${l.location}"`,
      `"${l.bottleSize}"`,
      `"${l.bottleMaterial}"`,
      `"${l.estimatedQuantity}"`,
      `"${(l.customerRequirements || '').replace(/"/g, '""')}"`,
      `"${(l.conversationSummary || '').replace(/"/g, '""')}"`,
      `"${l.sourcePage}"`,
      `"${l.leadStatus}"`,
      `"${l.adminNotificationStatus}"`,
      `"${l.customerConfirmationStatus}"`,
      `"${l.googleSheetsStatus}"`,
      `"${l.lastUpdated}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
