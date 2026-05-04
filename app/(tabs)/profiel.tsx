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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';

const PAARS = COLORS.secondary;

const INTERESSE_EMOJI: Record<string, string> = {
  uitgaan: '🕺',
  spelletjes: '🎲',
  evenement: '🎪',
  huisfeest: '🎵',
  feestje: '🎉',
  sport: '⚽',
  muziek: '🎸',
  film: '🎬',
  kunst: '🎨',
  reizen: '✈️',
  koken: '🍳',
  natuur: '🌿',
  gaming: '🎮',
  yoga: '🧘',
  fitness: '💪',
};

function interesseEmoji(interesse: string): string {
  return INTERESSE_EMOJI[interesse.toLowerCase()] ?? '✨';
}

const TABS = ['Info', 'Stats', 'Communities'] as const;
type TabNaam = (typeof TABS)[number];

export default function ProfielScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [actieveTab, setActieveTab] = useState<TabNaam>('Info');
  const [naam, setNaam] = useState('');
  const [leeftijd, setLeeftijd] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [interesses, setInteresses] = useState<string[]>([]);
  const [extraFotos, setExtraFotos] = useState<{ id: string; photo_url: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const [profielRes, interessesRes, fotosRes] = await Promise.all([
          supabase.from('profiles').select('name, avatar_url, age').eq('id', user.id).single(),
          supabase.from('user_interests').select('interest').eq('user_id', user.id),
          supabase.from('profile_photos').select('id, photo_url').eq('user_id', user.id).order('position'),
        ]);

        if (profielRes.data) {
          setNaam(profielRes.data.name ?? '');
          setLeeftijd(profielRes.data.age ?? null);
          setAvatarUrl(profielRes.data.avatar_url ?? null);
        }
        if (interessesRes.data) setInteresses(interessesRes.data.map((r) => r.interest));
        if (fotosRes.data) setExtraFotos(fotosRes.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const initialen = naam
    ? naam.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.rondeKnop} onPress={() => router.push('/instellingen')} hitSlop={8}>
          <Ionicons name="settings-outline" size={20} color={PAARS} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 48 }} />
      ) : (
        <>
          {/* Profiel info */}
          <View style={styles.profielRij}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaat]}>
                <Text style={styles.avatarLetters}>{initialen}</Text>
              </View>
            )}
            <View style={styles.profielTekst}>
              <View style={styles.naamRij}>
                <Text style={styles.naamVet}>{naam || '—'}</Text>
                {leeftijd != null && (
                  <Text style={styles.leeftijdTekst}> {leeftijd}</Text>
                )}
              </View>
              <Pressable onPress={() => router.push('/profiel-bewerken')}>
                <Text style={styles.bewerkLink}>Profiel bewerken</Text>
              </Pressable>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabBalk}>
            {TABS.map((tab) => (
              <Pressable key={tab} style={styles.tabItem} onPress={() => setActieveTab(tab)}>
                <Text style={[styles.tabTekst, actieveTab === tab && styles.tabActief]}>
                  {tab}
                </Text>
                {actieveTab === tab && <View style={styles.tabLijn} />}
              </Pressable>
            ))}
          </View>

          {/* Tab inhoud */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollInhoud, { paddingBottom: bottom + 100 }]}
            showsVerticalScrollIndicator={false}
          >
            {actieveTab === 'Info' && (
              <View style={styles.tabInhoud}>
                <View style={styles.sectie}>
                  <View style={styles.sectieHeader}>
                    <Text style={styles.sectieLabel}>Interesses</Text>
                    {interesses.length > 0 && (
                      <Text style={styles.sectieAantal}>{interesses.length}</Text>
                    )}
                  </View>
                  {interesses.length === 0 ? (
                    <Text style={styles.leegTekst}>Nog geen interesses toegevoegd.</Text>
                  ) : (
                    <View style={styles.chipsGrid}>
                      {interesses.map((int) => (
                        <View key={int} style={styles.chip}>
                          <Text style={styles.chipTekst}>
                            {interesseEmoji(int)} {int}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {extraFotos.length > 0 && (
                  <View style={styles.sectie}>
                    <View style={styles.sectieHeader}>
                      <Text style={styles.sectieLabel}>Foto's</Text>
                      <Text style={styles.sectieAantal}>{extraFotos.length}</Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.fotoScroll}
                      contentContainerStyle={styles.fotoScrollInhoud}
                    >
                      {extraFotos.map((foto) => (
                        <Image
                          key={foto.id}
                          source={{ uri: foto.photo_url }}
                          style={styles.fotoItem}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {actieveTab === 'Stats' && (
              <View style={styles.sectie}>
                <Text style={styles.leegTekst}>Stats komen binnenkort.</Text>
              </View>
            )}

            {actieveTab === 'Communities' && (
              <View style={styles.sectie}>
                <Text style={styles.leegTekst}>Communities komen binnenkort.</Text>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:        { flex: 1, backgroundColor: '#fff' },

  header:         { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 12 },
  rondeKnop:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },

  profielRij:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  avatar:         { width: 90, height: 90, borderRadius: 45 },
  avatarPlaat:    { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetters:  { fontSize: 32, fontWeight: '700', color: '#fff' },
  profielTekst:   { flex: 1, gap: 4 },
  naamRij:        { flexDirection: 'row', alignItems: 'baseline' },
  naamVet:        { fontSize: 28, fontWeight: '700', color: COLORS.text, letterSpacing: -0.5 },
  leeftijdTekst:  { fontSize: 28, fontWeight: '400', color: '#C7C7CC', letterSpacing: -0.5 },
  bewerkLink:     { fontSize: 15, fontWeight: '500', color: PAARS },

  tabBalk:        { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.12)', paddingHorizontal: 16 },
  tabItem:        { marginRight: 24, paddingBottom: 10 },
  tabTekst:       { fontSize: 16, fontWeight: '600', color: '#C7C7CC' },
  tabActief:      { color: COLORS.text },
  tabLijn:        { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: PAARS, borderRadius: 2 },

  scroll:         { flex: 1 },
  scrollInhoud:   { paddingHorizontal: 16, paddingTop: 20 },

  tabInhoud:      { gap: 28 },
  sectie:         { gap: 14 },
  sectieHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectieLabel:    { fontSize: 16, fontWeight: '700', color: COLORS.text },
  sectieAantal:   { fontSize: 15, fontWeight: '500', color: '#C7C7CC' },

  chipsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:           { backgroundColor: '#F2F2F7', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  chipTekst:      { fontSize: 14, fontWeight: '500', color: COLORS.text },

  leegTekst:      { fontSize: 14, color: COLORS.textLight },

  fotoScroll:      { marginHorizontal: -16 },
  fotoScrollInhoud: { paddingHorizontal: 16, gap: 10 },
  fotoItem:        { width: 120, height: 120, borderRadius: 12 },
});
