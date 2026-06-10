-- ============================================================================
-- Add Missing Indexes for Performance & DoS Prevention
-- ============================================================================

-- Notifications table indexes (critical for notifications page)
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);

-- Collections table indexes
CREATE INDEX IF NOT EXISTS collections_user_id_idx ON collections(user_id);
CREATE INDEX IF NOT EXISTS collections_user_created_at_idx ON collections(user_id, created_at DESC);

-- Collection prompts indexes
CREATE INDEX IF NOT EXISTS collection_prompts_collection_id_idx ON collection_prompts(collection_id);
CREATE INDEX IF NOT EXISTS collection_prompts_prompt_id_idx ON collection_prompts(prompt_id);

-- Saved prompts indexes
CREATE INDEX IF NOT EXISTS saved_prompts_listing_id_idx ON saved_prompts(listing_id);

-- Reports indexes
CREATE INDEX IF NOT EXISTS reports_listing_id_idx ON reports(listing_id);
CREATE INDEX IF NOT EXISTS reports_reporter_id_idx ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_reason_idx ON reports(reason);

-- Purchases indexes for quick lookups
CREATE INDEX IF NOT EXISTS purchases_listing_id_idx ON purchases(listing_id);

-- Sessions indexes for security
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
