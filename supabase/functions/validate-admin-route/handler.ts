// ====================================================================
// HARIT JAL™ (हरित जल) — VALIDATE-ADMIN-ROUTE PURE REQUEST HANDLER
// Authoritative Timezone: Asia/Kolkata (IST - UTC+05:30)
// Format: DDMMYYHHMM
// Persistent DB Rate Limiting + Trusted Origin + Fail-Closed 503
// ====================================================================

export interface ValidateRouteSupabaseAdminClient {
  rpc(
    fn: string,
    params?: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface ValidateRouteHandlerDeps {
  getEnv: (key: string) => string | undefined;
  createAdminClient?: (url: string, serviceRoleKey: string) => ValidateRouteSupabaseAdminClient;
  now?: () => Date;
  rateLimitStore?: Map<string, { count: number; resetAt: number }>;
}

const DEFAULT_ALLOWED_ORIGINS = [
  "https://haritjal.in",
  "https://www.haritjal.in",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const MAX_ATTEMPTS_PER_MINUTE = 10;

export function normalizeOrigin(raw: string | null | undefined): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
    return parsed.origin.toLowerCase();
  } catch {
    return "";
  }
}

function getAllowedOrigins(getEnv: (key: string) => string | undefined): string[] {
  const configured = (getEnv("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((o) => normalizeOrigin(o))
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS.map((o) => normalizeOrigin(o)), ...configured]));
}

export function buildCorsHeaders(req: Request, getEnv: (key: string) => string | undefined): Record<string, string> {
  const allowed = getAllowedOrigins(getEnv);
  const requestOrigin = normalizeOrigin(req.headers.get("origin"));
  const matchedOrigin = requestOrigin && allowed.includes(requestOrigin)
    ? requestOrigin
    : "https://haritjal.in";

  return {
    "Access-Control-Allow-Origin": matchedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((seg) => {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(seg)) return false;
    const n = Number(seg);
    return n >= 0 && n <= 255;
  });
}

function isValidIpAddress(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.length > 64) return false;
  if (isValidIpv4(trimmed)) return true;
  return /^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(":");
}

export function deriveClientKey(req: Request): string {
  const cfIp = (req.headers.get("cf-connecting-ip") || "").trim();
  if (isValidIpAddress(cfIp)) return `cf:${cfIp}`;

  const realIp = (req.headers.get("x-real-ip") || "").trim();
  if (isValidIpAddress(realIp)) return `real:${realIp}`;

  const xff = (req.headers.get("x-forwarded-for") || "").trim();
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(isValidIpAddress);
    if (hops.length > 0) {
      return `xff:${hops[hops.length - 1]}`;
    }
  }

  const ua = (req.headers.get("user-agent") || "").trim().slice(0, 64);
  const lang = (req.headers.get("accept-language") || "").trim().slice(0, 24);
  const ray = (req.headers.get("cf-ray") || "").trim().slice(0, 24);
  if (ua || lang || ray) {
    return `fp:${ua}|${lang}|${ray}`;
  }

  return "unknown";
}

export function getISTToken(date: Date): string {
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

export async function handleValidateRouteRequest(req: Request, deps: ValidateRouteHandlerDeps): Promise<Response> {
  const corsHeaders = buildCorsHeaders(req, deps.getEnv);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ valid: false, error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = (deps.getEnv("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (deps.getEnv("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceRoleKey || !deps.createAdminClient) {
    return new Response(
      JSON.stringify({ valid: false, error: "Server configuration missing: Persistent Supabase service role client is required." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch ? bearerMatch[1].trim() : "";
  const isServiceCaller = Boolean(bearerToken && bearerToken === serviceRoleKey);

  const allowedOrigins = getAllowedOrigins(deps.getEnv);
  const normalizedOrigin = normalizeOrigin(req.headers.get("origin"));
  if (!isServiceCaller && (!normalizedOrigin || !allowedOrigins.includes(normalizedOrigin))) {
    return new Response(
      JSON.stringify({ valid: false, error: "Forbidden: Untrusted or missing request Origin." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = deps.createAdminClient(supabaseUrl, serviceRoleKey);
  const serverNow = deps.now ? deps.now() : new Date();
  const clientKey = deriveClientKey(req);

  const { data: rateData, error: rateErr } = await supabaseAdmin.rpc("consume_edge_rate_limit", {
    p_bucket_key: `admin_route:${clientKey}`,
    p_max_requests: MAX_ATTEMPTS_PER_MINUTE,
    p_window_seconds: 60,
  });

  if (rateErr) {
    return new Response(
      JSON.stringify({ valid: false, error: `Rate limiter unavailable: ${rateErr.message}` }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const rateRow = (Array.isArray(rateData) ? rateData[0] : rateData) as
    | { allowed?: boolean; retry_after_seconds?: number }
    | undefined;
  if (!rateRow || rateRow.allowed !== true) {
    const retryAfter = Math.max(1, Number(rateRow?.retry_after_seconds || 60));
    return new Response(
      JSON.stringify({
        valid: false,
        error: "Too many route validation requests. Rate limit exceeded.",
      }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfter) },
      }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const routeToken = body.routeToken;

    if (!routeToken || typeof routeToken !== "string" || !/^[0-9]{10}$/.test(routeToken)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Invalid route format. Required 10-digit DDMMYYHHMM.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentValidToken = getISTToken(serverNow);
    const isValid = routeToken === currentValidToken;

    return new Response(
      JSON.stringify({
        valid: isValid,
        serverTimeIST: serverNow.toISOString(),
        expiresInSeconds: 60 - serverNow.getSeconds(),
      }),
      { status: isValid ? 200 : 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return new Response(
      JSON.stringify({ valid: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

