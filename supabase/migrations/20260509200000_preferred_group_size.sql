ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_group_size integer DEFAULT 4
  CHECK (preferred_group_size >= 3 AND preferred_group_size <= 5);
