import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Pool } from "pg";

import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";

export type NotificationType = "prompt_sold" | "review_received" | "report_resolved";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * Best-effort, fire-after-success. Never throws — failures are logged so a
 * notification bug can't fail the purchase/review/moderation it's attached to.
 */
export async function insertNotification(
  db: Pool,
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  referenceId?: string
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body ?? null, referenceId ?? null]
    );
  } catch (err) {
    console.error("Failed to insert notification:", err);
  }
}

export const listNotifications = createServerFn({ method: "GET" })
  .handler(async (): Promise<Notification[]> => {
    const user = await getSessionUser();
    if (!user) return [];

    const db = getDb();
    const result = await db.query<{
      id: string;
      type: NotificationType;
      title: string;
      body: string | null;
      reference_id: string | null;
      is_read: boolean;
      created_at: string;
    }>(
      `SELECT id, type, title, body, reference_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [user.id]
    );

    return result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      referenceId: row.reference_id,
      isRead: row.is_read,
      createdAt: row.created_at,
    }));
  });

export const getUnreadCount = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ count: number }> => {
    const user = await getSessionUser();
    if (!user) return { count: 0 };

    const db = getDb();
    const result = await db.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false",
      [user.id]
    );

    return { count: parseInt(result.rows[0].count, 10) };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in.");

    const db = getDb();
    await db.query(
      "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
      [user.id]
    );

    return { ok: true as const };
  });

export const markOneRead = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in.");

    const db = getDb();
    await db.query(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
      [data.id, user.id]
    );

    return { ok: true as const };
  });
