import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getDb } from "../db.server";
import { listListings } from "./listings.functions";
import type { MascotKey } from "../mascots";

export interface TrendingTag {
  tag: string;
  count: number;
}

export interface FeaturedCreator {
  id: string;
  username: string;
  mascot: MascotKey;
  bio: string | null;
  totalEarnings: number;
}

export const getTrendingTags = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().int().min(1).max(50).optional().default(12) }))
  .handler(async ({ data }): Promise<TrendingTag[]> => {
    const db = getDb();
    const result = await db.query<{ tag: string; count: string }>(
      `SELECT unnest(tags) AS tag, COUNT(*) AS count
       FROM prompt_listings
       WHERE status = 'published' AND is_nsfw = false
       GROUP BY tag
       ORDER BY count DESC
       LIMIT $1`,
      [data.limit]
    );

    return result.rows.map((row) => ({ tag: row.tag, count: parseInt(row.count, 10) }));
  });

export const getFeaturedCreators = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().int().min(1).max(50).optional().default(6) }))
  .handler(async ({ data }): Promise<FeaturedCreator[]> => {
    const db = getDb();
    const result = await db.query<{
      id: string;
      username: string;
      mascot: MascotKey;
      bio: string | null;
      total: string;
    }>(
      `SELECT u.id, u.username, u.mascot, u.bio, earnings.total
       FROM users u
       JOIN (
         SELECT user_id, SUM(amount) AS total
         FROM credit_transactions
         WHERE type = 'sale_earn'
         GROUP BY user_id
       ) earnings ON earnings.user_id = u.id
       WHERE EXISTS (
         SELECT 1 FROM prompt_listings pl
         WHERE pl.user_id = u.id AND pl.status = 'published' AND pl.is_nsfw = false
       )
       ORDER BY earnings.total DESC
       LIMIT $1`,
      [data.limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      mascot: row.mascot,
      bio: row.bio,
      totalEarnings: parseFloat(row.total),
    }));
  });

export const getNewArrivals = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().int().min(1).max(50).optional().default(8) }))
  .handler(async ({ data }) => {
    return listListings({ data: { sort: "newest", limit: data.limit, offset: 0 } });
  });

export const getTrendingPrompts = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().int().min(1).max(50).optional().default(8) }))
  .handler(async ({ data }) => {
    return listListings({ data: { sort: "trending", limit: data.limit, offset: 0 } });
  });
