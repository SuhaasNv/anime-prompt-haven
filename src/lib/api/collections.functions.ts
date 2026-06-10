import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { sanitize } from "../sanitize";

export type DbCollection = {
  id: string;
  name: string;
  vibe: string;
  color: "magenta" | "orange" | "yellow" | "purple";
  promptIds: string[];
  isPublic: boolean;
};

export type PublicCollection = DbCollection & {
  userId: string;
  username: string;
};

const COLLECTION_COLORS = ["magenta", "orange", "yellow", "purple"] as const;

async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("You must be signed in.");
  }
  return user;
}

export const listCollections = createServerFn({ method: "GET" }).handler(
  async (): Promise<DbCollection[]> => {
    const user = await getSessionUser();
    if (!user) return [];

    const db = getDb();
    const result = await db.query<{
      id: string;
      name: string;
      vibe: string;
      color: DbCollection["color"];
      is_public: boolean;
      prompt_ids: string[] | null;
    }>(
      `SELECT
         collections.id,
         collections.name,
         collections.vibe,
         collections.color,
         collections.is_public,
         array_remove(array_agg(collection_prompts.prompt_id), NULL) AS prompt_ids
       FROM collections
       LEFT JOIN collection_prompts ON collection_prompts.collection_id = collections.id
       WHERE collections.user_id = $1
       GROUP BY collections.id
       ORDER BY collections.created_at DESC`,
      [user.id],
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      vibe: row.vibe,
      color: row.color,
      promptIds: row.prompt_ids ?? [],
      isPublic: row.is_public,
    }));
  },
);

export const getPublicCollection = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }): Promise<PublicCollection | null> => {
    const db = getDb();
    const result = await db.query<{
      id: string;
      name: string;
      vibe: string;
      color: DbCollection["color"];
      is_public: boolean;
      user_id: string;
      username: string;
      prompt_ids: string[] | null;
    }>(
      `SELECT
         collections.id,
         collections.name,
         collections.vibe,
         collections.color,
         collections.is_public,
         collections.user_id,
         users.username,
         array_remove(array_agg(collection_prompts.prompt_id), NULL) AS prompt_ids
       FROM collections
       JOIN users ON users.id = collections.user_id
       LEFT JOIN collection_prompts ON collection_prompts.collection_id = collections.id
       WHERE collections.id = $1 AND collections.is_public = TRUE
       GROUP BY collections.id, users.username`,
      [data.id],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      vibe: row.vibe,
      color: row.color,
      promptIds: row.prompt_ids ?? [],
      isPublic: row.is_public,
      userId: row.user_id,
      username: row.username,
    };
  });

export const toggleCollectionVisibility = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    const owned = await db.query<{ is_public: boolean }>(
      "SELECT is_public FROM collections WHERE id = $1 AND user_id = $2",
      [data.id, user.id],
    );
    if (owned.rows.length === 0) throw new Error("Collection not found.");

    const isPublic = !owned.rows[0].is_public;
    await db.query("UPDATE collections SET is_public = $1 WHERE id = $2", [isPublic, data.id]);
    return { isPublic };
  });

export const createCollection = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1).max(60),
      vibe: z.string().max(120).optional(),
      color: z.enum(COLLECTION_COLORS).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    const result = await db.query<{ id: string }>(
      "INSERT INTO collections (user_id, name, vibe, color) VALUES ($1, $2, $3, $4) RETURNING id",
      [user.id, sanitize(data.name), sanitize(data.vibe ?? ""), data.color ?? "magenta"],
    );
    return { id: result.rows[0].id };
  });

export const addPromptToCollection = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      collectionId: z.string().uuid(),
      promptId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();

    const owned = await db.query("SELECT id FROM collections WHERE id = $1 AND user_id = $2", [
      data.collectionId,
      user.id,
    ]);
    if (owned.rows.length === 0) {
      throw new Error("Collection not found.");
    }

    await db.query(
      "INSERT INTO collection_prompts (collection_id, prompt_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [data.collectionId, data.promptId],
    );
    return { ok: true as const };
  });

export const removePromptFromCollection = createServerFn({ method: "POST" })
  .inputValidator(z.object({ collectionId: z.string().uuid(), promptId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    const owned = await db.query("SELECT id FROM collections WHERE id = $1 AND user_id = $2", [
      data.collectionId,
      user.id,
    ]);
    if (owned.rows.length === 0) throw new Error("Collection not found.");
    await db.query(
      "DELETE FROM collection_prompts WHERE collection_id = $1 AND prompt_id = $2",
      [data.collectionId, data.promptId],
    );
    return { ok: true as const };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    const owned = await db.query("SELECT id FROM collections WHERE id = $1 AND user_id = $2", [
      data.id,
      user.id,
    ]);
    if (owned.rows.length === 0) throw new Error("Collection not found.");
    await db.query("DELETE FROM collection_prompts WHERE collection_id = $1", [data.id]);
    await db.query("DELETE FROM collections WHERE id = $1", [data.id]);
    return { ok: true as const };
  });
