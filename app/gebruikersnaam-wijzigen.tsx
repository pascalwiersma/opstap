import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { supabase } from '../services/supabase';

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function valideerFormaat(u: string): boolean {
  return /^[a-zA-Z0-9_]{3,}$/.test(u);
}

function dagenTotWijzigen(changedAt: string): number {
  const volgende = new Date(changedAt);
  volgende.setMonth(volgende.getMonth() + 1);
  return Math.ceil((volgende.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function GebruikersnaamWijzigenScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [huidig, setHuidig] = useState<string | null>(null);
  const [changedAt, setChangedAt] = useState<string | null>(null);
  const [nieuw, setNieuw] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('username, username_changed_at')
        .eq('id', user.id)
        .single();
      if (data) {
        setHuidig(data.username ?? null);
        setChangedAt(data.username_changed_at ?? null);
      }
      setLaden(false);
    })();
  }, []);

  const dagenOver = changedAt ? dagenTotWijzigen(changedAt) : 0;
  const geblokkeerd = dagenOver > 0;

  function handleChange(waarde: string) {
    const gefilterd = waarde.replace(/[^a-zA-Z0-9_]/g, '');
    setNieuw(gefilterd);
    setFout(null);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!valideerFormaat(gefilterd)) {
      setStatus(gefilterd.length === 0 ? 'idle' : 'invalid');
      return;
    }
    if (gefilterd.toLowerCase() === huidig?.toLowerCase()) {
      setStatus('idle');
      return;
    }

    setStatus('checking');
    timerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', gefilterd.toLowerCase())
        .maybeSingle();
      setStatus(data ? 'taken' : 'available');
    }, 500);
  }

  async function slaOp() {
    if (!valideerFormaat(nieuw)) { setFout('Minimaal 3 tekens, alleen letters, cijfers en _.'); return; }
    if (status === 'taken') { setFout('Deze gebruikersnaam is al bezet.'); return; }
    if (status !== 'available') { setFout('Wacht even tot de beschikbaarheid is gecheckt.'); return; }

    setBezig(true);
    setFout(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ username: nieuw.toLowerCase(), username_changed_at: new Date().toISOString() })
      .eq('id', user.id);

    setBezig(false);

    if (error) { setFout(error.message); return; }
    router.back();
  }

  if (laden) {
    return (
      <View style={[styles.wrapper, { paddingTop: top }, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { paddingTop: top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.terugKnop} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.secondary} />
        </Pressable>
        <Text style={styles.headerTitel}>Gebruikersnaam</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.inhoud, { paddingBottom: bottom + 24 }]}>
        {huidig && (
          <Text style={styles.huidigTekst}>Huidig: <Text style={styles.huidigWaarde}>@{huidig}</Text></Text>
        )}

        {geblokkeerd ? (
          <View style={styles.blokkadeKaart}>
            <Ionicons name="time-outline" size={28} color={COLORS.textLight} />
            <Text style={styles.blokkadeTitel}>Nog {dagenOver} {dagenOver === 1 ? 'dag' : 'dagen'}</Text>
            <Text style={styles.blokkadeSubtitel}>
              Je kunt je gebruikersnaam 1x per maand wijzigen.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.inputRij}>
              <Text style={styles.atTeken}>@</Text>
              <TextInput
                style={styles.input}
                value={nieuw}
                onChangeText={handleChange}
                placeholder={huidig ?? 'nieuweNaam_123'}
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {status === 'checking' && <ActivityIndicator size="small" color={COLORS.primary} />}
              {status === 'available' && <Ionicons name="checkmark-circle" size={22} color="#38A169" />}
              {(status === 'taken' || status === 'invalid') && <Ionicons name="close-circle" size={22} color="#E53E3E" />}
            </View>

            {status === 'taken' && <Text style={styles.hint}>Deze gebruikersnaam is al bezet.</Text>}
            {status === 'invalid' && nieuw.length > 0 && <Text style={styles.hint}>Minimaal 3 tekens, alleen letters, cijfers en _.</Text>}
            {status === 'available' && <Text style={[styles.hint, { color: '#38A169' }]}>Beschikbaar!</Text>}

            {fout && (
              <View style={styles.foutBalk}>
                <Ionicons name="alert-circle" size={16} color="#C53030" />
                <Text style={styles.foutTekst}>{fout}</Text>
              </View>
            )}

            <Text style={styles.info}>Je kunt je gebruikersnaam 1x per maand wijzigen.</Text>

            <Pressable
              style={[styles.knop, (bezig || status !== 'available') && styles.knopDisabled]}
              onPress={slaOp}
              disabled={bezig || status !== 'available'}
            >
              {bezig ? <ActivityIndicator color="#fff" /> : <Text style={styles.knopTekst}>Opslaan</Text>}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  terugKnop: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitel: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  inhoud: { paddingHorizontal: 16, gap: 16 },

  huidigTekst: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
  huidigWaarde: { fontWeight: '700', color: COLORS.text },

  blokkadeKaart: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 10, marginTop: 12,
  },
  blokkadeTitel: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  blokkadeSubtitel: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },

  inputRij: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#ECECEC',
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 16 : 12,
  },
  atTeken: { fontSize: 20, fontWeight: '700', color: COLORS.textLight },
  input: { flex: 1, fontSize: 18, fontWeight: '600', color: COLORS.text },

  hint: { fontSize: 13, color: '#E53E3E', textAlign: 'center', marginTop: -8 },

  foutBalk: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF5F5', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FED7D7',
  },
  foutTekst: { flex: 1, fontSize: 13, color: '#9B2C2C' },

  info: { fontSize: 13, color: COLORS.textLight, textAlign: 'center' },

  knop: {
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  knopDisabled: { opacity: 0.6 },
  knopTekst: { fontSize: 17, fontWeight: '800', color: '#fff' },
});
