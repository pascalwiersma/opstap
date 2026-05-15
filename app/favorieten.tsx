import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { COLORS } from '../constants/colors';
import { supabase } from '../services/supabase';

const VENUE_KLEUREN: Record<string, string> = {
  cafe: '#6D4C41',
  bar: '#FF6B35',
  club: '#9B59B6',
};

const VENUE_LABELS: Record<string, string> = {
  cafe: 'Café',
  bar: 'Bar',
  club: 'Club',
};

const VENUE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cafe: 'cafe-outline',
  bar: 'wine-outline',
  club: 'musical-notes-outline',
};

type FavorietVenue = {
  favoriet_id: string;
  id: string;
  name: string;
  type: string | null;
  photo_url: string | null;
  opening_hours: Record<string, string> | null;
};

export default function FavorietenScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [venues, setVenues] = useState<FavorietVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      laden();
    }, [])
  );

  async function laden() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('user_favorites')
      .select('id, venues(id, name, type, photo_url, opening_hours)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setVenues(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data as any[]).map((r) => ({
          favoriet_id: r.id,
          ...r.venues,
        }))
      );
    }
    setLoading(false);
  }

  async function verwijder(favorietId: string) {
    await supabase.from('user_favorites').delete().eq('id', favorietId);
    setVenues((prev) => prev.filter((v) => v.favoriet_id !== favorietId));
  }

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.terugKnop} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.secondary} />
        </Pressable>
        <Text style={styles.titel}>Favorieten</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.midden}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : venues.length === 0 ? (
        <View style={styles.midden}>
          <Ionicons name="heart-outline" size={48} color="#D1D5DB" />
          <Text style={styles.leegTekst}>Nog geen favorieten</Text>
          <Text style={styles.leegSub}>Tik op een hartje op de kaart of in een venue om hem op te slaan.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.lijst, { paddingBottom: bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {venues.map((venue) => {
            const kleur = VENUE_KLEUREN[venue.type ?? ''] ?? '#888';
            const icoon = VENUE_ICONS[venue.type ?? ''] ?? 'location-outline';
            const label = VENUE_LABELS[venue.type ?? ''] ?? venue.type ?? '';

            return (
              <Pressable
                key={venue.favoriet_id}
                style={({ pressed }) => [styles.kaart, pressed && { opacity: 0.75 }]}
                onPress={() => router.push(`/venue/${venue.id}` as never)}
              >
                <View style={[styles.foto, { backgroundColor: kleur }]}>
                  {venue.photo_url ? (
                    <Image source={{ uri: venue.photo_url }} style={styles.fotoImg} resizeMode="cover" />
                  ) : (
                    <Ionicons name={icoon} size={26} color="rgba(255,255,255,0.6)" />
                  )}
                </View>

                <View style={styles.info}>
                  <View style={[styles.badge, { backgroundColor: kleur }]}>
                    <Text style={styles.badgeTekst}>{label}</Text>
                  </View>
                  <Text style={styles.naam} numberOfLines={1}>{venue.name}</Text>
                </View>

                <Pressable
                  style={styles.hartKnop}
                  hitSlop={8}
                  onPress={() => verwijder(venue.favoriet_id)}
                >
                  <Ionicons name="heart" size={22} color="#E53E3E" />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F2F2F7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  terugKnop: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titel: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  midden: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  leegTekst: { fontSize: 17, fontWeight: '600', color: COLORS.textLight },
  leegSub: { fontSize: 14, color: '#C7C7CC', textAlign: 'center', lineHeight: 20 },

  lijst: { paddingHorizontal: 16, gap: 10 },

  kaart: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },

  foto: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoImg: { ...StyleSheet.absoluteFillObject },

  info: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeTekst: { fontSize: 11, fontWeight: '700', color: '#fff' },
  naam: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  hartKnop: {
    padding: 16,
  },
});
