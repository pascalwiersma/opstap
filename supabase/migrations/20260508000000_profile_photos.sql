CREATE TABLE IF NOT EXISTS profile_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url  text NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profielfoto's zijn publiek leesbaar" ON profile_photos
  FOR SELECT USING (true);

CREATE POLICY "Eigen foto's toevoegen" ON profile_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Eigen foto's verwijderen" ON profile_photos
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON profile_photos TO authenticated;
