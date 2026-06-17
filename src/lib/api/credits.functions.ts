import { createServerFn } from "@tanstack/react-start";
import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";
import { logAdminAction } from "./audit.functions";

export const CREDITS_QUERY_KEY = ["credits"] as const;

export const getMyCredits = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user) return { balance: 0 };

  const db = getDb();
  const result = await db.query<{ balance: string }>(
    "SELECT balance FROM user_credits WHERE user_id = $1",
    [user.id],
  );

  if (result.rows.length === 0) {
    return { balance: 0 };
  }

  return { balance: parseFloat(result.rows[0].balance) };
});

export const listTransactions = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user) return [];

  const db = getDb();
  const result = await db.query<{
    id: string;
    amount: string;
    type: string;
    note: string | null;
    created_at: string;
  }>(
    `SELECT id, amount, type, note, created_at
       FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
    [user.id],
  );

  return result.rows.map((row) => ({
    id: row.id,
    amount: parseFloat(row.amount),
    type: row.type,
    note: row.note,
    createdAt: row.created_at,
  }));
});

export const listAllTransactions = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser();
  if (!user?.is_admin) throw new Error("Admin only");

  const db = getDb();

  // Log admin access for audit trail
  await logAdminAction(db, user.id, "list_all_transactions");

  const txns = await db.query<{
    id: string;
    amount: string;
    type: string;
    note: string | null;
    created_at: string;
    username: string;
  }>(
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
       WHERE created_at >= now() - interval '24 hours'`,
  );

  return {
    transactions: txns.rows.map((row) => ({
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
