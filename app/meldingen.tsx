import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';

export default function MeldingenScreen() {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingTop: top, paddingBottom: bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </Pressable>
        <Text style={styles.titel}>Meldingen</Text>
      </View>
      <Text style={styles.leeg}>Je hebt nog geen meldingen.</Text>
      <Text style={styles.hint}>Hier komen o.a. uitnodigingen en updates over je avonden.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 20 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 28 },
  titel:      { fontSize: 28, fontWeight: '700', color: COLORS.text },
  leeg:       { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  hint:       { fontSize: 15, color: COLORS.textLight, lineHeight: 22 },
});
