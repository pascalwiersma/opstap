ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS city text DEFAULT 'Groningen';
ALTER TABLE profiles  ADD COLUMN IF NOT EXISTS push_token text;
