-- Allow creators to temporarily hide a published listing from the
-- marketplace without deleting it (reversible, unlike 'removed').

ALTER TABLE prompt_listings DROP CONSTRAINT prompt_listings_status_check;
ALTER TABLE prompt_listings ADD CONSTRAINT prompt_listings_status_check
  CHECK (status IN ('draft', 'published', 'flagged', 'removed', 'hidden'));
