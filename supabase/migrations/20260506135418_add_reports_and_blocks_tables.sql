-- Reports: gebruikers kunnen anderen melden
CREATE TABLE IF NOT EXISTS reports (
  id          uuid        primary key default gen_random_uuid(),
  reporter_id uuid        not null references profiles(id) on delete cascade,
  reported_id uuid        not null references profiles(id) on delete cascade,
  reason      text        not null,
  created_at  timestamptz default now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eigen meldingen inzien" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "melding versturen" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

GRANT SELECT, INSERT ON public.reports TO authenticated;

-- Blocks: gebruikers kunnen anderen blokkeren
CREATE TABLE IF NOT EXISTS blocks (
  id         uuid        primary key default gen_random_uuid(),
  blocker_id uuid        not null references profiles(id) on delete cascade,
  blocked_id uuid        not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eigen blokkades inzien" ON blocks
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "iemand blokkeren" ON blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "blokkade opheffen" ON blocks
  FOR DELETE USING (auth.uid() = blocker_id);

GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
