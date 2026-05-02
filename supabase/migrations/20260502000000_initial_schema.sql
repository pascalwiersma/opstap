-- PostGIS voor locatie queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- TABELLEN
-- ============================================================

-- profiles: gespiegeld aan auth.users
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  avatar_url  text,
  age         integer,
  bio         text,
  trust_score numeric DEFAULT 5.0,
  created_at  timestamptz DEFAULT now()
);

-- Auto-aanmaken profiel bij registratie
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- user_interests
CREATE TABLE user_interests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  interest   text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- venues
CREATE TABLE venues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  address       text NOT NULL,
  lat           numeric NOT NULL,
  lng           numeric NOT NULL,
  location      geography(Point, 4326),
  type          text CHECK (type IN ('bar', 'club', 'pub', 'cafe')),
  opening_hours jsonb,
  description   text,
  photo_url     text,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Trigger: location kolom syncen met lat/lng
CREATE OR REPLACE FUNCTION sync_venue_location()
RETURNS trigger AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venue_location_sync
  BEFORE INSERT OR UPDATE OF lat, lng ON venues
  FOR EACH ROW EXECUTE FUNCTION sync_venue_location();

-- user_favorites
CREATE TABLE user_favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id   uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, venue_id)
);

-- events
CREATE TABLE events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venue_id      uuid REFERENCES venues(id) ON DELETE SET NULL,
  title         text NOT NULL,
  description   text,
  starts_at     timestamptz NOT NULL,
  max_attendees integer,
  status        text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'finished')),
  created_at    timestamptz DEFAULT now()
);

-- event_registrations
CREATE TABLE event_registrations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- attendance
CREATE TABLE attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  showed_up  boolean,
  reported   boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- night_venues
CREATE TABLE night_venues (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  venue_id   uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  "order"    integer,
  created_at timestamptz DEFAULT now()
);

-- night_photos
CREATE TABLE night_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  photo_url  text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX venues_location_idx          ON venues USING GIST (location);
CREATE INDEX events_starts_at_idx         ON events (starts_at);
CREATE INDEX events_status_idx            ON events (status);
CREATE INDEX registrations_event_id_idx   ON event_registrations (event_id);
CREATE INDEX registrations_user_id_idx    ON event_registrations (user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE night_venues       ENABLE ROW LEVEL SECURITY;
ALTER TABLE night_photos       ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Profiles zijn publiek leesbaar"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Gebruikers kunnen eigen profiel bijwerken"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- user_interests
CREATE POLICY "Interesses zijn publiek leesbaar"
  ON user_interests FOR SELECT USING (true);

CREATE POLICY "Gebruikers beheren eigen interesses"
  ON user_interests FOR ALL USING (auth.uid() = user_id);

-- venues
CREATE POLICY "Venues zijn publiek leesbaar"
  ON venues FOR SELECT USING (true);

-- user_favorites
CREATE POLICY "Gebruikers lezen eigen favorieten"
  ON user_favorites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Gebruikers beheren eigen favorieten"
  ON user_favorites FOR ALL USING (auth.uid() = user_id);

-- events
CREATE POLICY "Events zijn publiek leesbaar"
  ON events FOR SELECT USING (true);

CREATE POLICY "Ingelogde gebruikers kunnen events aanmaken"
  ON events FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Makers kunnen eigen events bijwerken"
  ON events FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Makers kunnen eigen events verwijderen"
  ON events FOR DELETE USING (auth.uid() = creator_id);

-- event_registrations
CREATE POLICY "Aanmeldingen leesbaar door maker en deelnemer"
  ON event_registrations FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT creator_id FROM events WHERE id = event_id)
  );

CREATE POLICY "Ingelogde gebruikers kunnen zich aanmelden"
  ON event_registrations FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    auth.uid() != (SELECT creator_id FROM events WHERE id = event_id)
  );

CREATE POLICY "Makers kunnen aanmeldingen goedkeuren of afwijzen"
  ON event_registrations FOR UPDATE
  USING (auth.uid() = (SELECT creator_id FROM events WHERE id = event_id));

CREATE POLICY "Gebruikers kunnen eigen openstaande aanmelding intrekken"
  ON event_registrations FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

-- attendance
CREATE POLICY "Aanwezigheid leesbaar door maker en deelnemer"
  ON attendance FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT creator_id FROM events WHERE id = event_id)
  );

CREATE POLICY "Makers beheren aanwezigheid"
  ON attendance FOR ALL
  USING (auth.uid() = (SELECT creator_id FROM events WHERE id = event_id));

-- night_venues
CREATE POLICY "Avondroute leesbaar door goedgekeurde deelnemers"
  ON night_venues FOR SELECT USING (
    auth.uid() = (SELECT creator_id FROM events WHERE id = event_id) OR
    EXISTS (
      SELECT 1 FROM event_registrations
      WHERE event_id = night_venues.event_id
        AND user_id = auth.uid()
        AND status = 'approved'
    )
  );

CREATE POLICY "Makers beheren avondroute"
  ON night_venues FOR ALL
  USING (auth.uid() = (SELECT creator_id FROM events WHERE id = event_id));

-- night_photos
CREATE POLICY "Foto's leesbaar door goedgekeurde deelnemers"
  ON night_photos FOR SELECT USING (
    auth.uid() = (SELECT creator_id FROM events WHERE id = event_id) OR
    EXISTS (
      SELECT 1 FROM event_registrations
      WHERE event_id = night_photos.event_id
        AND user_id = auth.uid()
        AND status = 'approved'
    )
  );

CREATE POLICY "Goedgekeurde deelnemers kunnen foto's uploaden"
  ON night_photos FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM event_registrations
      WHERE event_id = night_photos.event_id
        AND user_id = auth.uid()
        AND status = 'approved'
    )
  );

CREATE POLICY "Gebruikers kunnen eigen foto's verwijderen"
  ON night_photos FOR DELETE USING (auth.uid() = user_id);
