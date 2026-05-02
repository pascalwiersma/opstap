import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const GRONINGEN: [number, number] = [6.5665, 53.2194];
const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// Vereenvoudigde grens van Nederland als gesloten polygon.
const NEDERLAND_GRENS = {
  type: 'Feature' as const,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [[
      [3.37, 51.37],
      [3.85, 51.50],
      [4.00, 51.75],
      [3.95, 52.05],
      [4.55, 52.95],
      [4.85, 53.10],
      [5.30, 53.45],
      [6.20, 53.52],
      [7.25, 53.30],
      [7.05, 52.95],
      [6.90, 52.65],
      [7.00, 52.30],
      [6.75, 51.90],
      [6.10, 51.85],
      [5.90, 51.50],
      [5.75, 51.30],
      [5.50, 51.30],
      [4.75, 51.50],
      [4.20, 51.37],
      [3.37, 51.37],
    ]],
  },
  properties: {},
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

type MapLayer = {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
};

const HOOFDWEG_TOKENS = ['motorway', 'trunk', 'primary', 'secondary', 'major'];
const WATER_IDS = ['water', 'water-shadow', 'waterway'];

// Plaatsnamen (settlement/country) wél tonen, rest van de symbolen niet.
const PLAATSNAAM_TOKENS = ['settlement', 'country', 'state', 'continent'];

function processLayer(layer: MapLayer): MapLayer {
  const { id, type } = layer;

  if (type === 'background') {
    return { ...layer, paint: { ...layer.paint, 'background-color': KLEUREN.achtergrond } };
  }

  if (type === 'fill') {
    if (WATER_IDS.some((w) => id === w || id.startsWith(w + '-'))) {
      return { ...layer, paint: { ...layer.paint, 'fill-color': KLEUREN.water } };
    }
    if (id.includes('park') || id.includes('grass') || id.includes('national-park') || id.includes('scrub')) {
      return { ...layer, paint: { ...layer.paint, 'fill-color': KLEUREN.park } };
    }
    if (id.includes('building')) {
      return { ...layer, paint: { ...layer.paint, 'fill-color': KLEUREN.gebouw, 'fill-outline-color': KLEUREN.gebouwOutline } };
    }
  }

  if (type === 'line') {
    if (id.includes('waterway') || id.startsWith('water')) {
      return { ...layer, paint: { ...layer.paint, 'line-color': KLEUREN.water } };
    }
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
  const res = await fetch(
    `https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=${TOKEN}`
  );
  const style = await res.json();
  style.layers = (style.layers as MapLayer[])
    .filter((layer) => {
      if (layer.type !== 'symbol') return true;
      // Alleen plaatsnamen (steden, landen) doorlaten
      return PLAATSNAAM_TOKENS.some((t) => layer.id.includes(t));
    })
    .map(processLayer);
  return JSON.stringify(style);
}

export default function KaartScreen() {
  const [styleJSON, setStyleJSON] = useState<string | null>(null);
  const [locatie, setLocatie] = useState<[number, number] | null>(null);
  const cameraRef = useRef<React.ElementRef<typeof Mapbox.Camera>>(null);
  const { bottom } = useSafeAreaInsets();
  const gecentreerdRef = useRef(false);

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
      cameraRef.current?.setCamera({
        centerCoordinate: locatie,
        zoomLevel: 15,
        animationDuration: 800,
      });
    }, 300);
  }, [locatie, styleJSON]);

  async function centreerOpLocatie() {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({});
    cameraRef.current?.setCamera({
      centerCoordinate: [pos.coords.longitude, pos.coords.latitude],
      zoomLevel: 15,
      animationDuration: 500,
    });
  }

  return (
    <View style={styles.container}>
      {styleJSON && (
        <Mapbox.MapView
          style={StyleSheet.absoluteFillObject}
          styleJSON={styleJSON}
          logoEnabled={false}
          attributionEnabled={false}
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{ centerCoordinate: GRONINGEN, zoomLevel: 13 }}
          />
          <Mapbox.UserLocation visible />

          {/* Gekleurde rand om Nederland */}
          <Mapbox.ShapeSource id="nederland-grens" shape={NEDERLAND_GRENS}>
            <Mapbox.LineLayer
              id="nederland-border"
              style={{
                lineColor: '#1A73E8',
                lineWidth: 2.5,
                lineOpacity: 0.85,
              }}
            />
          </Mapbox.ShapeSource>
        </Mapbox.MapView>
      )}

      <Pressable
        style={[styles.locatieKnop, { bottom: bottom + 90 }]}
        onPress={centreerOpLocatie}
      >
        <Ionicons name="navigate" size={22} color="#1A73E8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
});
