import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import type { Prompt } from "../mock-data";

const MODEL_VALUES = ["Midjourney", "ChatGPT", "DALL-E", "Flux", "Stable Diffusion"] as const;
const SHADOWS = ["magenta", "orange", "yellow", "purple"] as const;
const ROTATIONS = [0, 1, -1] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Data URIs are stored inline (no external storage configured); ~4.5MB decoded
// is plenty for a single preview image while keeping rows manageable.
const MAX_IMAGE_LENGTH = 6_000_000;

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
    rating: 5,
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

export const listListings = createServerFn({ method: "GET" }).handler(async (): Promise<Prompt[]> => {
  const db = getDb();
  const result = await db.query<ListingRow>(
    `SELECT ${LISTING_COLUMNS}
     FROM prompt_listings
     JOIN users ON users.id = prompt_listings.user_id
     ORDER BY prompt_listings.created_at DESC`,
  );
  return result.rows.map(toPrompt);
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
       WHERE prompt_listings.id = $1`,
      [data.id],
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
      price: z.number().min(0).max(999),
      category: z.string().min(1),
      model: z.enum(MODEL_VALUES),
      tags: z.array(z.string().min(1).max(24)).max(6),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    const tags = data.tags.map((t) => (t.startsWith("#") ? t.toUpperCase() : `#${t.toUpperCase()}`));

    const result = await db.query<{ id: string }>(
      `INSERT INTO prompt_listings (user_id, title, description, body, image, price, category, model, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [user.id, data.title, data.description, data.body, data.image, data.price, data.category, data.model, tags],
    );
    return { id: result.rows[0].id };
  });
