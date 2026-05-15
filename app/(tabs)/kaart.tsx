import { Ionicons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { useVenues, VenuePin } from '../../hooks/useVenues';
import { useCityEvents, CityEventPin } from '../../hooks/useCityEvents';
import { useFavorites } from '../../hooks/useFavorites';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const GRONINGEN: [number, number] = [6.5665, 53.2194];
const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

const VENUE_KLEUREN: Record<string, string> = {
  cafe: '#6D4C41',
  bar: '#FF6B35',
  club: '#9B59B6',
};

const EVENT_KLEUR = '#f59e0b';

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

const FALLBACK_STYLE_URL = 'mapbox://styles/mapbox/light-v11';
let cachedStyleJSON: string | null = null;

async function fetchStyle(): Promise<string> {
  if (cachedStyleJSON) return cachedStyleJSON;
  const res = await fetch(`https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=${TOKEN}`);
  if (!res.ok) throw new Error(`Mapbox stijl: ${res.status}`);
  const style = await res.json();
  style.layers = (style.layers as MapLayer[])
    .filter((l) => l.type !== 'symbol' || PLAATSNAAM_TOKENS.some((t) => l.id.includes(t)))
    .map(processLayer);
  cachedStyleJSON = JSON.stringify(style);
  return cachedStyleJSON;
}

const CARD_HEIGHT = 120;
const ALLE_TYPES = ['cafe', 'bar', 'club'] as const;

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const s = new Date(start).toLocaleDateString('nl-NL', opts);
  const e = new Date(end).toLocaleDateString('nl-NL', opts);
  return start === end ? s : `${s} – ${e}`;
}
type VenueTyp = typeof ALLE_TYPES[number];

export default function KaartScreen() {
  const [styleJSON, setStyleJSON] = useState<string | null>(cachedStyleJSON);
  const [locatie, setLocatie] = useState<[number, number] | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<VenuePin | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CityEventPin | null>(null);
  const cameraRef = useRef<React.ElementRef<typeof Mapbox.Camera>>(null);
  const sourceRef = useRef<React.ElementRef<typeof Mapbox.ShapeSource>>(null);
  const { bottom, top } = useSafeAreaInsets();
  const gecentreerdRef = useRef(false);
  const venues = useVenues();
  const cityEvents = useCityEvents();
  const slideAnim = useRef(new Animated.Value(CARD_HEIGHT + 20)).current;
  const eventSlideAnim = useRef(new Animated.Value(CARD_HEIGHT + 20)).current;
  const [venueCardFoto, setVenueCardFoto] = useState<string | null>(null);
  const [actieveFilters, setActieveFilters] = useState<Set<VenueTyp>>(new Set(ALLE_TYPES));
  const [eventenZichtbaar, setEventenZichtbaar] = useState(true);
  const [alleenFavorieten, setAlleenFavorieten] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const { favorietIds, laden: laadFavorieten, toggle: toggleFavoriet } = useFavorites();
  const [meldingenOngelezen, setMeldingenOngelezen] = useState(0);
  const [zoekActief, setZoekActief] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  const [focusLocatie, setFocusLocatie] = useState({ stad: 'Groningen', provincie: 'Groningen', land: 'Nederland' });
  const [kaartZoom, setKaartZoom] = useState(13);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  type LocatieResultaat = { id: string; naam: string; adres: string; lng: number; lat: number };
  const [locatieResultaten, setLocatieResultaten] = useState<LocatieResultaat[]>([]);
  const locatieZoekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      laadFavorieten();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase
          .from('friendships')
          .select('id', { count: 'exact', head: true })
          .eq('friend_id', user.id)
          .eq('status', 'pending')
          .then(({ count }) => setMeldingenOngelezen(count ?? 0))
      })
    }, [laadFavorieten])
  );

  function toggleFilter(type: VenueTyp) {
    setActieveFilters((prev) => {
      if (prev.has(type) && prev.size === 1) return prev;
      const next = new Set(prev);
      prev.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  const zichtbareVenues = venues.filter((v) => {
    if (alleenFavorieten) return favorietIds.has(v.id);
    return actieveFilters.has((v.type ?? '') as VenueTyp);
  });

  // GeoJSON voor ShapeSource — geselecteerde venue apart renderen als MarkerView
  const geojson = {
    type: 'FeatureCollection' as const,
    features: zichtbareVenues
      .filter((v) => v.id !== selectedVenue?.id)
      .map((v) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [Number(v.lng), Number(v.lat)] },
        properties: { id: v.id, naam: v.name, type: v.type ?? '' },
      })),
  };

  // GeoJSON voor stad-evenementen (regio's)
  const eventRegionsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: !eventenZichtbaar ? [] : cityEvents
      .filter((e) => e.location_type === 'region' && e.polygon && e.polygon.length >= 3)
      .map((e) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[...e.polygon!, e.polygon![0]]],
        },
        properties: { id: e.id, color: e.color ?? EVENT_KLEUR },
      })),
  };

  // GeoJSON voor stad-evenementen (punten)
  const eventPointsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: !eventenZichtbaar ? [] : cityEvents
      .filter((e) => e.location_type === 'point' && e.lat != null && e.lng != null)
      .map((e) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [Number(e.lng), Number(e.lat)] },
        properties: { id: e.id, color: e.color ?? EVENT_KLEUR },
      })),
  };

  useEffect(() => {
    if (!cachedStyleJSON) {
      fetchStyle().then(setStyleJSON).catch(() => setStyleJSON('__fallback__'));
    }
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
    setVenueCardFoto(venue.photo_url ?? null);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    if (!venue.photo_url) {
      supabase
        .from('venue_photos')
        .select('photo_url')
        .eq('venue_id', venue.id)
        .order('sort_order')
        .limit(1)
        .maybeSingle()
        .then(({ data }) => { if (data) setVenueCardFoto(data.photo_url); });
    }
  }

  function sluitVenueCard() {
    Animated.timing(slideAnim, { toValue: CARD_HEIGHT + 20, duration: 220, useNativeDriver: true })
      .start(() => { setSelectedVenue(null); setVenueCardFoto(null); });
  }

  function openEventCard(event: CityEventPin) {
    sluitVenueCard();
    setSelectedEvent(event);
    Animated.spring(eventSlideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }

  function sluitEventCard() {
    Animated.timing(eventSlideAnim, { toValue: CARD_HEIGHT + 20, duration: 220, useNativeDriver: true })
      .start(() => setSelectedEvent(null));
  }

  function handleEventRegionPress(e: { features?: GeoJSON.Feature[] }) {
    const feature = e.features?.[0];
    if (!feature) return;
    const id = feature.properties?.id as string;
    const ev = cityEvents.find((c) => c.id === id);
    if (ev) openEventCard(ev);
  }

  function handleEventPointPress(e: { features?: GeoJSON.Feature[] }) {
    const feature = e.features?.[0];
    if (!feature) return;
    const id = feature.properties?.id as string;
    const ev = cityEvents.find((c) => c.id === id);
    if (ev) openEventCard(ev);
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

  function handleCameraChanged(state: { properties: { zoom: number } }) {
    setKaartZoom(state.properties.zoom);
  }

  function handleMapIdle(state: { properties: { center: GeoJSON.Position; zoom: number } }) {
    const center = state.properties.center;
    const lng = center[0];
    const lat = center[1];
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(async () => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const r = results[0];
        if (r) {
          setFocusLocatie({
            stad: r.city ?? r.subregion ?? r.name ?? 'Onbekend',
            provincie: r.region ?? '',
            land: r.country ?? '',
          });
        }
      } catch { /* silent */ }
    }, 300);
  }

  useEffect(() => {
    const term = zoekterm.trim();
    if (term.length < 2) { setLocatieResultaten([]); return; }
    if (locatieZoekTimerRef.current) clearTimeout(locatieZoekTimerRef.current);
    locatieZoekTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(term)}.json?access_token=${TOKEN}&language=nl&country=nl&types=place,address,poi&limit=4`
        );
        const data = await res.json();
        setLocatieResultaten(
          (data.features ?? []).map((f: { id: string; text: string; place_name: string; geometry: { coordinates: [number, number] } }) => ({
            id: f.id,
            naam: f.text,
            adres: f.place_name,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }))
        );
      } catch { /* silent */ }
    }, 400);
  }, [zoekterm]);

  function kiesLocatieResultaat(locatie: LocatieResultaat) {
    setZoekActief(false);
    setZoekterm('');
    setLocatieResultaten([]);
    cameraRef.current?.setCamera({ centerCoordinate: [locatie.lng, locatie.lat], zoomLevel: 15, animationDuration: 600 });
  }

  const zoekResultaten = zoekterm.trim().length > 0
    ? venues.filter((v) =>
        v.name.toLowerCase().includes(zoekterm.toLowerCase())
      )
    : venues;

  function kiesZoekResultaat(venue: VenuePin) {
    setZoekActief(false);
    setZoekterm('');
    openVenueCard(venue);
    cameraRef.current?.setCamera({
      centerCoordinate: [Number(venue.lng), Number(venue.lat)],
      zoomLevel: 17,
      animationDuration: 600,
    });
  }

  const kleur = VENUE_KLEUREN[selectedVenue?.type ?? ''] ?? '#1A73E8';
  const icon = VENUE_ICONS[selectedVenue?.type ?? ''] ?? 'location-outline';
  const label = VENUE_LABELS[selectedVenue?.type ?? ''] ?? '';

  function openingstijdVandaag(hours: VenuePin['opening_hours']): string | null {
    if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return null;
    const dagSleutels: Record<number, string[]> = {
      0: ['zo', 'sunday'],
      1: ['ma', 'monday'],
      2: ['di', 'tuesday'],
      3: ['wo', 'wednesday'],
      4: ['do', 'thursday'],
      5: ['vr', 'friday'],
      6: ['za', 'saturday'],
    };
    const sleutels = dagSleutels[new Date().getDay()] ?? [];
    const rec = hours as Record<string, unknown>;
    for (const key of sleutels) {
      const val = rec[key];
      if (typeof val === 'string' && val) return val;
    }
    return null;
  }

  return (
    <View style={styles.container}>
      {styleJSON && (
        <Mapbox.MapView
          style={styles.mapFlex}
          {...(styleJSON === '__fallback__'
            ? { styleURL: FALLBACK_STYLE_URL }
            : { styleJSON })}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
          onCameraChanged={handleCameraChanged}
          onMapIdle={handleMapIdle}
          onPress={() => { sluitVenueCard(); sluitEventCard(); }}
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{ centerCoordinate: GRONINGEN, zoomLevel: 13 }}
          />
          <Mapbox.UserLocation visible />

          {/* Stad-evenementen: regio's (polygonen) */}
          <Mapbox.ShapeSource
            id="event-regions"
            shape={eventRegionsGeoJSON}
            onPress={handleEventRegionPress}
          >
            <Mapbox.FillLayer
              id="event-regions-fill"
              style={{
                fillColor: ['coalesce', ['get', 'color'], EVENT_KLEUR] as unknown as string,
                fillOpacity: 0.18,
              }}
            />
            <Mapbox.LineLayer
              id="event-regions-outline"
              style={{
                lineColor: ['coalesce', ['get', 'color'], EVENT_KLEUR] as unknown as string,
                lineWidth: 2.5,
                lineOpacity: 0.85,
              }}
            />
          </Mapbox.ShapeSource>

          {/* Stad-evenementen: punt-locaties */}
          <Mapbox.ShapeSource
            id="event-points"
            shape={eventPointsGeoJSON}
            onPress={handleEventPointPress}
          >
            <Mapbox.CircleLayer
              id="event-pins"
              style={{
                circleColor: ['coalesce', ['get', 'color'], EVENT_KLEUR] as unknown as string,
                circleRadius: 10,
                circleStrokeWidth: 2.5,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </Mapbox.ShapeSource>

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

      {/* Stad/provincie indicator */}
      <View style={[styles.stadPillWrapper, { top: top + 12 }]} pointerEvents="none">
        <View style={styles.stadPill}>
          <Ionicons name="location" size={13} color="#374151" />
          {kaartZoom >= 11 ? (
            <>
              <Text style={styles.stadPillStad}>{focusLocatie.stad}</Text>
              {focusLocatie.provincie ? (
                <>
                  <Text style={styles.stadPillSep}>·</Text>
                  <Text style={styles.stadPillProvincie}>{focusLocatie.provincie}</Text>
                </>
              ) : null}
            </>
          ) : kaartZoom >= 6 ? (
            <Text style={styles.stadPillStad}>{focusLocatie.provincie || focusLocatie.stad}</Text>
          ) : (
            <Text style={styles.stadPillStad}>{focusLocatie.land}</Text>
          )}
        </View>
      </View>

      <View style={[styles.filterKnopWrapper, { top: top + 12 }]}>
        <Pressable
          style={styles.filterKnop}
          onPress={() => setZoekActief(true)}
        >
          <Ionicons name="search" size={22} color="#1A1A1A" />
        </Pressable>
        <Pressable
          style={[styles.filterKnop, { marginTop: 8 }]}
          onPress={() => setFilterMenuOpen((v) => !v)}
        >
          <Ionicons name="options-outline" size={20} color="#1A1A1A" />
        </Pressable>

        {filterMenuOpen && (
          <View style={styles.filterDropdown}>
            {/* Favorieten */}
            <Pressable
              style={styles.filterDropdownRij}
              onPress={() => setAlleenFavorieten((v) => !v)}
            >
              <Ionicons
                name={alleenFavorieten ? 'heart' : 'heart-outline'}
                size={14}
                color={alleenFavorieten ? '#E53E3E' : '#D1D5DB'}
              />
              <Text style={[styles.filterDropdownTekst, alleenFavorieten && { color: '#1A1A1A', fontWeight: '700' }]}>
                Favorieten
              </Text>
            </Pressable>

            <View style={styles.filterDivider} />

            {/* Venue types — uitgeschakeld in favorieten-modus */}
            {ALLE_TYPES.map((type) => {
              const actief = actieveFilters.has(type);
              return (
                <Pressable
                  key={type}
                  style={[styles.filterDropdownRij, alleenFavorieten && { opacity: 0.35 }]}
                  onPress={() => !alleenFavorieten && toggleFilter(type)}
                >
                  <View style={[styles.filterDot, { backgroundColor: actief ? VENUE_KLEUREN[type] : '#D1D5DB' }]} />
                  <Text style={[styles.filterDropdownTekst, actief && { color: '#1A1A1A', fontWeight: '700' }]}>
                    {VENUE_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={styles.filterDropdownRij}
              onPress={() => setEventenZichtbaar((v) => !v)}
            >
              <View style={[styles.filterDot, { backgroundColor: eventenZichtbaar ? EVENT_KLEUR : '#D1D5DB' }]} />
              <Text style={[styles.filterDropdownTekst, eventenZichtbaar && { color: '#1A1A1A', fontWeight: '700' }]}>
                Evenementen
              </Text>
            </Pressable>
          </View>
        )}
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

      {zoekActief && (
        <View style={[styles.zoekOverlay, { top: top + 8 }]}>
          <View style={styles.zoekBalkRij}>
            <Ionicons name="search" size={16} color="#888" />
            <TextInput
              style={styles.zoekInput}
              placeholder="Zoek café, bar of club…"
              placeholderTextColor="#999"
              autoFocus
              value={zoekterm}
              onChangeText={setZoekterm}
              returnKeyType="search"
            />
            <Pressable onPress={() => { setZoekActief(false); setZoekterm(''); }} hitSlop={8}>
              <Ionicons name="close" size={20} color="#888" />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.zoekLijst}>
            {zoekResultaten.length === 0 ? (
              <Text style={styles.zoekLeeg}>Geen resultaten voor "{zoekterm}"</Text>
            ) : (
              zoekResultaten.map((venue) => {
                const vKleur = VENUE_KLEUREN[venue.type ?? ''] ?? '#888';
                const vIcon = VENUE_ICONS[venue.type ?? ''] ?? 'location-outline';
                return (
                  <Pressable
                    key={venue.id}
                    style={({ pressed }) => [styles.zoekRij, pressed && { opacity: 0.6 }]}
                    onPress={() => kiesZoekResultaat(venue)}
                  >
                    <View style={[styles.zoekIcoonRond, { backgroundColor: vKleur }]}>
                      <Ionicons name={vIcon} size={16} color="#fff" />
                    </View>
                    <View style={styles.zoekRijInfo}>
                      <Text style={styles.zoekRijNaam} numberOfLines={1}>{venue.name}</Text>
                      {(() => {
                      const tijd = openingstijdVandaag(venue.opening_hours);
                      return tijd ? (
                        <Text style={styles.zoekRijAdres} numberOfLines={1}>Vandaag: {tijd}</Text>
                      ) : null;
                    })()}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                  </Pressable>
                );
              })
            )}
            {locatieResultaten.length > 0 && (
              <>
                <View style={styles.zoekSectieDivider}>
                  <Text style={styles.zoekSectieTitel}>Locaties</Text>
                </View>
                {locatieResultaten.map((loc) => (
                  <Pressable
                    key={loc.id}
                    style={({ pressed }) => [styles.zoekRij, pressed && { opacity: 0.6 }]}
                    onPress={() => kiesLocatieResultaat(loc)}
                  >
                    <View style={[styles.zoekIcoonRond, { backgroundColor: '#4B5563' }]}>
                      <Ionicons name="map-outline" size={16} color="#fff" />
                    </View>
                    <View style={styles.zoekRijInfo}>
                      <Text style={styles.zoekRijNaam} numberOfLines={1}>{loc.naam}</Text>
                      <Text style={styles.zoekRijAdres} numberOfLines={1}>{loc.adres}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                  </Pressable>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      )}

      <Pressable style={[styles.locatieKnop, { bottom: bottom }]} onPress={centreerOpLocatie}>
        <Ionicons name="navigate" size={22} color="#1A73E8" />
      </Pressable>

      {/* Stad-evenement info-kaartje */}
      {selectedEvent && (() => {
        const evKleur = selectedEvent.color ?? EVENT_KLEUR;
        const evIcon = EVENT_TYPE_ICONS[selectedEvent.event_type ?? ''] ?? 'calendar-outline';
        return (
          <Animated.View style={[styles.venueCard, { bottom: bottom, transform: [{ translateY: eventSlideAnim }] }]}>
            <Pressable
              style={styles.cardDrukbaar}
              onPress={() => router.push(`/city-event/${selectedEvent.id}` as never)}
            >
              <View style={[styles.cardFoto, { backgroundColor: evKleur }]}>
                {selectedEvent.photo_url ? (
                  <Image source={{ uri: selectedEvent.photo_url }} style={styles.cardFotoImg} resizeMode="cover" />
                ) : (
                  <Ionicons name={evIcon} size={34} color="#fff" />
                )}
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardBadgeRij}>
                  <View style={[styles.badge, { backgroundColor: evKleur }]}>
                    <Text style={styles.badgeTekst}>
                      {EVENT_TYPE_LABELS[selectedEvent.event_type ?? ''] ?? 'Evenement'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardNaam} numberOfLines={1}>{selectedEvent.name}</Text>
                <Text style={styles.cardAdres} numberOfLines={1}>
                  {formatDateRange(selectedEvent.start_date, selectedEvent.end_date)}
                </Text>
              </View>
            </Pressable>
            <Pressable style={styles.sluitKnop} onPress={sluitEventCard}>
              <Ionicons name="close" size={18} color="#999" />
            </Pressable>
          </Animated.View>
        );
      })()}

      {selectedVenue && (
        <Animated.View style={[styles.venueCard, { bottom: bottom, transform: [{ translateY: slideAnim }] }]}>
          <Pressable
            style={styles.cardDrukbaar}
            onPress={() => router.push(`/venue/${selectedVenue.id}` as never)}
          >
            <View style={[styles.cardFoto, { backgroundColor: kleur }]}>
              {venueCardFoto ? (
                <Image source={{ uri: venueCardFoto }} style={styles.cardFotoImg} resizeMode="cover" />
              ) : (
                <Ionicons name={icon} size={34} color="#fff" />
              )}
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.cardBadgeRij}>
                <View style={[styles.badge, { backgroundColor: kleur }]}>
                  <Text style={styles.badgeTekst}>{label}</Text>
                </View>
              </View>
              <Text style={styles.cardNaam} numberOfLines={1}>{selectedVenue.name}</Text>
              {(() => {
                const tijd = openingstijdVandaag(selectedVenue.opening_hours);
                return tijd ? (
                  <Text style={styles.cardAdres} numberOfLines={1}>Vandaag: {tijd}</Text>
                ) : null;
              })()}
            </View>
          </Pressable>
          <View style={styles.cardActies}>
            <Pressable
              onPress={() => toggleFavoriet(selectedVenue.id)}
              hitSlop={8}
              style={styles.hartKnopCard}
            >
              <Ionicons
                name={favorietIds.has(selectedVenue.id) ? 'heart' : 'heart-outline'}
                size={20}
                color={favorietIds.has(selectedVenue.id) ? '#E53E3E' : '#C7C7CC'}
              />
            </Pressable>
            <Pressable style={styles.sluitKnop} onPress={sluitVenueCard}>
              <Ionicons name="close" size={18} color="#999" />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
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
    overflow: 'hidden',
  },

  cardFotoImg: {
    ...StyleSheet.absoluteFillObject,
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

  cardDrukbaar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  sluitKnop: {
    padding: 12,
    alignSelf: 'flex-start',
  },

  filterKnopWrapper: {
    position: 'absolute',
    left: 16,
  },

  filterKnop: {
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

  filterDropdown: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
    minWidth: 150,
  },

  filterDropdownRij: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },

  filterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  filterDropdownTekst: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },

  filterDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 14,
    marginVertical: 2,
  },

  cardActies: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingRight: 4,
  },

  hartKnopCard: {
    padding: 8,
  },

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

  zoekOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: 380,
    overflow: 'hidden',
    zIndex: 2,
  },

  zoekBalkRij: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },

  zoekInput: { flex: 1, fontSize: 16, color: '#1A1A1A' },

  zoekLijst: { maxHeight: 300 },

  zoekLeeg: { padding: 20, textAlign: 'center', color: '#999', fontSize: 14 },

  zoekRij: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },

  zoekIcoonRond: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  zoekRijInfo: { flex: 1 },
  zoekRijNaam: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  zoekRijAdres: { fontSize: 12, color: '#888', marginTop: 1 },

  zoekSectieDivider: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  zoekSectieTitel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  stadPillWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },

  stadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  stadPillStad: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  stadPillSep: { fontSize: 13, color: '#9CA3AF' },
  stadPillProvincie: { fontSize: 12, fontWeight: '400', color: '#6B7280' },
});
