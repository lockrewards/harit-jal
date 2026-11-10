// ====================================================================
// HARIT JAL™ (हरित जल) — SUPABASE EDGE FUNCTION
// send-email-otp: Server-Side Resend Transactional Mailer & 6-Digit OTP Authority
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { handleSendEmailOtpRequest, type EmailOtpSupabaseAdminClient } from "./handler.ts";

serve(async (req: Request) => {
  return handleSendEmailOtpRequest(req, {
    createAdminClient: (url: string, serviceRoleKey: string) =>
      createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }) as unknown as EmailOtpSupabaseAdminClient,
    getEnv: (key: string) => Deno.env.get(key),
  });
});

