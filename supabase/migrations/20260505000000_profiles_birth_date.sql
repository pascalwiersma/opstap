-- Geboortedatum; leeftijd in de app wordt afgeleid en opgeslagen in profiles.age bij update.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN profiles.birth_date IS 'Geboortedatum; leeftijd (profiles.age) wordt client-side bijgewerkt.';
