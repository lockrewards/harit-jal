import { AutomationConfig, LeadRecord } from '../types/neer';
import { readViteEnv } from './env';
import { ResendService } from './resendService';
import { EmailLog } from './storage';
import { getSupabaseClient, isSupabaseConfigured, SupabaseService } from './supabase';

const STORAGE_KEYS = {
  AUTOMATION_CONFIG: 'harit_jal_automation_config_v1',
  LEAD_RECORDS: 'harit_jal_neer_leads_v2',
  EMAIL_LOGS: 'harit_jal_email_logs_v2',
  PENDING_SYNCS: 'harit_jal_pending_syncs_v1',
};

const DEFAULT_CONFIG: AutomationConfig = {
  adminEmail: 'info@haritjal.in',
  googleSheetsSpreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  googleSheetsAutoSync: true,
  emailFromAddress: 'noreply@haritjal.in',
};

export interface ServerIntegrationStatus {
  resendConfigured: boolean;
  sheetsWebhookConfigured: boolean;
  geminiConfigured: boolean;
}

function sanitizeAutomationConfig(rawObj: Record<string, unknown>): {
  clean: AutomationConfig;
  hadLegacySecrets: boolean;
} {
  const hadLegacySecrets =
    'googleSheetsWebhookUrl' in rawObj ||
    'emailProviderApiKey' in rawObj ||
    'aiProviderApiKey' in rawObj ||
    'webhookSecret' in rawObj;

  const clean: AutomationConfig = {
    adminEmail: typeof rawObj.adminEmail === 'string' && rawObj.adminEmail.trim()
      ? rawObj.adminEmail.trim()
      : DEFAULT_CONFIG.adminEmail,
    googleSheetsSpreadsheetId: typeof rawObj.googleSheetsSpreadsheetId === 'string' && rawObj.googleSheetsSpreadsheetId.trim()
      ? rawObj.googleSheetsSpreadsheetId.trim()
      : DEFAULT_CONFIG.googleSheetsSpreadsheetId,
    googleSheetsAutoSync: typeof rawObj.googleSheetsAutoSync === 'boolean'
      ? rawObj.googleSheetsAutoSync
      : DEFAULT_CONFIG.googleSheetsAutoSync,
    emailFromAddress: typeof rawObj.emailFromAddress === 'string' && rawObj.emailFromAddress.trim()
      ? rawObj.emailFromAddress.trim()
      : DEFAULT_CONFIG.emailFromAddress,
    lastSheetsSyncTime: typeof rawObj.lastSheetsSyncTime === 'string'
      ? rawObj.lastSheetsSyncTime
      : undefined,
  };

  return { clean, hadLegacySecrets };
}

export class AutomationService {
  public static getConfig(): AutomationConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUTOMATION_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const { clean, hadLegacySecrets } = sanitizeAutomationConfig(parsed);
        if (hadLegacySecrets) {
          localStorage.setItem(STORAGE_KEYS.AUTOMATION_CONFIG, JSON.stringify(clean));
        }
        return clean;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_CONFIG;
  }

  public static saveConfig(updates: Partial<AutomationConfig>): AutomationConfig {
    const current = this.getConfig();
    const { clean } = sanitizeAutomationConfig({ ...current, ...updates } as Record<string, unknown>);
    localStorage.setItem(STORAGE_KEYS.AUTOMATION_CONFIG, JSON.stringify(clean));
    return clean;
  }

  /**
   * Queries non-secret integration readiness flags (booleans only) from crm-sync Edge Function.
   * Requires an active authenticated AAL2 staff JWT.
   */
  public static async fetchServerIntegrationStatus(): Promise<ServerIntegrationStatus | null> {
    if (!isSupabaseConfigured()) return null;
    const supabase = getSupabaseClient();
    const supabaseUrl = readViteEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
    const anonKey = readViteEnv('VITE_SUPABASE_ANON_KEY');
    if (!supabase || !supabaseUrl || !anonKey) return null;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return null;

      const res = await fetch(`${supabaseUrl}/functions/v1/crm-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'integration_status' }),
      });

      if (!res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        integrations?: ServerIntegrationStatus;
      };
      return data.success && data.integrations ? data.integrations : null;
    } catch {
      return null;
    }
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
        sourcePage: leadData.sourcePage || '/gallery',
        leadStatus: leadData.leadStatus || 'Incomplete',
        adminNotificationStatus: leadData.adminNotificationStatus || 'Pending',
        customerConfirmationStatus: leadData.customerConfirmationStatus || 'Pending',
        googleSheetsStatus: 'Pending',
        lastUpdated: now,
      };
      leads.unshift(savedLead);
    }

    localStorage.setItem(STORAGE_KEYS.LEAD_RECORDS, JSON.stringify(leads));

    // Trigger server-proxied Google Sheets CRM sync in background (only for complete leads)
    if (savedLead.leadStatus !== 'Incomplete') {
      this.syncToGoogleSheets(savedLead).catch(() => {
        // Queued for retry inside syncToGoogleSheets
      });
    }

    return savedLead;
  }

  /**
   * Flush partial leads older than 5 minutes or on demand
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

          if (isSupabaseConfigured()) {
            SupabaseService.syncConsultationLead({
              id: lead.id,
              restaurantName: lead.businessName || 'Valued Restaurant Partner',
              ownerName: lead.customerName || 'Restaurant Owner',
              phone: lead.phone,
              email: lead.email,
              city: lead.location || 'India',
              preferredTime: 'Auto-Flushed Lead',
              bottleTypes: lead.bottleSize ? [lead.bottleSize] : [],
              notes: lead.customerRequirements,
              status: 'New',
            }).then((synced) => {
              if (synced) {
                this.syncToGoogleSheets(lead).catch(() => {});
                this.sendAdminNotification(lead);
              }
            }).catch(() => {});
          } else {
            this.syncToGoogleSheets(lead).catch(() => {});
            this.sendAdminNotification(lead);
          }
          updated = true;
        }
      }
    }

    if (updated) {
      localStorage.setItem(STORAGE_KEYS.LEAD_RECORDS, JSON.stringify(leads));
    }
  }

  /**
   * Sync single lead record to Google Sheets strictly via server-side `crm-sync` Edge Function.
   * Webhook URL and shared secret NEVER touch browser code or storage.
   */
  public static async syncToGoogleSheets(lead: LeadRecord): Promise<boolean> {
    const config = this.getConfig();
    if (!config.googleSheetsAutoSync) {
      return false;
    }

    if (!isSupabaseConfigured()) {
      this.updateLeadStatusFields(lead.id, { googleSheetsStatus: 'Pending' });
      this.queueForRetry(lead.id);
      return false;
    }

    const supabaseUrl = readViteEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
    const anonKey = readViteEnv('VITE_SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) {
      this.updateLeadStatusFields(lead.id, { googleSheetsStatus: 'Pending' });
      this.queueForRetry(lead.id);
      return false;
    }

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/crm-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          action: 'sync_lead',
          spreadsheetId: config.googleSheetsSpreadsheetId,
          lead,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { success?: boolean; synced?: boolean };
      if (!response.ok || !data.synced) {
        this.updateLeadStatusFields(lead.id, { googleSheetsStatus: 'Pending' });
        this.queueForRetry(lead.id);
        return false;
      }

      this.updateLeadStatusFields(lead.id, { googleSheetsStatus: 'Synced' });
      this.saveConfig({ lastSheetsSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
      return true;
    } catch {
      this.updateLeadStatusFields(lead.id, { googleSheetsStatus: 'Pending' });
      this.queueForRetry(lead.id);
      return false;
    }
  }

  /**
   * Automatic Admin Email Notification Dispatcher (proxied to Resend via Edge Function)
   */
  public static sendAdminNotification(lead: LeadRecord): boolean {
    const config = this.getConfig();
    const adminRecipient = config.adminEmail || 'info@haritjal.in';

    const isMascot = !lead.sourcePage || /mascot|neer/i.test(lead.sourcePage) || lead.inquirySource === 'mascot';
    const channelTag = isMascot ? 'Mascot (Neer AI)' : 'Website Form';
    const channelDetail = lead.sourcePage || (isMascot ? 'Mascot (Neer AI Chat)' : 'Website Form');

    const subject = `🚨 [NEW ENQUIRY via ${channelTag}] ${lead.businessName || lead.customerName} (${lead.location || 'India'})`;
    const emailBody = `Hello Admin,

A new customer enquiry has been received via ${channelDetail}.

• Channel / Source: ${channelDetail}

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
• Source Page / Channel: ${channelDetail}
• Enquiry Timestamp: ${lead.createdDate}
• Lead Status: ${lead.leadStatus}

Please follow up with the customer promptly.`;

    this.recordEmailDispatch({
      recipient: adminRecipient,
      subject,
      content: emailBody,
      type: 'admin_lead_alert',
    });

    if (isSupabaseConfigured()) {
      ResendService.sendAdminLeadAlert({
        id: lead.id,
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
        sourcePage: channelDetail,
      }).catch(() => {});
    }

    this.updateLeadStatusFields(lead.id, { adminNotificationStatus: 'Sent' });
    return true;
  }

  /**
   * Customer Confirmation Email Dispatcher (Idempotent - only once per lead)
   */
  public static sendCustomerConfirmation(lead: LeadRecord): boolean {
    if (lead.customerConfirmationStatus === 'Sent') {
      return true;
    }

    const config = this.getConfig();
    const fromAddress = config.emailFromAddress || 'noreply@haritjal.in';

    const subject = `Thank You for Your Interest in Harit Jal`;
    const customerBody = `Hello ${lead.customerName || 'Valued Partner'},

Thank you for connecting with Harit Jal!

We have received your enquiry regarding customized packaged drinking water for ${lead.businessName || 'your dining establishment'}.

Summary of Received Details:
• Business: ${lead.businessName || 'Your Establishment'}
• Product: ${lead.bottleSize} ${lead.bottleMaterial}
• Daily Requirement: ${lead.estimatedQuantity}
• Registered Email: ${lead.email}

Regards,
Team Harit Jal (${fromAddress})`;

    this.recordEmailDispatch({
      recipient: lead.email,
      subject,
      content: customerBody,
      type: 'client_confirmation',
    });

    if (isSupabaseConfigured() && lead.email && lead.email.includes('@')) {
      ResendService.sendConsultationConfirmation({
        restaurantName: lead.businessName || 'Restaurant Partner',
        ownerName: lead.customerName || 'Valued Partner',
        email: lead.email,
        phone: lead.phone || 'On file',
        preferredTime: 'Hospitality Desk Follow-Up',
        city: lead.location || 'Pan-India',
        bookingId: lead.id,
      }).catch(() => {});
    }

    this.updateLeadStatusFields(lead.id, { customerConfirmationStatus: 'Sent' });
    return true;
  }

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
        status: 'Dispatched',
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
          this.syncToGoogleSheets(lead).catch(() => {});
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
