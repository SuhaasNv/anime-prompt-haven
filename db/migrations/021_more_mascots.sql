-- Add three new selectable mascots (raven, vex, pixel) alongside nova/comet.
-- Widen the users.mascot CHECK constraint to allow the new keys.

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_mascot_check;

ALTER TABLE users
  ADD CONSTRAINT users_mascot_check
  CHECK (mascot IN ('nova', 'comet', 'raven', 'vex', 'pixel'));
