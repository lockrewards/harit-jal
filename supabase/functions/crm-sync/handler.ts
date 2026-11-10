// ====================================================================
// HARIT JAL™ (हरित जल) — CRM-SYNC & SERVER AI PROXY HANDLER
// Keeps Google Sheets Webhook URL, Webhook Signing Secret, and optional
// Gemini API Key strictly server-side inside Supabase Edge Runtime.
// Enforces fail-closed 503 admin client, normalized Origin, Turnstile,
// persistent DB rate limits/quotas, and single-shot consultation proof.
// ====================================================================

export interface CrmSelectEqChain {
  maybeSingle(): Promise<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>;
}

export interface CrmUpdateAfterEq extends PromiseLike<{ error: { message: string } | null }> {
  is(column: string, value: null): {
    select(columns: string): {
      maybeSingle(): Promise<{
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      }>;
    };
  };
}

export interface CrmSupabaseAdminClient {
  auth: {
    getUser(jwt: string): Promise<{
      data: {
        user: {
          id: string;
          email?: string;
          app_metadata?: Record<string, unknown>;
        } | null;
      };
      error: { message: string } | null;
    }>;
  };
  rpc(
    fn: string,
    params?: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): CrmSelectEqChain;
    };
    update(payload: Record<string, unknown>): {
      eq(column: string, value: unknown): CrmUpdateAfterEq;
    };
  };
}

export interface CrmSyncDeps {
  getEnv: (key: string) => string | undefined;
  createAdminClient?: (url: string, serviceRoleKey: string) => CrmSupabaseAdminClient;
  fetchImpl?: typeof fetch;
  now?: () => number;
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

const CONSULTATION_PROOF_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_NEER_AI_DAILY_LIMIT = 500;

const PRIVILEGED_STAFF_ROLES = new Set([
  "super_admin",
  "admin",
  "sales_manager",
  "operations_lead",
  "label_designer",
  "staff",
]);

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

export const BASE64URL_32_REGEX = /^[A-Za-z0-9_-]{32}$/;

/** Accept only the currently provisioned 32-character Base64URL webhook secret. */
export function isValidWebhookSecret(value: string): boolean {
  return BASE64URL_32_REGEX.test(value);
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

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, "Content-Type": "application/json" },
  });
}

function deriveClientIp(req: Request): string {
  const cfIp = (req.headers.get("cf-connecting-ip") || "").trim();
  if (cfIp) return `cf:${cfIp}`;
  const realIp = (req.headers.get("x-real-ip") || "").trim();
  if (realIp) return `real:${realIp}`;
  const xff = (req.headers.get("x-forwarded-for") || "").trim();
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return `xff:${hops[hops.length - 1]}`;
  }
  return "unknown";
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function sanitizeSheetCell(val: unknown, maxLen: number = 300): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/[\0\r\n]+/g, " ").trim().slice(0, maxLen);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function normalizePhoneDigits(phone: unknown): string {
  if (typeof phone !== "string") return "";
  return phone.replace(/\D/g, "");
}

async function consumeRateLimitBucket(
  supabaseAdmin: CrmSupabaseAdminClient,
  bucketKey: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfterSeconds: number; dbError?: string }> {
  const { data, error } = await supabaseAdmin.rpc("consume_edge_rate_limit", {
    p_bucket_key: bucketKey,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    return { allowed: false, retryAfterSeconds: 60, dbError: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { allowed: false, retryAfterSeconds: 60, dbError: "Invalid rate limiter RPC response." };
  }
  const typed = row as { allowed?: boolean; retry_after_seconds?: number };
  return {
    allowed: typed.allowed === true,
    retryAfterSeconds: Math.max(1, Number(typed.retry_after_seconds || windowSeconds)),
  };
}

export type EdgeEnvironment = "production" | "staging" | "development" | "test";

export function resolveEdgeEnvironment(getEnv: (key: string) => string | undefined): EdgeEnvironment {
  const explicit = (
    getEnv("APP_ENV") ||
    getEnv("ENVIRONMENT") ||
    getEnv("NODE_ENV") ||
    ""
  ).trim().toLowerCase();

  if (explicit === "staging") return "staging";
  if (explicit === "development" || explicit === "dev") return "development";
  if (explicit === "test" || explicit === "testing") return "test";
  if (explicit === "production" || explicit === "prod") return "production";

  // Check Node environment if process is defined (e.g. running in test runner)
  const nodeProc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined>; argv?: string[] } }).process;
  if (nodeProc?.env) {
    const proc = (nodeProc.env.APP_ENV || nodeProc.env.NODE_ENV || "").trim().toLowerCase();
    if (proc === "staging") return "staging";
    if (proc === "development" || proc === "dev") return "development";
    if (proc === "test" || proc === "testing") return "test";
    if (Array.isArray(nodeProc.argv) && nodeProc.argv.some((a: string) => a.includes("test"))) {
      return "test";
    }
  }

  // Fail closed by default to production
  return "production";
}

export async function verifyOptionalTurnstile(
  deps: CrmSyncDeps,
  turnstileToken: unknown,
  rawClientIp: string
): Promise<boolean> {
  const env = resolveEdgeEnvironment(deps.getEnv);
  const secret = (deps.getEnv("TURNSTILE_SECRET_KEY") || "").trim();
  const cleanToken = typeof turnstileToken === "string" ? turnstileToken.trim() : "";
  const cleanIp = rawClientIp.replace(/^(cf|real|xff):/, "");

  // If no TURNSTILE_SECRET_KEY is configured in edge secrets, bypass gracefully under rate limiting protection
  if (!secret) {
    return true;
  }

  // 1. DEVELOPMENT / TEST MODE: explicit bypass allowed with safe token or missing secret
  if (env === "development" || env === "test") {
    if (cleanToken === "dev-turnstile-bypass" || cleanToken === "test-turnstile-token") {
      return true;
    }
  }

  if (!cleanToken) return false;

  const fetchFn = deps.fetchImpl ?? globalThis.fetch;
  try {
    const res = await fetchFn("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: cleanToken,
        ...(cleanIp && cleanIp !== "unknown" ? { remoteip: cleanIp } : {}),
      }),
    });
    if (!res.ok) return false;
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return json.success === true;
  } catch {
    return false;
  }
}

async function isVerifiedStaffOrServiceCaller(
  req: Request,
  supabaseAdmin: CrmSupabaseAdminClient,
  serviceRoleKey: string
): Promise<{ verifiedStaff: boolean; isServiceRole: boolean; aal2Staff: boolean }> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : "";
  if (!token) return { verifiedStaff: false, isServiceRole: false, aal2Staff: false };

  if (serviceRoleKey && token === serviceRoleKey) {
    return { verifiedStaff: true, isServiceRole: true, aal2Staff: true };
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const user = data?.user;
    if (error || !user) return { verifiedStaff: false, isServiceRole: false, aal2Staff: false };
    const role = String(user.app_metadata?.role || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!PRIVILEGED_STAFF_ROLES.has(role) || user.app_metadata?.is_blocked === true) {
      return { verifiedStaff: false, isServiceRole: false, aal2Staff: false };
    }
    const { data: staffRow } = await supabaseAdmin
      .from("staff_users")
      .select("is_blocked")
      .eq("id", user.id)
      .maybeSingle();
    if (staffRow && staffRow.is_blocked === true) {
      return { verifiedStaff: false, isServiceRole: false, aal2Staff: false };
    }
    const jwtPayload = decodeJwtPayload(token);
    const aal = typeof jwtPayload?.aal === "string" ? jwtPayload.aal : "aal1";
    return { verifiedStaff: true, isServiceRole: false, aal2Staff: aal === "aal2" };
  } catch {
    return { verifiedStaff: false, isServiceRole: false, aal2Staff: false };
  }
}

/**
 * Release a consultation's single-shot claim after an upstream failure.
 * Returns false if the database did not confirm the rollback.
 */
async function rollbackConsultationClaim(
  supabaseAdmin: CrmSupabaseAdminClient,
  consultationId: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("consultations")
      .update({ crm_synced_at: null })
      .eq("id", consultationId);
    return !error;
  } catch {
    return false;
  }
}

export async function handleCrmSyncRequest(req: Request, deps: CrmSyncDeps): Promise<Response> {
  const corsHeaders = buildCorsHeaders(req, deps.getEnv);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed. Use POST." }, 405, corsHeaders);
  }

  const supabaseUrl = (deps.getEnv("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (deps.getEnv("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceRoleKey || !deps.createAdminClient) {
    return jsonResponse(
      { success: false, configured: false, error: "Server configuration missing: Persistent Supabase service role client is required." },
      503,
      corsHeaders
    );
  }

  const supabaseAdmin = deps.createAdminClient(supabaseUrl, serviceRoleKey);
  const nowMs = deps.now ? deps.now() : Date.now();
  const clientKey = deriveClientIp(req);

  const callerAuth = await isVerifiedStaffOrServiceCaller(req, supabaseAdmin, serviceRoleKey);
  const allowedOrigins = getAllowedOrigins(deps.getEnv);
  const normalizedOrigin = normalizeOrigin(req.headers.get("origin"));

  if (!callerAuth.verifiedStaff && (!normalizedOrigin || !allowedOrigins.includes(normalizedOrigin))) {
    return jsonResponse(
      { success: false, error: "Forbidden: Untrusted or missing request Origin." },
      403,
      corsHeaders
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action.trim() : "";

  // ---------------------------------------------------------------------------
  // ACTION: INTEGRATION_STATUS (Authenticated AAL2 Staff Only — Booleans Only)
  // ---------------------------------------------------------------------------
  if (action === "integration_status") {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = bearerMatch ? bearerMatch[1].trim() : "";

    if (!token) {
      return jsonResponse({ success: false, error: "Unauthorized: Staff authentication required." }, 401, corsHeaders);
    }

    const { data: callerRes, error: callerErr } = await supabaseAdmin.auth.getUser(token);
    const user = callerRes?.user;
    if (callerErr || !user) {
      return jsonResponse({ success: false, error: "Unauthorized: Invalid staff token." }, 401, corsHeaders);
    }

    const rawRole = String(user.app_metadata?.role || "").trim().toLowerCase().replace(/\s+/g, "_");
    const isBlocked = user.app_metadata?.is_blocked === true;
    const jwtPayload = decodeJwtPayload(token);
    const aal = typeof jwtPayload?.aal === "string" ? jwtPayload.aal : "aal1";

    if (isBlocked || !PRIVILEGED_STAFF_ROLES.has(rawRole) || aal !== "aal2") {
      return jsonResponse(
        { success: false, error: "Forbidden: Active AAL2 staff verification required." },
        403,
        corsHeaders
      );
    }

    const resendKey = (deps.getEnv("RESEND_API_KEY") || "").trim();
    const sheetsUrl = (deps.getEnv("GOOGLE_SHEETS_WEBHOOK_URL") || "").trim();
    const sheetsSecret = (deps.getEnv("GOOGLE_SHEETS_WEBHOOK_SECRET") || "").trim();
    const geminiKey = (deps.getEnv("GEMINI_API_KEY") || "").trim();

    return jsonResponse(
      {
        success: true,
        integrations: {
          resendConfigured: Boolean(resendKey && resendKey.startsWith("re_")),
          sheetsWebhookConfigured: Boolean(sheetsUrl.startsWith("https://") && isValidWebhookSecret(sheetsSecret)),
          geminiConfigured: Boolean(geminiKey),
        },
      },
      200,
      corsHeaders
    );
  }

  // ---------------------------------------------------------------------------
  // ACTION: SYNC_LEAD (Google Sheets Proxy + Single-Shot Consultation Proof)
  // ---------------------------------------------------------------------------
  if (action === "sync_lead") {
    const rate = await consumeRateLimitBucket(supabaseAdmin, `crm_sync:ip:${clientKey}`, 20, 900);
    if (rate.dbError) {
      return jsonResponse({ success: false, error: `Rate limiter unavailable: ${rate.dbError}` }, 503, corsHeaders);
    }
    if (!rate.allowed) {
      return jsonResponse(
        { success: false, error: "Too many CRM sync requests. Please wait and try again." },
        429,
        corsHeaders,
        { "Retry-After": String(rate.retryAfterSeconds) }
      );
    }

    if (!callerAuth.verifiedStaff) {
      const turnstileOk = await verifyOptionalTurnstile(deps, body.turnstileToken, clientKey);
      if (!turnstileOk) {
        return jsonResponse({ success: false, error: "Security check failed: Invalid or missing Turnstile verification." }, 403, corsHeaders);
      }
    }

    const webhookUrl = (deps.getEnv("GOOGLE_SHEETS_WEBHOOK_URL") || "").trim();
    const webhookSecret = (deps.getEnv("GOOGLE_SHEETS_WEBHOOK_SECRET") || "").trim();

    if (!webhookUrl || !webhookUrl.startsWith("https://") || !isValidWebhookSecret(webhookSecret)) {
      return jsonResponse(
        {
          success: false,
          configured: false,
          error: "Server Google Sheets webhook credentials (GOOGLE_SHEETS_WEBHOOK_URL / GOOGLE_SHEETS_WEBHOOK_SECRET) are not configured.",
        },
        503,
        corsHeaders
      );
    }

    const lead = (typeof body.lead === "object" && body.lead !== null ? body.lead : {}) as Record<string, unknown>;
    const leadId = sanitizeSheetCell(lead.id, 60);
    const restaurantName = sanitizeSheetCell(lead.businessName || lead.restaurantName, 140);
    const phone = sanitizeSheetCell(lead.phone, 40);
    const email = sanitizeSheetCell(lead.email, 254).toLowerCase();

    if (!restaurantName && !phone && !email) {
      return jsonResponse(
        { success: false, error: "Lead record must contain at least business name, phone, or email." },
        400,
        corsHeaders
      );
    }

    let claimedConsultationId: string | null = null;
    if (!callerAuth.verifiedStaff && !leadId) {
      return jsonResponse(
        { success: false, error: "Forbidden: Valid persisted consultation ID is required for CRM sync." },
        403,
        corsHeaders
      );
    }

    if (leadId) {
      const { data: consultationRow, error: lookupErr } = await supabaseAdmin
        .from("consultations")
        .select("id, email, phone, created_at, crm_synced_at")
        .eq("id", leadId)
        .maybeSingle();

      if (lookupErr) {
        return jsonResponse({ success: false, error: "Failed to verify consultation proof in database." }, 500, corsHeaders);
      }

      if (!callerAuth.verifiedStaff) {
        if (!consultationRow) {
          return jsonResponse({ success: false, error: "Forbidden: Consultation record not found." }, 403, corsHeaders);
        }
        const rowEmail = String(consultationRow.email || "").trim().toLowerCase();
        const rowPhoneDigits = normalizePhoneDigits(consultationRow.phone);
        const leadPhoneDigits = normalizePhoneDigits(lead.phone);
        const emailMatches = Boolean(email && rowEmail && rowEmail === email);
        const phoneMatches = Boolean(leadPhoneDigits && rowPhoneDigits && rowPhoneDigits === leadPhoneDigits);
        if (!emailMatches && !phoneMatches) {
          return jsonResponse({ success: false, error: "Forbidden: Consultation identity mismatch." }, 403, corsHeaders);
        }
        const createdAtMs = Date.parse(String(consultationRow.created_at || ""));
        if (Number.isNaN(createdAtMs) || nowMs - createdAtMs > CONSULTATION_PROOF_WINDOW_MS) {
          return jsonResponse({ success: false, error: "Forbidden: Consultation proof window expired." }, 403, corsHeaders);
        }
      }

      if (consultationRow) {
        const nowIso = new Date(nowMs).toISOString();
        const { data: claimedRow, error: claimErr } = await supabaseAdmin
          .from("consultations")
          .update({ crm_synced_at: nowIso })
          .eq("id", leadId)
          .is("crm_synced_at", null)
          .select("id")
          .maybeSingle();

        if (claimErr) {
          return jsonResponse({ success: false, error: "Failed to acquire consultation CRM sync claim." }, 500, corsHeaders);
        }
        if (!claimedRow) {
          return jsonResponse(
            { success: false, alreadySynced: true, error: "CRM sync has already been executed for this consultation." },
            409,
            corsHeaders
          );
        }
        claimedConsultationId = leadId;
      }
    }

    const outboundPayload = {
      action: "upsert_lead",
      webhookSecret,
      spreadsheetId: sanitizeSheetCell(body.spreadsheetId, 120),
      sheetName: "HaritJal_Customer_Leads",
      id: leadId,
      leadId,
      createdDate: sanitizeSheetCell(lead.createdDate, 40),
      customerName: sanitizeSheetCell(lead.customerName, 140),
      ownerName: sanitizeSheetCell(lead.customerName, 140),
      email,
      phone,
      businessName: restaurantName || "Dining Establishment",
      restaurantName: restaurantName || "Dining Establishment",
      businessCategory: sanitizeSheetCell(lead.businessCategory, 60),
      location: sanitizeSheetCell(lead.location, 140),
      city: sanitizeSheetCell(lead.location, 140),
      bottleSize: sanitizeSheetCell(lead.bottleSize, 80),
      bottleMaterial: sanitizeSheetCell(lead.bottleMaterial, 80),
      estimatedQuantity: sanitizeSheetCell(lead.estimatedQuantity, 80),
      monthlyVolume: Number(lead.monthlyVolume) || 1500,
      customerRequirements: sanitizeSheetCell(lead.customerRequirements, 300),
      notes: sanitizeSheetCell(lead.customerRequirements, 300),
      conversationSummary: sanitizeSheetCell(lead.conversationSummary, 300),
      sourcePage: sanitizeSheetCell(lead.sourcePage, 80),
      leadStatus: sanitizeSheetCell(lead.leadStatus, 40),
      status: sanitizeSheetCell(lead.leadStatus, 40),
      lastUpdated: sanitizeSheetCell(lead.lastUpdated, 40),
    };

    const fetchFn = deps.fetchImpl ?? globalThis.fetch;
    try {
      const upstreamRes = await fetchFn(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outboundPayload),
      });

      let upstreamJson: Record<string, unknown> | null = null;
      try {
        const parsed: unknown = await upstreamRes.json();
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          upstreamJson = parsed as Record<string, unknown>;
        }
      } catch {
        // Invalid/empty JSON is an upstream failure; never infer success.
      }

      const upstreamAccepted =
        upstreamRes.ok &&
        upstreamJson !== null &&
        upstreamJson.success === true &&
        upstreamJson.status === "success";

      if (!upstreamAccepted) {
        const rollbackOk = claimedConsultationId
          ? await rollbackConsultationClaim(supabaseAdmin, claimedConsultationId)
          : true;
        if (!rollbackOk) {
          return jsonResponse(
            {
              success: false,
              configured: true,
              rollbackFailed: true,
              error: "Google Sheets sync failed and the consultation claim rollback could not be confirmed. Manual reconciliation is required.",
            },
            500,
            corsHeaders
          );
        }
        return jsonResponse(
          {
            success: false,
            configured: true,
            error: typeof upstreamJson?.message === "string"
              ? upstreamJson.message
              : "Upstream Google Sheets webhook did not return an explicit success response.",
          },
          502,
          corsHeaders
        );
      }

      return jsonResponse({ success: true, configured: true, synced: true }, 200, corsHeaders);
    } catch (err: unknown) {
      const rollbackOk = claimedConsultationId
        ? await rollbackConsultationClaim(supabaseAdmin, claimedConsultationId)
        : true;
      if (!rollbackOk) {
        return jsonResponse(
          {
            success: false,
            configured: true,
            rollbackFailed: true,
            error: "Google Sheets request failed and the consultation claim rollback could not be confirmed. Manual reconciliation is required.",
          },
          500,
          corsHeaders
        );
      }
      const msg = err instanceof Error ? err.message : "Failed to reach Google Sheets webhook.";
      return jsonResponse({ success: false, configured: true, error: msg }, 502, corsHeaders);
    }
  }

  // ---------------------------------------------------------------------------
  // ACTION: NEER_AI_CHAT (Server Gemini Proxy + Per-IP & Global Daily Quota)
  // ---------------------------------------------------------------------------
  if (action === "neer_ai_chat") {
    const perIpRate = await consumeRateLimitBucket(supabaseAdmin, `neer_ai:ip:${clientKey}`, 12, 60);
    if (perIpRate.dbError) {
      return jsonResponse({ success: false, error: `Rate limiter unavailable: ${perIpRate.dbError}` }, 503, corsHeaders);
    }
    if (!perIpRate.allowed) {
      return jsonResponse(
        { success: false, error: "Too many AI chat requests. Please wait a minute and try again." },
        429,
        corsHeaders,
        { "Retry-After": String(perIpRate.retryAfterSeconds) }
      );
    }

    const rawDailyLimit = Number.parseInt((deps.getEnv("NEER_AI_DAILY_LIMIT") || "").trim(), 10);
    const dailyLimit = Number.isFinite(rawDailyLimit) && rawDailyLimit > 0 ? rawDailyLimit : DEFAULT_NEER_AI_DAILY_LIMIT;
    const utcDay = new Date(nowMs).toISOString().slice(0, 10);
    const dailyQuota = await consumeRateLimitBucket(supabaseAdmin, `neer_ai_global_daily:${utcDay}`, dailyLimit, 86400);
    if (dailyQuota.dbError) {
      return jsonResponse({ success: false, error: `Daily AI quota checker unavailable: ${dailyQuota.dbError}` }, 503, corsHeaders);
    }
    if (!dailyQuota.allowed) {
      return jsonResponse(
        { success: false, error: "Daily AI assistant quota reached. Please use guided product exploration or contact support." },
        429,
        corsHeaders,
        { "Retry-After": String(dailyQuota.retryAfterSeconds) }
      );
    }

    if (!callerAuth.verifiedStaff) {
      const turnstileOk = await verifyOptionalTurnstile(deps, body.turnstileToken, clientKey);
      if (!turnstileOk) {
        return jsonResponse({ success: false, error: "Security check failed: Invalid or missing Turnstile verification." }, 403, corsHeaders);
      }
    }

    const geminiApiKey = (deps.getEnv("GEMINI_API_KEY") || "").trim();
    if (!geminiApiKey) {
      return jsonResponse(
        {
          success: false,
          configured: false,
          error: "GEMINI_API_KEY is not configured in Supabase Edge Function secrets. Using local RAG engine.",
        },
        503,
        corsHeaders
      );
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 1500) : "";
    const systemContext = typeof body.context === "string" ? body.context.trim().slice(0, 2000) : "";
    const modelNameRaw = typeof body.modelName === "string" ? body.modelName.trim() : "gemini-2.0-flash";
    const safeModelName = /^[a-zA-Z0-9._-]{3,64}$/.test(modelNameRaw) ? modelNameRaw : "gemini-2.0-flash";

    if (!prompt) {
      return jsonResponse({ success: false, error: "Prompt is required." }, 400, corsHeaders);
    }

    const fetchFn = deps.fetchImpl ?? globalThis.fetch;
    try {
      const geminiRes = await fetchFn(
        `https://generativelanguage.googleapis.com/v1beta/models/${safeModelName}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiApiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: systemContext
                      ? `${systemContext}\n\nCustomer Query: ${prompt}`
                      : prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 512,
            },
          }),
        }
      );

      if (!geminiRes.ok) {
        return jsonResponse(
          { success: false, configured: true, error: "AI upstream returned an error." },
          502,
          corsHeaders
        );
      }

      const data = (await geminiRes.json().catch(() => ({}))) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return jsonResponse({ success: true, configured: true, reply }, 200, corsHeaders);
    } catch {
      return jsonResponse({ success: false, configured: true, error: "AI upstream unreachable." }, 502, corsHeaders);
    }
  }

  return jsonResponse({ success: false, error: "Unknown action specified." }, 400, corsHeaders);
}

