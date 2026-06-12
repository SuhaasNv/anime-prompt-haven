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
  avatarUrl: string | null;
  listingCount: number;
  reviewCount: number;
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
      avatar_url: string | null;
      count: string;
      review_count: string;
    }>(
      `SELECT u.id, u.username, u.mascot, u.bio, u.avatar_url,
              COUNT(DISTINCT pl.id) AS count,
              COUNT(r.id) AS review_count
       FROM users u
       JOIN prompt_listings pl ON pl.user_id = u.id AND pl.status = 'published' AND pl.is_nsfw = false
       LEFT JOIN reviews r ON r.listing_id = pl.id
       GROUP BY u.id, u.username, u.mascot, u.bio, u.avatar_url
       ORDER BY review_count DESC, count DESC
       LIMIT $1`,
      [data.limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      mascot: row.mascot,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      listingCount: parseInt(row.count, 10),
      reviewCount: parseInt(row.review_count, 10),
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
