import { createServerFn } from "@tanstack/react-start";
import { getSessionUser } from "../auth.server";
import { getDb } from "../db.server";

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
