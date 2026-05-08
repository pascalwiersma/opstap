ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_verified     boolean     default false,
  ADD COLUMN IF NOT EXISTS identity_verified_at  timestamptz;

CREATE TABLE IF NOT EXISTS identity_verifications (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references profiles(id) on delete cascade,
  session_id     text        not null unique,
  status         text        not null default 'Not Started',
  vendor_data    text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eigen verificaties inzien" ON identity_verifications
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.identity_verifications TO authenticated;
