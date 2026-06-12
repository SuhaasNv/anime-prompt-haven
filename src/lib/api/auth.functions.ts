import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { createSession, destroySession, getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { checkRateLimit } from "../rate-limit.server";
import { sanitize } from "../sanitize";
import { validateAndNormalizeAvatar } from "../image-validation.server";

const PASSWORD_MIN_LENGTH = 8;
const MASCOT_VALUES = ["nova", "comet"] as const;
const MAX_AVATAR_IMAGE_LENGTH = 4_000_000;

const SIGNIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SIGNIN_RATE_LIMIT_MAX_ATTEMPTS = 10;

// Precomputed bcrypt hash with no matching password, used to keep the
// "user not found" path's timing in line with the "wrong password" path
// so response time can't be used to enumerate registered emails.
const DUMMY_PASSWORD_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8K6bpkxwpoxNNYFDH2u8Bj6lqrVj0u";

// Shared so the navbar's cached session lookup can be kept in sync (instead
// of refetched from scratch) right when sign-in/sign-out actually changes it —
// that's what avoids the signed-out flash while navigating between pages.
export const CURRENT_USER_QUERY_KEY = ["current-user"] as const;

export const signUp = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      username: z.string().min(2).max(40),
      password: z.string().min(PASSWORD_MIN_LENGTH),
      mascot: z.enum(MASCOT_VALUES).optional().default("nova"),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [data.email]);
    if (existing.rows.length > 0) {
      throw new Error("An account with that email already exists.");
    }

    const username = sanitize(data.username);
    const existingUsername = await db.query("SELECT id FROM users WHERE username = $1", [username]);
    if (existingUsername.rows.length > 0) {
      throw new Error("That username is already taken.");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    let userId: string;
    try {
      const inserted = await db.query<{ id: string }>(
        "INSERT INTO users (email, username, password_hash, mascot) VALUES ($1, $2, $3, $4) RETURNING id",
        [data.email, username, passwordHash, data.mascot],
      );
      userId = inserted.rows[0].id;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        throw new Error("That username is already taken.");
      }
      throw err;
    }

    // Initialize user credits with welcome bonus
    await db.query(
      "INSERT INTO user_credits (user_id, balance) VALUES ($1, 5.00)",
      [userId]
    );

    // Log the welcome bonus
    await db.query(
      "INSERT INTO credit_transactions (user_id, amount, type, note) VALUES ($1, 5.00, 'bonus', 'Welcome bonus')",
      [userId]
    );

    await createSession(userId);
    return { ok: true as const };
  });

export const setMascot = createServerFn({ method: "POST" })
  .inputValidator(z.object({ mascot: z.enum(MASCOT_VALUES) }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) {
      throw new Error("You need to be signed in to do that.");
    }

    await getDb().query("UPDATE users SET mascot = $1 WHERE id = $2", [data.mascot, user.id]);
    return { ok: true as const };
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
      rememberMe: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const rateLimitKey = `signin:${data.email.toLowerCase()}`;
    checkRateLimit(rateLimitKey, SIGNIN_RATE_LIMIT_MAX_ATTEMPTS, SIGNIN_RATE_LIMIT_WINDOW_MS);

    const db = getDb();
    const result = await db.query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [data.email],
    );
    const user = result.rows[0];

    // Always run bcrypt.compare, even when no user was found, so the
    // response time doesn't reveal whether the email is registered.
    const valid = await bcrypt.compare(data.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) {
      throw new Error("Invalid email or password.");
    }

    await createSession(user.id, data.rememberMe ?? true);
    return { ok: true as const };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true as const };
});

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  return getSessionUser();
});

export interface UserProfile {
  id: string;
  username: string;
  bio: string | null;
  mascot: "nova" | "comet";
  avatarUrl: string | null;
  createdAt: string;
  listingsCount: number;
  salesCount: number;
  savesReceived: number;
}

export const getUserProfile = createServerFn({ method: "GET" })
  .inputValidator(z.object({ username: z.string().min(1).max(40) }))
  .handler(async ({ data }): Promise<UserProfile | null> => {
    const db = getDb();
    const result = await db.query<{
      id: string;
      username: string;
      bio: string | null;
      mascot: "nova" | "comet";
      avatar_url: string | null;
      created_at: string;
      listings_count: string;
      sales_count: string;
      saves_received: string;
    }>(
      `SELECT
         u.id, u.username, u.bio, u.mascot, u.avatar_url, u.created_at,
         (SELECT COUNT(*) FROM prompt_listings WHERE user_id = u.id AND status = 'published') AS listings_count,
         (SELECT COUNT(*) FROM purchases p JOIN prompt_listings pl ON pl.id = p.listing_id WHERE pl.user_id = u.id) AS sales_count,
         (SELECT COALESCE(SUM(save_count), 0) FROM prompt_listings WHERE user_id = u.id AND status = 'published') AS saves_received
       FROM users u
       WHERE u.username = $1`,
      [data.username],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      username: row.username,
      bio: row.bio,
      mascot: row.mascot,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      listingsCount: parseInt(row.listings_count, 10),
      salesCount: parseInt(row.sales_count, 10),
      savesReceived: parseInt(row.saves_received, 10),
    };
  });

export const updateBio = createServerFn({ method: "POST" })
  .inputValidator(z.object({ bio: z.string().max(300) }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in.");
    const db = getDb();
    await db.query("UPDATE users SET bio = $1 WHERE id = $2", [sanitize(data.bio), user.id]);
    return { ok: true as const };
  });

export const updateAvatar = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      imageDataUrl: z
        .string()
        .min(1, "An image is required.")
        .max(MAX_AVATAR_IMAGE_LENGTH, "That image is too large.")
        .startsWith("data:image/", "Upload a valid image file."),
    }),
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in.");

    const avatarUrl = await validateAndNormalizeAvatar(data.imageDataUrl);
    await getDb().query("UPDATE users SET avatar_url = $1 WHERE id = $2", [avatarUrl, user.id]);
    return { ok: true as const, avatarUrl };
  });

export const removeAvatar = createServerFn({ method: "POST" }).handler(async () => {
  const user = await getSessionUser();
  if (!user) throw new Error("You must be signed in.");

  await getDb().query("UPDATE users SET avatar_url = NULL WHERE id = $1", [user.id]);
  return { ok: true as const };
});
