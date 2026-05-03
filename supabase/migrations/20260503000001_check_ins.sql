-- check_ins: bijhoudt wie er vanavond uitwil
CREATE TABLE check_ins (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date            date        NOT NULL,
  checked_in_at   timestamptz DEFAULT now(),
  checked_out_at  timestamptz,
  status          text        DEFAULT 'active' CHECK (status IN ('active', 'matched', 'completed', 'cancelled')),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX check_ins_date_idx    ON check_ins (date);
CREATE INDEX check_ins_status_idx  ON check_ins (status);
CREATE INDEX check_ins_user_idx    ON check_ins (user_id);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- Eigen check-in lezen
CREATE POLICY "Gebruikers lezen eigen check-in"
  ON check_ins FOR SELECT
  USING (auth.uid() = user_id);

-- Aantal actieve check-ins voor een datum zichtbaar voor iedereen
CREATE POLICY "Actieve check-ins zijn publiek telbaar"
  ON check_ins FOR SELECT
  USING (status = 'active');

-- Aanmaken
CREATE POLICY "Gebruikers maken eigen check-in aan"
  ON check_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Eigen check-in bijwerken (annuleren, status wijzigen)
CREATE POLICY "Gebruikers wijzigen eigen check-in"
  ON check_ins FOR UPDATE
  USING (auth.uid() = user_id);
