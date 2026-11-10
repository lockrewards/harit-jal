// ====================================================================
// HARIT JAL™ (हरित जल) — SUPABASE EDGE FUNCTION
// validate-admin-route: Authoritative Server-Side Time-Based Route Validator
// Timezone: Asia/Kolkata (IST - UTC+05:30)
// Format: DDMMYYHHMM
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { handleValidateRouteRequest, type ValidateRouteSupabaseAdminClient } from "./handler.ts";

serve(async (req: Request) => {
  return handleValidateRouteRequest(req, {
    createAdminClient: (url: string, serviceRoleKey: string) =>
      createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }) as unknown as ValidateRouteSupabaseAdminClient,
    getEnv: (key: string) => Deno.env.get(key),
  });
});
