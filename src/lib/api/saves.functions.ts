import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import type { Prompt } from "../mock-data";

// Decorative card-shadow colours, picked deterministically per listing id.
const SAVED_SHADOWS: Prompt["shadow"][] = ["magenta", "orange", "yellow", "purple", "black"];

export const savePrompt = createServerFn({ method: "POST" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in to save prompts.");

    const db = getDb();

    // Insert and only increment the counter if a new row was actually created
    await db.query(
      `WITH ins AS (
         INSERT INTO saved_prompts (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id
       )
       UPDATE prompt_listings SET save_count = save_count + 1
       WHERE id = $2 AND EXISTS (SELECT 1 FROM ins)`,
      [user.id, data.listingId]
    );

    return { ok: true as const };
  });

export const unsavePrompt = createServerFn({ method: "POST" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
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
    if ((result.rowCount ?? 0) > 0) {
      await db.query(
        "UPDATE prompt_listings SET save_count = GREATEST(0, save_count - 1) WHERE id = $1",
        [data.listingId]
      );
    }

    return { ok: true as const };
  });

export const isSaved = createServerFn({ method: "GET" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
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
    const result = await db.query<{
      id: string;
      title: string;
      description: string;
      body: string;
      image: string;
      price: string;
      category: string;
      model: string;
      tags: string[];
      username: string;
      avatar_url: string | null;
      user_id: string;
      avg_rating: number;
      review_count: number;
    }>(
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
        users.username,
        users.avatar_url,
        prompt_listings.user_id,
        COALESCE(avg_r.avg_rating, 0)::float AS avg_rating,
        COALESCE(avg_r.review_count, 0)::int AS review_count
      FROM saved_prompts
      JOIN prompt_listings ON prompt_listings.id = saved_prompts.listing_id
      JOIN users ON users.id = prompt_listings.user_id
      LEFT JOIN (
        SELECT listing_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
        FROM reviews GROUP BY listing_id
      ) avg_r ON avg_r.listing_id = prompt_listings.id
      WHERE saved_prompts.user_id = $1 AND prompt_listings.status = 'published'
      ORDER BY saved_prompts.saved_at DESC`,
      [user.id]
    );

    // Saved prompts can be paid listings the user hasn't purchased — only
    // include the full body for free prompts, the creator, or purchases.
    const candidateIds = result.rows
      .filter((row) => parseFloat(row.price) > 0 && row.user_id !== user.id)
      .map((row) => row.id);
    let purchasedIds = new Set<string>();
    if (candidateIds.length > 0) {
      const purchases = await db.query<{ listing_id: string }>(
        "SELECT listing_id FROM purchases WHERE buyer_id = $1 AND listing_id = ANY($2)",
        [user.id, candidateIds]
      );
      purchasedIds = new Set(purchases.rows.map((r) => r.listing_id));
    }

    return result.rows.map((row): Prompt => {
      const price = parseFloat(row.price);
      const canView = price <= 0 || row.user_id === user.id || purchasedIds.has(row.id);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        body: canView ? row.body : "",
        image: row.image,
        price,
        category: row.category,
        model: row.model as Prompt["model"],
        tags: row.tags,
        creator: row.username,
        creatorEmoji: row.username.charAt(0).toUpperCase(),
        creatorAvatarUrl: row.avatar_url,
        userId: row.user_id,
        rating: row.avg_rating,
        reviews: row.review_count,
        shadow: SAVED_SHADOWS[row.id.charCodeAt(0) % SAVED_SHADOWS.length],
        rotate: 0, // Decorative value
      };
    });
  });
