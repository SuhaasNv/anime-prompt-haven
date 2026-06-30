import { randomBytes } from "node:crypto";
import process from "node:process";

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { getDb } from "./db.server";

const SESSION_COOKIE = "promptstar_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (financial system best practice)

export type Mascot = "nova" | "comet" | "raven" | "vex" | "pixel";

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  mascot: Mascot;
  is_admin: boolean;
  avatarUrl: string | null;
  onboarded: boolean;
  tour_completed: boolean;
};

/**
 * Insert a session row and return its token + expiry. Does NOT set a cookie —
 * callers that run inside a server function use `createSession`; callers that
 * build their own `Response` (OAuth callback routes) use this plus
 * `buildSessionSetCookie`.
 */
export async function createSessionToken(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await getDb().query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt],
  );

  return { token, expiresAt };
}

/**
 * Serialize the session cookie as a `Set-Cookie` header value for raw Responses
 * (the OAuth callback). Uses SameSite=Lax — NOT Strict — because the callback is
 * reached via a cross-site redirect from Google: a Strict cookie would be
 * withheld on the immediate redirect to /dashboard, bouncing the user back to
 * /auth. Lax is sent on top-level navigations and still blocks cross-site POST.
 */
export function buildSessionSetCookie(token: string, expiresAt: Date, remember = true): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  // "Remember me" off → session cookie (cleared on browser close); DB row still 7 days.
  if (remember) parts.push(`Expires=${expiresAt.toUTCString()}`);
  return parts.join("; ");
}

export async function createSession(userId: string, remember = true): Promise<void> {
  const { token, expiresAt } = await createSessionToken(userId);

  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // HTTPS-only in prod; plain http works in dev
    sameSite: "strict", // Prevent CSRF attacks (no cross-site cookies)
    path: "/",
    // "Remember me" off → browser session cookie (cleared on browser close).
    // The DB-side session lives for 7 days.
    ...(remember ? { expires: expiresAt } : {}),
  });
}

export async function destroySession(): Promise<void> {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    await getDb().query("DELETE FROM sessions WHERE token = $1", [token]);
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;

  const result = await getDb().query<SessionUser>(
    `SELECT users.id, users.email, users.username, users.mascot, users.is_admin,
            users.avatar_url AS "avatarUrl", users.onboarded, users.tour_completed
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = $1 AND sessions.expires_at > now()`,
    [token],
  );

  return result.rows[0] ?? null;
}

/** Read session from a raw Web Request (for file-route API handlers that don't run in H3 context). */
export async function getSessionUserFromRequest(request: Request): Promise<SessionUser | null> {
  const header = request.headers.get("cookie");
  if (!header) return null;
  let token: string | null = null;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    if (pair.slice(0, idx).trim() === SESSION_COOKIE) {
      token = pair.slice(idx + 1).trim();
      break;
    }
  }
  if (!token) return null;

  const result = await getDb().query<SessionUser>(
    `SELECT users.id, users.email, users.username, users.mascot, users.is_admin,
            users.avatar_url AS "avatarUrl", users.onboarded, users.tour_completed
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = $1 AND sessions.expires_at > now()`,
    [token],
  );

  return result.rows[0] ?? null;
}
