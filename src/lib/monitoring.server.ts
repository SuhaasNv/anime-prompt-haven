// Structured monitoring for the LangChain agent layer.
//
// LangSmith tracing is automatic — just set these env vars in Railway:
//   LANGCHAIN_TRACING_V2=true
//   LANGCHAIN_API_KEY=ls__...
//   LANGCHAIN_PROJECT=promptstar
//
// Chat events are also written to the chat_logs table so admins can inspect
// volume, tool usage, error rates, and latency without a third-party dashboard.

import { getDb } from "@/lib/db.server";

export interface ChatLogEntry {
  userId: string;
  mascot: string;
  durationMs: number;
  toolCalls: string[];
  cardCount: number;
  error?: string;
}

/** Write one chat interaction to the DB. Never throws — log failures are swallowed. */
export async function logChatEvent(entry: ChatLogEntry): Promise<void> {
  const tag = `[chat] user=${entry.userId} mascot=${entry.mascot} duration=${entry.durationMs}ms tools=[${entry.toolCalls.join(",")}] cards=${entry.cardCount}${entry.error ? ` error=${entry.error}` : ""}`;
  console.log(tag);

  try {
    await getDb().query(
      `INSERT INTO chat_logs (user_id, mascot, duration_ms, tool_calls, card_count, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.userId,
        entry.mascot,
        entry.durationMs,
        entry.toolCalls,
        entry.cardCount,
        entry.error ?? null,
      ],
    );
  } catch (err) {
    console.error("[monitoring] Failed to persist chat log:", err);
  }
}

export interface ChatMetrics {
  volume14d: { date: string; count: number }[];
  toolUsage: { tool: string; count: number }[];
  topUsers: { username: string; count: number }[];
  stats24h: { total: number; errors: number; avgMs: number };
}

export async function getChatMetrics(): Promise<ChatMetrics> {
  const db = getDb();

  const [vol, tools, users, stats] = await Promise.all([
    db.query<{ date: string; count: string }>(
      `SELECT DATE(created_at)::text AS date, COUNT(*)::text AS count
       FROM chat_logs
       WHERE created_at > NOW() - INTERVAL '14 days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
    ),
    db.query<{ tool: string; count: string }>(
      `SELECT unnest(tool_calls) AS tool, COUNT(*)::text AS count
       FROM chat_logs
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY tool
       ORDER BY count DESC
       LIMIT 10`,
    ),
    db.query<{ username: string; count: string }>(
      `SELECT u.username, COUNT(*)::text AS count
       FROM chat_logs cl
       JOIN users u ON u.id = cl.user_id
       WHERE cl.created_at > NOW() - INTERVAL '7 days'
       GROUP BY u.username
       ORDER BY count DESC
       LIMIT 8`,
    ),
    db.query<{ total: string; errors: string; avg_ms: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(error)::text AS errors,
              COALESCE(AVG(duration_ms), 0)::text AS avg_ms
       FROM chat_logs
       WHERE created_at > NOW() - INTERVAL '24 hours'`,
    ),
  ]);

  return {
    volume14d: vol.rows.map((r) => ({ date: r.date, count: Number(r.count) })),
    toolUsage: tools.rows.map((r) => ({ tool: r.tool, count: Number(r.count) })),
    topUsers: users.rows.map((r) => ({ username: r.username, count: Number(r.count) })),
    stats24h: {
      total: Number(stats.rows[0]?.total ?? 0),
      errors: Number(stats.rows[0]?.errors ?? 0),
      avgMs: Math.round(Number(stats.rows[0]?.avg_ms ?? 0)),
    },
  };
}
