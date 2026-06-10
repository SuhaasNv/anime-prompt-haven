import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { createSession, destroySession, getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { sanitize } from "../sanitize";

const PASSWORD_MIN_LENGTH = 8;
const MASCOT_VALUES = ["nova", "comet"] as const;

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
    const db = getDb();
    const result = await db.query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE email = $1",
      [data.email],
    );
    const user = result.rows[0];
    if (!user) {
      throw new Error("Invalid email or password.");
    }

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
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
      created_at: string;
      listings_count: string;
      sales_count: string;
      saves_received: string;
    }>(
      `SELECT
         u.id, u.username, u.bio, u.mascot, u.created_at,
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
