import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { CREDIT_RATES } from "../gamification";

export const recordCopy = createServerFn({ method: "POST" })
  .inputValidator(z.object({ listingId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) return { ok: true as const }; // anonymous copies don't earn rewards

    const db = getDb();

    // Check if this user already got a reward for copying this listing
    const existing = await db.query(
      "SELECT 1 FROM prompt_copies WHERE user_id = $1 AND listing_id = $2",
      [user.id, data.listingId]
    );
    if (existing.rows.length > 0) {
      // Already recorded — still increment count but no credit reward
      await db.query(
        "UPDATE prompt_listings SET copy_count = copy_count + 1 WHERE id = $1",
        [data.listingId]
      );
      return { ok: true as const, rewarded: false };
    }

    // Get listing author
    const listing = await db.query<{ user_id: string }>(
      "SELECT user_id FROM prompt_listings WHERE id = $1 AND status = 'published'",
      [data.listingId]
    );
    if (listing.rows.length === 0) return { ok: true as const, rewarded: false };

    const authorId = listing.rows[0].user_id;

    // Don't reward copying your own prompt
    if (authorId === user.id) {
      await db.query(
        "UPDATE prompt_listings SET copy_count = copy_count + 1 WHERE id = $1",
        [data.listingId]
      );
      return { ok: true as const, rewarded: false };
    }

    // Record the copy
    await db.query(
      "INSERT INTO prompt_copies (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user.id, data.listingId]
    );

    // Increment copy_count
    await db.query(
      "UPDATE prompt_listings SET copy_count = copy_count + 1 WHERE id = $1",
      [data.listingId]
    );

    // Award author their 70% share
    await db.query(
      `INSERT INTO user_credits (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + $2, updated_at = now()`,
      [authorId, CREDIT_RATES.copyAuthorShare]
    );
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, type, note)
       VALUES ($1, $2, 'copy_earn', $3)`,
      [authorId, CREDIT_RATES.copyAuthorShare, `Copy earn: ${data.listingId}`]
    );

    // Log platform fee (audit trail, not a deduction from anyone)
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, type, note)
       VALUES ($1, $2, 'platform_fee', $3)`,
      [authorId, -CREDIT_RATES.copyPlatformFee, `Platform fee on copy`]
    );

    return { ok: true as const, rewarded: true };
  });
