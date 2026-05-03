-- Kolom ontbreekt op productie of PostgREST-cache is oud → idempotent toevoegen + cache reload.
-- (Als 20260505000000_profiles_birth_date.sql al liep, is dit een no-op voor de kolom.)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN profiles.birth_date IS 'Geboortedatum; leeftijd (profiles.age) wordt client-side bijgewerkt.';

NOTIFY pgrst, 'reload schema';
