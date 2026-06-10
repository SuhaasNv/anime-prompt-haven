-- Partial index covering the hot listListings/feed query
-- (status='published' AND is_nsfw=false, ORDER BY created_at DESC).
-- Also serves the explore page's "New Arrivals"/"Trending" wrappers.
CREATE INDEX IF NOT EXISTS prompt_listings_published_feed_idx
  ON prompt_listings (created_at DESC)
  WHERE status = 'published' AND is_nsfw = false;
