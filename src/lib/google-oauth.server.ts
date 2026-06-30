// Server-only Google OAuth 2.0 (authorization code + PKCE). No third-party SDK:
// just the documented Google endpoints over fetch. The client secret never
// leaves the server (.server.ts is excluded from the client bundle).

import { createHash, randomBytes } from "node:crypto";

import { getServerConfig } from "./config.server";
import { getDb } from "./db.server";
import { sanitize } from "./sanitize";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const OAUTH_STATE_COOKIE = "promptstar_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "promptstar_oauth_verifier";
const OAUTH_TEMP_TTL_S = 600; // 10 minutes to complete the round-trip

/** Throws if Google SSO isn't configured, so callers fail loudly, not silently. */
export function getGoogleConfig(): { clientId: string; clientSecret: string } {
  const { googleClientId, googleClientSecret } = getServerConfig();
  if (!googleClientId || !googleClientSecret) {
    throw new Error("Google SSO is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  }
  return { clientId: googleClientId, clientSecret: googleClientSecret };
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE pair: a random verifier and its S256 challenge. */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64url(randomBytes(16));
}

/**
 * The registered OAuth redirect URI. Prefers the trusted APP_BASE_URL env var
 * (set in production) so a spoofed Host/X-Forwarded-Host header can't influence
 * it; falls back to the request origin for local dev where the var is unset.
 */
export function redirectUriFromRequest(request: Request): string {
  const { appBaseUrl } = getServerConfig();
  if (appBaseUrl) return `${appBaseUrl.replace(/\/+$/, "")}/api/auth/google/callback`;
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

export function buildAuthorizationUrl(opts: {
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const { clientId } = getGoogleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/** Short-lived, Lax temp cookie so it survives Google's cross-site redirect back. */
export function buildTempSetCookie(name: string, value: string, isProd: boolean): string {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${OAUTH_TEMP_TTL_S}`];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCookie(name: string, isProd: boolean): string {
  const parts = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    if (pair.slice(0, idx).trim() === name) return pair.slice(idx + 1).trim();
  }
  return null;
}

type GoogleUserInfo = { sub: string; email: string; email_verified: boolean; name?: string };

/** Exchange the authorization code (with PKCE verifier) for tokens. */
async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<{ access_token: string }> {
  const { clientId, clientSecret } = getGoogleConfig();
  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}).`);
  return res.json() as Promise<{ access_token: string }>;
}

/** Fetch the verified profile. The access token came straight from Google over TLS. */
async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo failed (${res.status}).`);
  return res.json() as Promise<GoogleUserInfo>;
}

/** Run the full code→user step and return Google's verified identity. */
export async function resolveGoogleIdentity(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<GoogleUserInfo> {
  const { access_token } = await exchangeCode(code, verifier, redirectUri);
  const info = await fetchUserInfo(access_token);
  if (!info.email || !info.email_verified) {
    throw new Error("Your Google account has no verified email.");
  }
  return info;
}

/** Build a unique, sanitized username from Google's name/email. */
async function deriveUniqueUsername(seed: string): Promise<string> {
  const base = (sanitize(seed).replace(/[^a-zA-Z0-9_ -]/g, "").trim() || "star").slice(0, 32) || "star";
  const db = getDb();
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const taken = await db.query("SELECT 1 FROM users WHERE username = $1", [candidate]);
    if (taken.rows.length === 0) return candidate.slice(0, 40);
  }
  return `${base.slice(0, 30)}-${randomBytes(4).toString("hex")}`;
}

/**
 * Find or create the user for a verified Google identity:
 *   1. existing google_id  → that user
 *   2. existing email      → link google_id onto it (one account, both methods)
 *   3. otherwise           → create a passwordless Google user + welcome bonus
 */
export async function findOrCreateGoogleUser(
  info: GoogleUserInfo,
): Promise<{ userId: string; needsOnboarding: boolean }> {
  const db = getDb();
  const email = info.email.toLowerCase();

  // Returning Google user — send them through onboarding only if they never
  // finished it (e.g. abandoned the first time).
  const byGoogle = await db.query<{ id: string; onboarded: boolean }>(
    "SELECT id, onboarded FROM users WHERE google_id = $1",
    [info.sub],
  );
  if (byGoogle.rows[0]) {
    return { userId: byGoogle.rows[0].id, needsOnboarding: !byGoogle.rows[0].onboarded };
  }

  // Existing account by verified email — link Google onto it; it's already set up.
  const byEmail = await db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  if (byEmail.rows[0]) {
    await db.query("UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL", [
      info.sub,
      byEmail.rows[0].id,
    ]);
    return { userId: byEmail.rows[0].id, needsOnboarding: false };
  }

  // Brand-new Google user — create them un-onboarded so /onboarding runs.
  const username = await deriveUniqueUsername(info.name || email.split("@")[0]);
  let userId: string;
  try {
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO users (email, username, google_id, auth_provider, onboarded)
       VALUES ($1, $2, $3, 'google', false) RETURNING id`,
      [email, username, info.sub],
    );
    userId = inserted.rows[0].id;
  } catch (err) {
    // Lost a race on email/google_id uniqueness — fall back to the now-existing row.
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      const existing = await db.query<{ id: string; onboarded: boolean }>(
        "SELECT id, onboarded FROM users WHERE google_id = $1 OR email = $2 LIMIT 1",
        [info.sub, email],
      );
      if (existing.rows[0]) {
        return { userId: existing.rows[0].id, needsOnboarding: !existing.rows[0].onboarded };
      }
    }
    throw err;
  }

  // Mirror signUp's welcome bonus so Google users start with the same credits.
  await db.query("INSERT INTO user_credits (user_id, balance) VALUES ($1, 5.00)", [userId]);
  await db.query(
    "INSERT INTO credit_transactions (user_id, amount, type, note) VALUES ($1, 5.00, 'bonus', 'Welcome bonus')",
    [userId],
  );

  return { userId, needsOnboarding: true };
}
