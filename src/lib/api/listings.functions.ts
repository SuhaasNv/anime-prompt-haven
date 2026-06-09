import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { sanitize } from "../sanitize";
import { CREDIT_RATES } from "../gamification";
import type { Prompt } from "../mock-data";

export const CURRENT_USER_QUERY_KEY = ["current-user"] as const;

const MODEL_VALUES = ["Midjourney", "ChatGPT", "DALL-E", "Flux", "Stable Diffusion"] as const;
const SHADOWS = ["magenta", "orange", "yellow", "purple"] as const;
const ROTATIONS = [0, 1, -1] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE_LENGTH = 6_000_000;
const MAX_LISTINGS_PER_USER = 10;
const MAX_PRICE = 49.99;

async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("You must be signed in.");
  }
  return user;
}

type ListingRow = {
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
};

function toPrompt(row: ListingRow, index: number): Prompt {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    body: row.body,
    image: row.image,
    creator: row.username,
    creatorEmoji: "🆕",
    price: Number(row.price),
    rating: 4.5,
    reviews: 0,
    category: row.category,
    model: row.model as Prompt["model"],
    tags: row.tags,
    shadow: SHADOWS[index % SHADOWS.length],
    rotate: ROTATIONS[index % ROTATIONS.length],
  };
}

const LISTING_COLUMNS = `
  prompt_listings.id, prompt_listings.title, prompt_listings.description,
  prompt_listings.body, prompt_listings.image, prompt_listings.price::text,
  prompt_listings.category, prompt_listings.model, prompt_listings.tags,
  users.username
`;

export const listListings = createServerFn({ method: "GET" })
  .validator(
    z.object({
      showNsfw: z.boolean().optional().default(false),
      sort: z.enum(["newest", "trending", "price_asc", "price_desc", "rating"]).optional().default("newest"),
      category: z.string().optional(),
      maxPrice: z.number().optional(),
      userId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).optional().default(24),
      offset: z.number().int().min(0).optional().default(0),
    })
  )
  .handler(async ({ data }): Promise<Prompt[]> => {
    const db = getDb();
    let whereConditions = ["prompt_listings.status = 'published'"];
    let orderBy = "prompt_listings.created_at DESC";
    const params: any[] = [];

    // NSFW filter
    if (!data.showNsfw) {
      whereConditions.push("prompt_listings.is_nsfw = false");
    }

    // Category filter
    if (data.category) {
      whereConditions.push("prompt_listings.category = $" + (params.length + 1));
      params.push(data.category);
    }

    // Price filter
    if (data.maxPrice !== undefined) {
      whereConditions.push("prompt_listings.price <= $" + (params.length + 1));
      params.push(data.maxPrice);
    }

    // User filter (for "My Listings")
    if (data.userId) {
      whereConditions.push("prompt_listings.user_id = $" + (params.length + 1));
      params.push(data.userId);
    }

    // Sort
    switch (data.sort) {
      case "trending":
        orderBy =
          "(prompt_listings.view_count * 0.2 + prompt_listings.purchase_count * 2.0 + prompt_listings.save_count * 0.8) DESC";
        break;
      case "price_asc":
        orderBy = "prompt_listings.price ASC";
        break;
      case "price_desc":
        orderBy = "prompt_listings.price DESC";
        break;
      case "rating":
        orderBy = "COALESCE(avg_r.avg_rating, 0) DESC";
        break;
      default:
        orderBy = "prompt_listings.created_at DESC";
    }

    const whereClause = whereConditions.join(" AND ");
    const offset = data.offset;
    const limit = data.limit;

    const result = await db.query<ListingRow>(
      `WITH avg_r AS (
         SELECT listing_id, AVG(rating) AS avg_rating FROM reviews GROUP BY listing_id
       )
       SELECT ${LISTING_COLUMNS}
       FROM prompt_listings
       JOIN users ON users.id = prompt_listings.user_id
       LEFT JOIN avg_r ON avg_r.listing_id = prompt_listings.id
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return result.rows.map((row, index) => toPrompt(row, offset + index));
  });

export const getListing = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<Prompt | null> => {
    if (!UUID_RE.test(data.id)) return null;

    const db = getDb();
    const result = await db.query<ListingRow>(
      `SELECT ${LISTING_COLUMNS}
       FROM prompt_listings
       JOIN users ON users.id = prompt_listings.user_id
       WHERE prompt_listings.id = $1 AND prompt_listings.status != 'removed'`,
      [data.id]
    );

    const row = result.rows[0];
    return row ? toPrompt(row, 0) : null;
  });

export const createListing = createServerFn({ method: "POST" })
  .validator(
    z.object({
      title: z.string().min(2).max(80),
      description: z.string().min(10).max(280),
      body: z.string().min(10).max(2000),
      image: z
        .string()
        .min(1, "An image is required.")
        .max(MAX_IMAGE_LENGTH, "That image is too large.")
        .startsWith("data:image/", "Upload a valid image file."),
      price: z.number().min(0).max(MAX_PRICE),
      category: z.string().min(1),
      model: z.enum(MODEL_VALUES),
      tags: z.array(z.string().min(1).max(24)).max(6),
      isNsfw: z.boolean().optional().default(false),
      status: z.enum(["draft", "published"]).optional().default("published"),
    })
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();

    // Check listing cap
    const activeListings = await db.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM prompt_listings WHERE user_id = $1 AND status != 'removed'",
      [user.id]
    );

    if (parseInt(activeListings.rows[0].count, 10) >= MAX_LISTINGS_PER_USER) {
      throw new Error(
        `You have reached the maximum of ${MAX_LISTINGS_PER_USER} active listings. Remove or draft some to add more.`
      );
    }

    // Initialize user_credits if needed
    await db.query(
      `INSERT INTO user_credits (user_id, balance) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
      [user.id]
    );

    const title = sanitize(data.title);
    const description = sanitize(data.description);
    const body = sanitize(data.body);
    const tags = data.tags.map((t) => {
      const clean = sanitize(t);
      return clean.startsWith("#") ? clean.toUpperCase() : `#${clean.toUpperCase()}`;
    });

    const result = await db.query<{ id: string }>(
      `INSERT INTO prompt_listings (user_id, title, description, body, image, price, category, model, tags, is_nsfw, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        user.id,
        title,
        description,
        body,
        data.image,
        data.price,
        sanitize(data.category),
        data.model,
        tags,
        data.isNsfw,
        data.status,
      ]
    );

    const listingId = result.rows[0].id;

    // Publish bonus: +2.00 credits to the author
    if (data.status === "published") {
      await db.query(
        `INSERT INTO user_credits (user_id, balance) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + $2, updated_at = now()`,
        [user.id, CREDIT_RATES.publishBonus]
      );
      await db.query(
        `INSERT INTO credit_transactions (user_id, amount, type, note) VALUES ($1, $2, 'bonus', 'Publish reward')`,
        [user.id, CREDIT_RATES.publishBonus]
      );
    }

    return { id: listingId };
  });

export const deleteListing = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();

    // Check ownership
    const listing = await db.query<{ user_id: string }>(
      "SELECT user_id FROM prompt_listings WHERE id = $1",
      [data.id]
    );

    if (listing.rows.length === 0) {
      throw new Error("Listing not found.");
    }

    if (listing.rows[0].user_id !== user.id && !user.is_admin) {
      throw new Error("You can only delete your own listings.");
    }

    // Soft delete
    await db.query(
      "UPDATE prompt_listings SET status = 'removed' WHERE id = $1",
      [data.id]
    );

    return { ok: true as const };
  });

export const updateListing = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(2).max(80).optional(),
      description: z.string().min(10).max(280).optional(),
      body: z.string().min(10).max(2000).optional(),
      price: z.number().min(0).max(MAX_PRICE).optional(),
      category: z.string().optional(),
      model: z.enum(MODEL_VALUES).optional(),
      tags: z.array(z.string().min(1).max(24)).max(6).optional(),
      status: z.enum(["draft", "published"]).optional(),
    })
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();

    // Check ownership
    const listing = await db.query<{ user_id: string; is_nsfw: boolean }>(
      "SELECT user_id, is_nsfw FROM prompt_listings WHERE id = $1",
      [data.id]
    );

    if (listing.rows.length === 0) {
      throw new Error("Listing not found.");
    }

    if (listing.rows[0].user_id !== user.id && !user.is_admin) {
      throw new Error("You can only edit your own listings.");
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(sanitize(data.title));
      paramIndex++;
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(sanitize(data.description));
      paramIndex++;
    }
    if (data.body !== undefined) {
      updates.push(`body = $${paramIndex}`);
      params.push(sanitize(data.body));
      paramIndex++;
    }
    if (data.price !== undefined) {
      updates.push(`price = $${paramIndex}`);
      params.push(data.price);
      paramIndex++;
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      params.push(sanitize(data.category));
      paramIndex++;
    }
    if (data.model !== undefined) {
      updates.push(`model = $${paramIndex}`);
      params.push(data.model);
      paramIndex++;
    }
    if (data.tags !== undefined) {
      const tags = data.tags.map((t) => {
        const clean = sanitize(t);
        return clean.startsWith("#") ? clean.toUpperCase() : `#${clean.toUpperCase()}`;
      });
      updates.push(`tags = $${paramIndex}`);
      params.push(tags);
      paramIndex++;
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(data.status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return { ok: true as const };
    }

    params.push(data.id);
    await db.query(
      `UPDATE prompt_listings SET ${updates.join(", ")} WHERE id = $${paramIndex}`,
      params
    );

    return { ok: true as const };
  });

export const getMyStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await getSessionUser();
    if (!user) return { listingsCount: 0, salesCount: 0, savesReceived: 0, copyCount: 0 };

    const db = getDb();
    const result = await db.query<{
      listings_count: string;
      sales_count: string;
      saves_received: string;
      copy_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM prompt_listings WHERE user_id = $1 AND status != 'removed') AS listings_count,
         (SELECT COUNT(*) FROM purchases p JOIN prompt_listings pl ON pl.id = p.listing_id WHERE pl.user_id = $1) AS sales_count,
         (SELECT COALESCE(SUM(save_count), 0) FROM prompt_listings WHERE user_id = $1) AS saves_received,
         (SELECT COALESCE(SUM(copy_count), 0) FROM prompt_listings WHERE user_id = $1) AS copy_count`,
      [user.id]
    );

    const row = result.rows[0];
    return {
      listingsCount: parseInt(row.listings_count),
      salesCount: parseInt(row.sales_count),
      savesReceived: parseInt(row.saves_received),
      copyCount: parseInt(row.copy_count),
    };
  });

export interface MyListing {
  id: string;
  title: string;
  image: string;
  price: number;
  status: string;
  viewCount: number;
  saveCount: number;
  copyCount: number;
  purchaseCount: number;
  totalEarnings: number;
  createdAt: string;
}

export const listMyListings = createServerFn({ method: "GET" })
  .handler(async (): Promise<MyListing[]> => {
    const user = await getSessionUser();
    if (!user) return [];

    const db = getDb();
    const result = await db.query(
      `SELECT
         pl.id, pl.title, pl.image, pl.price::text, pl.status,
         pl.view_count, pl.save_count, pl.copy_count, pl.purchase_count,
         COALESCE(
           (SELECT SUM(p.price_paid * 0.70)
            FROM purchases p WHERE p.listing_id = pl.id),
           0
         )::text AS total_earnings,
         pl.created_at
       FROM prompt_listings pl
       WHERE pl.user_id = $1 AND pl.status != 'removed'
       ORDER BY pl.created_at DESC`,
      [user.id]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      image: row.image,
      price: parseFloat(row.price),
      status: row.status,
      viewCount: parseInt(row.view_count),
      saveCount: parseInt(row.save_count),
      copyCount: parseInt(row.copy_count),
      purchaseCount: parseInt(row.purchase_count),
      totalEarnings: parseFloat(row.total_earnings),
      createdAt: row.created_at,
    }));
  });

export const incrementViewCount = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) return { ok: true as const };
    const db = getDb();
    await db.query(
      "UPDATE prompt_listings SET view_count = view_count + 1 WHERE id = $1",
      [data.id]
    );
    return { ok: true as const };
  });
