import { randomBytes } from "node:crypto";

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { getDb } from "./db.server";

const SESSION_COOKIE = "promptstar_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (financial system best practice)

export type Mascot = "nova" | "comet";

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  mascot: Mascot;
  is_admin: boolean;
};

export async function createSession(userId: string, remember = true): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await getDb().query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt],
  );

  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true, // Always use HTTPS in production; development uses secure=false via test only
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
    `SELECT users.id, users.email, users.username, users.mascot, users.is_admin
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token = $1 AND sessions.expires_at > now()`,
    [token],
  );

  return result.rows[0] ?? null;
}
