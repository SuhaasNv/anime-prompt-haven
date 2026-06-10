import { createServerFn } from "@tanstack/react-start";
import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { logAdminAction } from "./audit.functions";

export const CREDITS_QUERY_KEY = ["credits"] as const;

export const getMyCredits = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await getSessionUser();
    if (!user) return { balance: 0 };

    const db = getDb();
    const result = await db.query<{ balance: string }>(
      "SELECT balance FROM user_credits WHERE user_id = $1",
      [user.id]
    );

    if (result.rows.length === 0) {
      return { balance: 0 };
    }

    return { balance: parseFloat(result.rows[0].balance) };
  });

export const topUpCredits = createServerFn({ method: "POST" })
  .handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new Error("You must be signed in to top up credits.");

    const db = getDb();
    const TOPUP_AMOUNT = 50.0;

    // Rate limit: max 1 topup per 24 hours per user
    const lastTopup = await db.query<{ created_at: string }>(
      `SELECT created_at FROM credit_transactions
       WHERE user_id = $1 AND type = 'bonus' AND created_at > now() - interval '24 hours'
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (lastTopup.rows.length > 0) {
      throw new Error("You can only top up credits once per day. Try again later.");
    }

    // Insert or update user_credits
    await db.query(
      `INSERT INTO user_credits (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET balance = user_credits.balance + $2, updated_at = now()`,
      [user.id, TOPUP_AMOUNT]
    );

    // Log the transaction
    await db.query(
      `INSERT INTO credit_transactions (user_id, amount, type, note)
       VALUES ($1, $2, 'bonus', 'Demo top-up')`,
      [user.id, TOPUP_AMOUNT]
    );

    // Fetch updated balance
    const result = await db.query<{ balance: string }>(
      "SELECT balance FROM user_credits WHERE user_id = $1",
      [user.id]
    );

    return {
      ok: true as const,
      newBalance: parseFloat(result.rows[0].balance),
    };
  });

export const listTransactions = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await getSessionUser();
    if (!user) return [];

    const db = getDb();
    const result = await db.query(
      `SELECT id, amount, type, note, created_at
       FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [user.id]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      amount: parseFloat(row.amount),
      type: row.type,
      note: row.note,
      createdAt: row.created_at,
    }));
  });

export const listAllTransactions = createServerFn({ method: "GET" })
  .handler(async () => {
    const user = await getSessionUser();
    if (!user?.is_admin) throw new Error("Admin only");

    const db = getDb();

    // Log admin access for audit trail
    await logAdminAction(db, user.id, "list_all_transactions");

    const txns = await db.query(
      `SELECT ct.id, ct.amount, ct.type, ct.note, ct.created_at,
              u.username
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.user_id
       ORDER BY ct.created_at DESC
       LIMIT 200`,
    );

    const stats = await db.query<{ total_distributed: string; total_platform_fees: string }>(
      `SELECT
         COALESCE(SUM(CASE WHEN amount > 0 AND type != 'platform_fee' THEN amount ELSE 0 END), 0) AS total_distributed,
         COALESCE(SUM(CASE WHEN type = 'platform_fee' THEN ABS(amount) ELSE 0 END), 0) AS total_platform_fees
       FROM credit_transactions
       WHERE created_at >= now() - interval '24 hours'`
    );

    return {
      transactions: txns.rows.map((row: any) => ({
        id: row.id,
        username: row.username,
        amount: parseFloat(row.amount),
        type: row.type,
        note: row.note,
        createdAt: row.created_at,
      })),
      stats: {
        totalDistributed: parseFloat(stats.rows[0].total_distributed),
        totalPlatformFees: parseFloat(stats.rows[0].total_platform_fees),
      },
    };
  });
