import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useStats } from '../hooks/useStats';

interface Props {
  userId: string | null;
  trustScore?: number | null;
}

export function StatsTab({ userId, trustScore }: Props) {
  const { stats, laden } = useStats(userId);

  if (laden) {
    return <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />;
  }

  if (!stats) return null;

  const { opkomstKeren, actiefSindsWeken } = stats;

  return (
    <View style={styles.wrapper}>

      {/* Betrouwbaarheid */}
      {trustScore != null && (
        <View style={styles.kaart}>
          <View style={styles.kaartHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#F59E0B" />
            <Text style={styles.kaartTitel}>Betrouwbaarheidsscore</Text>
            <Pressable
              style={{ marginLeft: 'auto' }}
              onPress={() => Alert.alert(
                'Hoe werkt de score?',
                'De betrouwbaarheidsscore loopt van 1 tot 5 sterren en laat zien hoe betrouwbaar iemand is.\n\nDe dag na een avondje uit krijgt iedereen uit de groep de vraag wie er was komen opdagen. Als uit die stemming blijkt dat jij er niet was, gaat je score omlaag.\n\n⭐ Stijgt wanneer de groep bevestigt dat je er was.\n⬇️ Daalt bij te vaak afzeggen of niet opdagen.\n\nEen hoge score vergroot de kans dat deze persoon daadwerkelijk te vertrouwen is.',
                [{ text: 'Duidelijk' }]
              )}
              hitSlop={8}
            >
              <Ionicons name="information-circle-outline" size={18} color="#9CA3AF" />
            </Pressable>
          </View>
          <View style={styles.sterrenRij}>
            {[1,2,3,4,5].map((n) => {
              const vol = trustScore >= n;
              const half = !vol && trustScore >= n - 0.5;
              return (
                <Ionicons key={n} name={vol ? 'star' : half ? 'star-half' : 'star-outline'} size={22} color="#F59E0B" />
              );
            })}
            <Text style={styles.sterrenGetal}>{Number(trustScore).toFixed(1)}</Text>
          </View>
        </View>
      )}

      {/* Cijfers */}
      <View style={styles.kaart}>
        {actiefSindsWeken !== null && (
          <>
            <StatRij
              icoon="time-outline"
              label="Actief sinds"
              tekst={actiefSindsWeken === 0 ? 'Deze week' : actiefSindsWeken === 1 ? '1 week' : `${actiefSindsWeken} weken`}
            />
            <View style={styles.divider} />
          </>
        )}
        <StatRij icoon="checkmark-circle-outline" label="Keren ingecheckt" waarde={opkomstKeren} />
      </View>
    </View>
  );
}

function StatRij({ icoon, label, waarde, tekst }: { icoon: keyof typeof Ionicons.glyphMap; label: string; waarde?: number; tekst?: string }) {
  return (
    <View style={styles.statRij}>
      <View style={styles.statIcoonRond}>
        <Ionicons name={icoon} size={16} color={COLORS.secondary} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statWaarde}>{waarde !== undefined ? waarde : tekst}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },

  kaart: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10 },
  kaartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kaartTitel: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  sterrenRij: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sterrenGetal: { marginLeft: 6, fontSize: 15, fontWeight: '700', color: '#F59E0B' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.07)' },
  statRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIcoonRond: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EDE9FF', alignItems: 'center', justifyContent: 'center' },
  statLabel: { flex: 1, fontSize: 15, color: COLORS.text },
  statWaarde: { fontSize: 15, fontWeight: '700', color: COLORS.text },
});
