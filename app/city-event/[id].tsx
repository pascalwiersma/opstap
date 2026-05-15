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
import { MeldingModal } from '../../components/MeldingModal';

const EVENT_TYPE_LABELS: Record<string, string> = {
  kermis: 'Kermis',
  festival: 'Festival',
  markt: 'Markt',
  concert: 'Concert',
  sport: 'Sport',
  overig: 'Evenement',
};

const EVENT_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  kermis: 'happy-outline',
  festival: 'musical-notes-outline',
  markt: 'storefront-outline',
  concert: 'mic-outline',
  sport: 'football-outline',
  overig: 'calendar-outline',
};

type CityEventDetail = {
  id: string;
  name: string;
  description: string | null;
  event_type: string | null;
  location_type: 'point' | 'region';
  start_date: string;
  end_date: string;
  color: string;
  photo_url: string | null;
};

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatPeriode(start: string, end: string): string {
  if (start === end) return formatDatum(start);
  const s = new Date(start).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
  const e = new Date(end).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${s} – ${e}`;
}

const HEADER_HOOGTE = 260;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function CityEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { top } = useSafeAreaInsets();
  const [event, setEvent] = useState<CityEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [meldingOpen, setMeldingOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    db
      .from('city_events')
      .select('id, name, description, event_type, location_type, start_date, end_date, color, photo_url')
      .eq('id', id)
      .single()
      .then(({ data, error }: { data: CityEventDetail | null; error: { message: string } | null }) => {
        if (error) console.error('CityEvent fout:', error.message);
        if (data) setEvent(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.ladenWrapper}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.ladenWrapper}>
        <Text style={{ color: COLORS.textLight }}>Evenement niet gevonden.</Text>
      </View>
    );
  }

  const kleur = event.color ?? '#0ea5e9';
  const typeLabel = EVENT_TYPE_LABELS[event.event_type ?? ''] ?? 'Evenement';
  const typeIcon = EVENT_TYPE_ICONS[event.event_type ?? ''] ?? 'calendar-outline';

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInhoud}
        showsVerticalScrollIndicator={false}
      >
        {/* Header foto / kleurblok */}
        <View style={[styles.headerBlok, { height: HEADER_HOOGTE, backgroundColor: kleur }]}>
          {event.photo_url ? (
            <Image source={{ uri: event.photo_url }} style={styles.headerFoto} resizeMode="cover" />
          ) : (
            <View style={styles.headerIconWrapper}>
              <Ionicons name={typeIcon} size={72} color="rgba(255,255,255,0.35)" />
            </View>
          )}
          {!event.photo_url && <View style={[styles.headerOverlay, { backgroundColor: `${kleur}99` }]} />}
        </View>

        {/* Naam kaartje */}
        <View style={styles.naamKaart}>
          <View style={[styles.badge, { backgroundColor: kleur }]}>
            <Text style={styles.badgeTekst}>{typeLabel}</Text>
          </View>

          <Text style={styles.naam}>{event.name}</Text>

          {/* Periode */}
          <View style={styles.infoRij}>
            <Ionicons name="calendar-outline" size={16} color={kleur} />
            <Text style={styles.infoTekst}>{formatPeriode(event.start_date, event.end_date)}</Text>
          </View>

          {/* Regio indicator */}
          {event.location_type === 'region' && (
            <View style={styles.infoRij}>
              <Ionicons name="map-outline" size={16} color={kleur} />
              <Text style={styles.infoTekst}>Dit evenement beslaat een gebied op de kaart</Text>
            </View>
          )}
        </View>

        {/* Beschrijving */}
        {event.description ? (
          <View style={styles.sectie}>
            <Text style={styles.sectieKop}>Over dit evenement</Text>
            <Text style={styles.omschrijving}>{event.description}</Text>
          </View>
        ) : null}

        {/* Melding link */}
        <Pressable style={styles.meldingLink} onPress={() => setMeldingOpen(true)}>
          <Text style={styles.meldingLinkTekst}>Klopt deze informatie?</Text>
        </Pressable>
      </ScrollView>

      {/* Terugknop */}
      <Pressable style={[styles.terugKnop, { top: top + 12 }]} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </Pressable>

      <MeldingModal
        zichtbaar={meldingOpen}
        contentType="city_event"
        contentId={event.id}
        opties={[
          'Naam klopt niet',
          'Datum klopt niet',
          'Locatie klopt niet',
          "Foto's kloppen niet",
          'Evenement bestaat niet meer',
          'Anders',
        ]}
        onSluit={() => setMeldingOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F2F2F7' },
  ladenWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
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

  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeTekst: { fontSize: 12, fontWeight: '700', color: '#fff' },

  naam: { fontSize: 22, fontWeight: '800', color: COLORS.text, lineHeight: 28 },

  infoRij: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTekst: { fontSize: 14, color: COLORS.textLight, flex: 1 },

  sectie: { marginHorizontal: 16, marginTop: 20, gap: 8 },
  sectieKop: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  omschrijving: { fontSize: 15, color: COLORS.text, lineHeight: 23 },

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
