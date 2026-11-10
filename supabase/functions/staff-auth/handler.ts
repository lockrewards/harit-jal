// ====================================================================
// HARIT JAL™ (हरित जल) — STAFF-AUTH PURE REQUEST HANDLER
// Separated cleanly from Deno URL bootstrap so TypeScript, oxlint,
// Deno Edge Runtime, and Node.js integration tests execute the exact same logic.
// ====================================================================

export interface StaffAdminFactor {
  id: string;
  factor_type?: string;
  status?: string;
}

export interface StaffAuthUserRecord {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  factors?: StaffAdminFactor[];
}

export interface StaffQueryFilterBuilder {
  eq(column: string, value: unknown): StaffQueryFilterBuilder;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
}

export interface StaffTableHandle {
  select(columns: string): {
    eq(column: string, value: unknown): StaffQueryFilterBuilder;
  };
  upsert(payload: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  update(payload: Record<string, unknown>): {
    eq(column: string, value: unknown): Promise<{ error: { message: string } | null }>;
  };
  insert(payload: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  delete(): {
    eq(column: string, value: unknown): Promise<{ error: { message: string } | null }>;
  };
}

export interface StaffSupabaseAdminClient {
  auth: {
    getUser(jwt: string): Promise<{ data: { user: StaffAuthUserRecord | null }; error: { message: string } | null }>;
    signInWithPassword?: (params: { email?: string; phone?: string; password: string }) => Promise<{
      data: { session: Record<string, unknown> | null; user: StaffAuthUserRecord | null };
      error: { message: string } | null;
    }>;
    admin: {
      createUser(params: Record<string, unknown>): Promise<{ data: { user: StaffAuthUserRecord | null }; error: { message: string } | null }>;
      getUserById(userId: string): Promise<{ data: { user: StaffAuthUserRecord | null }; error: { message: string } | null }>;
      updateUserById(userId: string, params: Record<string, unknown>): Promise<{ data?: { user: StaffAuthUserRecord | null }; error: { message: string } | null }>;
      deleteUser(userId: string): Promise<{ error: { message: string } | null }>;
      mfa?: {
        listFactors(params: { userId: string }): Promise<{ data: { factors: StaffAdminFactor[] } | null; error: { message: string } | null }>;
        deleteFactor(params: { id: string; userId: string }): Promise<{ data?: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
  from(table: string): StaffTableHandle;
}

export interface StaffAuthHandlerDeps {
  createAdminClient: (url: string, serviceRoleKey: string) => StaffSupabaseAdminClient;
  getEnv: (key: string) => string | undefined;
  fetchImpl?: typeof fetch;
}

const DEFAULT_ALLOWED_ORIGINS = [
  "https://haritjal.in",
  "https://www.haritjal.in",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

type CanonicalRole =
  | "admin"
  | "sales_manager"
  | "operations_lead"
  | "label_designer"
  | "staff";

const ROLE_ALIASES: Record<string, CanonicalRole> = {
  super_admin: "admin",
  "super admin": "admin",
  "super-admin": "admin",
  superadmin: "admin",
  admin: "admin",
  staff: "staff",
  sales_manager: "sales_manager",
  "sales manager": "sales_manager",
  "sales-manager": "sales_manager",
  operations_lead: "operations_lead",
  "operations lead": "operations_lead",
  "operations-lead": "operations_lead",
  label_designer: "label_designer",
  "label designer": "label_designer",
  "label-designer": "label_designer",
};

const ASSIGNABLE_STAFF_ROLES = new Set<CanonicalRole>([
  "staff",
  "sales_manager",
  "operations_lead",
  "label_designer",
  "admin",
]);

const ALLOWED_STAFF_PERMISSIONS = new Set<string>([
  "leads",
  "orders",
  "inventory",
  "pricing",
  "analytics",
  "audit_logs",
]);

function normalizeRole(role: unknown): CanonicalRole | null {
  if (typeof role !== "string") return null;
  const cleaned = role.trim().toLowerCase().replace(/\s+/g, " ");
  return ROLE_ALIASES[cleaned] ?? null;
}

function getAllowedOrigins(getEnv: (key: string) => string | undefined): string[] {
  const configured = (getEnv("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]));
}

export function buildCorsHeaders(req: Request, getEnv: (key: string) => string | undefined): Record<string, string> {
  const allowed = getAllowedOrigins(getEnv);
  const requestOrigin = (req.headers.get("origin") || "").trim();
  const matchedOrigin = allowed.find((o) => o === requestOrigin.toLowerCase())
    ? requestOrigin
    : "https://haritjal.in";

  return {
    "Access-Control-Allow-Origin": matchedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(payload: Record<string, unknown>, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64.padEnd(base64.length + padLen, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function generateSecureServerTempPassword(): string {
  const digits = "23456789";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const allChars = digits + uppercase + lowercase;

  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);

  const chars = [
    digits[randomBytes[0] % digits.length],
    uppercase[randomBytes[1] % uppercase.length],
    lowercase[randomBytes[2] % lowercase.length],
  ];

  for (let i = 3; i < 8; i++) {
    chars.push(allChars[randomBytes[i] % allChars.length]);
  }

  const shuffleBytes = new Uint8Array(8);
  crypto.getRandomValues(shuffleBytes);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return `HaritStaff#${chars.join("")}`;
}

function isStrongPermanentPassword(pwd: unknown): pwd is string {
  if (typeof pwd !== "string" || pwd.length < 12) return false;
  return /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export interface NormalizedIndianPhone {
  isValid: boolean;
  e164: string;
  digits10: string;
  formattedDisplay: string;
}

export function normalizeIndianMobileNumber(raw: unknown): NormalizedIndianPhone {
  if (typeof raw !== "string" || !raw.trim()) {
    return { isValid: false, e164: "", digits10: "", formattedDisplay: "" };
  }
  const rawDigits = raw.replace(/\D/g, "");
  let digits10 = "";

  if (rawDigits.length === 10) {
    digits10 = rawDigits;
  } else if (rawDigits.length === 11 && rawDigits.startsWith("0")) {
    digits10 = rawDigits.slice(1);
  } else if (rawDigits.length === 12 && rawDigits.startsWith("91")) {
    digits10 = rawDigits.slice(2);
  } else if (rawDigits.length === 13 && rawDigits.startsWith("091")) {
    digits10 = rawDigits.slice(3);
  } else {
    return { isValid: false, e164: "", digits10: "", formattedDisplay: "" };
  }

  const firstDigit = digits10.charAt(0);
  if (!["6", "7", "8", "9"].includes(firstDigit)) {
    return { isValid: false, e164: "", digits10: "", formattedDisplay: "" };
  }

  return {
    isValid: true,
    e164: `+91${digits10}`,
    digits10,
    formattedDisplay: `+91 ${digits10.slice(0, 5)} ${digits10.slice(5)}`,
  };
}

const phoneLoginRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkPhoneLoginRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = phoneLoginRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    phoneLoginRateLimit.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count++;
  return true;
}

async function handlePhoneLogin(
  body: Record<string, unknown>,
  supabaseAdmin: StaffSupabaseAdminClient,
  corsHeaders: Record<string, string>,
  deps: StaffAuthHandlerDeps
): Promise<Response> {
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  const rawPassword = typeof body.password === "string" ? body.password.trim() : "";
  const rawAccountType = typeof body.accountType === "string" ? body.accountType.trim().toLowerCase() : "";

  if (!rawPhone || !rawPassword || !rawAccountType) {
    return jsonResponse(
      { error: "Mobile number, password, and account type are required." },
      400,
      corsHeaders
    );
  }

  if (rawAccountType !== "admin" && rawAccountType !== "staff" && rawAccountType !== "partner") {
    return jsonResponse(
      { error: "Invalid account type. Expected admin, staff, or partner." },
      400,
      corsHeaders
    );
  }

  const normPhone = normalizeIndianMobileNumber(rawPhone);
  if (!normPhone.isValid) {
    return jsonResponse(
      { error: "Please enter a valid 10-digit Indian mobile number." },
      400,
      corsHeaders
    );
  }

  const rateLimitKey = `${normPhone.digits10}:${rawAccountType}`;
  if (!checkPhoneLoginRateLimit(rateLimitKey)) {
    return jsonResponse(
      { error: "Too many login attempts. Access is temporarily rate-limited. Please try again in 15 minutes." },
      429,
      corsHeaders
    );
  }

  const table = rawAccountType === "partner" ? "customers" : "staff_users";
  const columns = rawAccountType === "partner"
    ? "id, email, phone, owner_name, restaurant_name"
    : "id, name, email, phone, role, is_blocked";
  const candidates: Array<{ id: string; email: string; phone?: string; role?: string; is_blocked?: boolean }> = [];

  const addCandidateRow = (data: unknown) => {
    if (!data) return;
    const rows = Array.isArray(data) ? data : [data];
    for (const r of rows) {
      if (r && typeof r === "object") {
        const row = r as Record<string, unknown>;
        if (typeof row.email === "string" && row.email) {
          candidates.push({
            id: String(row.id || ""),
            email: String(row.email).trim().toLowerCase(),
            phone: typeof row.phone === "string" ? row.phone : undefined,
            role: typeof row.role === "string" ? row.role : (rawAccountType === "partner" ? "customer" : undefined),
            is_blocked: Boolean(row.is_blocked),
          });
        }
      }
    }
  };

  // Test standard phone formats (E.164, formatted display with spaces, 10-digit national, single-space +91, with 0)
  const phoneFormats = [
    normPhone.e164,
    normPhone.formattedDisplay,
    normPhone.digits10,
    `+91 ${normPhone.digits10}`,
    `0${normPhone.digits10}`,
  ];

  for (const fmt of phoneFormats) {
    if (candidates.length > 0) break;
    try {
      const q = supabaseAdmin.from(table).select(columns).eq("phone", fmt);
      if (q && typeof (q as { maybeSingle?: () => Promise<{ data: Record<string, unknown> | null }> }).maybeSingle === "function") {
        const res = await (q as { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> }).maybeSingle();
        if (res?.data) addCandidateRow(res.data);
      } else {
        const res = await (q as unknown as Promise<{ data: unknown }>);
        if (res?.data) addCandidateRow(res.data);
      }
    } catch {}
  }

  // Deduplicate matched records by ID
  const uniqueCandidates = Array.from(new Map(candidates.map((c) => [c.id, c])).values());

  if (uniqueCandidates.length > 1) {
    return jsonResponse(
      { error: "Multiple accounts match this mobile number. Please sign in using your registered email address." },
      400,
      corsHeaders
    );
  }

  if (uniqueCandidates.length === 0) {
    // Constant-time generic error to prevent account enumeration
    return jsonResponse(
      { error: "Invalid mobile number or password. Please verify your credentials." },
      401,
      corsHeaders
    );
  }

  const matched = uniqueCandidates[0];

  if (matched.is_blocked === true) {
    return jsonResponse(
      { error: "Account has been blocked or suspended by Administrator. Access is revoked." },
      403,
      corsHeaders
    );
  }

  // Role compatibility enforcement
  if (rawAccountType === "admin") {
    const canonRole = normalizeRole(matched.role);
    if (canonRole !== "admin") {
      return jsonResponse(
        { error: "Invalid mobile number or password. Please verify your credentials." },
        401,
        corsHeaders
      );
    }
  } else if (rawAccountType === "staff") {
    const canonRole = normalizeRole(matched.role);
    if (!canonRole || canonRole === "admin") {
      return jsonResponse(
        { error: "Invalid mobile number or password. Please verify your credentials." },
        401,
        corsHeaders
      );
    }
  }

  const targetEmail = (matched.email || "").trim().toLowerCase();
  if (!targetEmail || !isValidEmail(targetEmail)) {
    return jsonResponse(
      { error: "Account record has an invalid email configuration. Please contact administrator." },
      500,
      corsHeaders
    );
  }

  let authSession: Record<string, unknown> | null = null;
  let authUser: Record<string, unknown> | null = null;

  if (typeof supabaseAdmin.auth?.signInWithPassword === "function") {
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: targetEmail,
      password: rawPassword,
    });
    if (authError || !authData?.session) {
      return jsonResponse(
        { error: "Invalid mobile number or password. Please verify your credentials." },
        401,
        corsHeaders
      );
    }
    authSession = authData.session;
    authUser = (authData.user as unknown as Record<string, unknown>) || null;
  } else {
    const supabaseUrl = deps.getEnv("SUPABASE_URL");
    const serviceRoleKey = deps.getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = deps.getEnv("SUPABASE_ANON_KEY") || serviceRoleKey;

    const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
    const authFetch = typeof deps.fetchImpl === "function" ? deps.fetchImpl : fetch;
    const authRes = await authFetch(authUrl, {
      method: "POST",
      headers: {
        "apikey": anonKey || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: targetEmail, password: rawPassword }),
    });

    if (!authRes.ok) {
      return jsonResponse(
        { error: "Invalid mobile number or password. Please verify your credentials." },
        401,
        corsHeaders
      );
    }
    const resData = (await authRes.json()) as Record<string, unknown>;
    authSession = resData;
    authUser = (resData.user as Record<string, unknown>) || null;
  }

  return jsonResponse(
    {
      success: true,
      session: authSession,
      user: authUser,
      accountType: rawAccountType,
    },
    200,
    corsHeaders
  );
}

export async function handleStaffAuthRequest(req: Request, deps: StaffAuthHandlerDeps): Promise<Response> {
  const corsHeaders = buildCorsHeaders(req, deps.getEnv);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405, corsHeaders);
  }

  const supabaseUrl = deps.getEnv("SUPABASE_URL");
  const serviceRoleKey = deps.getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Server configuration missing: SUPABASE_SERVICE_ROLE_KEY." }, 500, corsHeaders);
  }

  const supabaseAdmin = deps.createAdminClient(supabaseUrl, serviceRoleKey);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action.trim() : "";

  // -------------------------------------------------------------------------
  // UNRESTRICTED / PUBLIC ACTION: phone_login
  // Allows unauthenticated clients to sign in using registered mobile + password
  // Resolves mobile number to identity on the server without ever exposing email to client
  // -------------------------------------------------------------------------
  if (action === "phone_login") {
    return handlePhoneLogin(body, supabaseAdmin, corsHeaders, deps);
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing authorization bearer token." }, 401, corsHeaders);
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch ? bearerMatch[1].trim() : "";
  if (!token) {
    return jsonResponse({ error: "Invalid authorization header format. Expected Bearer token." }, 401, corsHeaders);
  }

  const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerUser) {
    return jsonResponse({ error: "Unauthorized: Invalid or expired caller token." }, 401, corsHeaders);
  }

  // Dual-vector block check on caller (app_metadata + live public.staff_users)
  if (callerUser.app_metadata?.is_blocked === true) {
    return jsonResponse({ error: "Forbidden: Account has been blocked by Administrator. Access is revoked." }, 403, corsHeaders);
  }

  let callerDbRowFound = false;
  let callerDbBlocked = false;
  let callerDbRole: string | undefined;
  let callerDbRootSuperAdmin = false;
  let callerDbPermissions: string[] = [];
  let callerDbStaffId: string = callerUser.id;
  try {
    // Option A Hardened Identity Resolution (Rules A, B, C, D)
    let callerStaffRow: { id?: string; is_blocked?: boolean; role?: string; is_root_super_admin?: boolean; permissions?: unknown[]; auth_user_id?: string } | null = null;
    
    // Query both identity vectors in parallel and check errors
    const [{ data: byAuthId, error: errAuthId }, { data: byId, error: errId }] = await Promise.all([
      supabaseAdmin
        .from("staff_users")
        .select("id, is_blocked, role, is_root_super_admin, permissions, auth_user_id")
        .eq("auth_user_id", callerUser.id)
        .maybeSingle(),
      supabaseAdmin
        .from("staff_users")
        .select("id, is_blocked, role, is_root_super_admin, permissions, auth_user_id")
        .eq("id", callerUser.id)
        .maybeSingle(),
    ]);

    // Check errors from both queries: if either fails, reject authentication (fail-closed)
    if (errAuthId || errId) {
      return jsonResponse({
        error: "Forbidden: Failed to verify staff identity due to database query error.",
      }, 403, corsHeaders);
    }

    // Rule D: Detect ambiguous matches across both identity vectors
    if (byAuthId && byId && byAuthId.id !== byId.id) {
      return jsonResponse({
        error: "Forbidden: Ambiguous identity mapping detected across staff records. Access revoked.",
      }, 403, corsHeaders);
    }

    if (byAuthId) {
      // Rule A: Exact match on auth_user_id = authenticated GoTrue UUID
      callerStaffRow = byAuthId;
    } else if (byId) {
      // Rule B & C: Legacy fallback permitted ONLY when matched row has auth_user_id IS NULL
      if (byId.auth_user_id != null && byId.auth_user_id !== callerUser.id) {
        return jsonResponse({
          error: "Forbidden: Identity mapping conflict: staff record is bound to another authenticated identity.",
        }, 403, corsHeaders);
      }
      callerStaffRow = byId;
    }

    if (callerStaffRow) {
      callerDbRowFound = true;
      if (typeof callerStaffRow.id === "string") {
        callerDbStaffId = callerStaffRow.id;
      }
      callerDbBlocked = callerStaffRow.is_blocked === true;
      if (typeof callerStaffRow.role === "string") {
        callerDbRole = callerStaffRow.role;
      }
      callerDbRootSuperAdmin = callerStaffRow.is_root_super_admin === true;
      if (Array.isArray(callerStaffRow.permissions)) {
        callerDbPermissions = callerStaffRow.permissions.filter((p): p is string => typeof p === "string");
      }
    }
  } catch {
    // Database query failed or table not found
  }

  if (callerDbBlocked) {
    return jsonResponse({ error: "Forbidden: Account has been blocked by Administrator. Access is revoked." }, 403, corsHeaders);
  }

  // Strict server-managed role resolution (NEVER evaluate user_metadata.role)
  const callerCanonicalRole = normalizeRole(callerUser.app_metadata?.role ?? callerDbRole);
  const isCallerAnyStaff = callerCanonicalRole !== null;

  if (!isCallerAnyStaff) {
    return jsonResponse({
      error: "Forbidden: Only authorized staff and administrators can access this service.",
    }, 403, corsHeaders);
  }

  const isCallerAdmin = callerCanonicalRole === "admin";
  const callerJwtRootClaim = callerUser.app_metadata?.is_root_super_admin === true;

  // Authoritative Root Authorization with Strict Dual-Vector Database Parity
  // Strictly requires:
  // 1. Authoritative staff record present in database (callerDbRowFound === true)
  // 2. Database account is not blocked (callerDbBlocked === false)
  // 3. Database is_root_super_admin is exactly true (callerDbRootSuperAdmin === true)
  // 4. Cryptographically validated JWT app_metadata root claim matches database state (callerJwtRootClaim === true)
  // 5. Canonical business role is admin (isCallerAdmin === true)
  const isCallerRootAdmin = Boolean(
    callerDbRowFound &&
    !callerDbBlocked &&
    callerDbRootSuperAdmin === true &&
    callerJwtRootClaim === true &&
    isCallerAdmin
  );

  const effectiveCallerPermissions: string[] = callerDbPermissions.length > 0
    ? callerDbPermissions
    : Array.isArray(callerUser.app_metadata?.permissions)
    ? (callerUser.app_metadata.permissions.filter((p): p is string => typeof p === "string"))
    : [];

  const callerHasStaffPermission = effectiveCallerPermissions.includes("staff");

  // Extract AAL claim from cryptographically validated GoTrue JWT
  const payload = decodeJwtPayload(token);
  const callerAal = typeof payload?.aal === "string" ? payload.aal : "aal1";

  const assertStaffGovernanceAal2 = (): Response | null => {
    if (callerAal !== "aal2") {
      return jsonResponse({
        error: "MFA Required: Privileged operations require Authenticator Assurance Level 2 (AAL2). Please complete Google Authenticator verification.",
      }, 403, corsHeaders);
    }
    const canManage = isCallerRootAdmin || (isCallerAdmin && callerHasStaffPermission);
    if (!canManage) {
      return jsonResponse({
        error: "Forbidden: You do not have permission to manage staff members.",
      }, 403, corsHeaders);
    }
    return null;
  };

  const assertRootAdminAal2 = (): Response | null => {
    if (callerAal !== "aal2") {
      return jsonResponse({
        error: "MFA Required: Privileged operations require Authenticator Assurance Level 2 (AAL2). Please complete Google Authenticator verification.",
      }, 403, corsHeaders);
    }
    if (!isCallerAdmin || !isCallerRootAdmin) {
      return jsonResponse({
        error: "Forbidden: Only the Root Administrator can perform this action.",
      }, 403, corsHeaders);
    }
    return null;
  };

  const verifyOwnedTotpFactorAtAal2 = async (factorId: unknown): Promise<Response | null> => {
    if (typeof factorId !== "string" || !factorId.trim()) {
      return jsonResponse({
        error: "factorId is strictly mandatory for Supabase Auth Native MFA verification.",
      }, 400, corsHeaders);
    }
    if (callerAal !== "aal2") {
      return jsonResponse({
        error: "MFA Required: Complete Google Authenticator verification in your browser session (AAL2) before finishing setup.",
      }, 403, corsHeaders);
    }

    const { data: verifiedUserRes, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(callerUser.id);
    if (lookupError || !verifiedUserRes?.user) {
      return jsonResponse({ error: "Failed to verify MFA factor ownership with GoTrue." }, 500, corsHeaders);
    }

    const factors = verifiedUserRes.user.factors || [];
    const matchingFactor = factors.find(
      (f) => f.id === factorId.trim() && f.factor_type === "totp" && f.status === "verified"
    );
    if (!matchingFactor) {
      return jsonResponse({
        error: "Forbidden: Supplied TOTP factor is unverified or does not belong to the authenticated staff member.",
      }, 403, corsHeaders);
    }
    return null;
  };

  try {
    const snapshotStaffRow = async (userId: string): Promise<Record<string, unknown> | null> => {
      try {
        const [{ data: byAuthId, error: errAuthId }, { data: byId, error: errId }] = await Promise.all([
          supabaseAdmin
            .from("staff_users")
            .select(
              "id, name, email, phone, designation, role, permissions, is_blocked, totp_enabled, is_first_login, is_root_super_admin, email_phone_changes_count, created_at, updated_at, auth_user_id"
            )
            .eq("auth_user_id", userId)
            .maybeSingle(),
          supabaseAdmin
            .from("staff_users")
            .select(
              "id, name, email, phone, designation, role, permissions, is_blocked, totp_enabled, is_first_login, is_root_super_admin, email_phone_changes_count, created_at, updated_at, auth_user_id"
            )
            .eq("id", userId)
            .maybeSingle(),
        ]);

        if (errAuthId || errId) {
          return null;
        }

        // Rule D: Cross-vector ambiguity
        if (byAuthId && byId && byAuthId.id !== byId.id) {
          return null;
        }

        if (byAuthId) return byAuthId;
        if (byId) {
          // Rule B & C: Legacy fallback permitted ONLY when matched row has auth_user_id IS NULL
          if (byId.auth_user_id != null && byId.auth_user_id !== userId) {
            return null;
          }
          return byId;
        }
        return null;
      } catch {
        return null;
      }
    };

    const deleteAllUserFactors = async (
      targetUserId: string,
      fallbackFactors: StaffAdminFactor[] = []
    ): Promise<{ count: number; error: string | null }> => {
      let factors: StaffAdminFactor[] = fallbackFactors;
      if (supabaseAdmin.auth.admin.mfa?.listFactors) {
        const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: targetUserId });
        if (error) {
          return { count: 0, error: `Failed to list MFA factors: ${error.message}` };
        }
        factors = data?.factors || [];
      } else {
        const { data: userLookup } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
        if (userLookup?.user?.factors) {
          factors = userLookup.user.factors;
        }
      }

      if (factors.length === 0) {
        return { count: 0, error: null };
      }

      for (const factor of factors) {
        if (!factor?.id) continue;
        if (supabaseAdmin.auth.admin.mfa?.deleteFactor) {
          const { error: delErr } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
            id: factor.id,
            userId: targetUserId,
          });
          if (delErr) {
            return { count: 0, error: `Failed to delete MFA factor ${factor.id}: ${delErr.message}` };
          }
        } else {
          const restRes = await fetch(
            `${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}/factors/${encodeURIComponent(factor.id)}`,
            {
              method: "DELETE",
              headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
              },
            }
          );
          if (!restRes.ok) {
            const msg = await restRes.text().catch(() => restRes.statusText);
            return { count: 0, error: `Failed to delete MFA factor ${factor.id} (${restRes.status}): ${msg}` };
          }
        }
      }

      return { count: factors.length, error: null };
    };

    // -------------------------------------------------------------------------
    // 1. ACTION: CREATE_STAFF_USER (Staff Governance - AAL2 Enforced)
    // -------------------------------------------------------------------------
    if (action === "create_staff_user") {
      const authGateError = assertStaffGovernanceAal2();
      if (authGateError) return authGateError;

      const {
        name,
        email,
        phone,
        designation,
        role = "staff",
        permissions = ["leads", "orders"],
      } = body;

      if (
        typeof name !== "string" || !name.trim() ||
        typeof email !== "string" || !email.trim() ||
        typeof phone !== "string" || !phone.trim() ||
        typeof designation !== "string" || !designation.trim()
      ) {
        return jsonResponse({ error: "Name, Email, Mobile number, and Designation are strictly mandatory." }, 400, corsHeaders);
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim();
      const cleanName = name.trim();
      const cleanDesig = designation.trim();

      if (!isValidEmail(cleanEmail)) {
        return jsonResponse({ error: "Please provide a valid corporate email address." }, 400, corsHeaders);
      }
      if (!isValidPhone(cleanPhone)) {
        return jsonResponse({ error: "Please provide a valid 10-15 digit mobile number." }, 400, corsHeaders);
      }

      const canonicalTargetRole = normalizeRole(role);
      if (!canonicalTargetRole || !ASSIGNABLE_STAFF_ROLES.has(canonicalTargetRole)) {
        return jsonResponse({
          error: "Invalid staff role specified.",
        }, 400, corsHeaders);
      }

      if (canonicalTargetRole === "admin") {
        const rootGateError = assertRootAdminAal2();
        if (rootGateError) return rootGateError;
      }

      if (!Array.isArray(permissions)) {
        return jsonResponse({ error: "Permissions must be a valid array of workspace keys." }, 400, corsHeaders);
      }

      const sanitizedPermissions = Array.from(
        new Set(
          permissions
            .filter((p): p is string => typeof p === "string")
            .map((p) => p.trim().toLowerCase())
            .filter((p) => ALLOWED_STAFF_PERMISSIONS.has(p))
        )
      );
      if (sanitizedPermissions.length === 0) {
        return jsonResponse({ error: "Select at least one valid workspace permission." }, 400, corsHeaders);
      }

      if (sanitizedPermissions.includes("audit_logs")) {
        const rootGateError = assertRootAdminAal2();
        if (rootGateError) return rootGateError;
      }
      const effectivePermissions = sanitizedPermissions;

      const tempPassword = generateSecureServerTempPassword();
      const expiresAt = Date.now() + 72 * 60 * 60 * 1000;

      const { data: createdAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: tempPassword,
        email_confirm: true,
        phone: cleanPhone,
        user_metadata: {
          name: cleanName,
          designation: cleanDesig,
        },
        app_metadata: {
          role: canonicalTargetRole,
          permissions: effectivePermissions,
          is_first_login: true,
          temporary_password_expires_at: expiresAt,
          is_blocked: false,
          totp_enabled: false,
          is_root_super_admin: false,
        },
      });

      if (createError || !createdAuth?.user?.id) {
        return jsonResponse({
          error: `Failed to create staff account: ${createError?.message || "Unknown auth creation failure"}`,
        }, 400, corsHeaders);
      }

      const newUserId = createdAuth.user.id;
      const nowIso = new Date().toISOString();

      const { error: upsertError } = await supabaseAdmin.from("staff_users").upsert({
        id: newUserId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        designation: cleanDesig,
        role: canonicalTargetRole,
        permissions: effectivePermissions,
        is_blocked: false,
        totp_enabled: false,
        is_first_login: true,
        is_root_super_admin: false,
        created_at: nowIso,
        updated_at: nowIso,
      });

      if (upsertError) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return jsonResponse({
          error: `Failed to persist staff directory profile (auth user rolled back): ${upsertError.message}`,
        }, 500, corsHeaders);
      }

      const { error: auditError } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "CREATE_STAFF",
        target_user_id: newUserId,
        target_user_email: cleanEmail,
        performed_by: callerUser.email || callerUser.id,
        details: `Created staff member ${cleanName} (${canonicalTargetRole}, ${cleanDesig}) with single-use 72h credentials.`,
        created_at: nowIso,
      });

      if (auditError) {
        await supabaseAdmin.from("staff_users").delete().eq("id", newUserId);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return jsonResponse({
          error: `Staff provisioning rolled back because audit log persistence failed: ${auditError.message}`,
        }, 500, corsHeaders);
      }

      return jsonResponse({
        success: true,
        staff: {
          id: newUserId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          designation: cleanDesig,
          role: canonicalTargetRole,
          permissions: effectivePermissions,
          temporaryPassword: tempPassword,
          expiresAt,
          isFirstLogin: true,
          totpEnabled: false,
        },
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------------------
    // 2. ACTION: COMPLETE_STAFF_FIRST_TIME_SETUP (Authenticated First-Login Staff)
    // Browser must already have executed supabase.auth.mfa.challengeAndVerify (AAL2).
    // -------------------------------------------------------------------------
    if (action === "complete_staff_first_time_setup") {
      if (!isCallerAnyStaff) {
        return jsonResponse({ error: "Forbidden: Only authorized staff accounts can complete first-time setup." }, 403, corsHeaders);
      }

      if (callerUser.app_metadata?.is_first_login !== true) {
        return jsonResponse({ error: "Forbidden: Account has already completed first-time onboarding." }, 403, corsHeaders);
      }

      const { newPassword, factorId } = body;

      if (!isStrongPermanentPassword(newPassword)) {
        return jsonResponse({
          error: "Permanent password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, and one number.",
        }, 400, corsHeaders);
      }

      const prevAppMetadata = { ...(callerUser.app_metadata || {}) };
      const prevStaffRow = await snapshotStaffRow(callerUser.id);
      const nowIso = new Date().toISOString();

      const tempExpiresAtRaw = callerUser.app_metadata?.temporary_password_expires_at;
      const tempExpiresAt = typeof tempExpiresAtRaw === "number" ? tempExpiresAtRaw : Number(tempExpiresAtRaw || 0);
      if (callerUser.app_metadata?.invitation_expired === true || (tempExpiresAt > 0 && Date.now() > tempExpiresAt)) {
        const { error: dbLockErr } = await supabaseAdmin.from("staff_users").update({
          is_blocked: true,
          updated_at: nowIso,
        }).eq("id", callerUser.id);
        if (dbLockErr) {
          return jsonResponse({ error: `Failed to record expired invitation lock: ${dbLockErr.message}` }, 500, corsHeaders);
        }

        const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(callerUser.id, {
          ban_duration: "876000h",
          app_metadata: {
            ...prevAppMetadata,
            is_blocked: true,
            invitation_expired: true,
          },
        });
        if (banErr) {
          await supabaseAdmin.from("staff_users").update({
            is_blocked: prevStaffRow ? Boolean(prevStaffRow.is_blocked) : false,
            updated_at: nowIso,
          }).eq("id", callerUser.id);
          return jsonResponse({ error: `Failed to lock expired invitation: ${banErr.message}` }, 500, corsHeaders);
        }

        return jsonResponse({
          error: "Temporary password has expired (72h limit). Please contact Super Admin to issue a new invitation.",
        }, 403, corsHeaders);
      }

      const mfaVerifyError = await verifyOwnedTotpFactorAtAal2(factorId);
      if (mfaVerifyError) return mfaVerifyError;

      // Reversible DB update BEFORE GoTrue credential mutation
      const { error: staffUpdateError } = await supabaseAdmin.from("staff_users").update({
        is_first_login: false,
        totp_enabled: true,
        updated_at: nowIso,
      }).eq("id", callerUser.id);

      if (staffUpdateError) {
        return jsonResponse({
          error: `Failed to update staff onboarding profile: ${staffUpdateError.message}`,
        }, 500, corsHeaders);
      }

      const { error: pwdError } = await supabaseAdmin.auth.admin.updateUserById(callerUser.id, {
        password: newPassword,
        app_metadata: {
          ...prevAppMetadata,
          is_first_login: false,
          temporary_password_expires_at: null,
          totp_enabled: true,
        },
      });

      if (pwdError) {
        await supabaseAdmin.from("staff_users").update({
          is_first_login: prevStaffRow ? Boolean(prevStaffRow.is_first_login) : true,
          totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : false,
          updated_at: nowIso,
        }).eq("id", callerUser.id);
        return jsonResponse({ error: `Failed to set permanent password (profile rolled back): ${pwdError.message}` }, 500, corsHeaders);
      }

      const { error: auditError } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "FIRST_LOGIN_COMPLETE",
        target_user_id: callerUser.id,
        target_user_email: callerUser.email || callerUser.id,
        performed_by: callerUser.email || callerUser.id,
        details: "Staff member completed mandatory first-time password setup and verified Supabase Native MFA (TOTP) at AAL2.",
        created_at: nowIso,
      });

      if (auditError) {
        await supabaseAdmin.from("staff_users").update({
          is_first_login: prevStaffRow ? Boolean(prevStaffRow.is_first_login) : true,
          totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : false,
          updated_at: nowIso,
        }).eq("id", callerUser.id);
        await supabaseAdmin.auth.admin.updateUserById(callerUser.id, {
          app_metadata: prevAppMetadata,
        });
        return jsonResponse({
          error: `Onboarding rolled back because audit log persistence failed: ${auditError.message}`,
        }, 500, corsHeaders);
      }

      return jsonResponse({
        success: true,
        message: "First-time setup completed successfully. Permanent credentials and Native MFA active at AAL2.",
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------------------
    // 3. ACTION: COMPLETE_MFA_ENROLLMENT (Existing Staff / Root Super Admin MFA Bootstrap)
    // Rejects un-onboarded first-login / expired accounts (HIGH-H5-04).
    // Verifies browser session reached AAL2 & owns verified GoTrue factor before stamping totp_enabled=true.
    // -------------------------------------------------------------------------
    if (action === "complete_mfa_enrollment") {
      if (!isCallerAnyStaff) {
        return jsonResponse({ error: "Forbidden: Only authorized staff/admin accounts can activate staff MFA." }, 403, corsHeaders);
      }

      const prevAppMetadata = { ...(callerUser.app_metadata || {}) };
      const prevStaffRow = await snapshotStaffRow(callerUser.id);
      const nowIso = new Date().toISOString();

      if (prevAppMetadata.is_first_login === true || prevStaffRow?.is_first_login === true) {
        return jsonResponse({
          error: "Forbidden: First-login invited staff must complete password and MFA onboarding via complete_staff_first_time_setup.",
        }, 403, corsHeaders);
      }

      const tempExpiresAtRaw = prevAppMetadata.temporary_password_expires_at;
      const tempExpiresAt = typeof tempExpiresAtRaw === "number" ? tempExpiresAtRaw : Number(tempExpiresAtRaw || 0);
      if (prevAppMetadata.invitation_expired === true) {
        return jsonResponse({
          error: "Temporary invitation has expired. Please contact Super Admin to issue a new invitation.",
        }, 403, corsHeaders);
      }
      if (tempExpiresAt > 0 && Date.now() > tempExpiresAt) {
        await supabaseAdmin.from("staff_users").update({
          is_blocked: true,
          updated_at: nowIso,
        }).eq("id", callerUser.id);
        await supabaseAdmin.auth.admin.updateUserById(callerUser.id, {
          ban_duration: "876000h",
          app_metadata: {
            ...prevAppMetadata,
            is_blocked: true,
            invitation_expired: true,
          },
        });
        return jsonResponse({
          error: "Temporary password has expired (72h limit). Please contact Super Admin to issue a new invitation.",
        }, 403, corsHeaders);
      }

      const mfaVerifyError = await verifyOwnedTotpFactorAtAal2(body.factorId);
      if (mfaVerifyError) return mfaVerifyError;

      // Reversible DB update BEFORE GoTrue metadata mutation
      const { error: staffUpdateErr } = await supabaseAdmin.from("staff_users").update({
        totp_enabled: true,
        updated_at: nowIso,
      }).eq("id", callerUser.id);

      if (staffUpdateErr) {
        return jsonResponse({
          error: `Failed to update staff MFA status: ${staffUpdateErr.message}`,
        }, 500, corsHeaders);
      }

      const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(callerUser.id, {
        app_metadata: {
          ...prevAppMetadata,
          totp_enabled: true,
        },
      });
      if (metaErr) {
        await supabaseAdmin.from("staff_users").update({
          totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : false,
          updated_at: nowIso,
        }).eq("id", callerUser.id);
        return jsonResponse({ error: `Failed to activate server MFA metadata (profile rolled back): ${metaErr.message}` }, 500, corsHeaders);
      }

      const { error: auditErr } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "MFA_ENROLLMENT_COMPLETE",
        target_user_id: callerUser.id,
        target_user_email: callerUser.email || callerUser.id,
        performed_by: callerUser.email || callerUser.id,
        details: "Verified Native GoTrue TOTP factor enrolled and session elevated to AAL2.",
        created_at: nowIso,
      });

      if (auditErr) {
        await supabaseAdmin.from("staff_users").update({
          totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : false,
          updated_at: nowIso,
        }).eq("id", callerUser.id);
        await supabaseAdmin.auth.admin.updateUserById(callerUser.id, {
          app_metadata: prevAppMetadata,
        });
        return jsonResponse({
          error: `MFA completion rolled back because audit log write failed: ${auditErr.message}`,
        }, 500, corsHeaders);
      }

      return jsonResponse({
        success: true,
        message: "Native GoTrue MFA activated and verified at AAL2.",
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------------------
    // 4. ACTION: BLOCK_STAFF_USER (Staff Governance - AAL2 Enforced)
    // -------------------------------------------------------------------------
    if (action === "block_staff_user") {
      const authGateError = assertStaffGovernanceAal2();
      if (authGateError) return authGateError;

      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
      if (!targetUserId) {
        return jsonResponse({ error: "Target staff user ID is required." }, 400, corsHeaders);
      }

      if (targetUserId === callerUser.id) {
        return jsonResponse({ error: "You cannot block your own currently active account." }, 400, corsHeaders);
      }

      const { data: targetUserRes, error: getError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (getError || !targetUserRes?.user) {
        return jsonResponse({ error: "Staff member not found." }, 404, corsHeaders);
      }

      const prevStaffRow = await snapshotStaffRow(targetUserId);
      const dbRootFlag = prevStaffRow?.is_root_super_admin === true;

      if (targetUserRes.user.app_metadata?.is_root_super_admin === true || dbRootFlag) {
        return jsonResponse({ error: "The Root Super Admin account cannot be blocked." }, 400, corsHeaders);
      }

      const targetRole = normalizeRole(targetUserRes.user.app_metadata?.role ?? prevStaffRow?.role);
      if (targetRole === "admin") {
        const rootGateError = assertRootAdminAal2();
        if (rootGateError) return rootGateError;
      }

      const prevAppMetadata = { ...(targetUserRes.user.app_metadata || {}) };
      const nowIso = new Date().toISOString();

      // Reversible DB update BEFORE GoTrue ban
      const { error: dbBlockError } = await supabaseAdmin.from("staff_users").update({
        is_blocked: true,
        updated_at: nowIso,
      }).eq("id", targetUserId);
      if (dbBlockError) {
        return jsonResponse({
          error: `Failed to record block in staff_users: ${dbBlockError.message}`,
        }, 500, corsHeaders);
      }

      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "876000h",
        app_metadata: {
          ...prevAppMetadata,
          is_blocked: true,
        },
      });
      if (banError) {
        await supabaseAdmin.from("staff_users").update({
          is_blocked: prevStaffRow ? Boolean(prevStaffRow.is_blocked) : false,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        return jsonResponse({ error: `Failed to block user in Supabase Auth (DB rolled back): ${banError.message}` }, 500, corsHeaders);
      }

      const targetEmail = (targetUserRes.user.email || targetUserId).toLowerCase();
      const { error: auditError } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "BLOCK_STAFF",
        target_user_id: targetUserId,
        target_user_email: targetEmail,
        performed_by: callerUser.email || callerUser.id,
        details: `Blocked staff account ${targetEmail}. Banned in GoTrue and blocked in database RLS.`,
        created_at: nowIso,
      });
      if (auditError) {
        await supabaseAdmin.from("staff_users").update({
          is_blocked: prevStaffRow ? Boolean(prevStaffRow.is_blocked) : false,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          ban_duration: prevAppMetadata.is_blocked === true ? "876000h" : "none",
          app_metadata: prevAppMetadata,
        });
        return jsonResponse({
          error: `Block action rolled back because audit log persistence failed: ${auditError.message}`,
        }, 500, corsHeaders);
      }

      return jsonResponse({ success: true, message: "Staff account successfully blocked and access revoked." }, 200, corsHeaders);
    }

    // -------------------------------------------------------------------------
    // 5. ACTION: UNBLOCK_STAFF_USER (Staff Governance - AAL2 Enforced)
    // -------------------------------------------------------------------------
    if (action === "unblock_staff_user") {
      const authGateError = assertStaffGovernanceAal2();
      if (authGateError) return authGateError;

      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
      if (!targetUserId) {
        return jsonResponse({ error: "Target staff user ID is required." }, 400, corsHeaders);
      }

      const { data: targetUserRes, error: getError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (getError || !targetUserRes?.user) {
        return jsonResponse({ error: "Staff member not found." }, 404, corsHeaders);
      }

      const prevStaffRow = await snapshotStaffRow(targetUserId);
      const targetRole = normalizeRole(targetUserRes.user.app_metadata?.role ?? prevStaffRow?.role);
      if (targetRole === "admin") {
        const rootGateError = assertRootAdminAal2();
        if (rootGateError) return rootGateError;
      }

      const prevAppMetadata = { ...(targetUserRes.user.app_metadata || {}) };
      const nowIso = new Date().toISOString();

      // Reversible DB update BEFORE GoTrue unban
      const { error: dbUnblockError } = await supabaseAdmin.from("staff_users").update({
        is_blocked: false,
        updated_at: nowIso,
      }).eq("id", targetUserId);
      if (dbUnblockError) {
        return jsonResponse({
          error: `Failed to unblock user in staff_users: ${dbUnblockError.message}`,
        }, 500, corsHeaders);
      }

      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
        app_metadata: {
          ...prevAppMetadata,
          is_blocked: false,
        },
      });
      if (unbanError) {
        await supabaseAdmin.from("staff_users").update({
          is_blocked: prevStaffRow ? Boolean(prevStaffRow.is_blocked) : true,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        return jsonResponse({ error: `Failed to unblock user in Supabase Auth (DB rolled back): ${unbanError.message}` }, 500, corsHeaders);
      }

      const targetEmail = (targetUserRes.user.email || targetUserId).toLowerCase();
      const { error: auditError } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "UNBLOCK_STAFF",
        target_user_id: targetUserId,
        target_user_email: targetEmail,
        performed_by: callerUser.email || callerUser.id,
        details: `Unblocked staff account ${targetEmail}. Authentication access restored.`,
        created_at: nowIso,
      });
      if (auditError) {
        await supabaseAdmin.from("staff_users").update({
          is_blocked: prevStaffRow ? Boolean(prevStaffRow.is_blocked) : true,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          ban_duration: prevAppMetadata.is_blocked === true ? "876000h" : "none",
          app_metadata: prevAppMetadata,
        });
        return jsonResponse({
          error: `Unblock action rolled back because audit log persistence failed: ${auditError.message}`,
        }, 500, corsHeaders);
      }

      return jsonResponse({ success: true, message: "Staff account successfully unblocked." }, 200, corsHeaders);
    }

    // -------------------------------------------------------------------------
    // 6. ACTION: DELETE_STAFF_USER (Staff Governance - AAL2 Enforced)
    // Deletes public.staff_users BEFORE auth.users so DB triggers (Root immunity)
    // run cleanly while historical orders/consultations survive via ON DELETE SET NULL.
    // Compensating restore re-inserts snapshot if auth.admin.deleteUser fails.
    // -------------------------------------------------------------------------
    if (action === "delete_staff_user") {
      const authGateError = assertStaffGovernanceAal2();
      if (authGateError) return authGateError;

      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
      if (!targetUserId) {
        return jsonResponse({ error: "Target staff user ID is required." }, 400, corsHeaders);
      }

      if (targetUserId === callerUser.id) {
        return jsonResponse({ error: "You cannot delete your own active account." }, 400, corsHeaders);
      }

      const { data: targetUserRes, error: getError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (getError || !targetUserRes?.user) {
        return jsonResponse({ error: "Staff member not found." }, 404, corsHeaders);
      }

      const prevStaffRow = await snapshotStaffRow(targetUserId);
      const dbRootFlag = prevStaffRow?.is_root_super_admin === true;
      const dbEmail = typeof prevStaffRow?.email === "string" ? prevStaffRow.email : undefined;

      if (targetUserRes.user.app_metadata?.is_root_super_admin === true || dbRootFlag) {
        return jsonResponse({ error: "The Root Super Admin account cannot be deleted." }, 400, corsHeaders);
      }

      const targetRole = normalizeRole(targetUserRes.user.app_metadata?.role ?? prevStaffRow?.role);
      if (targetRole === "admin") {
        const rootGateError = assertRootAdminAal2();
        if (rootGateError) return rootGateError;
      }

      const targetEmail = (targetUserRes.user.email || dbEmail || targetUserId).toLowerCase();

      const { error: dbDeleteError } = await supabaseAdmin.from("staff_users").delete().eq("id", targetUserId);
      if (dbDeleteError) {
        return jsonResponse({ error: `Failed to delete staff directory profile: ${dbDeleteError.message}` }, 500, corsHeaders);
      }

      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
      if (authDeleteError) {
        if (prevStaffRow) {
          await supabaseAdmin.from("staff_users").upsert(prevStaffRow);
        }
        return jsonResponse({
          error: `Failed to delete staff auth identity (directory row restored): ${authDeleteError.message}`,
        }, 500, corsHeaders);
      }

      const { error: auditError } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "DELETE_STAFF",
        target_user_id: targetUserId,
        target_user_email: targetEmail,
        performed_by: callerUser.email || callerUser.id,
        details: `Deleted staff member ${targetEmail}. Authentication credentials deleted; historical records preserved.`,
        created_at: new Date().toISOString(),
      });
      if (auditError) {
        return jsonResponse({ error: `Staff deleted, but failed to write audit log: ${auditError.message}` }, 500, corsHeaders);
      }

      return jsonResponse({ success: true, message: "Staff account deleted successfully." }, 200, corsHeaders);
    }

    // -------------------------------------------------------------------------
    // 7. ACTION: RESET_STAFF_MFA (Staff Governance - AAL2 Enforced)
    // Reversible DB update runs BEFORE GoTrue metadata and irreversible factor
    // unenrollment so failures never leave half-deleted MFA factors.
    // -------------------------------------------------------------------------
    if (action === "reset_staff_mfa") {
      const authGateError = assertStaffGovernanceAal2();
      if (authGateError) return authGateError;

      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
      if (!targetUserId) {
        return jsonResponse({ error: "Target staff user ID is required." }, 400, corsHeaders);
      }
      if (targetUserId === callerUser.id) {
        return jsonResponse({ error: "You cannot reset your own active MFA from staff management." }, 400, corsHeaders);
      }

      const { data: targetUserRes, error: getError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (getError || !targetUserRes?.user) {
        return jsonResponse({ error: "Staff member not found." }, 404, corsHeaders);
      }

      const prevStaffRow = await snapshotStaffRow(targetUserId);
      const dbRootFlag = prevStaffRow?.is_root_super_admin === true;
      if (targetUserRes.user.app_metadata?.is_root_super_admin === true || dbRootFlag) {
        return jsonResponse({ error: "Root Super Admin MFA cannot be reset through bulk staff recovery." }, 400, corsHeaders);
      }

      const targetRole = normalizeRole(targetUserRes.user.app_metadata?.role ?? prevStaffRow?.role);
      if (targetRole === "admin") {
        const rootGateError = assertRootAdminAal2();
        if (rootGateError) return rootGateError;
      }

      const prevAppMetadata = { ...(targetUserRes.user.app_metadata || {}) };
      const nowIso = new Date().toISOString();

      // 1. Reversible DB update first
      const { error: dbErr } = await supabaseAdmin.from("staff_users").update({
        totp_enabled: false,
        updated_at: nowIso,
      }).eq("id", targetUserId);
      if (dbErr) {
        return jsonResponse({ error: `Failed to update staff MFA flag: ${dbErr.message}` }, 500, corsHeaders);
      }

      // 2. Reversible GoTrue metadata update
      const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        app_metadata: {
          ...prevAppMetadata,
          totp_enabled: false,
        },
      });
      if (metaErr) {
        await supabaseAdmin.from("staff_users").update({
          totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : true,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        return jsonResponse({ error: `Failed to update GoTrue MFA state (DB rolled back): ${metaErr.message}` }, 500, corsHeaders);
      }

      // 3. Irreversible factor unenrollment AFTER reversible writes succeed
      const factorDelRes = await deleteAllUserFactors(targetUserId, targetUserRes.user.factors || []);
      if (factorDelRes.error) {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, { app_metadata: prevAppMetadata });
        await supabaseAdmin.from("staff_users").update({
          totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : true,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        return jsonResponse({ error: factorDelRes.error }, 500, corsHeaders);
      }

      const targetEmail = (targetUserRes.user.email || targetUserId).toLowerCase();
      const { error: auditErr } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "RESET_STAFF_MFA",
        target_user_id: targetUserId,
        target_user_email: targetEmail,
        performed_by: callerUser.email || callerUser.id,
        details: `Reset ${factorDelRes.count} MFA factor(s) for ${targetEmail}. User must re-enroll Authenticator on next sign-in.`,
        created_at: nowIso,
      });
      if (auditErr) {
        await supabaseAdmin.from("staff_users").update({
          totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : true,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, { app_metadata: prevAppMetadata });
        return jsonResponse({ error: `MFA reset rolled back because audit log failed: ${auditErr.message}` }, 500, corsHeaders);
      }

      return jsonResponse({
        success: true,
        removedFactors: factorDelRes.count,
        message: "Staff Google Authenticator factor reset. Staff member will be prompted to enroll a new authenticator on next sign-in.",
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------------------
    // 8. ACTION: REISSUE_STAFF_INVITE (Staff Governance - AAL2 Enforced)
    // Reversible DB update precedes GoTrue credential update and optional
    // irreversible factor cleanup.
    // -------------------------------------------------------------------------
    if (action === "reissue_staff_invite") {
      const authGateError = assertStaffGovernanceAal2();
      if (authGateError) return authGateError;

      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
      if (!targetUserId) {
        return jsonResponse({ error: "Target staff user ID is required." }, 400, corsHeaders);
      }
      if (targetUserId === callerUser.id) {
        return jsonResponse({ error: "Cannot reissue a temporary invitation for your own active account." }, 400, corsHeaders);
      }

      const { data: targetUserRes, error: getError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (getError || !targetUserRes?.user) {
        return jsonResponse({ error: "Staff member not found." }, 404, corsHeaders);
      }

      const prevStaffRow = await snapshotStaffRow(targetUserId);
      const dbRootFlag = prevStaffRow?.is_root_super_admin === true;
      if (targetUserRes.user.app_metadata?.is_root_super_admin === true || dbRootFlag) {
        return jsonResponse({ error: "Cannot reissue temporary credentials for Root Super Admin." }, 400, corsHeaders);
      }

      const targetRole = normalizeRole(targetUserRes.user.app_metadata?.role ?? prevStaffRow?.role);
      if (targetRole === "admin") {
        const rootGateError = assertRootAdminAal2();
        if (rootGateError) return rootGateError;
      }

      const prevAppMetadata = { ...(targetUserRes.user.app_metadata || {}) };
      const shouldResetMfa = body.resetMfa === true || prevAppMetadata.totp_enabled !== true;
      const tempPassword = generateSecureServerTempPassword();
      const expiresAt = Date.now() + 72 * 60 * 60 * 1000;
      const nextTotpEnabled = shouldResetMfa ? false : Boolean(prevAppMetadata.totp_enabled);
      const nowIso = new Date().toISOString();

      // 1. Reversible DB update first
      const { error: dbErr } = await supabaseAdmin.from("staff_users").update({
        is_blocked: false,
        is_first_login: true,
        totp_enabled: nextTotpEnabled,
        updated_at: nowIso,
      }).eq("id", targetUserId);
      if (dbErr) {
        return jsonResponse({ error: `Failed to persist reissued invite in staff_users: ${dbErr.message}` }, 500, corsHeaders);
      }

      // 2. GoTrue temporary credential + unblock update
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password: tempPassword,
        ban_duration: "none",
        app_metadata: {
          ...prevAppMetadata,
          is_first_login: true,
          is_blocked: false,
          invitation_expired: false,
          temporary_password_expires_at: expiresAt,
          totp_enabled: nextTotpEnabled,
        },
      });
      if (updateErr) {
        await supabaseAdmin.from("staff_users").update({
          is_blocked: prevStaffRow ? Boolean(prevStaffRow.is_blocked) : false,
          is_first_login: prevStaffRow ? Boolean(prevStaffRow.is_first_login) : false,
          totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : false,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        return jsonResponse({ error: `Failed to reissue staff credentials in GoTrue (DB rolled back): ${updateErr.message}` }, 500, corsHeaders);
      }

      // 3. Optional irreversible factor deletion AFTER reversible writes succeed
      let clearedFactorsCount = 0;
      if (shouldResetMfa) {
        const factorDelRes = await deleteAllUserFactors(targetUserId, targetUserRes.user.factors || []);
        if (factorDelRes.error) {
          await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
            ban_duration: prevAppMetadata.is_blocked === true ? "876000h" : "none",
            app_metadata: prevAppMetadata,
          });
          await supabaseAdmin.from("staff_users").update({
            is_blocked: prevStaffRow ? Boolean(prevStaffRow.is_blocked) : false,
            is_first_login: prevStaffRow ? Boolean(prevStaffRow.is_first_login) : false,
            totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : false,
            updated_at: nowIso,
          }).eq("id", targetUserId);
          return jsonResponse({ error: factorDelRes.error }, 500, corsHeaders);
        }
        clearedFactorsCount = factorDelRes.count;
      }

      const targetEmail = (targetUserRes.user.email || targetUserId).toLowerCase();
      const { error: auditErr } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "REISSUE_STAFF_INVITE",
        target_user_id: targetUserId,
        target_user_email: targetEmail,
        performed_by: callerUser.email || callerUser.id,
        details: `Reissued fresh 72h CSPRNG temporary password for ${targetEmail}${shouldResetMfa ? ` (reset ${clearedFactorsCount} pending/stale MFA factor(s))` : ""}.`,
        created_at: nowIso,
      });
      if (auditErr) {
        await supabaseAdmin.from("staff_users").update({
          is_blocked: prevStaffRow ? Boolean(prevStaffRow.is_blocked) : false,
          is_first_login: prevStaffRow ? Boolean(prevStaffRow.is_first_login) : false,
          totp_enabled: prevStaffRow ? Boolean(prevStaffRow.totp_enabled) : false,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          ban_duration: prevAppMetadata.is_blocked === true ? "876000h" : "none",
          app_metadata: prevAppMetadata,
        });
        return jsonResponse({ error: `Invite reissue rolled back because audit log failed: ${auditErr.message}` }, 500, corsHeaders);
      }

      return jsonResponse({
        success: true,
        temporaryPassword: tempPassword,
        expiresAt,
        factorsReset: shouldResetMfa,
        message: "Fresh 72-hour temporary password issued successfully.",
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------------------
    // 9. ACTION: UPDATE_STAFF_ROLE_PERMISSIONS (Staff Governance - AAL2 Enforced)
    // Reversible DB update precedes GoTrue metadata mutation.
    // -------------------------------------------------------------------------
    if (action === "update_staff_role_permissions") {
      const authGateError = assertStaffGovernanceAal2();
      if (authGateError) return authGateError;

      const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
      if (!targetUserId) {
        return jsonResponse({ error: "Target staff user ID is required." }, 400, corsHeaders);
      }
      if (targetUserId === callerUser.id) {
        return jsonResponse({ error: "Cannot modify your own administrative role from staff directory." }, 400, corsHeaders);
      }

      const canonicalTargetRole = normalizeRole(body.role);
      if (!canonicalTargetRole || !ASSIGNABLE_STAFF_ROLES.has(canonicalTargetRole)) {
        return jsonResponse({
          error: "Invalid staff role specified.",
        }, 400, corsHeaders);
      }

      if (!Array.isArray(body.permissions)) {
        return jsonResponse({ error: "Permissions must be a valid array of workspace keys." }, 400, corsHeaders);
      }

      const sanitizedPermissions = Array.from(
        new Set(
          body.permissions
            .filter((p): p is string => typeof p === "string")
            .map((p) => p.trim().toLowerCase())
            .filter((p) => ALLOWED_STAFF_PERMISSIONS.has(p))
        )
      );
      if (sanitizedPermissions.length === 0) {
        return jsonResponse({ error: "Select at least one valid workspace permission." }, 400, corsHeaders);
      }

      const { data: targetUserRes, error: getError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (getError || !targetUserRes?.user) {
        return jsonResponse({ error: "Staff member not found." }, 404, corsHeaders);
      }

      const prevStaffRow = await snapshotStaffRow(targetUserId);
      const dbRootFlag = prevStaffRow?.is_root_super_admin === true;
      if (targetUserRes.user.app_metadata?.is_root_super_admin === true || dbRootFlag) {
        return jsonResponse({ error: "Root Super Admin role and permissions cannot be downgraded or altered." }, 400, corsHeaders);
      }

      const currentTargetRole = normalizeRole(targetUserRes.user.app_metadata?.role ?? prevStaffRow?.role);
      if (currentTargetRole === "admin" || canonicalTargetRole === "admin") {
        const rootGateError = assertRootAdminAal2();
        if (rootGateError) return rootGateError;
      }

      if (sanitizedPermissions.includes("audit_logs")) {
        const rootGateError = assertRootAdminAal2();
        if (rootGateError) return rootGateError;
      }

      const prevAppMetadata = { ...(targetUserRes.user.app_metadata || {}) };
      const nowIso = new Date().toISOString();

      // 1. Reversible DB update first
      const { error: dbErr } = await supabaseAdmin.from("staff_users").update({
        role: canonicalTargetRole,
        permissions: sanitizedPermissions,
        updated_at: nowIso,
      }).eq("id", targetUserId);
      if (dbErr) {
        return jsonResponse({ error: `Failed to persist updated role/permissions: ${dbErr.message}` }, 500, corsHeaders);
      }

      // 2. GoTrue metadata sync
      const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        app_metadata: {
          ...prevAppMetadata,
          role: canonicalTargetRole,
          permissions: sanitizedPermissions,
        },
      });
      if (metaErr) {
        await supabaseAdmin.from("staff_users").update({
          role: prevStaffRow ? prevStaffRow.role : prevAppMetadata.role,
          permissions: prevStaffRow ? prevStaffRow.permissions : prevAppMetadata.permissions,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        return jsonResponse({ error: `Failed to update GoTrue staff claims (DB rolled back): ${metaErr.message}` }, 500, corsHeaders);
      }

      const targetEmail = (targetUserRes.user.email || targetUserId).toLowerCase();
      const { error: auditErr } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "UPDATE_STAFF_PERMISSIONS",
        target_user_id: targetUserId,
        target_user_email: targetEmail,
        performed_by: callerUser.email || callerUser.id,
        details: `Updated ${targetEmail} role to '${canonicalTargetRole}' with workspace permissions [${sanitizedPermissions.join(", ")}].`,
        created_at: nowIso,
      });
      if (auditErr) {
        await supabaseAdmin.from("staff_users").update({
          role: prevStaffRow ? prevStaffRow.role : prevAppMetadata.role,
          permissions: prevStaffRow ? prevStaffRow.permissions : prevAppMetadata.permissions,
          updated_at: nowIso,
        }).eq("id", targetUserId);
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, { app_metadata: prevAppMetadata });
        return jsonResponse({ error: `Role update rolled back because audit log failed: ${auditErr.message}` }, 500, corsHeaders);
      }

      return jsonResponse({
        success: true,
        role: canonicalTargetRole,
        permissions: sanitizedPermissions,
        message: "Staff role and workspace permissions updated.",
      }, 200, corsHeaders);
    }

    // -------------------------------------------------------------------------
    // 10. ACTION: UPDATE_OWN_ADMIN_PROFILE (Admin Self-Service - AAL2 Enforced)
    // Reversible DB update executes BEFORE GoTrue identity update while enforcing
    // the 5-modification lifetime quota server-side.
    // Root Admin email/phone are permanently bound and immutable.
    // -------------------------------------------------------------------------
    if (action === "update_own_admin_profile") {
      if (!isCallerAdmin) {
        return jsonResponse({ error: "Forbidden: Only administrators can update administrative profile settings." }, 403, corsHeaders);
      }
      if (callerAal !== "aal2") {
        return jsonResponse({
          error: "MFA Required: Privileged operations require Authenticator Assurance Level 2 (AAL2). Please complete Google Authenticator verification.",
        }, 403, corsHeaders);
      }

      const cleanEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const cleanPhone = typeof body.phone === "string" ? body.phone.trim() : "";
      const cleanName = typeof body.name === "string" ? body.name.trim() : "";

      if (!isValidEmail(cleanEmail)) {
        return jsonResponse({ error: "Please provide a valid email address." }, 400, corsHeaders);
      }
      if (!isValidPhone(cleanPhone)) {
        return jsonResponse({ error: "Please provide a valid 10-15 digit mobile number." }, 400, corsHeaders);
      }

      const prevStaffRow = await snapshotStaffRow(callerUser.id);
      const currentEmail = (typeof prevStaffRow?.email === "string" ? prevStaffRow.email : callerUser.email || "").toLowerCase();
      const currentPhone = typeof prevStaffRow?.phone === "string" ? prevStaffRow.phone : (callerUser.phone || "");
      const currentName = typeof prevStaffRow?.name === "string" ? prevStaffRow.name : "";
      const rawCount = prevStaffRow?.email_phone_changes_count ?? callerUser.app_metadata?.email_phone_changes_count ?? 0;
      const currentChangesCount = typeof rawCount === "number" ? rawCount : Number(rawCount || 0);

      const emailChanged = cleanEmail !== currentEmail;
      const phoneChanged = cleanPhone !== currentPhone;
      const nameChanged = Boolean(cleanName) && cleanName !== currentName;

      if (!emailChanged && !phoneChanged && !nameChanged) {
        return jsonResponse({
          success: true,
          email: currentEmail,
          phone: currentPhone,
          name: cleanName || currentName,
          emailPhoneChangesCount: currentChangesCount,
          message: "No profile changes detected.",
        }, 200, corsHeaders);
      }

      if ((isCallerRootAdmin || prevStaffRow?.is_root_super_admin === true || callerDbStaffId === "admin_seed_001") && (emailChanged || phoneChanged)) {
        return jsonResponse({
          error: "Root Administrator email address and mobile number are permanently bound and immutable.",
        }, 400, corsHeaders);
      }

      if ((emailChanged || phoneChanged) && currentChangesCount >= 5) {
        return jsonResponse({
          error: "Lifetime modification limit reached (5 of 5 used). Security contact details are now locked.",
        }, 400, corsHeaders);
      }

      if (emailChanged) {
        try {
          const { data: conflictRow } = await supabaseAdmin
            .from("staff_users")
            .select("id")
            .eq("email", cleanEmail)
            .maybeSingle();
          if (conflictRow && conflictRow.id !== callerDbStaffId) {
            return jsonResponse({ error: "This email address is already assigned to another staff account." }, 400, corsHeaders);
          }
        } catch {
          // Proceed cleanly if query returns empty
        }
      }

      const nextChangesCount = emailChanged || phoneChanged ? currentChangesCount + 1 : currentChangesCount;
      const prevAppMetadata = { ...(callerUser.app_metadata || {}) };
      const nowIso = new Date().toISOString();

      // 1. Reversible DB update first
      const dbPatch: Record<string, unknown> = {
        email: cleanEmail,
        phone: cleanPhone,
        email_phone_changes_count: nextChangesCount,
        updated_at: nowIso,
      };
      if (cleanName) {
        dbPatch.name = cleanName;
      }

      const { error: dbUpdateErr } = await supabaseAdmin.from("staff_users").update(dbPatch).eq("id", callerDbStaffId);
      if (dbUpdateErr) {
        return jsonResponse({
          error: `Failed to persist profile update in staff_users: ${dbUpdateErr.message}`,
        }, 500, corsHeaders);
      }

      // 2. GoTrue identity & metadata update
      const authPatch: Record<string, unknown> = {
        app_metadata: {
          ...prevAppMetadata,
          email_phone_changes_count: nextChangesCount,
        },
      };
      if (emailChanged) {
        authPatch.email = cleanEmail;
        authPatch.email_confirm = true;
      }
      if (phoneChanged) {
        authPatch.phone = cleanPhone;
      }
      if (nameChanged) {
        authPatch.user_metadata = {
          ...(callerUser.user_metadata || {}),
          name: cleanName,
        };
      }

      const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(callerUser.id, authPatch);
      if (authUpdateErr) {
        await supabaseAdmin.from("staff_users").update({
          email: currentEmail,
          phone: currentPhone,
          ...(currentName ? { name: currentName } : {}),
          email_phone_changes_count: currentChangesCount,
          updated_at: nowIso,
        }).eq("id", callerDbStaffId);
        return jsonResponse({ error: `Failed to update GoTrue identity profile (DB rolled back): ${authUpdateErr.message}` }, 500, corsHeaders);
      }

      const { error: auditErr } = await supabaseAdmin.from("staff_audit_logs").insert({
        action: "UPDATE_ADMIN_PROFILE",
        target_user_id: callerDbStaffId,
        target_user_email: cleanEmail,
        performed_by: cleanEmail,
        details: `Updated Admin contact profile (changes used: ${nextChangesCount}/5).`,
        created_at: nowIso,
      });
      if (auditErr) {
        await supabaseAdmin.from("staff_users").update({
          email: currentEmail,
          phone: currentPhone,
          ...(currentName ? { name: currentName } : {}),
          email_phone_changes_count: currentChangesCount,
          updated_at: nowIso,
        }).eq("id", callerDbStaffId);
        await supabaseAdmin.auth.admin.updateUserById(callerUser.id, {
          ...(emailChanged && currentEmail ? { email: currentEmail, email_confirm: true } : {}),
          ...(phoneChanged ? { phone: currentPhone } : {}),
          app_metadata: prevAppMetadata,
        });
        return jsonResponse({ error: `Profile update rolled back because audit log failed: ${auditErr.message}` }, 500, corsHeaders);
      }

      return jsonResponse({
        success: true,
        email: cleanEmail,
        phone: cleanPhone,
        name: cleanName || currentName,
        emailPhoneChangesCount: nextChangesCount,
        message: "Admin profile & security contacts updated in cloud.",
      }, 200, corsHeaders);
    }

    return jsonResponse({ error: `Unsupported staff action: ${action}` }, 400, corsHeaders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Server error: ${message}` }, 500, corsHeaders);
  }
}
