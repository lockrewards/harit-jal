// ====================================================================
// HARIT JAL™ (हरित जल) — RESEND TRANSACTIONAL EMAIL SERVICE
// Dispatches luxury branded emails for OTP verification, password resets,
// and booking confirmations with local audit logging fallback.
// ====================================================================

import { StorageService } from './storage';
import { SupabaseService } from './supabase';

const RESEND_API_KEY = (import.meta.env.VITE_RESEND_API_KEY || '').trim();
const FROM_EMAIL = (import.meta.env.VITE_RESEND_FROM_EMAIL || 'Harit Jal™ <onboarding@resend.dev>').trim();

export const isResendConfigured = (): boolean => {
  return Boolean(RESEND_API_KEY) && RESEND_API_KEY.startsWith('re_');
};

export const ResendService = {
  /**
   * Core Email Sender via Resend REST API
   */
  async sendEmail({
    to,
    subject,
    html,
    text,
  }: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const cleanTo = to.trim().toLowerCase();

    // 1. Record in local & Supabase audit logs
    StorageService.addEmailLog({
      to: cleanTo,
      subject,
      body: text || subject,
      status: isResendConfigured() ? 'Dispatched' : 'Sent (Local Mock)',
    });

    SupabaseService.syncEmailLog({
      recipient: cleanTo,
      subject,
      body: text || subject,
      status: isResendConfigured() ? 'Dispatched' : 'Local Mock',
    });

    // 2. If Resend is not configured, complete gracefully with mock dispatch
    if (!isResendConfigured()) {
      console.log(`[Resend Mock] Email recorded to local log for: ${cleanTo} — Subject: "${subject}"`);
      return {
        success: true,
        messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };
    }

    // 3. Real HTTP dispatch via Resend REST API
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [cleanTo],
          subject,
          html,
          text: text || subject,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.warn('[Resend API Error]:', data);
        return { success: false, error: data.message || 'Failed to dispatch email via Resend' };
      }

      console.log(`[Resend API Success] Email sent to ${cleanTo}, Message ID: ${data.id}`);
      return { success: true, messageId: data.id };
    } catch (e: any) {
      console.warn('[Resend Network Error]:', e);
      return { success: false, error: e?.message || 'Network error calling Resend API' };
    }
  },

  /**
   * Send 6-Digit Verification OTP Email
   */
  async sendOtpEmail(
    email: string, 
    otp: string, 
    purpose: 'signup' | 'forgot_password'
  ): Promise<{ success: boolean; error?: string }> {
    const isSignup = purpose === 'signup';
    const title = isSignup ? 'Verify Your Restaurant Partner Account' : 'Reset Your Partner Password';
    const subject = `[Harit Jal] ${otp} is your 6-Digit Verification Code`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #FAF7EE; margin: 0; padding: 24px; color: #102C47; }
    .container { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; border: 1px solid #C99B42; overflow: hidden; box-shadow: 0 10px 30px rgba(16,44,71,0.08); }
    .header { background: #102C47; padding: 28px 24px; text-align: center; color: #FFFFFF; }
    .header h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0; color: #C99B42; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; }
    .content { padding: 32px 28px; text-align: center; }
    .otp-box { margin: 24px auto; background: #FAF7EE; border: 2px dashed #C99B42; border-radius: 14px; padding: 18px 24px; display: inline-block; }
    .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: bold; letter-spacing: 8px; color: #102C47; margin: 0; }
    .notice { font-size: 13px; color: #77766F; line-height: 1.6; margin: 20px 0; }
    .policy { background: #F8F5EC; border-radius: 10px; padding: 12px 16px; font-size: 11.5px; color: #35432D; text-align: left; margin-top: 24px; }
    .footer { background: #FAF7EE; padding: 18px 24px; text-align: center; font-size: 11px; color: #8A8981; border-top: 1px solid #EBE4D5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Harit Jal™</h1>
      <p>Bespoke Dining Hydration</p>
    </div>
    <div class="content">
      <h2 style="font-size: 20px; margin-top: 0; color: #102C47;">${title}</h2>
      <p class="notice">
        We received a request to verify your restaurant account identity for <strong>${email}</strong>. Use the 6-digit security code below:
      </p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      <div class="policy">
        <strong>Security Policy:</strong>
        <ul style="margin: 6px 0 0; padding-left: 18px;">
          <li>Valid for <strong>5 minutes</strong> from dispatch.</li>
          <li>Maximum <strong>3 attempts</strong> allowed before a 24-hour security lockout.</li>
          <li>Single-use token: Automatically expires once verified.</li>
          <li>Never share this verification code with anyone.</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      Harit Jal Bespoke Dining Hydration · BIS IS:14543 & FSSAI Certified<br>
      © ${new Date().getFullYear()} Harit Jal Inc. All rights reserved.
    </div>
  </div>
</body>
</html>
    `;

    const text = `Harit Jal™ Bespoke Dining Hydration\n\nYour 6-Digit Verification Code is: ${otp}\n\nValid for 5 minutes. Never share this code. Maximum 3 attempts before 24-hour lockout.\n\nHarit Jal Bespoke Dining Hydration`;

    return this.sendEmail({ to: email, subject, html, text });
  },

  /**
   * Send Consultation Booking Confirmation Email
   */
  async sendConsultationConfirmation(booking: {
    restaurantName: string;
    ownerName: string;
    email: string;
    phone: string;
    preferredTime: string;
    city: string;
  }): Promise<{ success: boolean; error?: string }> {
    const subject = `[Harit Jal] Consultation Confirmed: Bespoke Glass Bottles for ${booking.restaurantName}`;

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #FAF7EE; padding: 20px; color: #102C47;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; border: 1px solid #C99B42; border-radius: 16px; padding: 24px;">
    <h2 style="color: #102C47; margin-top: 0;">Consultation Call Confirmed</h2>
    <p>Dear <strong>${booking.ownerName}</strong>,</p>
    <p>Thank you for booking a discovery consultation for <strong>${booking.restaurantName}</strong> (${booking.city}).</p>
    <div style="background: #F8F5EC; border-radius: 10px; padding: 14px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Preferred Call Time:</strong> ${booking.preferredTime}</p>
      <p style="margin: 4px 0;"><strong>Phone:</strong> ${booking.phone}</p>
      <p style="margin: 4px 0;"><strong>Assigned Specialist:</strong> Harit Jal Hospitality Manager</p>
    </div>
    <p style="font-size: 13px; color: #77766F;">Our team will bring physical custom-engraved bottle samples and discuss wholesale pricing for your restaurant.</p>
    <p style="font-size: 12px; color: #C99B42; font-weight: bold;">Harit Jal™ Bespoke Dining Hydration</p>
  </div>
</body>
</html>
    `;

    return this.sendEmail({ to: booking.email, subject, html });
  },
};

