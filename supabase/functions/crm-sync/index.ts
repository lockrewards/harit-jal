// ====================================================================
// HARIT JAL™ (हरित जल) — SUPABASE EDGE FUNCTION
// crm-sync: Authoritative Server-Side Google Sheets Webhook & AI Proxy
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { handleCrmSyncRequest, type CrmSupabaseAdminClient } from "./handler.ts";

serve(async (req: Request) => {
  return handleCrmSyncRequest(req, {
    createAdminClient: (url: string, serviceRoleKey: string) =>
      createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }) as unknown as CrmSupabaseAdminClient,
    getEnv: (key: string) => Deno.env.get(key),
  });
});

