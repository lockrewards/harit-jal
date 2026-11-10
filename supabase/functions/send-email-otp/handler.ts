// ====================================================================
// HARIT JAL™ (हरित जल) — SEND-EMAIL-OTP EDGE FUNCTION HANDLER
// Authoritative Server-Side Resend Dispatch, CSPRNG 6-Digit OTP Engine,
// PostgreSQL Persistent Challenge/Rate-Limit State & Multi-Vector Lockout
// ====================================================================

export interface EmailSecurityBlockRow {
  target_key: string;
  target_type?: string;
  identifier?: string;
  source_vector?: string;
  blocked_until: string;
  reason?: string;
}

export interface EmailLogInsertPayload {
  recipient: string;
  subject: string;
  body: string;
  template_type: string;
  status: string;
  error_message?: string | null;
  sent_at?: string;
}

export interface EmailOtpSelectChain {
  in?(column: string, values: string[]): Promise<{
    data: EmailSecurityBlockRow[] | null;
    error: { message: string } | null;
  }>;
  eq(column: string, value: unknown): EmailOtpSelectEqChain;
}

export interface EmailOtpSelectEqChain {
  eq(column: string, value: unknown): EmailOtpSelectEqChain;
  order?(column: string, options?: { ascending?: boolean }): {
    limit(count: number): {
      maybeSingle(): Promise<{
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      }>;
    };
  };
  maybeSingle(): Promise<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>;
}

export interface EmailOtpUpdateAfterEq extends PromiseLike<{ error: { message: string } | null }> {
  is(column: string, value: null): {
    select(columns: string): {
      maybeSingle(): Promise<{
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      }>;
    };
  };
}

export interface EmailOtpSupabaseAdminClient {
  auth?: {
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
    select(columns: string): EmailOtpSelectChain;
    upsert?(
      payload: Record<string, unknown>,
      options?: Record<string, unknown>
    ): Promise<{ error: { message: string } | null }>;
    insert(payload: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    update(payload: Record<string, unknown>): {
      eq(column: string, value: unknown): EmailOtpUpdateAfterEq;
    };
  };
}

export interface OtpChallengeState {
  jti: string;
  email: string;
  purpose: "signup" | "forgot_password";
  expiresAt: number;
  resendAvailableAt: number;
  otpHash: string;
  attempts: number;
  used: boolean;
}

export interface BlockStateEntry {
  targetKey: string;
  targetType: "id" | "device" | "ip";
  identifier: string;
  blockedUntil: number;
  reason: string;
}

export interface SendEmailOtpStateStores {
  challenges: Map<string, OtpChallengeState>;
  activeByEmailPurpose: Map<string, string>;
  strikes: Map<string, number>;
  blocks: Map<string, BlockStateEntry>;
  ipRateLimit: Map<string, { count: number; resetAt: number }>;
}

export interface SendEmailOtpDeps {
  getEnv: (key: string) => string | undefined;
  createAdminClient?: (url: string, serviceRoleKey: string) => EmailOtpSupabaseAdminClient;
  fetchImpl?: typeof fetch;
  now?: () => number;
  stores?: SendEmailOtpStateStores;
}

const DEFAULT_ALLOWED_ORIGINS = [
  "https://haritjal.in",
  "https://www.haritjal.in",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const PRIVILEGED_STAFF_ROLES = new Set([
  "super_admin",
  "admin",
  "sales_manager",
  "operations_lead",
  "label_designer",
  "staff",
]);

const OTP_VALIDITY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const CONSULTATION_PROOF_WINDOW_MS = 24 * 60 * 60 * 1000;
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 15;
const MAX_OTP_PER_EMAIL_15M = 5;
const DEFAULT_FROM_EMAIL = "Harit Jal <noreply@haritjal.in>";
const DEFAULT_ADMIN_EMAIL = "info@haritjal.in";

export function createOtpStateStores(): SendEmailOtpStateStores {
  return {
    challenges: new Map(),
    activeByEmailPurpose: new Map(),
    strikes: new Map(),
    blocks: new Map(),
    ipRateLimit: new Map(),
  };
}

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
  const rawOrigin = (req.headers.get("origin") || "").trim();
  const normalized = normalizeOrigin(rawOrigin);
  const matchedOrigin = normalized && allowed.includes(normalized)
    ? normalized
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

export function deriveClientIp(req: Request): string {
  const cfIp = (req.headers.get("cf-connecting-ip") || "").trim();
  if (isValidIpAddress(cfIp)) return cfIp;

  const realIp = (req.headers.get("x-real-ip") || "").trim();
  if (isValidIpAddress(realIp)) return realIp;

  const xff = (req.headers.get("x-forwarded-for") || "").trim();
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(isValidIpAddress);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return "unknown";
}

function sanitizeDeviceId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

export function escapeHtml(input: unknown): string {
  const str = typeof input === "string" ? input : String(input ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeSingleLine(input: unknown, maxLen: number = 200): string {
  const str = typeof input === "string" ? input : String(input ?? "");
  return str.replace(/[\r\n\0]+/g, " ").trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhoneDigits(phone: unknown): string {
  if (typeof phone !== "string") return "";
  return phone.replace(/\D/g, "");
}

function redactSixDigitOtp(text: string): string {
  return text.replace(
    /((?:otp|verification\s*code|passcode|auth\s*code)\s*[:#-]*\s*)[0-9]{6}/gi,
    "$1[REDACTED]"
  );
}

function generateServerCsprngOtp(): string {
  const range = 900000;
  const maxUnbiased = Math.floor(0x100000000 / range) * range;
  const buf = new Uint32Array(1);
  let rand = 0;
  do {
    crypto.getRandomValues(buf);
    rand = buf[0];
  } while (rand >= maxUnbiased);
  return String(100000 + (rand % range));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(b64u: string): Uint8Array {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export interface HmacKeyRing {
  primaryKey: CryptoKey;
  previousKey: CryptoKey | null;
}

export interface VerifiedSignedToken {
  payload: Record<string, unknown>;
  activeKey: CryptoKey;
  usedPreviousKey: boolean;
}

/**
 * Validates signing secret entropy:
 * - Must be defined, non-empty, and contain >= 32 UTF-8 bytes (256 bits).
 * - Fails closed if missing, empty, or weak (< 32 bytes).
 */
export function validateAndImportSigningSecret(secretRaw: string | undefined): Uint8Array | null {
  if (!secretRaw) return null;
  const trimmed = secretRaw.trim();
  if (!trimmed) return null;
  const bytes = new TextEncoder().encode(trimmed);
  if (bytes.byteLength < 32) {
    return null;
  }
  return bytes;
}

async function importHmacKey(secretBytes: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(secretBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages
  );
}

/**
 * Resolves HMAC signing keys strictly from OTP_SIGNING_SECRET (and optional OTP_SIGNING_SECRET_PREVIOUS).
 * All fallback derivation from SUPABASE_SERVICE_ROLE_KEY is permanently removed.
 * Fails closed if OTP_SIGNING_SECRET is missing, empty, or has < 32 bytes of entropy.
 */
export async function resolveHmacKeys(
  getEnv: (key: string) => string | undefined
): Promise<HmacKeyRing | null> {
  const primaryBytes = validateAndImportSigningSecret(getEnv("OTP_SIGNING_SECRET"));
  if (!primaryBytes) {
    return null;
  }

  const primaryKey = await importHmacKey(primaryBytes, ["sign", "verify"]);

  let previousKey: CryptoKey | null = null;
  const previousRaw = getEnv("OTP_SIGNING_SECRET_PREVIOUS");
  if (previousRaw) {
    const previousBytes = validateAndImportSigningSecret(previousRaw);
    if (previousBytes) {
      previousKey = await importHmacKey(previousBytes, ["sign", "verify"]);
    } else {
      console.warn(
        "[OTP_SIGNING_SECRET_PREVIOUS] Provided previous secret is invalid or has < 32 bytes; ignoring previous rotation key."
      );
    }
  }

  return { primaryKey, previousKey };
}

/**
 * Backward-compatible single key resolver for callers/tests that expect a single primary CryptoKey.
 */
export async function resolveHmacKey(
  getEnv: (key: string) => string | undefined
): Promise<CryptoKey | null> {
  const keys = await resolveHmacKeys(getEnv);
  return keys ? keys.primaryKey : null;
}

export async function computeHmacHex(key: CryptoKey, message: string): Promise<string> {
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, toArrayBuffer(new TextEncoder().encode(message)))
  );
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signChallengePayload(key: CryptoKey, payload: Record<string, unknown>): Promise<string> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadB64u = bytesToBase64Url(jsonBytes);
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, toArrayBuffer(new TextEncoder().encode(payloadB64u)))
  );
  return `${payloadB64u}.${bytesToBase64Url(sigBytes)}`;
}

/**
 * Verifies signed token using HmacKeyRing (or a single CryptoKey for backward compatibility):
 * 1. Checks primaryKey first.
 * 2. If invalid and previousKey is configured, verifies with previousKey.
 * 3. Returns decoded payload along with activeKey used to verify.
 */
export async function verifySignedToken(
  keyOrRing: CryptoKey | HmacKeyRing,
  token: string
): Promise<VerifiedSignedToken | null> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const keyRing: HmacKeyRing =
    "primaryKey" in keyOrRing ? keyOrRing : { primaryKey: keyOrRing, previousKey: null };

  try {
    const payloadB64u = parts[0];
    const sigBytes = base64UrlToBytes(parts[1]);
    const payloadBuffer = toArrayBuffer(new TextEncoder().encode(payloadB64u));
    const sigBuffer = toArrayBuffer(sigBytes);

    // 1. Try primary key
    const primaryValid = await crypto.subtle.verify(
      "HMAC",
      keyRing.primaryKey,
      sigBuffer,
      payloadBuffer
    );
    if (primaryValid) {
      const decoded = new TextDecoder().decode(base64UrlToBytes(payloadB64u));
      const payload = JSON.parse(decoded) as Record<string, unknown>;
      return { payload, activeKey: keyRing.primaryKey, usedPreviousKey: false };
    }

    // 2. Try previous key if present
    if (keyRing.previousKey) {
      const previousValid = await crypto.subtle.verify(
        "HMAC",
        keyRing.previousKey,
        sigBuffer,
        payloadBuffer
      );
      if (previousValid) {
        const decoded = new TextDecoder().decode(base64UrlToBytes(payloadB64u));
        const payload = JSON.parse(decoded) as Record<string, unknown>;
        return { payload, activeKey: keyRing.previousKey, usedPreviousKey: true };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function formatRemainingDuration(remainingMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

function createRequiredAdminClient(deps: SendEmailOtpDeps): EmailOtpSupabaseAdminClient | null {
  const supabaseUrl = (deps.getEnv("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (deps.getEnv("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceRoleKey || !deps.createAdminClient) {
    return null;
  }
  return deps.createAdminClient(supabaseUrl, serviceRoleKey);
}

async function isVerifiedStaffOrServiceCaller(
  req: Request,
  supabaseAdmin: EmailOtpSupabaseAdminClient,
  serviceRoleKey: string
): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : "";
  if (!token) return false;

  if (serviceRoleKey && token === serviceRoleKey) {
    return true;
  }

  if (!supabaseAdmin.auth?.getUser) return false;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    const user = data?.user;
    if (error || !user) return false;
    const role = String(user.app_metadata?.role || "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!PRIVILEGED_STAFF_ROLES.has(role) || user.app_metadata?.is_blocked === true) {
      return false;
    }
    const { data: staffRow } = await supabaseAdmin
      .from("staff_users")
      .select("is_blocked")
      .eq("id", user.id)
      .maybeSingle();
    if (staffRow && staffRow.is_blocked === true) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
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

export function isCloudflareTestingSecret(secret: string): boolean {
  return /^[123]x0000000000000000000000000000000[A-Za-z0-9]{2}$/i.test(secret.trim());
}

export async function verifyOptionalTurnstile(
  deps: SendEmailOtpDeps,
  turnstileToken: unknown,
  clientIp: string
): Promise<boolean> {
  const env = resolveEdgeEnvironment(deps.getEnv);
  const secret = (deps.getEnv("TURNSTILE_SECRET_KEY") || "").trim();
  const cleanToken = typeof turnstileToken === "string" ? turnstileToken.trim() : "";
  const cleanIp = clientIp.replace(/^(cf|real|xff):/, "");

  // If no TURNSTILE_SECRET_KEY is configured in edge secrets, allow request through under rate-limiter protection
  if (!secret) {
    return true;
  }

  // 1. DEVELOPMENT / TEST MODE: explicit bypass allowed with safe warning
  if (env === "development" || env === "test") {
    if (cleanToken === "dev-turnstile-bypass" || cleanToken === "test-turnstile-token") {
      console.warn(
        `[Turnstile:${env}] Explicit ${env} mode active: bypassing Turnstile verification. Forbidden in production.`
      );
      return true;
    }
  }

  // 2. PRODUCTION STRICTLY FORBIDS TESTING SECRETS
  if (env === "production" && isCloudflareTestingSecret(secret)) {
    console.error(
      "[Turnstile:production] Cloudflare test secrets (1x/2x/3x...) are strictly forbidden in production. Failing closed."
    );
    return false;
  }

  // 3. STAGING LABELS BEHAVIOR
  if (env === "staging" && isCloudflareTestingSecret(secret)) {
    console.info(
      "[Turnstile:staging] Staging environment using Cloudflare test credentials."
    );
  }

  // 4. TOKEN IS REQUIRED FOR VERIFICATION WHEN SECRET IS CONFIGURED
  if (!cleanToken) {
    console.warn(`[Turnstile:${env}] Turnstile token missing or empty.`);
    return false;
  }

  // 6. EXTERNAL SITEVERIFY VERIFICATION
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
    if (!res.ok) {
      console.error(`[Turnstile:${env}] Cloudflare siteverify HTTP error: ${res.status}`);
      return false;
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return json.success === true;
  } catch (err) {
    console.error(
      `[Turnstile:${env}] Cloudflare siteverify network error or timeout:`,
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

async function consumeRateLimitBucket(
  supabaseAdmin: EmailOtpSupabaseAdminClient,
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

async function checkMultiVectorBlock(
  candidateKeys: Array<{ key: string; type: "id" | "device" | "ip"; identifier: string }>,
  supabaseAdmin: EmailOtpSupabaseAdminClient,
  nowMs: number
): Promise<{
  isBlocked: boolean;
  blockedUntil?: number;
  remainingMs?: number;
  remainingFormatted?: string;
  blockedBy?: "id" | "device" | "ip";
}> {
  if (candidateKeys.length === 0) return { isBlocked: false };

  const { data, error } = await supabaseAdmin.rpc("check_security_block", {
    p_target_keys: candidateKeys.map((c) => c.key),
  });

  if (!error && Array.isArray(data)) {
    for (const row of data as EmailSecurityBlockRow[]) {
      const untilMs = Date.parse(row.blocked_until);
      if (!Number.isNaN(untilMs) && untilMs > nowMs) {
        const targetType = row.target_type === "device" || row.target_type === "ip" ? row.target_type : "id";
        const remainingMs = untilMs - nowMs;
        return {
          isBlocked: true,
          blockedUntil: untilMs,
          remainingMs,
          remainingFormatted: formatRemainingDuration(remainingMs),
          blockedBy: targetType,
        };
      }
    }
  }

  return { isBlocked: false };
}

async function recordEmailAuditLog(
  supabaseAdmin: EmailOtpSupabaseAdminClient,
  entry: EmailLogInsertPayload,
  nowIso: string
): Promise<void> {
  try {
    await supabaseAdmin.from("email_logs").insert({
      recipient: entry.recipient,
      subject: sanitizeSingleLine(entry.subject, 500),
      body: redactSixDigitOtp(entry.body).slice(0, 4000),
      template_type: entry.template_type,
      status: entry.status,
      error_message: entry.error_message || null,
      sent_at: entry.sent_at || nowIso,
    });
  } catch {
    // Non-fatal audit insert failure
  }
}

async function sendViaResend(
  deps: SendEmailOtpDeps,
  params: { to: string; subject: string; html: string; text: string }
): Promise<{ ok: true; messageId: string } | { ok: false; status: number; error: string }> {
  const apiKey = (deps.getEnv("RESEND_API_KEY") || "").trim();
  if (!apiKey || !apiKey.startsWith("re_")) {
    return {
      ok: false,
      status: 500,
      error: "Server configuration missing: Valid RESEND_API_KEY Edge Function secret is required.",
    };
  }

  const fromEmail = sanitizeSingleLine(deps.getEnv("RESEND_FROM_EMAIL") || DEFAULT_FROM_EMAIL, 200);
  const fetchFn = deps.fetchImpl ?? globalThis.fetch;

  try {
    const response = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.to],
        subject: sanitizeSingleLine(params.subject, 500),
        html: params.html,
        text: params.text,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const errMsg = typeof data.message === "string" ? data.message : "Failed to dispatch transactional email.";
      return { ok: false, status: 502, error: errMsg };
    }

    return {
      ok: true,
      messageId: typeof data.id === "string" ? data.id : `resend_${Date.now()}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Resend upstream transport failure.";
    return { ok: false, status: 502, error: msg };
  }
}

const CDN_FALLBACK_LOGO_URL = "https://cdn.jsdelivr.net/gh/lockrewards/harit-jal@main/public/images/brand/harit-jal-logo-mark.png";
const DEFAULT_OTP_LOGO_URL = CDN_FALLBACK_LOGO_URL;

export function resolveOtpLogoUrl(getEnv: (key: string) => string | undefined): string {
  const explicitLogoUrl = sanitizeSingleLine(getEnv("EMAIL_LOGO_URL") || "", 500);
  if (explicitLogoUrl.startsWith("https://") && !/\s/.test(explicitLogoUrl)) {
    return explicitLogoUrl;
  }

  const publicSiteUrl = sanitizeSingleLine(
    getEnv("PUBLIC_SITE_URL") || getEnv("SITE_URL") || "",
    300
  ).replace(/\/+$/, "");
  if (publicSiteUrl.startsWith("https://") && !/\s/.test(publicSiteUrl) && publicSiteUrl !== "https://haritjal.in") {
    return `${publicSiteUrl}/images/brand/harit-jal-logo-mark.png`;
  }

  return DEFAULT_OTP_LOGO_URL;
}

export interface BuildOtpEmailOptions {
  logoUrl?: string;
}

export function buildOtpEmailContent(
  _email: string,
  otp: string,
  purpose: "signup" | "forgot_password",
  options: BuildOtpEmailOptions = {}
) {
  const normalizedOtp = typeof otp === "string" ? otp.trim() : "";
  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new Error("Invalid OTP format: transactional email requires a dynamic 6-digit numeric code.");
  }

  const candidateLogoUrl = sanitizeSingleLine(options.logoUrl || DEFAULT_OTP_LOGO_URL, 500);
  const logoUrl = candidateLogoUrl.startsWith("https://") && !/\s/.test(candidateLogoUrl)
    ? candidateLogoUrl
    : DEFAULT_OTP_LOGO_URL;
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeOtp = escapeHtml(normalizedOtp);
  const digits = normalizedOtp.split("");
  const flowContext = purpose === "forgot_password"
    ? "Account Recovery & Security Verification"
    : "Email Verification";
  const subject = "Your Harit Jal Verification Code";

  const digitCellsHtml = digits
    .map((digit, idx) => {
      const safeDigit = escapeHtml(digit);
      const spacer = idx < digits.length - 1
        ? `<td width="2.6%" style="width:2.6%; font-size:1px; line-height:1px; mso-line-height-rule:exactly;">&nbsp;</td>`
        : "";
      return `<td width="14.5%" height="48" align="center" valign="middle" class="hj-otp-digit" style="width:14.5%; height:48px; background-color:#FFFFFF; border:1px solid #9DC1A3; border-radius:8px; font-family:'Courier New',Courier,monospace; font-size:24px; font-weight:700; line-height:48px; mso-line-height-rule:exactly; color:#1B4332; text-align:center; padding:0;">${safeDigit}</td>${spacer}`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    :root {
      color-scheme: light only;
      supported-color-schemes: light only;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background-color: #FFFFFF !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    table {
      border-spacing: 0;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    a[x-apple-data-detectors],
    u + #body a,
    #MessageViewBody a {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }
    .hj-copy-mobile {
      display: none;
      max-height: 0;
      overflow: hidden;
      mso-hide: all;
    }
    .hj-copy-desktop {
      display: block;
    }
    @media only screen and (max-width: 600px) {
      .hj-outer-td {
        padding: 12px 8px !important;
      }
      .hj-header-td {
        padding: 20px 14px 16px 14px !important;
      }
      .hj-content-td {
        padding: 22px 14px !important;
      }
      .hj-footer-td {
        padding: 16px 14px !important;
      }
      .hj-heading {
        font-size: 21px !important;
        line-height: 28px !important;
      }
      .hj-otp-box {
        padding: 16px 10px !important;
      }
      .hj-otp-digit {
        height: 42px !important;
        line-height: 42px !important;
        font-size: 20px !important;
      }
      .hj-otp-selectable {
        font-size: 15px !important;
      }
      .hj-copy-desktop {
        display: none !important;
        max-height: 0 !important;
        overflow: hidden !important;
      }
      .hj-copy-mobile {
        display: block !important;
        max-height: none !important;
        overflow: visible !important;
      }
    }
  </style>
</head>
<body id="body" style="margin:0; padding:0; width:100%; background-color:#FFFFFF; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#1B4332; -webkit-font-smoothing:antialiased;">
  <div style="display:none; font-size:1px; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; mso-hide:all;">
    Your Harit Jal verification code (${escapeHtml(flowContext)}). Valid for 5 minutes.
  </div>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width:100%; background-color:#FFFFFF; margin:0; padding:0; border-collapse:collapse;">
    <tr>
      <td align="center" valign="top" class="hj-outer-td" style="padding:24px 12px; background-color:#FFFFFF;">
        <!--[if mso]>
        <table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="540">
        <tr>
        <td align="center" valign="top" width="540">
        <![endif]-->
        <table role="presentation" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%; max-width:540px; margin:0 auto; background-color:#FFFFFF; border:1px solid #CFE0D2; border-radius:14px; border-collapse:separate; border-spacing:0; overflow:hidden;">
          <!-- HEADER -->
          <tr>
            <td align="center" class="hj-header-td" style="padding:26px 24px 20px 24px; background-color:#FFFFFF; border-bottom:1px solid #E3EDE4; border-radius:13px 13px 0 0;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <img src="${safeLogoUrl}" alt="Harit Jal™ (हरित जल)" width="38" height="50" style="display:block; margin:0 auto; width:38px; max-width:38px; height:50px; border:0; outline:none; text-decoration:none; font-family:Georgia,'Times New Roman',serif; font-size:14px; font-weight:700; color:#1B4332; line-height:1.3;" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Georgia,'Times New Roman',serif; font-size:21px; font-weight:700; line-height:1.3; color:#1B4332; letter-spacing:0.2px;">
                    <span style="white-space:nowrap;">Harit Jal™</span> <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#2D5A3F; white-space:nowrap;">(हरित जल)</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- BODY -->
          <tr>
            <td align="center" class="hj-content-td" style="padding:28px 20px; background-color:#FFFFFF;">
              <h1 class="hj-heading" style="margin:0 0 8px 0; font-family:Georgia,'Times New Roman',serif; font-size:24px; font-weight:700; line-height:32px; color:#1B4332; text-align:center;">
                Verify Your Email
              </h1>
              <p style="margin:0 0 12px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; line-height:22px; color:#2D5A3F; text-align:center;">
                Welcome to Harit Jal!
              </p>
              <p style="margin:0 0 22px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; font-weight:400; line-height:22px; color:#41594B; text-align:center;">
                Use the verification code below to confirm your email address and secure your account.
              </p>
              <!-- SOFT SAGE GREEN OTP CONTAINER -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%; background-color:#F2F7F2; border:1px solid #BDD6C0; border-radius:12px; border-collapse:separate; border-spacing:0;">
                <tr>
                  <td align="center" class="hj-otp-box" style="padding:20px 14px; background-color:#F2F7F2; border-radius:11px;">
                    <!--[if mso]>
                    <table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" width="312">
                    <tr>
                    <td align="center" width="312">
                    <![endif]-->
                    <table role="presentation" align="center" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%; max-width:312px; margin:0 auto; table-layout:fixed; border-collapse:separate; border-spacing:0;">
                      <tr>
                        ${digitCellsHtml}
                      </tr>
                    </table>
                    <!--[if mso]>
                    </td>
                    </tr>
                    </table>
                    <![endif]-->
                    <!-- PROMINENT BUTTON-STYLE COPY BOX -->
                    <table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" style="margin:16px auto 0 auto; border-collapse:separate; border-spacing:0;">
                      <tr>
                        <td align="center" style="background-color:#1B4332; border:1px solid #102B1D; border-radius:8px; padding:10px 22px; box-shadow:0 2px 4px rgba(27,67,50,0.18);">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="border-collapse:collapse;">
                            <tr>
                              <td align="center" valign="middle" style="padding-right:10px;">
                                <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; font-weight:700; color:#FFFFFF; letter-spacing:0.5px; text-transform:uppercase;">&#x1F4CB; Copy Code:</span>
                              </td>
                              <td align="center" valign="middle" style="background-color:#2D5A3F; border:1px solid #41594B; border-radius:6px; padding:5px 14px;">
                                <span class="hj-otp-selectable" style="font-family:'Courier New',Courier,monospace; font-size:19px; font-weight:700; letter-spacing:3px; color:#FFFFFF; user-select:all; -webkit-user-select:all; -moz-user-select:all; cursor:pointer;">${safeOtp}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <div class="hj-copy-desktop" style="margin:10px 0 0 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; font-weight:500; line-height:18px; color:#2D5A3F; text-align:center;">
                      Select and copy your code. (Click code to select &bull; Ctrl+C)
                    </div>
                    <!--[if !mso]><!-->
                    <div class="hj-copy-mobile" style="display:none; max-height:0; overflow:hidden; mso-hide:all; margin:10px 0 0 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; font-weight:500; line-height:18px; color:#2D5A3F; text-align:center;">
                      Tap and hold to copy your code.
                    </div>
                    <!--<![endif]-->
                    <p style="margin:10px 0 0 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12.5px; font-weight:600; line-height:18px; color:#1B4332; text-align:center;">
                      This code is valid for 5 minutes.
                    </p>
                  </td>
                </tr>
              </table>
              <!-- SECURITY REMINDERS -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%; margin-top:20px; background-color:#FAFDF9; border:1px solid #DCE9DE; border-radius:10px; border-collapse:separate; border-spacing:0;">
                <tr>
                  <td align="left" style="padding:14px 16px;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
                      <tr>
                        <td width="24" valign="middle" style="padding:4px 8px 4px 0;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="20" height="20" style="width:20px; height:20px; background-color:#E8F3EA; border:1px solid #A9CEAF; border-radius:10px; border-collapse:separate; border-spacing:0;">
                            <tr>
                              <td align="center" valign="middle" style="font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:700; line-height:18px; color:#1B4332;">&#10003;</td>
                            </tr>
                          </table>
                        </td>
                        <td valign="middle" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; line-height:19px; color:#2E4A39; word-wrap:break-word;">
                          Keep it private.
                        </td>
                      </tr>
                      <tr>
                        <td width="24" valign="middle" style="padding:4px 8px 4px 0;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="20" height="20" style="width:20px; height:20px; background-color:#E8F3EA; border:1px solid #A9CEAF; border-radius:10px; border-collapse:separate; border-spacing:0;">
                            <tr>
                              <td align="center" valign="middle" style="font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:700; line-height:18px; color:#1B4332;">!</td>
                            </tr>
                          </table>
                        </td>
                        <td valign="middle" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; line-height:19px; color:#2E4A39; word-wrap:break-word;">
                          Don't share with anyone.
                        </td>
                      </tr>
                      <tr>
                        <td width="24" valign="middle" style="padding:4px 8px 4px 0;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="20" height="20" style="width:20px; height:20px; background-color:#E8F3EA; border:1px solid #A9CEAF; border-radius:10px; border-collapse:separate; border-spacing:0;">
                            <tr>
                              <td align="center" valign="middle" style="font-family:Arial,Helvetica,sans-serif; font-size:10px; font-weight:700; line-height:18px; color:#1B4332;">&#9670;</td>
                            </tr>
                          </table>
                        </td>
                        <td valign="middle" style="padding:4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; line-height:19px; color:#2E4A39; word-wrap:break-word;">
                          Harit Jal will never ask for your OTP.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td align="center" class="hj-footer-td" style="padding:18px 24px; background-color:#FAFDF9; border-top:1px solid #E3EDE4; border-radius:0 0 13px 13px;">
              <p style="margin:0 0 4px 0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; font-weight:600; line-height:19px; color:#1B4332; text-align:center;">
                Thank you for choosing Harit Jal.
              </p>
              <p style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; font-weight:400; line-height:18px; color:#567060; text-align:center;">
                &copy; 2026 Harit Jal. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "Harit Jal™ (हरित जल)",
    "",
    "Verify Your Email",
    "Welcome to Harit Jal!",
    "",
    "Use the verification code below to confirm your email address and secure your account.",
    "",
    `Your Verification Code: ${normalizedOtp}`,
    "",
    "This code is valid for 5 minutes.",
    "",
    "Security Reminders:",
    "- Keep it private.",
    "- Don't share with anyone.",
    "- Harit Jal will never ask for your OTP.",
    "",
    "Thank you for choosing Harit Jal.",
    "© 2026 Harit Jal. All rights reserved.",
  ].join("\n");

  return { subject, html, text };
}

export async function handleSendEmailOtpRequest(req: Request, deps: SendEmailOtpDeps): Promise<Response> {
  const corsHeaders = buildCorsHeaders(req, deps.getEnv);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed. Use POST." }, 405, corsHeaders);
  }

  const supabaseAdmin = createRequiredAdminClient(deps);
  if (!supabaseAdmin) {
    return jsonResponse(
      {
        success: false,
        configured: false,
        error: "Server configuration missing: Persistent Supabase service role client is required.",
      },
      503,
      corsHeaders
    );
  }

  const nowMs = deps.now ? deps.now() : Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const serviceRoleKey = (deps.getEnv("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const isVerifiedCaller = await isVerifiedStaffOrServiceCaller(req, supabaseAdmin, serviceRoleKey);
  const allowedOrigins = getAllowedOrigins(deps.getEnv);
  const normalizedOrigin = normalizeOrigin(req.headers.get("origin"));

  if (!isVerifiedCaller && (!normalizedOrigin || !allowedOrigins.includes(normalizedOrigin))) {
    return jsonResponse(
      { success: false, error: "Forbidden: Untrusted or missing request Origin." },
      403,
      corsHeaders
    );
  }

  const clientIp = deriveClientIp(req);

  // Persistent per-IP flood protection across Edge isolates
  const ipRate = await consumeRateLimitBucket(
    supabaseAdmin,
    `send_email_otp:ip:${clientIp}`,
    MAX_REQUESTS_PER_MINUTE,
    60
  );
  if (ipRate.dbError) {
    return jsonResponse({ success: false, error: `Rate limiter unavailable: ${ipRate.dbError}` }, 503, corsHeaders);
  }
  if (!ipRate.allowed) {
    return jsonResponse(
      { success: false, error: "Too many email/OTP requests. Please wait a minute and try again." },
      429,
      corsHeaders,
      { "Retry-After": String(ipRate.retryAfterSeconds) }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action.trim() : "";

  // ---------------------------------------------------------------------------
  // ACTION: CHECK_STATUS (Authoritative Database Block Check)
  // ---------------------------------------------------------------------------
  if (action === "check_status") {
    const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const deviceId = sanitizeDeviceId(body.deviceId);
    const candidates: Array<{ key: string; type: "id" | "device" | "ip"; identifier: string }> = [];
    if (isValidEmail(emailRaw)) candidates.push({ key: `id:${emailRaw}`, type: "id", identifier: emailRaw });
    if (deviceId) candidates.push({ key: `device:${deviceId}`, type: "device", identifier: deviceId });
    if (clientIp !== "unknown") candidates.push({ key: `ip:${clientIp}`, type: "ip", identifier: clientIp });

    const blockStatus = await checkMultiVectorBlock(candidates, supabaseAdmin, nowMs);
    return jsonResponse({ success: true, ...blockStatus }, 200, corsHeaders);
  }

  // ---------------------------------------------------------------------------
  // ACTION: SEND_OTP
  // ---------------------------------------------------------------------------
  if (action === "send_otp") {
    const cleanEmail = sanitizeSingleLine(body.email, 254).toLowerCase();
    const purposeRaw = typeof body.purpose === "string" ? body.purpose.trim() : "signup";
    if (purposeRaw !== "signup" && purposeRaw !== "forgot_password") {
      return jsonResponse({ success: false, error: "Invalid OTP purpose specified." }, 400, corsHeaders);
    }
    const purpose = purposeRaw;

    if (!isValidEmail(cleanEmail)) {
      return jsonResponse({ success: false, error: "Please enter a valid email address." }, 400, corsHeaders);
    }

    if (!isVerifiedCaller) {
      const turnstileOk = await verifyOptionalTurnstile(deps, body.turnstileToken, clientIp);
      if (!turnstileOk) {
        return jsonResponse(
          { success: false, error: "Security check failed: Invalid or missing Turnstile verification." },
          403,
          corsHeaders
        );
      }
    }

    const hmacKeys = await resolveHmacKeys(deps.getEnv);
    if (!hmacKeys) {
      return jsonResponse(
        { success: false, error: "Service temporarily unavailable. Please try again shortly." },
        503,
        corsHeaders
      );
    }

    const deviceId = sanitizeDeviceId(body.deviceId);
    const candidates: Array<{ key: string; type: "id" | "device" | "ip"; identifier: string }> = [
      { key: `id:${cleanEmail}`, type: "id", identifier: cleanEmail },
    ];
    if (deviceId) candidates.push({ key: `device:${deviceId}`, type: "device", identifier: deviceId });
    if (clientIp !== "unknown") candidates.push({ key: `ip:${clientIp}`, type: "ip", identifier: clientIp });

    const blockStatus = await checkMultiVectorBlock(candidates, supabaseAdmin, nowMs);
    if (blockStatus.isBlocked) {
      return jsonResponse(
        {
          success: false,
          isBlocked: true,
          blockedBy: blockStatus.blockedBy,
          blockedUntil: blockStatus.blockedUntil,
          remainingMs: blockStatus.remainingMs,
          remainingFormatted: blockStatus.remainingFormatted,
          error: `Security Lockout: Account ID, device, and network are locked for 24 hours due to repeated failed attempts. Remaining: ${blockStatus.remainingFormatted}.`,
        },
        403,
        corsHeaders
      );
    }

    // Enforce persistent 60-second resend cooldown across isolates
    const challengeQuery = supabaseAdmin
      .from("otp_challenges")
      .select("jti, expires_at, resend_available_at, used, created_at")
      .eq("email", cleanEmail)
      .eq("purpose", purpose);
    const latestRes = challengeQuery.order
      ? await challengeQuery.order("created_at", { ascending: false }).limit(1).maybeSingle()
      : await challengeQuery.maybeSingle();

    if (latestRes.error) {
      return jsonResponse(
        { success: false, error: `Failed to query OTP challenge state: ${latestRes.error.message}` },
        500,
        corsHeaders
      );
    }

    const latestChallenge = latestRes.data;
    if (latestChallenge && latestChallenge.used !== true) {
      const resendAtMs = Date.parse(String(latestChallenge.resend_available_at || ""));
      const expiresAtMs = Date.parse(String(latestChallenge.expires_at || ""));
      if (!Number.isNaN(resendAtMs) && nowMs < resendAtMs) {
        const waitSeconds = Math.ceil((resendAtMs - nowMs) / 1000);
        return jsonResponse(
          {
            success: false,
            resendInSeconds: waitSeconds,
            expiresAt: Number.isNaN(expiresAtMs) ? undefined : expiresAtMs,
            resendAvailableAt: resendAtMs,
            error: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
          },
          429,
          corsHeaders,
          { "Retry-After": String(waitSeconds) }
        );
      }
    }

    // Enforce persistent per-email rolling quota (5 requests / 15m)
    const emailRate = await consumeRateLimitBucket(
      supabaseAdmin,
      `otp_email:${cleanEmail}`,
      MAX_OTP_PER_EMAIL_15M,
      900
    );
    if (emailRate.dbError) {
      return jsonResponse({ success: false, error: `Rate limiter unavailable: ${emailRate.dbError}` }, 503, corsHeaders);
    }
    if (!emailRate.allowed) {
      return jsonResponse(
        {
          success: false,
          error: "Too many verification codes requested for this email. Please wait before trying again.",
        },
        429,
        corsHeaders,
        { "Retry-After": String(emailRate.retryAfterSeconds) }
      );
    }

    // Generate server-side CSPRNG 6-digit OTP
    const otp = generateServerCsprngOtp();
    const jti = crypto.randomUUID();
    const expiresAt = nowMs + OTP_VALIDITY_MS;
    const resendAvailableAt = nowMs + RESEND_COOLDOWN_MS;
    const otpHash = await computeHmacHex(hmacKeys.primaryKey, `${jti}:${cleanEmail}:${purpose}:${otp}`);

    const challengeToken = await signChallengePayload(hmacKeys.primaryKey, {
      jti,
      email: cleanEmail,
      purpose,
      iat: nowMs,
      exp: expiresAt,
      resendAt: resendAvailableAt,
      otpHash,
    });

    const emailContent = buildOtpEmailContent(cleanEmail, otp, purpose, {
      logoUrl: resolveOtpLogoUrl(deps.getEnv),
    });
    const dispatchRes = await sendViaResend(deps, {
      to: cleanEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!dispatchRes.ok) {
      await recordEmailAuditLog(
        supabaseAdmin,
        {
          recipient: cleanEmail,
          subject: emailContent.subject,
          body: `OTP dispatch failed for ${cleanEmail} (${purpose}). Code redacted.`,
          template_type: "otp_verification",
          status: "Failed",
          error_message: dispatchRes.error,
        },
        nowIso
      );
      return jsonResponse(
        { success: false, error: dispatchRes.error },
        dispatchRes.status,
        corsHeaders
      );
    }

    // Supersede previous active challenge and persist new challenge in PostgreSQL
    if (latestChallenge && latestChallenge.used !== true && typeof latestChallenge.jti === "string") {
      await supabaseAdmin
        .from("otp_challenges")
        .update({ used: true, used_at: nowIso })
        .eq("jti", latestChallenge.jti);
    }

    const { error: insertErr } = await supabaseAdmin.from("otp_challenges").insert({
      jti,
      email: cleanEmail,
      purpose,
      otp_hash: otpHash,
      expires_at: new Date(expiresAt).toISOString(),
      resend_available_at: new Date(resendAvailableAt).toISOString(),
      attempts: 0,
      used: false,
      created_at: nowIso,
    });

    if (insertErr) {
      return jsonResponse(
        { success: false, error: `Failed to persist OTP challenge: ${insertErr.message}` },
        500,
        corsHeaders
      );
    }

    await recordEmailAuditLog(
      supabaseAdmin,
      {
        recipient: cleanEmail,
        subject: emailContent.subject,
        body: `Authoritative 6-digit OTP challenge ${jti} dispatched via Resend for ${cleanEmail} (${purpose}). Code redacted.`,
        template_type: "otp_verification",
        status: "Dispatched",
      },
      nowIso
    );

    return jsonResponse(
      {
        success: true,
        challengeToken,
        expiresAt,
        resendAvailableAt,
        resendInSeconds: 60,
        messageId: dispatchRes.messageId,
      },
      200,
      corsHeaders
    );
  }

  // ---------------------------------------------------------------------------
  // ACTION: VERIFY_OTP
  // ---------------------------------------------------------------------------
  if (action === "verify_otp") {
    const cleanEmail = sanitizeSingleLine(body.email, 254).toLowerCase();
    const cleanOtp = typeof body.otp === "string" ? body.otp.trim() : "";
    const purposeRaw = typeof body.purpose === "string" ? body.purpose.trim() : "signup";
    const challengeToken = typeof body.challengeToken === "string" ? body.challengeToken.trim() : "";

    if (!isValidEmail(cleanEmail)) {
      return jsonResponse({ success: false, error: "Please provide a valid email address." }, 400, corsHeaders);
    }
    if (purposeRaw !== "signup" && purposeRaw !== "forgot_password") {
      return jsonResponse({ success: false, error: "Invalid verification purpose." }, 400, corsHeaders);
    }
    const purpose = purposeRaw;

    if (!/^\d{6}$/.test(cleanOtp)) {
      return jsonResponse({ success: false, error: "Please enter all 6 digits of the verification code." }, 400, corsHeaders);
    }
    if (!challengeToken) {
      return jsonResponse({ success: false, error: "Verification challenge token missing. Please request a new OTP." }, 400, corsHeaders);
    }

    const hmacKeys = await resolveHmacKeys(deps.getEnv);
    if (!hmacKeys) {
      return jsonResponse(
        { success: false, error: "Service temporarily unavailable. Please try again shortly." },
        503,
        corsHeaders
      );
    }

    const deviceId = sanitizeDeviceId(body.deviceId);
    const verified = await verifySignedToken(hmacKeys, challengeToken);
    if (!verified) {
      return jsonResponse({ success: false, error: "Invalid or tampered OTP challenge token. Please request a new OTP." }, 400, corsHeaders);
    }

    const verifiedPayload = verified.payload;
    const tokenJti = typeof verifiedPayload.jti === "string" ? verifiedPayload.jti : "";
    const tokenEmail = typeof verifiedPayload.email === "string" ? verifiedPayload.email : "";
    const tokenPurpose = verifiedPayload.purpose;
    const tokenExp = typeof verifiedPayload.exp === "number" ? verifiedPayload.exp : 0;
    const tokenOtpHash = typeof verifiedPayload.otpHash === "string" ? verifiedPayload.otpHash : "";

    if (!tokenJti || tokenEmail !== cleanEmail || tokenPurpose !== purpose || !tokenOtpHash) {
      return jsonResponse({ success: false, error: "Challenge token does not match the verification email or flow." }, 400, corsHeaders);
    }

    if (nowMs > tokenExp) {
      await supabaseAdmin
        .from("otp_challenges")
        .update({ used: true, used_at: nowIso })
        .eq("jti", tokenJti);
      return jsonResponse(
        {
          success: false,
          expired: true,
          error: "Verification code has expired (validity is 5 minutes). Please request a new OTP.",
        },
        400,
        corsHeaders
      );
    }

    const candidateHash = await computeHmacHex(verified.activeKey, `${tokenJti}:${cleanEmail}:${purpose}:${cleanOtp}`);

    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("verify_otp_challenge_attempt", {
      p_jti: tokenJti,
      p_email: cleanEmail,
      p_purpose: purpose,
      p_otp_hash: candidateHash,
      p_device_id: deviceId,
      p_client_ip: clientIp,
    });

    if (rpcErr) {
      return jsonResponse(
        { success: false, error: `OTP verification service unavailable: ${rpcErr.message}` },
        503,
        corsHeaders
      );
    }

    const rpcRow = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as {
      outcome?: string;
      attempts_remaining?: number;
      blocked_until?: string | null;
    } | null;

    if (!rpcRow || typeof rpcRow.outcome !== "string") {
      return jsonResponse({ success: false, error: "Unexpected OTP verification response." }, 503, corsHeaders);
    }

    const outcome = rpcRow.outcome;
    const blockedUntilMs = rpcRow.blocked_until ? Date.parse(String(rpcRow.blocked_until)) : NaN;
    const effectiveBlockedUntil = !Number.isNaN(blockedUntilMs) ? blockedUntilMs : nowMs + BLOCK_DURATION_MS;
    const remainingFormatted = formatRemainingDuration(Math.max(60000, effectiveBlockedUntil - nowMs));

    if (outcome === "blocked") {
      return jsonResponse(
        {
          success: false,
          isBlocked: true,
          blockedUntil: effectiveBlockedUntil,
          remainingFormatted,
          error: `Account locked for 24 hours due to multiple failed verification attempts. Remaining: ${remainingFormatted}.`,
        },
        403,
        corsHeaders
      );
    }

    if (outcome === "locked") {
      return jsonResponse(
        {
          success: false,
          isBlocked: true,
          attemptsRemaining: 0,
          blockedUntil: effectiveBlockedUntil,
          remainingFormatted,
          error: "Maximum 3 wrong attempts reached. Your account ID, device, and IP address are locked for 24 hours for security.",
        },
        403,
        corsHeaders
      );
    }

    if (outcome === "expired") {
      return jsonResponse(
        {
          success: false,
          expired: true,
          error: "Verification code has expired (validity is 5 minutes). Please request a new OTP.",
        },
        400,
        corsHeaders
      );
    }

    if (outcome === "already_used") {
      return jsonResponse(
        { success: false, error: "This verification code has already been used. Please request a new OTP." },
        400,
        corsHeaders
      );
    }

    if (outcome === "superseded") {
      return jsonResponse(
        { success: false, error: "A newer verification code was issued. Please enter the latest 6-digit code." },
        400,
        corsHeaders
      );
    }

    if (outcome === "not_found") {
      return jsonResponse(
        { success: false, error: "OTP challenge not found or invalid. Please request a new OTP." },
        400,
        corsHeaders
      );
    }

    if (outcome === "invalid") {
      const attemptsRemaining = Math.max(1, Number(rpcRow.attempts_remaining ?? 1));
      return jsonResponse(
        {
          success: false,
          attemptsRemaining,
          error: `Incorrect 6-digit verification code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining before 24-hour lockout.`,
        },
        401,
        corsHeaders
      );
    }

    if (outcome !== "verified") {
      return jsonResponse({ success: false, error: "OTP verification did not succeed." }, 400, corsHeaders);
    }

    const verificationProof = await signChallengePayload(hmacKeys.primaryKey, {
      verified: true,
      email: cleanEmail,
      purpose,
      verifiedAt: nowMs,
      exp: nowMs + 15 * 60 * 1000,
    });

    return jsonResponse(
      {
        success: true,
        verified: true,
        verificationProof,
      },
      200,
      corsHeaders
    );
  }

  // ---------------------------------------------------------------------------
  // ACTION: SEND_CONSULTATION_CONFIRMATION (DB Proof + Atomic Claim -> Customer)
  // ---------------------------------------------------------------------------
  if (action === "send_consultation_confirmation") {
    if (!isVerifiedCaller) {
      const turnstileOk = await verifyOptionalTurnstile(deps, body.turnstileToken, clientIp);
      if (!turnstileOk) {
        return jsonResponse(
          { success: false, error: "Security check failed: Invalid or missing Turnstile verification." },
          403,
          corsHeaders
        );
      }
    }

    const booking = (typeof body.booking === "object" && body.booking !== null ? body.booking : {}) as Record<string, unknown>;
    const bookingId = sanitizeSingleLine(booking.id, 60);
    const recipientEmail = sanitizeSingleLine(booking.email, 254).toLowerCase();
    const restaurantName = sanitizeSingleLine(booking.restaurantName, 140);
    const ownerName = sanitizeSingleLine(booking.ownerName, 140) || "Valued Partner";
    const phone = sanitizeSingleLine(booking.phone, 40) || "On file";
    const preferredTime = sanitizeSingleLine(booking.preferredTime, 100) || "Scheduled window";
    const city = sanitizeSingleLine(booking.city, 140) || "Pan-India";

    if (!isValidEmail(recipientEmail) || !restaurantName) {
      return jsonResponse({ success: false, error: "Valid email and restaurant name are required." }, 400, corsHeaders);
    }

    if (!isVerifiedCaller && !bookingId) {
      return jsonResponse(
        { success: false, error: "Forbidden: Valid persisted consultation ID is required for confirmation email." },
        403,
        corsHeaders
      );
    }

    let claimedConsultationId: string | null = null;
    if (bookingId) {
      const { data: consultationRow, error: lookupErr } = await supabaseAdmin
        .from("consultations")
        .select("id, email, phone, created_at, confirmation_email_sent_at")
        .eq("id", bookingId)
        .maybeSingle();

      if (lookupErr) {
        return jsonResponse({ success: false, error: "Failed to verify consultation proof in database." }, 500, corsHeaders);
      }

      if (!isVerifiedCaller) {
        if (!consultationRow) {
          return jsonResponse({ success: false, error: "Forbidden: Consultation record not found." }, 403, corsHeaders);
        }
        const rowEmail = String(consultationRow.email || "").trim().toLowerCase();
        const rowPhoneDigits = normalizePhoneDigits(consultationRow.phone);
        const bookingPhoneDigits = normalizePhoneDigits(booking.phone);
        const phoneMatches = Boolean(bookingPhoneDigits && rowPhoneDigits && rowPhoneDigits === bookingPhoneDigits);
        const identityValid = rowEmail ? rowEmail === recipientEmail : phoneMatches;
        if (!identityValid) {
          return jsonResponse({ success: false, error: "Forbidden: Consultation identity mismatch." }, 403, corsHeaders);
        }
        const createdAtMs = Date.parse(String(consultationRow.created_at || ""));
        if (Number.isNaN(createdAtMs) || nowMs - createdAtMs > CONSULTATION_PROOF_WINDOW_MS) {
          return jsonResponse({ success: false, error: "Forbidden: Consultation proof window expired." }, 403, corsHeaders);
        }
      }

      if (consultationRow) {
        const { data: claimedRow, error: claimErr } = await supabaseAdmin
          .from("consultations")
          .update({ confirmation_email_sent_at: nowIso })
          .eq("id", bookingId)
          .is("confirmation_email_sent_at", null)
          .select("id")
          .maybeSingle();

        if (claimErr) {
          return jsonResponse({ success: false, error: "Failed to acquire consultation email claim." }, 500, corsHeaders);
        }
        if (!claimedRow) {
          return jsonResponse(
            {
              success: false,
              alreadySent: true,
              error: "Consultation confirmation email has already been dispatched for this booking.",
            },
            409,
            corsHeaders
          );
        }
        claimedConsultationId = bookingId;
      }
    }

    const subject = `[Harit Jal] Consultation Confirmed: Bespoke Glass Bottles for ${restaurantName}`;
    const html = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #FAF7EE; padding: 20px; color: #102C47;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #C99B42; border-radius: 16px; padding: 24px;">
    <h2 style="color: #102C47; margin-top: 0;">Consultation Call Confirmed</h2>
    <p>Dear <strong>${escapeHtml(ownerName)}</strong>,</p>
    <p>Thank you for booking a discovery consultation for <strong>${escapeHtml(restaurantName)}</strong> (${escapeHtml(city)}).</p>
    <div style="background: #F8F5EC; border-radius: 10px; padding: 14px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Preferred Call Time:</strong> ${escapeHtml(preferredTime)}</p>
      <p style="margin: 4px 0;"><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p style="margin: 4px 0;"><strong>Assigned Specialist:</strong> Harit Jal Hospitality Manager</p>
    </div>
    <p style="font-size: 13px; color: #77766F;">Our team will prepare custom bottle label proofs and coordinate sample dispatch for your establishment.</p>
    <p style="font-size: 12px; color: #C99B42; font-weight: bold;">Harit Jal™ Bespoke Dining Hydration</p>
  </div>
</body>
</html>`;
    const text = `Harit Jal Consultation Confirmed\n\nDear ${ownerName},\nWe received your consultation request for ${restaurantName} (${city}).\nPreferred Time: ${preferredTime}\nPhone: ${phone}\n\nTeam Harit Jal`;

    const dispatchRes = await sendViaResend(deps, { to: recipientEmail, subject, html, text });
    await recordEmailAuditLog(
      supabaseAdmin,
      {
        recipient: recipientEmail,
        subject,
        body: text,
        template_type: "client_confirmation",
        status: dispatchRes.ok ? "Dispatched" : "Failed",
        error_message: dispatchRes.ok ? null : dispatchRes.error,
      },
      nowIso
    );

    if (!dispatchRes.ok) {
      if (claimedConsultationId) {
        await supabaseAdmin
          .from("consultations")
          .update({ confirmation_email_sent_at: null })
          .eq("id", claimedConsultationId);
      }
      return jsonResponse({ success: false, error: dispatchRes.error }, dispatchRes.status, corsHeaders);
    }

    return jsonResponse({ success: true, messageId: dispatchRes.messageId }, 200, corsHeaders);
  }

  // ---------------------------------------------------------------------------
  // ACTION: SEND_ADMIN_LEAD_ALERT (DB Proof + Atomic Claim -> Admin Only)
  // ---------------------------------------------------------------------------
  if (action === "send_admin_lead_alert") {
    if (!isVerifiedCaller) {
      const turnstileOk = await verifyOptionalTurnstile(deps, body.turnstileToken, clientIp);
      if (!turnstileOk) {
        return jsonResponse(
          { success: false, error: "Security check failed: Invalid or missing Turnstile verification." },
          403,
          corsHeaders
        );
      }
    }

    const lead = (typeof body.lead === "object" && body.lead !== null ? body.lead : {}) as Record<string, unknown>;
    const adminRecipient = sanitizeSingleLine(deps.getEnv("HARIT_JAL_ADMIN_EMAIL") || DEFAULT_ADMIN_EMAIL, 254).toLowerCase();
    const businessName = sanitizeSingleLine(lead.businessName, 140) || "Dining Establishment";
    const customerName = sanitizeSingleLine(lead.customerName, 140) || "Valued Restaurant Partner";
    const leadEmailRaw = sanitizeSingleLine(lead.email, 254).toLowerCase();
    const leadEmail = leadEmailRaw || "Not provided";
    const leadPhone = sanitizeSingleLine(lead.phone, 40) || "Not provided";
    const location = sanitizeSingleLine(lead.location, 140) || "Pan-India";
    const bottleSize = sanitizeSingleLine(lead.bottleSize, 80) || "500ml";
    const bottleMaterial = sanitizeSingleLine(lead.bottleMaterial, 80) || "Flint Glass / rPET";
    const estimatedQuantity = sanitizeSingleLine(lead.estimatedQuantity, 80) || "Pending estimate";
    const requirements = sanitizeSingleLine(lead.customerRequirements, 500) || "Bespoke dining bottles";
    const rawLeadId = sanitizeSingleLine(lead.id, 60);
    const leadId = rawLeadId || "NEW-LEAD";

    if (!isVerifiedCaller && !rawLeadId) {
      return jsonResponse(
        { success: false, error: "Forbidden: Valid persisted consultation ID is required for admin alert dispatch." },
        403,
        corsHeaders
      );
    }

    let claimedConsultationId: string | null = null;
    if (rawLeadId) {
      const { data: consultationRow, error: lookupErr } = await supabaseAdmin
        .from("consultations")
        .select("id, email, phone, created_at, admin_alert_sent_at")
        .eq("id", rawLeadId)
        .maybeSingle();

      if (lookupErr) {
        return jsonResponse({ success: false, error: "Failed to verify consultation proof in database." }, 500, corsHeaders);
      }

      if (!isVerifiedCaller) {
        if (!consultationRow) {
          return jsonResponse({ success: false, error: "Forbidden: Consultation record not found." }, 403, corsHeaders);
        }
        const rowEmail = String(consultationRow.email || "").trim().toLowerCase();
        const rowPhoneDigits = normalizePhoneDigits(consultationRow.phone);
        const leadPhoneDigits = normalizePhoneDigits(lead.phone);
        const emailMatches = Boolean(leadEmailRaw && rowEmail && rowEmail === leadEmailRaw);
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
        const { data: claimedRow, error: claimErr } = await supabaseAdmin
          .from("consultations")
          .update({ admin_alert_sent_at: nowIso })
          .eq("id", rawLeadId)
          .is("admin_alert_sent_at", null)
          .select("id")
          .maybeSingle();

        if (claimErr) {
          return jsonResponse({ success: false, error: "Failed to acquire admin alert claim." }, 500, corsHeaders);
        }
        if (!claimedRow) {
          return jsonResponse(
            {
              success: false,
              alreadySent: true,
              error: "Admin lead alert has already been dispatched for this consultation.",
            },
            409,
            corsHeaders
          );
        }
        claimedConsultationId = rawLeadId;
      }
    }

    const rawSource = sanitizeSingleLine(
      (typeof lead.sourcePage === "string" && lead.sourcePage) ||
      (typeof lead.source === "string" && lead.source) ||
      (typeof lead.inquirySource === "string" && lead.inquirySource) ||
      "",
      120
    );
    const isMascot = /mascot|neer/i.test(rawSource);
    const sourceLabel = isMascot ? "Mascot (Neer AI Chat)" : (rawSource || "Website Form");
    const sourceBadge = isMascot ? "🤖 Mascot (Neer AI)" : "🌐 Website Form";

    const subject = `🚨 [NEW ENQUIRY via ${isMascot ? "Mascot (Neer AI)" : "Website Form"}] ${businessName} (${location}) — Harit Jal`;
    const html = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #FAF7EE; padding: 20px; color: #102C47;">
  <div style="max-width: 540px; margin: 0 auto; background: #fff; border: 1px solid #C99B42; border-radius: 16px; padding: 24px;">
    <div style="margin-bottom: 16px; padding: 8px 14px; background: ${isMascot ? '#EBF5FB' : '#FEF9E7'}; border: 1px solid ${isMascot ? '#2980B9' : '#C99B42'}; border-radius: 8px; font-size: 13px; font-weight: bold; color: ${isMascot ? '#1B4F72' : '#7D6608'};">
      Enquiry Source: ${escapeHtml(sourceBadge)} — ${escapeHtml(sourceLabel)}
    </div>
    <h2 style="color: #102C47; margin-top: 0;">New Hospitality Lead Received (${escapeHtml(leadId)})</h2>
    <p><strong>Customer:</strong> ${escapeHtml(customerName)}</p>
    <p><strong>Establishment:</strong> ${escapeHtml(businessName)} (${escapeHtml(location)})</p>
    <p><strong>Email:</strong> ${escapeHtml(leadEmail)} · <strong>Phone:</strong> ${escapeHtml(leadPhone)}</p>
    <p><strong>Channel:</strong> ${escapeHtml(sourceBadge)} (${escapeHtml(sourceLabel)})</p>
    <p><strong>Format:</strong> ${escapeHtml(bottleSize)} · ${escapeHtml(bottleMaterial)} (${escapeHtml(estimatedQuantity)})</p>
    <p><strong>Requirements:</strong> ${escapeHtml(requirements)}</p>
  </div>
</body>
</html>`;
    const text = `New Customer Enquiry (${leadId})\nChannel / Source: ${sourceBadge} — ${sourceLabel}\nCustomer: ${customerName}\nBusiness: ${businessName} (${location})\nEmail: ${leadEmail}\nPhone: ${leadPhone}\nProduct: ${bottleSize} ${bottleMaterial} (${estimatedQuantity})\nRequirements: ${requirements}`;

    const dispatchRes = await sendViaResend(deps, { to: adminRecipient, subject, html, text });
    await recordEmailAuditLog(
      supabaseAdmin,
      {
        recipient: adminRecipient,
        subject,
        body: text,
        template_type: "admin_lead_alert",
        status: dispatchRes.ok ? "Dispatched" : "Failed",
        error_message: dispatchRes.ok ? null : dispatchRes.error,
      },
      nowIso
    );

    if (!dispatchRes.ok) {
      if (claimedConsultationId) {
        await supabaseAdmin
          .from("consultations")
          .update({ admin_alert_sent_at: null })
          .eq("id", claimedConsultationId);
      }
      return jsonResponse({ success: false, error: dispatchRes.error }, dispatchRes.status, corsHeaders);
    }

    return jsonResponse({ success: true, messageId: dispatchRes.messageId }, 200, corsHeaders);
  }

  return jsonResponse({ success: false, error: "Unknown action specified." }, 400, corsHeaders);
}

