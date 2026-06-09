-- Add bio field to users for profile page
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
