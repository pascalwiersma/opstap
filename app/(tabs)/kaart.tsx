import Mapbox from '@rnmapbox/maps';
import { StyleSheet, View } from 'react-native';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const GRONINGEN: [number, number] = [6.5665, 53.2194];

export default function KaartScreen() {
  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL="mapbox://styles/mapbox/dark-v11"
        logoEnabled={false}
        attributionEnabled={false}
      >
        <Mapbox.Camera
          defaultSettings={{
            centerCoordinate: GRONINGEN,
            zoomLevel: 13,
          }}
        />
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
