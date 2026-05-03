import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';

export default function InstellingenScreen() {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingTop: top, paddingBottom: bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </Pressable>
        <Text style={styles.titel}>Instellingen</Text>
      </View>
      <Text style={styles.tekst}>
        Hier komen voorkeuren voor meldingen, privacy en meer. Dit scherm wordt nog gevuld.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 16 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  titel:      { fontSize: 28, fontWeight: '700', color: COLORS.text },
  tekst:      { fontSize: 15, color: COLORS.textLight, lineHeight: 22 },
});
