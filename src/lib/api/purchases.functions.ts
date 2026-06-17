import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { insertNotification } from "./notifications.functions";
import type { Prompt } from "../mock-data";

// Decorative card-shadow colours, picked deterministically per listing id.
const PURCHASED_SHADOWS: Prompt["shadow"][] = ["magenta", "orange", "yellow", "purple", "black"];

export const purchaseListing = createServerFn({ method: "POST" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in to purchase prompts.");

    const db = getDb();

    // Get listing details
    const listing = await db.query<{
      user_id: string;
      price: string;
      status: string;
      title: string;
    }>("SELECT user_id, price, status, title FROM prompt_listings WHERE id = $1", [data.listingId]);

    if (listing.rows.length === 0) {
      throw new Error("Listing not found.");
    }

    const { user_id: sellerId, price: priceStr, status, title } = listing.rows[0];
    const price = parseFloat(priceStr);

    // Validation checks
    if (status !== "published") {
      throw new Error("This listing is not available for purchase.");
    }

    if (price <= 0) {
      throw new Error("This listing is free. Use 'Copy & Use' instead.");
    }

    if (sellerId === user.id) {
      throw new Error("You cannot purchase your own listing.");
    }

    // ========================================================================
    // ATOMIC TRANSACTION: All or nothing (SERIALIZABLE with row locking)
    // A single checked-out client is required so BEGIN/FOR UPDATE/COMMIT all
    // run on the same Postgres session — Pool.query() spreads each call
    // across different pooled connections and would not be atomic.
    // ========================================================================
    const client = await db.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

      // 1. Lock and verify buyer's balance (inside transaction to prevent race)
      const credits = await client.query<{ balance: string }>(
        "SELECT balance FROM user_credits WHERE user_id = $1 FOR UPDATE",
        [user.id],
      );

      const balance = credits.rows.length > 0 ? parseFloat(credits.rows[0].balance) : 0;

      if (balance < price) {
        await client.query("ROLLBACK");
        throw new Error(
          `Insufficient credits. You have ${Math.floor(balance)}, need ${Math.floor(price)}.`,
        );
      }

      // 2. Insert purchase record (UNIQUE constraint prevents duplicates)
      const purchaseResult = await client.query<{ id: string }>(
        `INSERT INTO purchases (buyer_id, listing_id, price_paid)
         VALUES ($1, $2, $3)
         ON CONFLICT (buyer_id, listing_id) DO NOTHING
         RETURNING id`,
        [user.id, data.listingId, price],
      );

      if (purchaseResult.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new Error("You have already purchased this listing.");
      }

      const purchaseId = purchaseResult.rows[0].id;

      // 3. Deduct from buyer's balance
      await client.query(
        "UPDATE user_credits SET balance = balance - $1, updated_at = now() WHERE user_id = $2",
        [price, user.id],
      );

      // 4. Add to seller's balance (70% split; platform keeps 30%)
      const sellerEarnings = Math.round(price * 0.7 * 100) / 100;
      const platformFee = Math.round(price * 0.3 * 100) / 100;
      await client.query(
        `INSERT INTO user_credits (user_id, balance) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
         SET balance = user_credits.balance + $2, updated_at = now()`,
        [sellerId, sellerEarnings],
      );

      // 5. Log buyer transaction (negative = debit)
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, type, reference_id, note)
         VALUES ($1, $2, 'purchase', $3, $4)`,
        [user.id, -price, purchaseId, `Purchase: ${data.listingId}`],
      );

      // 6. Log seller transaction (positive = credit)
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, type, reference_id, note)
         VALUES ($1, $2, 'sale_earn', $3, $4)`,
        [sellerId, sellerEarnings, purchaseId, `Sale earnings from purchase`],
      );

      // 7. Log platform fee (audit trail)
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, type, reference_id, note)
         VALUES ($1, $2, 'platform_fee', $3, $4)`,
        [sellerId, -platformFee, purchaseId, `Platform fee (30%)`],
      );

      // 8. Increment purchase count on listing
      await client.query(
        "UPDATE prompt_listings SET purchase_count = purchase_count + 1 WHERE id = $1",
        [data.listingId],
      );

      await client.query("COMMIT");

      // Best-effort: never fails the purchase if this throws.
      await insertNotification(
        db,
        sellerId,
        "prompt_sold",
        "Your prompt sold!",
        `"${title}" just sold for ${Math.round(sellerEarnings)} ✦.`,
        data.listingId,
      );

      // Fetch updated balance for client
      const newCredits = await db.query<{ balance: string }>(
        "SELECT balance FROM user_credits WHERE user_id = $1",
        [user.id],
      );

      return {
        ok: true as const,
        newBalance: parseFloat(newCredits.rows[0].balance),
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

export const listPurchases = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user) return [];

  const db = getDb();
  const result = await db.query<{
    id: string;
    title: string;
    description: string | null;
    body: string;
    image: string | null;
    price: string;
    category: string;
    model: string;
    tags: string[];
    username: string;
    avatar_url: string | null;
    user_id: string;
    created_at: string;
    avg_rating: number;
    review_count: number;
  }>(
    `SELECT
        prompt_listings.id,
        prompt_listings.title,
        prompt_listings.description,
        prompt_listings.body,
        prompt_listings.image,
        purchases.price_paid::text as price,
        prompt_listings.category,
        prompt_listings.model,
        prompt_listings.tags,
        users.username,
        users.avatar_url,
        prompt_listings.user_id,
        purchases.created_at,
        COALESCE(avg_r.avg_rating, 0)::float AS avg_rating,
        COALESCE(avg_r.review_count, 0)::int AS review_count
      FROM purchases
      JOIN prompt_listings ON prompt_listings.id = purchases.listing_id
      JOIN users ON users.id = prompt_listings.user_id
      LEFT JOIN (
        SELECT listing_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
        FROM reviews GROUP BY listing_id
      ) avg_r ON avg_r.listing_id = prompt_listings.id
      WHERE purchases.buyer_id = $1
      ORDER BY purchases.created_at DESC`,
    [user.id],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    body: row.body,
    image: row.image ?? "",
    price: parseFloat(row.price),
    category: row.category,
    model: row.model as Prompt["model"],
    tags: row.tags,
    creator: row.username,
    creatorEmoji: row.username.charAt(0).toUpperCase(),
    creatorAvatarUrl: row.avatar_url,
    userId: row.user_id,
    rating: row.avg_rating,
    reviews: row.review_count,
    shadow: PURCHASED_SHADOWS[row.id.charCodeAt(0) % PURCHASED_SHADOWS.length],
    rotate: 0 as const, // Decorative value
    purchasedAt: row.created_at,
  }));
});

export const hasPurchased = createServerFn({ method: "GET" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) return { purchased: false };

    const db = getDb();
    const result = await db.query(
      "SELECT 1 FROM purchases WHERE buyer_id = $1 AND listing_id = $2",
      [user.id, data.listingId],
    );

    return { purchased: result.rows.length > 0 };
  });

export const listMyPurchasedListingIds = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const user = await getSessionUser();
    if (!user) return [];

    const db = getDb();
    const result = await db.query<{ listing_id: string }>(
      "SELECT listing_id FROM purchases WHERE buyer_id = $1",
      [user.id],
    );

    return result.rows.map((row) => row.listing_id);
  },
);
