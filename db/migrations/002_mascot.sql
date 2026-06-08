ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mascot TEXT NOT NULL DEFAULT 'nova';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_mascot_check;

ALTER TABLE users
  ADD CONSTRAINT users_mascot_check CHECK (mascot IN ('nova', 'comet'));
