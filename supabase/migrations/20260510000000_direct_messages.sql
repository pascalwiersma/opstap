-- direct_messages: privé gesprekken tussen twee gebruikers
CREATE TABLE direct_messages (
  id                uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id          uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id          uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stream_channel_id text  NOT NULL UNIQUE,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK(user1_id < user2_id)
);

CREATE INDEX direct_messages_user1_idx ON direct_messages(user1_id);
CREATE INDEX direct_messages_user2_idx ON direct_messages(user2_id);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gebruikers zien eigen DMs"
  ON direct_messages FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Gebruikers maken eigen DMs aan"
  ON direct_messages FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
