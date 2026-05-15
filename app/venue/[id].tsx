import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/colors';
import { supabase } from '../../services/supabase';
import { MeldingModal } from '../../components/MeldingModal';

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
  type: string | null;
  description: string | null;
  photo_url: string | null;
  opening_hours: Record<string, unknown> | null;
};

type VenuePhoto = {
  photo_url: string;
  sort_order: number;
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
  const [venuePhotos, setVenuePhotos] = useState<VenuePhoto[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriet, setFavoriet] = useState(false);
  const [favorietBezig, setFavorietBezig] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [meldingOpen, setMeldingOpen] = useState(false);
  const schermBreedte = Dimensions.get('window').width;

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [venueRes, photosRes, userRes] = await Promise.all([
        supabase
          .from('venues')
          .select('id, name, type, description, photo_url, opening_hours')
          .eq('id', id)
          .single(),
        supabase
          .from('venue_photos')
          .select('photo_url, sort_order')
          .eq('venue_id', id)
          .order('sort_order'),
        supabase.auth.getUser(),
      ]);

      if (venueRes.data) setVenue(venueRes.data as Venue);
      if (photosRes.data) setVenuePhotos(photosRes.data as VenuePhoto[]);

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
  const DAGEN_VOLGORDE = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  const openingsuren = venue.opening_hours
    ? Object.entries(venue.opening_hours).sort(
        ([a], [b]) => DAGEN_VOLGORDE.indexOf(a) - DAGEN_VOLGORDE.indexOf(b)
      )
    : [];
  const fotoUrls: string[] = venuePhotos.length > 0
    ? venuePhotos.map(p => p.photo_url)
    : venue.photo_url ? [venue.photo_url] : [];

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInhoud}
        showsVerticalScrollIndicator={false}
      >
        {/* Header foto / carousel */}
        <View style={[styles.headerBlok, { height: HEADER_HOOGTE, backgroundColor: kleur }]}>
          {fotoUrls.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / schermBreedte);
                  setCarouselIndex(index);
                }}
                style={{ width: schermBreedte, height: HEADER_HOOGTE }}
              >
                {fotoUrls.map((url, i) => (
                  <Image
                    key={i}
                    source={{ uri: url }}
                    style={{ width: schermBreedte, height: HEADER_HOOGTE }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {fotoUrls.length > 1 && (
                <View style={styles.dotsRij}>
                  {fotoUrls.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === carouselIndex && styles.dotActief]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.headerIconWrapper}>
                <Ionicons name={icoon} size={72} color="rgba(255,255,255,0.35)" />
              </View>
              <View style={[styles.headerOverlay, { backgroundColor: `${kleur}99` }]} />
            </>
          )}
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
        {/* Melding link */}
        <Pressable style={styles.meldingLink} onPress={() => setMeldingOpen(true)}>
          <Text style={styles.meldingLinkTekst}>Klopt deze informatie?</Text>
        </Pressable>
      </ScrollView>

      {/* Terugknop over de foto */}
      <Pressable style={[styles.terugKnop, { top: top + 12 }]} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>

      <MeldingModal
        zichtbaar={meldingOpen}
        contentType="venue"
        contentId={venue.id}
        opties={[
          'Naam klopt niet',
          'Adres klopt niet',
          'Openingstijden kloppen niet',
          'Locatie op kaart klopt niet',
          "Foto's kloppen niet",
          'Anders',
        ]}
        onSluit={() => setMeldingOpen(false)}
      />
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

  dotsRij: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActief: {
    backgroundColor: '#fff',
    width: 18,
    borderRadius: 3,
  },

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

  meldingLink: {
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  meldingLinkTekst: {
    fontSize: 13,
    color: COLORS.textLight,
    textDecorationLine: 'underline',
  },

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
