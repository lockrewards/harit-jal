// ====================================================================
// HARIT JAL™ (हरित जल) — SUPABASE CLOUD DATABASE CLIENT
// Provides cloud synchronization for Customers, Consultations, Orders,
// Security Blocks, and Email Logs with graceful offline LocalStorage fallback.
// ====================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Check if valid credentials are provided (not empty or template placeholder)
export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    !SUPABASE_URL.includes('your-project-id') &&
    SUPABASE_URL.startsWith('https://')
  );
};

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance) {
    try {
      clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (e) {
      console.warn('[Supabase] Failed to initialize client, operating in local offline mode:', e);
      return null;
    }
  }
  return clientInstance;
};

export const SupabaseService = {
  /**
   * Check connection status
   */
  async testConnection(): Promise<{ connected: boolean; message: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { 
        connected: false, 
        message: 'Supabase credentials not configured in .env (Operating in local storage mode).' 
      };
    }

    try {
      const { error } = await supabase.from('consultations').select('id').limit(1);
      if (error) {
        return { connected: false, message: `Database query failed: ${error.message}` };
      }
      return { connected: true, message: 'Connected to Supabase PostgreSQL cloud database successfully.' };
    } catch (e: any) {
      return { connected: false, message: `Connection error: ${e?.message || e}` };
    }
  },

  /**
   * Sync a new consultation / call booking
   */
  async syncConsultationLead(lead: {
    id: string;
    restaurantName: string;
    ownerName: string;
    phone: string;
    email: string;
    city: string;
    preferredTime: string;
    bottleTypes?: string[];
    notes?: string;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('consultations').upsert({
        id: lead.id,
        restaurant_name: lead.restaurantName,
        owner_name: lead.ownerName,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        preferred_time: lead.preferredTime,
        bottle_types: lead.bottleTypes || [],
        notes: lead.notes || '',
        status: 'New',
        created_at: new Date().toISOString(),
      });
      if (error) console.warn('[Supabase] Consultation upsert error:', error.message);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Sync registered customer account
   */
  async syncCustomer(customer: {
    id: string;
    restaurantName: string;
    ownerName: string;
    email: string;
    phone: string;
    city: string;
    password?: string;
    emailPhoneChangesCount?: number;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('customers').upsert({
        id: customer.id,
        restaurant_name: customer.restaurantName,
        owner_name: customer.ownerName,
        email: customer.email.toLowerCase(),
        phone: customer.phone,
        city: customer.city,
        password: customer.password || '',
        dpdp_consent: true,
        updated_at: new Date().toISOString(),
      });
      if (error) console.warn('[Supabase] Customer upsert error:', error.message);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Sync custom bottle order
   */
  async syncOrder(order: {
    id: string;
    restaurantName: string;
    ownerName: string;
    ownerEmail: string;
    phone: string;
    bottleType: string;
    quantity: number;
    customEngraving?: string;
    status: string;
    orderedAt: string;
    expectedDelivery?: string;
    driverName?: string;
    driverPhone?: string;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('orders').upsert({
        id: order.id,
        restaurant_name: order.restaurantName,
        owner_name: order.ownerName,
        owner_email: order.ownerEmail.toLowerCase(),
        phone: order.phone,
        bottle_type: order.bottleType,
        quantity: order.quantity,
        custom_engraving: order.customEngraving || '',
        status: order.status,
        ordered_at: order.orderedAt,
        expected_delivery: order.expectedDelivery || '',
        driver_name: order.driverName || '',
        driver_phone: order.driverPhone || '',
      });
      if (error) console.warn('[Supabase] Order upsert error:', error.message);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Sync staff / administrative user
   */
  async syncStaffUser(user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    designation?: string;
    role: string;
    permissions?: string[];
    isBlocked?: boolean;
    totpEnabled?: boolean;
    totpSecret?: string;
    isFirstLogin?: boolean;
    temporaryPassword?: string;
    emailPhoneChangesCount?: number;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('staff_users').upsert({
        id: user.id,
        name: user.name,
        email: user.email.toLowerCase(),
        phone: user.phone || '',
        designation: user.designation || '',
        role: user.role,
        permissions: user.permissions || [],
        is_blocked: user.isBlocked || false,
        totp_enabled: user.totpEnabled || false,
        totp_secret: user.totpSecret || '',
        is_first_login: user.isFirstLogin || false,
        temporary_password: user.temporaryPassword || '',
        email_phone_changes_count: user.emailPhoneChangesCount || 0,
        updated_at: new Date().toISOString(),
      });
      if (error) console.warn('[Supabase] Staff upsert error:', error.message);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Delete staff user from cloud database
   */
  async deleteStaffUser(userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('staff_users').delete().eq('id', userId);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Sync multi-vector security block to cloud
   */
  async syncSecurityBlock(block: {
    targetKey: string;
    targetType: 'id' | 'device' | 'ip';
    identifier: string;
    reason: string;
    sourceVector: 'password' | 'otp';
    blockedUntil: number;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('security_blocks').upsert({
        target_key: block.targetKey,
        target_type: block.targetType,
        identifier: block.identifier,
        reason: block.reason,
        source_vector: block.sourceVector,
        blocked_until: new Date(block.blockedUntil).toISOString(),
      });
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Sync email log
   */
  async syncEmailLog(log: {
    recipient: string;
    subject: string;
    body: string;
    status: string;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('email_logs').insert({
        recipient: log.recipient,
        subject: log.subject,
        body: log.body,
        status: log.status,
        sent_at: new Date().toISOString(),
      });
      return !error;
    } catch {
      return false;
    }
  },
};

