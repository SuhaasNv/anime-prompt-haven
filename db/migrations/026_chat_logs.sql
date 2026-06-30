-- Chat session logs for monitoring agent usage, errors, and tool call patterns.
CREATE TABLE IF NOT EXISTS chat_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mascot       TEXT        NOT NULL,
  duration_ms  INTEGER,
  tool_calls   TEXT[]      NOT NULL DEFAULT '{}',
  card_count   INTEGER     NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_logs_user_id_idx   ON chat_logs (user_id);
CREATE INDEX IF NOT EXISTS chat_logs_created_at_idx ON chat_logs (created_at DESC);
