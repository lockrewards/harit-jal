// ====================================================================
// HARIT JAL™ (हरित जल) — SUPABASE CLOUD DATABASE CLIENT
// Provides cloud synchronization for Customers, Consultations, Orders,
// Staff Roster, Audit Logs, Security Blocks, and Email Logs with
// fail-closed production semantics and clean offline dev fallback.
// ====================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AdminUser, CallBooking, CustomerOrder, StaffAuditLog } from '../types';
import { readViteEnv } from './env';
import { normalizeStaffRole } from './roles';

function getSupabaseCredentials(): { url: string; anonKey: string } {
  return {
    url: readViteEnv('VITE_SUPABASE_URL'),
    anonKey: readViteEnv('VITE_SUPABASE_ANON_KEY'),
  };
}

// Check if valid credentials are provided (not empty or template placeholder)
export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getSupabaseCredentials();
  return (
    Boolean(url) &&
    Boolean(anonKey) &&
    !url.includes('your-project-id') &&
    url.startsWith('https://')
  );
};

let clientInstance: SupabaseClient | null = null;
let cachedCredentialsKey = '';

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { url, anonKey } = getSupabaseCredentials();
  const nextKey = `${url}::${anonKey}`;

  if (!clientInstance || cachedCredentialsKey !== nextKey) {
    try {
      clientInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      cachedCredentialsKey = nextKey;
    } catch (err: unknown) {
      console.warn('[Supabase] Failed to initialize client, operating in local offline mode:', err);
      return null;
    }
  }
  return clientInstance;
};

interface OrderEngravingPayload {
  deliveryAddress?: string;
  caseCount?: number;
  ratePerBottle?: number;
  totalAmount?: number;
  customEngraving?: string;
}

function parseOrderMetadata(raw: unknown, quantity: number): {
  deliveryAddress: string;
  caseCount: number;
  ratePerBottle: number;
  totalAmount: number;
} {
  const defaultCaseCount = Math.max(1, Math.round(quantity / 24));
  const defaultRate = 7.5;

  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as OrderEngravingPayload;
      const caseCount = typeof parsed.caseCount === 'number' && parsed.caseCount > 0
        ? parsed.caseCount
        : defaultCaseCount;
      const ratePerBottle = typeof parsed.ratePerBottle === 'number' && parsed.ratePerBottle > 0
        ? parsed.ratePerBottle
        : defaultRate;
      const totalAmount = typeof parsed.totalAmount === 'number' && parsed.totalAmount > 0
        ? parsed.totalAmount
        : Math.round(quantity * ratePerBottle);

      return {
        deliveryAddress: parsed.deliveryAddress || 'Partner Delivery Address on File',
        caseCount,
        ratePerBottle,
        totalAmount,
      };
    } catch {
      // Fall through to plain-text engraving fallback
    }
  }

  return {
    deliveryAddress: typeof raw === 'string' && raw.trim() ? raw.trim() : 'Partner Delivery Address on File',
    caseCount: defaultCaseCount,
    ratePerBottle: defaultRate,
    totalAmount: Math.round(quantity * defaultRate),
  };
}

function normalizeOrderBottleSize(bottleType: unknown): CustomerOrder['bottleSize'] {
  if (bottleType === '250ml' || bottleType === '500ml' || bottleType === '750ml_glass' || bottleType === '1000ml') {
    return bottleType;
  }
  return '500ml';
}

function normalizeBookingBottleSize(bottleTypes: unknown): CallBooking['bottleSize'] {
  const first = Array.isArray(bottleTypes) ? bottleTypes[0] : bottleTypes;
  if (first === '250ml' || first === '500ml' || first === '750ml_glass' || first === '1000ml') {
    return first;
  }
  return '500ml';
}

function normalizeOrderStatus(status: unknown): CustomerOrder['status'] {
  if (
    status === 'Order Confirmed' ||
    status === 'Bottling & BIS Testing' ||
    status === 'Dispatched (Out for Delivery)' ||
    status === 'Delivered to Restaurant'
  ) {
    return status;
  }
  return 'Order Confirmed';
}

function normalizeBookingStatus(status: unknown): CallBooking['status'] {
  if (
    status === 'New' ||
    status === 'Call Scheduled' ||
    status === 'Sample Dispatched' ||
    status === 'Active Client' ||
    status === 'Follow Up'
  ) {
    return status;
  }
  return 'New';
}

export const SupabaseService = {
  /**
   * Check connection status without violating RLS policies on private tables.
   */
  async testConnection(): Promise<{ connected: boolean; message: string }> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        connected: false,
        message: 'Supabase credentials not configured (Operating in local storage mode).',
      };
    }

    try {
      const { error } = await supabase.rpc('db_health_ping');
      if (error) {
        return { connected: false, message: `Database health check failed: ${error.message}` };
      }
      return { connected: true, message: 'Connected to Supabase PostgreSQL cloud database successfully.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: false, message: `Connection error: ${msg}` };
    }
  },

  /**
   * Sync a new consultation / call booking using INSERT-only RLS semantics.
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
    status?: CallBooking['status'];
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      let candidateId = lead.id;
      let { error } = await supabase.from('consultations').insert({
        id: candidateId,
        restaurant_name: lead.restaurantName,
        owner_name: lead.ownerName,
        phone: lead.phone,
        email: lead.email.trim().toLowerCase(),
        city: lead.city,
        preferred_time: lead.preferredTime,
        bottle_types: lead.bottleTypes || [],
        notes: lead.notes || '',
        status: lead.status || 'New',
        created_at: new Date().toISOString(),
      });

      // If duplicate key error, auto-retry once with a fresh timestamp ID
      if (error && (error.code === '23505' || error.message.includes('duplicate key'))) {
        candidateId = `HJ-2026-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 90)}`;
        const retryRes = await supabase.from('consultations').insert({
          id: candidateId,
          restaurant_name: lead.restaurantName,
          owner_name: lead.ownerName,
          phone: lead.phone,
          email: lead.email.trim().toLowerCase(),
          city: lead.city,
          preferred_time: lead.preferredTime,
          bottle_types: lead.bottleTypes || [],
          notes: lead.notes || '',
          status: lead.status || 'New',
          created_at: new Date().toISOString(),
        });
        error = retryRes.error;
      }

      if (error) console.warn('[Supabase] Consultation insert error:', error.message);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Sync registered customer account profile to Supabase public.customers.
   * Requires an active authenticated session (never executes as anon) and avoids
   * PostgREST .upsert() so UPDATE / INSERT RLS policies evaluate cleanly.
   */
  async syncCustomer(customer: {
    id: string;
    restaurantName: string;
    ownerName: string;
    email: string;
    phone: string;
    city: string;
    emailPhoneChangesCount?: number;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user || sessionData.session.user.id !== customer.id) {
        return false;
      }

      const nowIso = new Date().toISOString();
      // HIGH-H5-03: Strip restricted columns (email, dpdp_consent, email_phone_changes_count) from client UPDATE payload.
      const updateFields = {
        restaurant_name: customer.restaurantName,
        owner_name: customer.ownerName,
        phone: customer.phone,
        city: customer.city,
        updated_at: nowIso,
      };

      const { data: updatedRows, error: updateError } = await supabase
        .from('customers')
        .update(updateFields)
        .eq('id', customer.id)
        .select('id');

      if (updateError) {
        console.warn('[Supabase] Customer update error:', updateError.message);
        return false;
      }

      if (Array.isArray(updatedRows) && updatedRows.length > 0) {
        return true;
      }

      const insertFields = {
        id: customer.id,
        ...updateFields,
        email: customer.email.toLowerCase(),
        dpdp_consent: true,
        email_phone_changes_count: customer.emailPhoneChangesCount ?? 0,
        created_at: nowIso,
      };

      const { error: insertError } = await supabase.from('customers').insert(insertFields);
      if (insertError) console.warn('[Supabase] Customer insert error:', insertError.message);
      return !insertError;
    } catch {
      return false;
    }
  },

  /**
   * Sync custom bottle order using INSERT-only RLS semantics (no .upsert()).
   */
  async syncOrder(order: {
    id: string;
    restaurantName: string;
    ownerName?: string;
    ownerEmail: string;
    phone?: string;
    bottleType?: string;
    bottleSize?: CustomerOrder['bottleSize'];
    quantity?: number;
    bottlesTotal?: number;
    caseCount?: number;
    ratePerBottle?: number;
    totalAmount?: number;
    deliveryAddress?: string;
    customEngraving?: string;
    status: string;
    orderedAt: string;
    expectedDelivery?: string;
    driverName?: string;
    driverPhone?: string;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const quantity = typeof order.quantity === 'number' && order.quantity > 0
      ? order.quantity
      : Math.max(1, order.bottlesTotal || 24);
    const bottleType = order.bottleType || order.bottleSize || '500ml';
    const engravingPayload = order.customEngraving
      ? order.customEngraving
      : JSON.stringify({
          deliveryAddress: order.deliveryAddress || '',
          caseCount: order.caseCount || Math.max(1, Math.round(quantity / 24)),
          ratePerBottle: order.ratePerBottle || 7.5,
          totalAmount: order.totalAmount || Math.round(quantity * (order.ratePerBottle || 7.5)),
        });

    const parsedOrderedAt = Date.parse(order.orderedAt);
    const isoOrderedAt = Number.isNaN(parsedOrderedAt)
      ? new Date().toISOString()
      : new Date(parsedOrderedAt).toISOString();

    try {
      const { error } = await supabase.from('orders').insert({
        id: order.id,
        restaurant_name: order.restaurantName,
        owner_name: order.ownerName || order.restaurantName,
        owner_email: order.ownerEmail.trim().toLowerCase(),
        phone: order.phone || 'Not provided',
        bottle_type: bottleType,
        quantity,
        custom_engraving: engravingPayload,
        status: order.status,
        ordered_at: isoOrderedAt,
        expected_delivery: order.expectedDelivery || '',
        driver_name: order.driverName || '',
        driver_phone: order.driverPhone || '',
      });
      if (error) console.warn('[Supabase] Order insert error:', error.message);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Fetch all orders for the currently signed-in customer email (enforced by RLS).
   */
  async fetchOrdersForCustomer(email: string): Promise<CustomerOrder[] | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('owner_email', email.trim().toLowerCase())
        .order('ordered_at', { ascending: false });

      if (error || !Array.isArray(data)) return null;

      return data.map((row) => {
        const qty = Number(row.quantity || 24);
        const meta = parseOrderMetadata(row.custom_engraving, qty);
        return {
          id: String(row.id),
          restaurantName: String(row.restaurant_name || ''),
          ownerEmail: String(row.owner_email || '').toLowerCase(),
          bottleSize: normalizeOrderBottleSize(row.bottle_type),
          caseCount: meta.caseCount,
          bottlesTotal: qty,
          ratePerBottle: meta.ratePerBottle,
          totalAmount: meta.totalAmount,
          status: normalizeOrderStatus(row.status),
          driverName: row.driver_name ? String(row.driver_name) : undefined,
          driverPhone: row.driver_phone ? String(row.driver_phone) : undefined,
          deliveryAddress: meta.deliveryAddress,
          orderedAt: String(row.ordered_at || '').replace('T', ' ').substring(0, 16),
          expectedDelivery: String(row.expected_delivery || 'Within 48 hours'),
        };
      });
    } catch {
      return null;
    }
  },

  /**
   * Fetch all orders visible to authenticated staff at AAL2 (enforced by RLS).
   */
  async fetchOrdersForStaff(): Promise<CustomerOrder[] | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('ordered_at', { ascending: false });

      if (error || !Array.isArray(data)) return null;

      return data.map((row) => {
        const qty = Number(row.quantity || 24);
        const meta = parseOrderMetadata(row.custom_engraving, qty);
        return {
          id: String(row.id),
          restaurantName: String(row.restaurant_name || ''),
          ownerEmail: String(row.owner_email || '').toLowerCase(),
          bottleSize: normalizeOrderBottleSize(row.bottle_type),
          caseCount: meta.caseCount,
          bottlesTotal: qty,
          ratePerBottle: meta.ratePerBottle,
          totalAmount: meta.totalAmount,
          status: normalizeOrderStatus(row.status),
          driverName: row.driver_name ? String(row.driver_name) : undefined,
          driverPhone: row.driver_phone ? String(row.driver_phone) : undefined,
          deliveryAddress: meta.deliveryAddress,
          orderedAt: String(row.ordered_at || '').replace('T', ' ').substring(0, 16),
          expectedDelivery: String(row.expected_delivery || 'Within 48 hours'),
        };
      });
    } catch {
      return null;
    }
  },

  /**
   * Fetch consultations visible to a signed-in customer (enforced by RLS).
   */
  async fetchConsultationsForCustomer(email: string): Promise<CallBooking[] | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .order('created_at', { ascending: false });

      if (error || !Array.isArray(data)) return null;

      return data.map((row) => ({
        id: String(row.id),
        restaurantName: String(row.restaurant_name || ''),
        ownerName: String(row.owner_name || ''),
        phone: String(row.phone || ''),
        email: String(row.email || '').toLowerCase(),
        city: String(row.city || ''),
        bottleSize: normalizeBookingBottleSize(row.bottle_types),
        bottleFormats: Array.isArray(row.bottle_types) ? row.bottle_types.map(String) : undefined,
        monthlyVolume: 3000,
        capColor: 'emerald_green',
        labelStyle: 'classic_luxury',
        preferredDateTime: String(row.preferred_time || ''),
        notes: row.notes ? String(row.notes) : undefined,
        status: normalizeBookingStatus(row.status),
        assignedTo: 'Harit Jal Concierge',
        createdAt: String(row.created_at || '').replace('T', ' ').substring(0, 16),
        syncedToGoogleSheets: true,
      }));
    } catch {
      return null;
    }
  },

  /**
   * Fetch all consultations visible to authenticated staff at AAL2 (enforced by RLS).
   */
  async fetchConsultationsForStaff(): Promise<CallBooking[] | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !Array.isArray(data)) return null;

      return data.map((row) => ({
        id: String(row.id),
        restaurantName: String(row.restaurant_name || ''),
        ownerName: String(row.owner_name || ''),
        phone: String(row.phone || ''),
        email: String(row.email || '').toLowerCase(),
        city: String(row.city || ''),
        bottleSize: normalizeBookingBottleSize(row.bottle_types),
        bottleFormats: Array.isArray(row.bottle_types) ? row.bottle_types.map(String) : undefined,
        monthlyVolume: 3000,
        capColor: 'emerald_green',
        labelStyle: 'classic_luxury',
        preferredDateTime: String(row.preferred_time || ''),
        notes: row.notes ? String(row.notes) : undefined,
        status: normalizeBookingStatus(row.status),
        assignedTo: row.assigned_staff_id ? String(row.assigned_staff_id) : 'Harit Jal Desk',
        createdAt: String(row.created_at || '').replace('T', ' ').substring(0, 16),
        syncedToGoogleSheets: true,
      }));
    } catch {
      return null;
    }
  },

  async updateConsultationStatusInCloud(
    id: string,
    status: CallBooking['status'],
    assignedStaffId?: string
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const updatePayload: Record<string, unknown> = { status };
      if (assignedStaffId) {
        updatePayload.assigned_staff_id = assignedStaffId;
      }
      const { error } = await supabase.from('consultations').update(updatePayload).eq('id', id);
      if (error) console.warn('[Supabase] Consultation update error:', error.message);
      return !error;
    } catch {
      return false;
    }
  },

  async updateOrderStatusInCloud(id: string, status: CustomerOrder['status']): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) console.warn('[Supabase] Order update error:', error.message);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Fetch authoritative staff roster from public.staff_users (AAL2 Super Admin RLS).
   */
  async fetchStaffUsers(): Promise<AdminUser[] | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('staff_users')
        .select('*')
        .order('is_root_super_admin', { ascending: false })
        .order('created_at', { ascending: true });

      if (error || !Array.isArray(data)) return null;

      return data.map((row) => ({
        id: String(row.id),
        name: String(row.name || 'Staff Member'),
        email: String(row.email || '').toLowerCase(),
        phone: String(row.phone || ''),
        designation: String(row.designation || ''),
        role: normalizeStaffRole(typeof row.role === 'string' ? row.role : 'staff') || 'staff',
        permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : ['leads', 'orders'],
        status: row.is_blocked === true ? 'Blocked' : 'Active',
        inquiriesAssigned: 0,
        isRootSuperAdmin: row.is_root_super_admin === true,
        isFirstLogin: row.is_first_login === true,
        totpEnabled: row.totp_enabled === true,
        emailPhoneChangesCount: Number(row.email_phone_changes_count || 0),
        createdAt: row.created_at ? String(row.created_at) : undefined,
      }));
    } catch {
      return null;
    }
  },

  /**
   * Fetch immutable staff audit logs from public.staff_audit_logs (AAL2 Super Admin RLS).
   */
  async fetchStaffAuditLogs(): Promise<StaffAuditLog[] | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('staff_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !Array.isArray(data)) return null;

      return data.map((row) => ({
        id: String(row.id),
        action: String(row.action || 'CREATE_STAFF') as StaffAuditLog['action'],
        targetUserId: String(row.target_user_id || ''),
        targetUserEmail: String(row.target_user_email || ''),
        performedBy: String(row.performed_by || ''),
        details: String(row.details || ''),
        timestamp: String(row.created_at || new Date().toISOString()),
      }));
    } catch {
      return null;
    }
  },

  /**
   * Sync staff / administrative user profile to Supabase public.staff_users.
   * NOTE: Passwords and TOTP secrets are strictly managed server-side and
   * are NEVER sent or stored in public.staff_users.
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
    isFirstLogin?: boolean;
    isRootSuperAdmin?: boolean;
    emailPhoneChangesCount?: number;
  }): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const canonicalRole = normalizeStaffRole(user.role) || 'staff';
    const nowIso = new Date().toISOString();
    const staffFields = {
      name: user.name,
      email: user.email.toLowerCase(),
      phone: user.phone || '',
      designation: user.designation || '',
      role: canonicalRole,
      permissions: user.permissions || [],
      is_blocked: user.isBlocked || false,
      totp_enabled: user.totpEnabled || false,
      is_first_login: user.isFirstLogin || false,
      is_root_super_admin: user.isRootSuperAdmin || false,
      email_phone_changes_count: user.emailPhoneChangesCount || 0,
      updated_at: nowIso,
    };

    try {
      const { data: updated, error: updErr } = await supabase
        .from('staff_users')
        .update(staffFields)
        .eq('id', user.id)
        .select('id');
      if (updErr) {
        console.warn('[Supabase] Staff update error:', updErr.message);
        return false;
      }
      if (Array.isArray(updated) && updated.length > 0) {
        return true;
      }
      const { error: insErr } = await supabase.from('staff_users').insert({
        id: user.id,
        ...staffFields,
        created_at: nowIso,
      });
      if (insErr) console.warn('[Supabase] Staff insert error:', insErr.message);
      return !insErr;
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
   * Fetch email audit logs for authenticated Super Admin / Admin sessions (AAL2 RLS).
   */
  async fetchEmailLogs(): Promise<Array<{
    id: string;
    recipient: string;
    subject: string;
    sentAt: string;
    type: 'admin_lead_alert' | 'client_confirmation' | 'otp_verification';
    content: string;
    status?: string;
  }> | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(100);
      if (error || !Array.isArray(data)) return null;

      return data.map((row) => {
        const tpl = String(row.template_type || 'transactional');
        const mappedType: 'admin_lead_alert' | 'client_confirmation' | 'otp_verification' =
          tpl === 'admin_lead_alert'
            ? 'admin_lead_alert'
            : tpl === 'otp_verification'
              ? 'otp_verification'
              : 'client_confirmation';
        return {
          id: String(row.id),
          recipient: String(row.recipient || ''),
          subject: String(row.subject || ''),
          sentAt: String(row.sent_at || row.created_at || '').replace('T', ' ').substring(0, 16),
          type: mappedType,
          content: String(row.body || ''),
          status: row.status ? String(row.status) : 'Dispatched',
        };
      });
    } catch {
      return null;
    }
  },
};
