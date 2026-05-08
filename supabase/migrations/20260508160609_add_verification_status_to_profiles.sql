ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none'
  CHECK (verification_status IN ('none', 'pending', 'approved'));
