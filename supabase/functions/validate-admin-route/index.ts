// ====================================================================
// HARIT JAL™ (हरित जल) — SUPABASE EDGE FUNCTION
// validate-admin-route: Authoritative Server-Side Time-Based Route Validator
// Timezone: Asia/Kolkata (IST - UTC+05:30)
// Format: DDMMYYHHMM
// ====================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// In-memory rate limiting map: ip -> { count: number, resetAt: number }
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS_PER_MINUTE = 10;

/**
 * Computes the authoritative IST token (DDMMYYHHMM) for a given Date
 */
function getISTToken(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${partMap.day}${partMap.month}${partMap.year}${partMap.hour}${partMap.minute}`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const nowMs = Date.now();

  // Rate Limiting Check
  const rateRecord = rateLimitStore.get(clientIP) || { count: 0, resetAt: nowMs + 60000 };
  if (nowMs > rateRecord.resetAt) {
    rateRecord.count = 0;
    rateRecord.resetAt = nowMs + 60000;
  }
  rateRecord.count += 1;
  rateLimitStore.set(clientIP, rateRecord);

  if (rateRecord.count > MAX_ATTEMPTS_PER_MINUTE) {
    return new Response(
      JSON.stringify({
        valid: false,
        error: "Too many route validation requests. Rate limit exceeded.",
      }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { routeToken } = body;

    if (!routeToken || typeof routeToken !== "string" || !/^[0-9]{10}$/.test(routeToken)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Invalid route format. Required 10-digit DDMMYYHHMM.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Authoritative Server Time in Asia/Kolkata
    const serverNow = new Date();
    const currentValidToken = getISTToken(serverNow);

    const isValid = routeToken === currentValidToken;

    return new Response(
      JSON.stringify({
        valid: isValid,
        serverTimeIST: serverNow.toISOString(),
        expiresInSeconds: 60 - serverNow.getSeconds(),
      }),
      {
        status: isValid ? 200 : 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return new Response(
      JSON.stringify({ valid: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

