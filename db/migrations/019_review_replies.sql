-- Let prompt creators reply to reviews left on their listings.
ALTER TABLE reviews
  ADD COLUMN creator_reply TEXT CHECK (char_length(creator_reply) <= 500),
  ADD COLUMN creator_reply_at TIMESTAMPTZ;

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('prompt_sold', 'review_received', 'report_resolved', 'review_reply'));
