CREATE TABLE IF NOT EXISTS friendships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  friend_id  uuid not null references profiles(id) on delete cascade,
  status     text not null default 'pending'
               check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zie eigen vriendschappen" ON friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "stuur vriendschapsverzoek" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reageer op verzoek" ON friendships
  FOR UPDATE USING (auth.uid() = friend_id OR auth.uid() = user_id);

CREATE POLICY "verwijder vriendschap" ON friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT SELECT ON public.friendships TO anon;
