// ====================================================================
// HARIT JAL™ (हरित जल) — TRANSACTIONAL EMAIL CLIENT GATEWAY
// All Resend API credentials live strictly in Supabase Edge Function secrets.
// Browser code NEVER holds RESEND_API_KEY and NEVER calls api.resend.com.
// ====================================================================

import { isProductionEnvironment, readViteEnv } from './env';
import { StorageService } from './storage';
import { isSupabaseConfigured } from './supabase';

export const isResendConfigured = (): boolean => {
  return isSupabaseConfigured();
};

function getEdgeEmailEndpoint(): { endpoint: string; anonKey: string } | null {
  const supabaseUrl = readViteEnv('VITE_SUPABASE_URL').replace(/\/$/, '');
  const anonKey = readViteEnv('VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey || !isSupabaseConfigured()) {
    return null;
  }
  return {
    endpoint: `${supabaseUrl}/functions/v1/send-email-otp`,
    anonKey,
  };
}

export const ResendService = {
  /**
   * Send Consultation Booking Confirmation Email via server Edge Function
   */
  async sendConsultationConfirmation(booking: {
    restaurantName: string;
    ownerName: string;
    email: string;
    phone: string;
    preferredTime: string;
    city: string;
    bookingId?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const cleanTo = (booking.email || '').trim().toLowerCase();
    const isProd = isProductionEnvironment();
    const edge = getEdgeEmailEndpoint();

    if (!edge) {
      if (isProd) {
        return {
          success: false,
          error: 'Email service requires configured Supabase Edge Functions in production.',
        };
      }
      StorageService.addEmailLog({
        to: cleanTo,
        subject: `[Harit Jal] Consultation Confirmed: ${booking.restaurantName}`,
        body: `Offline dev simulation: Consultation confirmation logged for ${cleanTo}.`,
        status: 'Simulated (Local Dev)',
      });
      return { success: true, messageId: `dev_mock_${Date.now()}` };
    }

    try {
      const response = await fetch(edge.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: edge.anonKey,
          Authorization: `Bearer ${edge.anonKey}`,
        },
        body: JSON.stringify({
          action: 'send_consultation_confirmation',
          booking: {
            ...booking,
            id: booking.bookingId || (booking as { id?: string }).id,
            email: cleanTo,
          },
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        messageId?: string;
        error?: string;
      };

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Failed to dispatch consultation confirmation email.',
        };
      }

      StorageService.addEmailLog({
        to: cleanTo,
        subject: `[Harit Jal] Consultation Confirmed: Bespoke Glass Bottles for ${booking.restaurantName}`,
        body: `Dispatched securely via Supabase Edge Function for ${cleanTo}.`,
        status: 'Dispatched',
      });

      return { success: true, messageId: data.messageId };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unable to reach email service.',
      };
    }
  },

  /**
   * Send Admin Lead Alert Email via server Edge Function
   */
  async sendAdminLeadAlert(lead: {
    id?: string;
    customerName: string;
    email: string;
    phone: string;
    businessName: string;
    businessCategory?: string;
    location?: string;
    bottleSize?: string;
    bottleMaterial?: string;
    estimatedQuantity?: string;
    customerRequirements?: string;
    conversationSummary?: string;
    sourcePage?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const isProd = isProductionEnvironment();
    const edge = getEdgeEmailEndpoint();

    if (!edge) {
      if (isProd) {
        return {
          success: false,
          error: 'Admin lead notification service requires configured Supabase Edge Functions in production.',
        };
      }
      return { success: true, messageId: `dev_admin_mock_${Date.now()}` };
    }

    try {
      const response = await fetch(edge.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: edge.anonKey,
          Authorization: `Bearer ${edge.anonKey}`,
        },
        body: JSON.stringify({
          action: 'send_admin_lead_alert',
          lead,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        messageId?: string;
        error?: string;
      };

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Failed to dispatch admin lead alert.',
        };
      }

      return { success: true, messageId: data.messageId };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unable to reach admin alert service.',
      };
    }
  },
};
