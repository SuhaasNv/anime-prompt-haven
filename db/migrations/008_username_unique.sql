-- Enforce unique usernames so /u/$username profile lookups are unambiguous.
-- Existing duplicates: keep the earliest account's username unchanged and
-- append a short id-derived suffix to the later ones (guaranteed unique
-- since it's derived from each user's own UUID).
WITH ranked AS (
  SELECT id, username,
         ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at ASC, id ASC) AS rn
  FROM users
)
UPDATE users
SET username = users.username || '_' || substr(ranked.id::text, 1, 8)
FROM ranked
WHERE users.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (username);
