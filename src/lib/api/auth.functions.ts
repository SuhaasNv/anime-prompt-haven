import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { createSession, destroySession, getSessionUser } from "../auth.server";
import { getDb } from "../db.server";

const PASSWORD_MIN_LENGTH = 8;
const MASCOT_VALUES = ["nova", "comet"] as const;

export const signUp = createServerFn({ method: "POST" })
  .validator(
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

    const passwordHash = await bcrypt.hash(data.password, 10);
    const inserted = await db.query<{ id: string }>(
      "INSERT INTO users (email, username, password_hash, mascot) VALUES ($1, $2, $3, $4) RETURNING id",
      [data.email, data.username, passwordHash, data.mascot],
    );

    await createSession(inserted.rows[0].id);
    return { ok: true as const };
  });

export const setMascot = createServerFn({ method: "POST" })
  .validator(z.object({ mascot: z.enum(MASCOT_VALUES) }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) {
      throw new Error("You need to be signed in to do that.");
    }

    await getDb().query("UPDATE users SET mascot = $1 WHERE id = $2", [data.mascot, user.id]);
    return { ok: true as const };
  });

export const signIn = createServerFn({ method: "POST" })
  .validator(
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
