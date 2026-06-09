import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";

export const savePrompt = createServerFn({ method: "POST" })
  .validator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in to save prompts.");

    const db = getDb();

    // Insert into saved_prompts (ON CONFLICT DO NOTHING prevents duplicates)
    await db.query(
      "INSERT INTO saved_prompts (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user.id, data.listingId]
    );

    // Increment save_count on the listing
    await db.query(
      "UPDATE prompt_listings SET save_count = save_count + 1 WHERE id = $1",
      [data.listingId]
    );

    return { ok: true as const };
  });

export const unsavePrompt = createServerFn({ method: "POST" })
  .validator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in to unsave prompts.");

    const db = getDb();

    // Delete from saved_prompts
    const result = await db.query(
      "DELETE FROM saved_prompts WHERE user_id = $1 AND listing_id = $2",
      [user.id, data.listingId]
    );

    // Only decrement if the row was actually deleted
    if (result.rowCount > 0) {
      await db.query(
        "UPDATE prompt_listings SET save_count = GREATEST(0, save_count - 1) WHERE id = $1",
        [data.listingId]
      );
    }

    return { ok: true as const };
  });

export const isSaved = createServerFn({ method: "GET" })
  .validator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) return { saved: false };

    const db = getDb();
    const result = await db.query(
      "SELECT 1 FROM saved_prompts WHERE user_id = $1 AND listing_id = $2",
      [user.id, data.listingId]
    );

    return { saved: result.rows.length > 0 };
  });

export const listSavedPrompts = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await getSessionUser();
    if (!user) return [];

    const db = getDb();
    const result = await db.query(
      `SELECT
        prompt_listings.id,
        prompt_listings.title,
        prompt_listings.description,
        prompt_listings.body,
        prompt_listings.image,
        prompt_listings.price::text,
        prompt_listings.category,
        prompt_listings.model,
        prompt_listings.tags,
        users.username
      FROM saved_prompts
      JOIN prompt_listings ON prompt_listings.id = saved_prompts.listing_id
      JOIN users ON users.id = prompt_listings.user_id
      WHERE saved_prompts.user_id = $1 AND prompt_listings.status = 'published'
      ORDER BY saved_prompts.saved_at DESC`,
      [user.id]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      body: row.body,
      image: row.image,
      price: parseFloat(row.price),
      category: row.category,
      model: row.model,
      tags: row.tags,
      creator: row.username,
      rating: 4.5, // TODO: Calculate from reviews
      shadow: "", // Decorative value
      rotate: 0, // Decorative value
    }));
  });
