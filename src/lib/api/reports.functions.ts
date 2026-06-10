import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { sanitize } from "../sanitize";
import { insertNotification } from "./notifications.functions";

const REPORT_THRESHOLD = 5; // Auto-flag after this many reports

export const reportListing = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      listingId: z.string().uuid(),
      reason: z.enum(["nsfw_undisclosed", "spam", "stolen_content", "misleading", "other"]),
      note: z.string().max(300).optional(),
    })
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in to report listings.");

    const db = getDb();

    // Get listing to check ownership
    const listing = await db.query<{ user_id: string }>(
      "SELECT user_id FROM prompt_listings WHERE id = $1",
      [data.listingId]
    );

    if (listing.rows.length === 0) {
      throw new Error("Listing not found.");
    }

    if (listing.rows[0].user_id === user.id) {
      throw new Error("You cannot report your own listing.");
    }

    // Insert report (ON CONFLICT prevents duplicate reports)
    await db.query(
      `INSERT INTO reports (reporter_id, listing_id, reason, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (reporter_id, listing_id) DO UPDATE
       SET reason = $3, note = $4`,
      [user.id, data.listingId, data.reason, data.note ? sanitize(data.note) : null]
    );

    // Check if we should auto-flag the listing
    const reportCount = await db.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM reports WHERE listing_id = $1",
      [data.listingId]
    );

    const count = parseInt(reportCount.rows[0].count, 10);
    let flagged = false;

    if (count >= REPORT_THRESHOLD) {
      await db.query(
        "UPDATE prompt_listings SET status = 'flagged' WHERE id = $1",
        [data.listingId]
      );
      flagged = true;
    }

    // If nsfw_undisclosed, auto-set is_nsfw flag
    if (data.reason === "nsfw_undisclosed") {
      await db.query(
        "UPDATE prompt_listings SET is_nsfw = true WHERE id = $1",
        [data.listingId]
      );
    }

    return { ok: true as const, flagged, reportCount: count };
  });

export const listReports = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Only admins can view reports.");
    }

    const db = getDb();
    const result = await db.query(
      `SELECT
        prompt_listings.id,
        prompt_listings.title,
        prompt_listings.status,
        COUNT(reports.id) as report_count,
        COUNT(CASE WHEN reports.reason = 'nsfw_undisclosed' THEN 1 END) as nsfw_reports,
        COUNT(CASE WHEN reports.reason = 'spam' THEN 1 END) as spam_reports,
        COUNT(CASE WHEN reports.reason = 'stolen_content' THEN 1 END) as stolen_reports,
        COUNT(CASE WHEN reports.reason = 'misleading' THEN 1 END) as misleading_reports,
        COUNT(CASE WHEN reports.reason = 'other' THEN 1 END) as other_reports
      FROM prompt_listings
      LEFT JOIN reports ON reports.listing_id = prompt_listings.id
      WHERE prompt_listings.status = 'flagged'
      GROUP BY prompt_listings.id, prompt_listings.title, prompt_listings.status
      ORDER BY report_count DESC`,
      []
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      reportCount: parseInt(row.report_count, 10),
      reasons: {
        nsfw: parseInt(row.nsfw_reports, 10),
        spam: parseInt(row.spam_reports, 10),
        stolen: parseInt(row.stolen_reports, 10),
        misleading: parseInt(row.misleading_reports, 10),
        other: parseInt(row.other_reports, 10),
      },
    }));
  });

export const moderateListing = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      listingId: z.string().uuid(),
      action: z.enum(["restore", "remove"]),
    })
  )
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      throw new Error("Only admins can moderate listings.");
    }

    const db = getDb();
    const newStatus = data.action === "restore" ? "published" : "removed";

    const result = await db.query<{ user_id: string; title: string }>(
      "UPDATE prompt_listings SET status = $1 WHERE id = $2 RETURNING user_id, title",
      [newStatus, data.listingId]
    );

    // Best-effort: never fails the moderation action if this throws.
    if (data.action === "restore" && result.rows.length > 0) {
      await insertNotification(
        db,
        result.rows[0].user_id,
        "report_resolved",
        "Your prompt was restored",
        `"${result.rows[0].title}" was reviewed and restored to the marketplace.`,
        data.listingId
      );
    }

    return { ok: true as const };
  });
