-- Allow users to upload a custom profile picture.
-- NULL means "no custom avatar" — UI falls back to a username-initial badge.
ALTER TABLE users ADD COLUMN avatar_url TEXT;
