-- Product tour completion flag. The new-user walkthrough (react-joyride) runs
-- once on the first dashboard visit after onboarding; this records that it ran
-- so it doesn't repeat across devices. Existing users default to false and will
-- see the tour once on their next dashboard load (or can dismiss it).

ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT false;
