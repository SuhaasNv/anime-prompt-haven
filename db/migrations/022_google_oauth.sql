-- Google SSO support.
--
-- Users who sign in with Google have no password, so password_hash must be
-- nullable. google_id stores Google's stable account identifier (the OpenID
-- `sub` claim) and is unique so one Google account maps to one user. Existing
-- password accounts keep auth_provider = 'password'; linking a Google login to
-- an existing email just sets google_id on that row.

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password';

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users (google_id) WHERE google_id IS NOT NULL;

-- Guard against a row ending up with neither a password nor a Google identity.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_has_credential;
ALTER TABLE users ADD CONSTRAINT users_has_credential
  CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL);
