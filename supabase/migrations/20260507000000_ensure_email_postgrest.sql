-- email/onboarding_completed_at ontbreken in PostgREST-cache → idempotent toevoegen + cache reload.
-- (Als 20260504100000_onboarding_profiles.sql al liep, zijn deze ADD COLUMNs no-ops.)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

NOTIFY pgrst, 'reload schema';
