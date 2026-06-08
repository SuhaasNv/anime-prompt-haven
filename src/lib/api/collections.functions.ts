import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";

export type DbCollection = {
  id: string;
  name: string;
  vibe: string;
  color: "magenta" | "orange" | "yellow" | "purple";
  promptIds: string[];
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
      prompt_ids: string[] | null;
    }>(
      `SELECT
         collections.id,
         collections.name,
         collections.vibe,
         collections.color,
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
    }));
  },
);

export const createCollection = createServerFn({ method: "POST" })
  .validator(
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
      [user.id, data.name, data.vibe ?? "", data.color ?? "magenta"],
    );
    return { id: result.rows[0].id };
  });

export const addPromptToCollection = createServerFn({ method: "POST" })
  .validator(
    z.object({
      collectionId: z.string().uuid(),
      promptId: z.string().min(1),
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
