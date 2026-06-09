-- Add copy_count tracking to prompt_listings
ALTER TABLE prompt_listings ADD COLUMN IF NOT EXISTS copy_count INTEGER NOT NULL DEFAULT 0;

-- Track which user copied which listing (1 reward per user per listing)
CREATE TABLE IF NOT EXISTS prompt_copies (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES prompt_listings(id) ON DELETE CASCADE,
  copied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS prompt_copies_listing_idx ON prompt_copies(listing_id);
