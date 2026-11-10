// ====================================================================
// HARIT JAL™ (हरित जल) — SUPABASE EDGE FUNCTION
// staff-auth: Authoritative Server-Side Staff Authentication & Identity Management
// Standard: Supabase Auth Admin API (GoTrue), Browser Challenge AAL2 MFA Enforcement
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { handleStaffAuthRequest, type StaffSupabaseAdminClient } from "./handler.ts";

serve(async (req: Request) => {
  return handleStaffAuthRequest(req, {
    createAdminClient: (url: string, serviceRoleKey: string) =>
      createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }) as unknown as StaffSupabaseAdminClient,
    getEnv: (key: string) => Deno.env.get(key),
  });
});
