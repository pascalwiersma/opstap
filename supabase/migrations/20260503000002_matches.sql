-- matches: een groepje mensen die samen uitgaan
CREATE TABLE matches (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date  NOT NULL,
  status        text  DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'completed', 'cancelled')),
  group_chat_id text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX matches_date_idx    ON matches (date);
CREATE INDEX matches_status_idx  ON matches (status);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match-leden lezen eigen match"
  ON matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM match_members
      WHERE match_id = matches.id AND user_id = auth.uid()
    )
  );

-- match_members: wie zit er in een match
CREATE TABLE match_members (
  id                  uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id            uuid  NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id             uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response            text  DEFAULT 'pending' CHECK (response IN ('pending', 'accepted', 'declined')),
  verified_attendance boolean,
  responded_at        timestamptz,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX match_members_match_idx  ON match_members (match_id);
CREATE INDEX match_members_user_idx   ON match_members (user_id);

ALTER TABLE match_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match-leden lezen eigen match_members"
  ON match_members FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM match_members mm
      WHERE mm.match_id = match_members.match_id AND mm.user_id = auth.uid()
    )
  );

CREATE POLICY "Gebruikers reageren op eigen uitnodiging"
  ON match_members FOR UPDATE
  USING (auth.uid() = user_id);
