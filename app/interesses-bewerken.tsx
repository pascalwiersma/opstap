import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { supabase } from '../services/supabase';

const MIN = 2;
const MAX = 10;

export const ALLE_INTERESSES = [
  'Housemuziek', 'R&B', 'Latin', 'Rock', 'Pop',
  'Terrasjes', 'Pubquiz', 'Cocktailbars', 'Sportcafes', 'Clubbing',
  'Jazz', 'Techno', 'Indie', 'Karaoke', 'Livemuziek',
];

export default function InteressesBewerkenScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const opgeslagenRef = useRef<Set<string>>(new Set());

  const gewijzigd =
    geselecteerd.size !== opgeslagenRef.current.size ||
    [...geselecteerd].some((i) => !opgeslagenRef.current.has(i));

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);

      const { data } = await supabase
        .from('user_interests')
        .select('interest')
        .eq('user_id', session.user.id);

      if (data && data.length > 0) {
        const set = new Set(data.map((r) => r.interest));
        setGeselecteerd(set);
        opgeslagenRef.current = new Set(set);
      }
      setLaden(false);
    })();
  }, []);

  function toggle(interesse: string) {
    setGeselecteerd((prev) => {
      const nieuw = new Set(prev);
      if (nieuw.has(interesse)) {
        if (nieuw.size <= MIN) return prev;
        nieuw.delete(interesse);
      } else {
        if (nieuw.size >= MAX) return prev;
        nieuw.add(interesse);
      }
      return nieuw;
    });
  }

  async function opslaan() {
    if (!userId || bezig || geselecteerd.size < MIN) return;
    setBezig(true);
    try {
      await supabase.from('user_interests').delete().eq('user_id', userId);
      const rijen = [...geselecteerd].map((interesse) => ({ user_id: userId, interest: interesse }));
      const { error } = await supabase.from('user_interests').insert(rijen);
      if (error) throw error;
      opgeslagenRef.current = new Set(geselecteerd);
      router.back();
    } catch {
      Alert.alert('Fout', 'Kon interesses niet opslaan. Probeer opnieuw.');
    } finally {
      setBezig(false);
    }
  }

  const aantalTekst = `${geselecteerd.size} / ${MAX} geselecteerd`;
  const opslaanMogelijk = geselecteerd.size >= MIN && gewijzigd;

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.terugKnop} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.secondary} />
        </Pressable>
        <Text style={styles.titel}>Interesses</Text>
        <View style={{ width: 40 }} />
      </View>

      {laden ? (
        <View style={styles.midden}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.inhoud, { paddingBottom: bottom + 100 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subtitel}>
              Kies minimaal {MIN} en maximaal {MAX} interesses. We gebruiken dit om je te matchen met andere gebruikers.
            </Text>
            <Text style={styles.teller}>{aantalTekst}</Text>
            <View style={styles.grid}>
              {ALLE_INTERESSES.map((interesse) => {
                const actief = geselecteerd.has(interesse);
                const geblokkeerd = !actief && geselecteerd.size >= MAX;
                return (
                  <Pressable
                    key={interesse}
                    style={[
                      styles.tag,
                      actief ? styles.tagActief : styles.tagInactief,
                      geblokkeerd && styles.tagGeblokkeerd,
                    ]}
                    onPress={() => toggle(interesse)}
                  >
                    {actief && (
                      <Ionicons name="checkmark" size={14} color="#fff" style={styles.vinkje} />
                    )}
                    <Text style={[styles.tagTekst, actief ? styles.tagTekstActief : styles.tagTekstInactief]}>
                      {interesse}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {geselecteerd.size < MIN && (
              <Text style={styles.hint}>Kies nog {MIN - geselecteerd.size} interesse{MIN - geselecteerd.size !== 1 ? 's' : ''}</Text>
            )}
          </ScrollView>

          <View style={[styles.bodem, { paddingBottom: bottom + 12 }]}>
            <Pressable
              style={[styles.opslaanKnop, (!opslaanMogelijk || bezig) && styles.knopDisabled]}
              onPress={opslaan}
              disabled={!opslaanMogelijk || bezig}
            >
              {bezig
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.opslaanTekst}>Opslaan</Text>}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:  { flex: 1, backgroundColor: '#F2F2F7' },
  midden:   { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  terugKnop: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  titel:    { fontSize: 17, fontWeight: '700', color: COLORS.text },

  inhoud:   { paddingHorizontal: 16, paddingTop: 4, gap: 16 },
  subtitel: { fontSize: 14, color: COLORS.textLight, lineHeight: 20 },
  teller:   { fontSize: 13, fontWeight: '600', color: COLORS.secondary },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24 },
  tagActief:     { backgroundColor: COLORS.primary },
  tagInactief:   { backgroundColor: '#fff' },
  tagGeblokkeerd: { opacity: 0.4 },
  vinkje:   { marginRight: 5 },
  tagTekst: { fontSize: 15, fontWeight: '600' },
  tagTekstActief:   { color: '#fff' },
  tagTekstInactief: { color: COLORS.text },

  hint: { fontSize: 13, color: COLORS.primary, textAlign: 'center', fontWeight: '600' },

  bodem:    { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#F2F2F7', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)' },
  opslaanKnop:  { backgroundColor: COLORS.secondary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  opslaanTekst: { fontSize: 16, fontWeight: '700', color: '#fff' },
  knopDisabled: { opacity: 0.4 },
});
