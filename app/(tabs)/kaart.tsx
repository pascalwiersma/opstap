import { Ionicons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { useVenues, VenuePin } from '../../hooks/useVenues';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const GRONINGEN: [number, number] = [6.5665, 53.2194];
const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

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

const KLEUREN = {
  achtergrond: '#E8F5E9',
  water: '#B2EBF2',
  hoofdweg: '#B0BEC5',
  hoofdwegCase: '#90A4AE',
  straatje: '#CFD8DC',
  straatjeCase: '#B0BEC5',
  gebouw: '#FFFFFF',
  gebouwOutline: '#E0E8E4',
  park: '#C8E6C9',
} as const;

type MapLayer = { id: string; type: string; paint?: Record<string, unknown> };

const HOOFDWEG_TOKENS = ['motorway', 'trunk', 'primary', 'secondary', 'major'];
const WATER_IDS = ['water', 'water-shadow', 'waterway'];
const PLAATSNAAM_TOKENS = ['settlement', 'country', 'state', 'continent'];

function processLayer(layer: MapLayer): MapLayer {
  const { id, type } = layer;
  if (type === 'background') return { ...layer, paint: { ...layer.paint, 'background-color': KLEUREN.achtergrond } };
  if (type === 'fill') {
    if (WATER_IDS.some((w) => id === w || id.startsWith(w + '-')))
      return { ...layer, paint: { ...layer.paint, 'fill-color': KLEUREN.water } };
    if (id.includes('park') || id.includes('grass') || id.includes('national-park') || id.includes('scrub'))
      return { ...layer, paint: { ...layer.paint, 'fill-color': KLEUREN.park } };
    if (id.includes('building'))
      return { ...layer, paint: { ...layer.paint, 'fill-color': KLEUREN.gebouw, 'fill-outline-color': KLEUREN.gebouwOutline } };
  }
  if (type === 'line') {
    if (id.includes('waterway') || id.startsWith('water'))
      return { ...layer, paint: { ...layer.paint, 'line-color': KLEUREN.water } };
    if (id.startsWith('road-') || id.includes('-road')) {
      const isCase = id.endsWith('-case');
      const isHoofdweg = HOOFDWEG_TOKENS.some((t) => id.includes(t));
      const kleur = isHoofdweg
        ? (isCase ? KLEUREN.hoofdwegCase : KLEUREN.hoofdweg)
        : (isCase ? KLEUREN.straatjeCase : KLEUREN.straatje);
      return { ...layer, paint: { ...layer.paint, 'line-color': kleur } };
    }
  }
  return layer;
}

async function fetchStyle(): Promise<string> {
  const res = await fetch(`https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=${TOKEN}`);
  const style = await res.json();
  style.layers = (style.layers as MapLayer[])
    .filter((l) => l.type !== 'symbol' || PLAATSNAAM_TOKENS.some((t) => l.id.includes(t)))
    .map(processLayer);
  return JSON.stringify(style);
}

const CARD_HEIGHT = 120;
const ALLE_TYPES = ['cafe', 'bar', 'club'] as const;
type VenueTyp = typeof ALLE_TYPES[number];

export default function KaartScreen() {
  const [styleJSON, setStyleJSON] = useState<string | null>(null);
  const [locatie, setLocatie] = useState<[number, number] | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenuePin | null>(null);
  const cameraRef = useRef<React.ElementRef<typeof Mapbox.Camera>>(null);
  const sourceRef = useRef<React.ElementRef<typeof Mapbox.ShapeSource>>(null);
  const { bottom, top } = useSafeAreaInsets();
  const gecentreerdRef = useRef(false);
  const venues = useVenues();
  const slideAnim = useRef(new Animated.Value(CARD_HEIGHT + 20)).current;
  const [actieveFilters, setActieveFilters] = useState<Set<VenueTyp>>(new Set(ALLE_TYPES));
  const [meldingenOngelezen, setMeldingenOngelezen] = useState(0);

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('friend_id', user.id)
          .eq('status', 'pending')
          .then(({ count }) => setMeldingenOngelezen(count ?? 0))
      })
    }, [])
  );

  function toggleFilter(type: VenueTyp) {
    setActieveFilters((prev) => {
      if (prev.has(type) && prev.size === 1) return prev;
      const next = new Set(prev);
      prev.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  const zichtbareVenues = venues.filter((v) => actieveFilters.has((v.type ?? '') as VenueTyp));

  // GeoJSON voor ShapeSource — geselecteerde venue apart renderen als MarkerView
  const geojson = {
    type: 'FeatureCollection' as const,
    features: zichtbareVenues
      .filter((v) => v.id !== selectedVenue?.id)
      .map((v) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [Number(v.lng), Number(v.lat)] },
        properties: { id: v.id, naam: v.name, type: v.type ?? '', adres: v.address ?? '' },
      })),
  };

  useEffect(() => {
    fetchStyle().then(setStyleJSON).catch(console.error);
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      setLocatie([pos.coords.longitude, pos.coords.latitude]);
    })();
  }, []);

  useEffect(() => {
    if (!locatie || !styleJSON || gecentreerdRef.current) return;
    gecentreerdRef.current = true;
    setTimeout(() => {
      cameraRef.current?.setCamera({ centerCoordinate: locatie, zoomLevel: 15, animationDuration: 800 });
    }, 300);
  }, [locatie, styleJSON]);

  function openVenueCard(venue: VenuePin) {
    setSelectedVenue(venue);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }

  function sluitVenueCard() {
    Animated.timing(slideAnim, { toValue: CARD_HEIGHT + 20, duration: 220, useNativeDriver: true })
      .start(() => setSelectedVenue(null));
  }

  async function handleShapePress(e: { features?: GeoJSON.Feature[] }) {
    const feature = e.features?.[0];
    if (!feature || !feature.geometry || feature.geometry.type !== 'Point') return;

    const coords = feature.geometry.coordinates as [number, number];

    if (feature.properties?.cluster) {
      try {
        const zoom = await sourceRef.current?.getClusterExpansionZoom(feature as GeoJSON.Feature);
        cameraRef.current?.setCamera({ centerCoordinate: coords, zoomLevel: zoom ?? 16, animationDuration: 400 });
      } catch {
        cameraRef.current?.setCamera({ centerCoordinate: coords, zoomLevel: 16, animationDuration: 400 });
      }
      return;
    }

    const venue = zichtbareVenues.find((v) => v.id === feature.properties?.id);
    if (venue) openVenueCard(venue);
  }

  async function centreerOpLocatie() {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    cameraRef.current?.setCamera({ centerCoordinate: [pos.coords.longitude, pos.coords.latitude], zoomLevel: 15, animationDuration: 500 });
  }

  const kleur = VENUE_KLEUREN[selectedVenue?.type ?? ''] ?? '#1A73E8';
  const icon = VENUE_ICONS[selectedVenue?.type ?? ''] ?? 'location-outline';
  const label = VENUE_LABELS[selectedVenue?.type ?? ''] ?? '';

  return (
    <View style={styles.container}>
      {styleJSON && (
        <Mapbox.MapView
          style={styles.mapFlex}
          styleJSON={styleJSON}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
          onPress={sluitVenueCard}
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{ centerCoordinate: GRONINGEN, zoomLevel: 13 }}
          />
          <Mapbox.UserLocation visible />

          {/* Alle niet-geselecteerde venues als geclusterde ShapeSource */}
          <Mapbox.ShapeSource
            ref={sourceRef}
            id="venues"
            shape={geojson}
            cluster
            clusterRadius={40}
            clusterMaxZoomLevel={14}
            onPress={handleShapePress}
          >
            {/* Cluster cirkel */}
            <Mapbox.CircleLayer
              id="clusters"
              filter={['has', 'point_count']}
              style={{
                circleColor: '#334155',
                circleRadius: ['step', ['get', 'point_count'], 18, 5, 22, 10, 26] as unknown as number,
                circleStrokeWidth: 2,
                circleStrokeColor: '#FFFFFF',
                circleOpacity: 0.92,
              }}
            />
            {/* Cluster telling */}
            <Mapbox.SymbolLayer
              id="cluster-count"
              filter={['has', 'point_count']}
              style={{
                textField: '{point_count_abbreviated}',
                textSize: 12,
                textColor: '#FFFFFF',
                textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                textAllowOverlap: true,
              }}
            />
            {/* Individuele pins */}
            <Mapbox.CircleLayer
              id="venues-pins"
              filter={['!', ['has', 'point_count']]}
              style={{
                circleColor: [
                  'match', ['get', 'type'],
                  'cafe', VENUE_KLEUREN.cafe,
                  'bar', VENUE_KLEUREN.bar,
                  'club', VENUE_KLEUREN.club,
                  '#1A73E8',
                ] as unknown as string,
                circleRadius: 8,
                circleStrokeWidth: 2.5,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </Mapbox.ShapeSource>

          {/* Geselecteerde venue als MarkerView met icoon */}
          {selectedVenue && (
            <Mapbox.MarkerView
              id="selected"
              coordinate={[Number(selectedVenue.lng), Number(selectedVenue.lat)]}
            >
              <Pressable onPress={sluitVenueCard} hitSlop={16}>
                <View style={[styles.teardropKop, { backgroundColor: kleur }]}>
                  <Ionicons name={icon} size={20} color="#FFFFFF" />
                </View>
              </Pressable>
            </Mapbox.MarkerView>
          )}
        </Mapbox.MapView>
      )}

      <View style={[styles.filterRij, { top: top + 12 }]}>
        {ALLE_TYPES.map((type) => {
          const actief = actieveFilters.has(type);
          return (
            <Pressable
              key={type}
              style={[styles.filterPill, actief && { backgroundColor: VENUE_KLEUREN[type] }]}
              onPress={() => toggleFilter(type)}
            >
              <Text style={[styles.filterTekst, actief && styles.filterTekstActief]}>
                {VENUE_LABELS[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.meldingenKnop, { top: top + 12 }]}
        onPress={() => router.push('/meldingen')}
        accessibilityRole="button"
        accessibilityLabel={
          meldingenOngelezen > 0
            ? `Meldingen, ${meldingenOngelezen} ongelezen`
            : 'Meldingen'
        }
      >
        <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
        {meldingenOngelezen > 0 ? (
          <View style={styles.meldingBadge}>
            <Text style={styles.meldingBadgeTekst}>
              {meldingenOngelezen > 99 ? '99+' : String(meldingenOngelezen)}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable style={[styles.locatieKnop, { bottom: bottom }]} onPress={centreerOpLocatie}>
        <Ionicons name="navigate" size={22} color="#1A73E8" />
      </Pressable>

      {selectedVenue && (
        <Animated.View style={[styles.venueCard, { bottom: bottom + 16, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.cardFoto, { backgroundColor: kleur }]}>
            <Ionicons name={icon} size={34} color="#fff" />
            <View style={styles.hartKnop}>
              <Ionicons name="heart-outline" size={18} color="#fff" />
            </View>
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardBadgeRij}>
              <View style={[styles.badge, { backgroundColor: kleur }]}>
                <Text style={styles.badgeTekst}>{label}</Text>
              </View>
            </View>
            <Text style={styles.cardNaam} numberOfLines={1}>{selectedVenue.name}</Text>
            <Text style={styles.cardAdres} numberOfLines={1}>{selectedVenue.address}</Text>
          </View>
          <Pressable style={styles.sluitKnop} onPress={sluitVenueCard}>
            <Ionicons name="close" size={18} color="#999" />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// GeoJSON types inline zodat geen extra import nodig is
declare namespace GeoJSON {
  interface Feature<G = Geometry> { type: 'Feature'; geometry: G; properties: Record<string, unknown> | null }
  interface FeatureCollection { type: 'FeatureCollection'; features: Feature[] }
  type Geometry = { type: 'Point'; coordinates: number[] } | { type: string; coordinates: unknown }
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  mapFlex: { flex: 1 },

  teardropKop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locatieKnop: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  venueCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: CARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },

  cardFoto: {
    width: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hartKnop: {
    position: 'absolute',
    bottom: 10,
    left: 10,
  },

  cardInfo: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    gap: 4,
  },

  cardBadgeRij: { flexDirection: 'row', marginBottom: 2 },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },

  badgeTekst: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardNaam: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  cardAdres: { fontSize: 13, color: '#888' },

  sluitKnop: {
    padding: 12,
    alignSelf: 'flex-start',
  },

  filterRij: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },

  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },

  filterTekst: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTekstActief: { color: '#FFFFFF' },

  meldingenKnop: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  meldingBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meldingBadgeTekst: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
});
