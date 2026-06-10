import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { sanitize } from "../sanitize";
import { insertNotification } from "./notifications.functions";

export const createReview = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      listingId: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      body: z.string().max(500).optional(),
    })
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in to review prompts.");

    const db = getDb();

    // Verify user has purchased this listing
    const purchase = await db.query(
      "SELECT id FROM purchases WHERE buyer_id = $1 AND listing_id = $2",
      [user.id, data.listingId]
    );

    if (purchase.rows.length === 0) {
      throw new Error("You must purchase a prompt before reviewing it.");
    }

    // Insert review (ON CONFLICT prevents duplicate reviews)
    await db.query(
      `INSERT INTO reviews (listing_id, user_id, rating, body)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (listing_id, user_id) DO UPDATE
       SET rating = $3, body = $4`,
      [data.listingId, user.id, data.rating, data.body ? sanitize(data.body) : null]
    );

    // Best-effort: never fails the review if this throws.
    const listing = await db.query<{ user_id: string; title: string }>(
      "SELECT user_id, title FROM prompt_listings WHERE id = $1",
      [data.listingId]
    );
    if (listing.rows.length > 0 && listing.rows[0].user_id !== user.id) {
      await insertNotification(
        db,
        listing.rows[0].user_id,
        "review_received",
        "New review on your prompt",
        `"${listing.rows[0].title}" got a ${data.rating}-star review.`,
        data.listingId
      );
    }

    return { ok: true as const };
  });

export const listReviews = createServerFn({ method: "GET" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const db = getDb();
    const result = await db.query(
      `SELECT reviews.user_id, reviews.rating, reviews.body, reviews.created_at, users.username
       FROM reviews
       JOIN users ON users.id = reviews.user_id
       WHERE reviews.listing_id = $1
       ORDER BY reviews.created_at DESC`,
      [data.listingId]
    );

    return result.rows.map((row: any) => ({
      userId: row.user_id,
      username: row.username,
      rating: row.rating,
      body: row.body,
      createdAt: row.created_at,
    }));
  });

export const deleteReview = createServerFn({ method: "POST" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in.");

    const db = getDb();
    await db.query(
      "DELETE FROM reviews WHERE listing_id = $1 AND user_id = $2",
      [data.listingId, user.id]
    );

    return { ok: true as const };
  });

export const hasUserReviewed = createServerFn({ method: "GET" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) return { reviewed: false };
    const db = getDb();
    const result = await db.query(
      "SELECT 1 FROM reviews WHERE listing_id = $1 AND user_id = $2",
      [data.listingId, user.id]
    );
    return { reviewed: result.rows.length > 0 };
  });

export const getAverageRating = createServerFn({ method: "GET" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const db = getDb();
    const result = await db.query<{ average: string | null; count: string }>(
      `SELECT
        ROUND(AVG(rating)::numeric, 1) as average,
        COUNT(*) as count
       FROM reviews
       WHERE listing_id = $1`,
      [data.listingId]
    );

    const row = result.rows[0];
    return {
      average: row.average ? parseFloat(row.average) : null,
      count: parseInt(row.count, 10),
    };
  });
