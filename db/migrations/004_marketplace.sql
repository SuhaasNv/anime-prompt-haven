-- Phase 2: Marketplace Schema
-- Adds NSFW tracking, soft delete support, saved prompts, purchases, reviews, reports, and credits

-- ============================================================================
-- 1. Extend prompt_listings with marketplace metadata
-- ============================================================================

ALTER TABLE prompt_listings
  ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'flagged', 'removed')),
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS prompt_listings_status_idx ON prompt_listings(status);
CREATE INDEX IF NOT EXISTS prompt_listings_nsfw_idx ON prompt_listings(is_nsfw);
CREATE INDEX IF NOT EXISTS prompt_listings_view_count_idx ON prompt_listings(view_count DESC);

-- ============================================================================
-- 2. Saved Prompts (Bookmarks/Favorites)
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_prompts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES prompt_listings(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS saved_prompts_user_idx ON saved_prompts(user_id);
CREATE INDEX IF NOT EXISTS saved_prompts_listing_idx ON saved_prompts(listing_id);

-- ============================================================================
-- 3. Purchases (Transactions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES prompt_listings(id) ON DELETE CASCADE,
  price_paid NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(buyer_id, listing_id)
);

CREATE INDEX IF NOT EXISTS purchases_buyer_idx ON purchases(buyer_id);
CREATE INDEX IF NOT EXISTS purchases_listing_idx ON purchases(listing_id);
CREATE INDEX IF NOT EXISTS purchases_created_at_idx ON purchases(created_at DESC);

-- ============================================================================
-- 4. Reviews (User Feedback)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES prompt_listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT CHECK (char_length(body) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(listing_id, user_id)
);

CREATE INDEX IF NOT EXISTS reviews_listing_idx ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS reviews_user_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_created_at_idx ON reviews(created_at DESC);

-- ============================================================================
-- 5. Reports/Flags (Community Moderation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES prompt_listings(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'nsfw_undisclosed',
    'spam',
    'stolen_content',
    'misleading',
    'other'
  )),
  note TEXT CHECK (char_length(note) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reporter_id, listing_id)
);

CREATE INDEX IF NOT EXISTS reports_listing_idx ON reports(listing_id);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_reason_idx ON reports(reason);

-- ============================================================================
-- 6. User Credits (Virtual Marketplace Currency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. Credit Transaction Log (Immutable Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'sale_earn', 'refund', 'bonus', 'withdrawal')),
  reference_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_type_idx ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS credit_transactions_created_at_idx ON credit_transactions(created_at DESC);

-- ============================================================================
-- 8. Admin Role
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- Migration complete
-- ============================================================================
-- All new tables created with idempotent IF NOT EXISTS clauses
-- Safe to run multiple times
