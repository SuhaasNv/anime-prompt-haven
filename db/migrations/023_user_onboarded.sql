-- Onboarding flag. Password sign-ups pick a username + companion during signup,
-- so they (and all existing users) are considered onboarded. New Google users are
-- created with onboarded = false and sent through /onboarding to choose theirs.

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT true;
