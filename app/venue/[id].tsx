import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../services/supabase';

const VENUE_KLEUREN: Record<string, string> = {
  cafe: '#6D4C41',
  bar: '#FF6B35',
  club: '#9B59B6',
};

const VENUE_LABELS: Record<string, string> = {
  cafe: 'Café',
  bar: 'Bar',
  club: 'Club',
  pub: 'Pub',
};

const VENUE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cafe: 'cafe-outline',
  bar: 'wine-outline',
  club: 'musical-notes-outline',
  pub: 'beer-outline',
};

const DAGEN_NL: Record<string, string> = {
  monday: 'Maandag',
  tuesday: 'Dinsdag',
  wednesday: 'Woensdag',
  thursday: 'Donderdag',
  friday: 'Vrijdag',
  saturday: 'Zaterdag',
  sunday: 'Zondag',
  ma: 'Maandag',
  di: 'Dinsdag',
  wo: 'Woensdag',
  do: 'Donderdag',
  vr: 'Vrijdag',
  za: 'Zaterdag',
  zo: 'Zondag',
};

type Venue = {
  id: string;
  name: string;
  address: string;
  type: string | null;
  description: string | null;
  photo_url: string | null;
  opening_hours: Record<string, unknown> | null;
};

type Event = {
  id: string;
  title: string;
  starts_at: string;
  max_attendees: number | null;
};

function formatOpeningstijd(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, string>;
    if (obj.open && obj.close) return `${obj.open} – ${obj.close}`;
  }
  return '–';
}

const HEADER_HOOGTE = 280;

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { top } = useSafeAreaInsets();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriet, setFavoriet] = useState(false);
  const [favorietBezig, setFavorietBezig] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [venueRes, userRes] = await Promise.all([
        supabase
          .from('venues')
          .select('id, name, address, type, description, photo_url, opening_hours')
          .eq('id', id)
          .single(),
        supabase.auth.getUser(),
      ]);

      if (venueRes.data) setVenue(venueRes.data as Venue);

      const userId = userRes.data.user?.id;
      if (userId) {
        const [favRes, eventsRes] = await Promise.all([
          supabase
            .from('user_favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('venue_id', id)
            .maybeSingle(),
          supabase
            .from('events')
            .select('id, title, starts_at, max_attendees')
            .eq('venue_id', id)
            .eq('status', 'active')
            .order('starts_at'),
        ]);
        setFavoriet(!!favRes.data);
        setEvents((eventsRes.data ?? []) as Event[]);
      }

      setLoading(false);
    })();
  }, [id]);

  async function toggleFavoriet() {
    if (favorietBezig) return;
    setFavorietBezig(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setFavorietBezig(false); return; }

    if (favoriet) {
      await supabase.from('user_favorites').delete().eq('user_id', user.id).eq('venue_id', id);
      setFavoriet(false);
    } else {
      await supabase.from('user_favorites').insert({ user_id: user.id, venue_id: id });
      setFavoriet(true);
    }
    setFavorietBezig(false);
  }

  if (loading) {
    return (
      <View style={styles.ladenWrapper}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.ladenWrapper}>
        <Text style={{ color: COLORS.textLight }}>Venue niet gevonden.</Text>
      </View>
    );
  }

  const kleur = VENUE_KLEUREN[venue.type ?? ''] ?? '#888';
  const icoon = VENUE_ICONS[venue.type ?? ''] ?? 'location-outline';
  const label = VENUE_LABELS[venue.type ?? ''] ?? venue.type ?? '';
  const openingsuren = venue.opening_hours
    ? Object.entries(venue.opening_hours)
    : [];

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInhoud}
        showsVerticalScrollIndicator={false}
      >
        {/* Header foto / kleur blok */}
        <View style={[styles.headerBlok, { height: HEADER_HOOGTE, backgroundColor: kleur }]}>
          {venue.photo_url ? (
            <Image source={{ uri: venue.photo_url }} style={styles.headerFoto} resizeMode="cover" />
          ) : (
            <View style={styles.headerIconWrapper}>
              <Ionicons name={icoon} size={72} color="rgba(255,255,255,0.35)" />
            </View>
          )}
          <View style={[styles.headerOverlay, { backgroundColor: `${kleur}99` }]} />
        </View>

        {/* Naam kaartje */}
        <View style={styles.naamKaart}>
          <View style={styles.naamRij}>
            <Text style={styles.naam} numberOfLines={2}>{venue.name}</Text>
            <Pressable onPress={toggleFavoriet} disabled={favorietBezig} hitSlop={8}>
              <Ionicons
                name={favoriet ? 'heart' : 'heart-outline'}
                size={26}
                color={favoriet ? '#E53E3E' : '#C7C7CC'}
              />
            </Pressable>
          </View>

          <View style={styles.adresRij}>
            <Ionicons name="location-outline" size={16} color={COLORS.textLight} />
            <Text style={styles.adres}>{venue.address}</Text>
          </View>

          <View style={[styles.badge, { backgroundColor: kleur }]}>
            <Text style={styles.badgeTekst}>{label}</Text>
          </View>
        </View>

        {/* Omschrijving */}
        {venue.description ? (
          <View style={styles.sectie}>
            <Text style={styles.sectieKop}>Over dit adres</Text>
            <Text style={styles.omschrijving}>{venue.description}</Text>
          </View>
        ) : null}

        {/* Openingstijden */}
        {openingsuren.length > 0 && (
          <View style={styles.sectie}>
            <Text style={styles.sectieKop}>Openingstijden</Text>
            <View style={styles.tijdenKaart}>
              {openingsuren.map(([dag, tijd], i) => (
                <View key={dag} style={[styles.tijdRij, i < openingsuren.length - 1 && styles.tijdRijBorder]}>
                  <Text style={styles.dagNaam}>{DAGEN_NL[dag] ?? dag}</Text>
                  <Text style={styles.tijdWaarde}>{formatOpeningstijd(tijd)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actieve events */}
        {events.length > 0 && (
          <View style={styles.sectie}>
            <Text style={styles.sectieKop}>Events vanavond</Text>
            {events.map((event) => (
              <Pressable
                key={event.id}
                style={({ pressed }) => [styles.eventKaart, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(`/event/${event.id}` as never)}
              >
                <Ionicons name="calendar-outline" size={20} color={kleur} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitel} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.eventTijd}>
                    {new Date(event.starts_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    {event.max_attendees ? ` · max ${event.max_attendees} personen` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Terugknop over de foto */}
      <Pressable style={[styles.terugKnop, { top: top + 12 }]} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { flex: 1, backgroundColor: '#F2F2F7' },
  ladenWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:     { flex: 1 },
  scrollInhoud: { paddingBottom: 40 },

  headerBlok: { width: '100%', overflow: 'hidden' },
  headerFoto: { ...StyleSheet.absoluteFillObject },
  headerIconWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerOverlay: { ...StyleSheet.absoluteFillObject },

  naamKaart: {
    marginHorizontal: 16,
    marginTop: -24,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },

  naamRij:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  naam:       { flex: 1, fontSize: 22, fontWeight: '800', color: COLORS.text, lineHeight: 28 },
  adresRij:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  adres:      { fontSize: 14, color: COLORS.textLight, flex: 1 },

  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeTekst: { fontSize: 12, fontWeight: '700', color: '#fff' },

  sectie:     { marginHorizontal: 16, marginTop: 20, gap: 10 },
  sectieKop:  { fontSize: 13, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  omschrijving: { fontSize: 15, color: COLORS.text, lineHeight: 23 },

  tijdenKaart: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tijdRij:     { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
  tijdRijBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.07)' },
  dagNaam:     { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  tijdWaarde:  { fontSize: 15, color: COLORS.textLight },

  eventKaart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  eventTitel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  eventTijd:  { fontSize: 13, color: COLORS.textLight, marginTop: 2 },

  terugKnop: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
