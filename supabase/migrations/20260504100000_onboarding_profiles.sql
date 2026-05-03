-- Onboarding: nieuwe gebruikers vullen naam + e-mail; daarna zetten we onboarding_completed_at.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN profiles.email IS 'Contact/e-mail uit onboarding of profiel; los van Auth e-mail.';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'NULL = onboarding nog niet afgerond.';

-- Bestaande accounts: niet opnieuw door onboarding.
UPDATE profiles
SET onboarding_completed_at = coalesce(onboarding_completed_at, now())
WHERE onboarding_completed_at IS NULL;
