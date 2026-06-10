ALTER TABLE collections ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS collections_public_idx ON collections(is_public) WHERE is_public = TRUE;
