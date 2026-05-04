import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { Tables } from '../../types/supabase';

type CheckIn = Pick<Tables<'check_ins'>, 'id' | 'status'>;

const GRONINGEN: { lat: number; lng: number } = { lat: 53.2194, lng: 6.5665 };
const STRAAL_KM = 15;

function afstandKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function bepaalStad(lat: number, lng: number): Promise<string | null> {
  const km = afstandKm(lat, lng, GRONINGEN.lat, GRONINGEN.lng);
  return km <= STRAAL_KM ? 'Groningen' : null;
}

async function haalPushToken(): Promise<string | null> {
  try {
    const { status: bestaand } = await Notifications.getPermissionsAsync();
    const status =
      bestaand !== 'granted'
        ? (await Notifications.requestPermissionsAsync()).status
        : bestaand;
    if (status !== 'granted') return null;
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch {
    return null;
  }
}

function PulseRing({ actief }: { actief: boolean }) {
  const schaal = useRef(new Animated.Value(1)).current;
  const doorzichtig = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!actief) return;
    const animatie = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(schaal, { toValue: 1.6, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(doorzichtig, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(schaal, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(doorzichtig, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    animatie.start();
    return () => animatie.stop();
  }, [actief]);

  if (!actief) return null;
  return (
    <Animated.View
      style={[
        styles.pulseRing,
        { transform: [{ scale: schaal }], opacity: doorzichtig },
      ]}
    />
  );
}

export default function IncheckenScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [count, setCount] = useState(0);
  const [stad, setStad] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function laadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [eigenResult, telResult] = await Promise.all([
      supabase.from('check_ins').select('id, status').eq('user_id', user.id).eq('date', today).maybeSingle(),
      supabase.from('check_ins').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'active'),
    ]);

    setCheckIn(eigenResult.data as CheckIn | null);
    setCount(telResult.count ?? 0);
    setLoading(false);
  }

  useEffect(() => { laadData(); }, []);

  async function inchecken() {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Locatie + push token parallel ophalen — beiden mogen falen zonder check-in te blokkeren
      const [locatieResult, pushToken] = await Promise.all([
        (async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return null;
            return (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords;
          } catch { return null; }
        })(),
        haalPushToken(),
      ]);

      const gevondenStad = locatieResult
        ? await bepaalStad(locatieResult.latitude, locatieResult.longitude)
        : 'Groningen';

      // Push token fire-and-forget — blokkeer check-in niet
      if (pushToken) {
        supabase.from('profiles').update({ push_token: pushToken } as never).eq('id', user.id).then();
      }

      const stad = gevondenStad ?? 'Groningen';
      let nieuweCheckIn: CheckIn | null = null;

      if (checkIn) {
        const { data, error } = await supabase
          .from('check_ins')
          .update({ status: 'active', city: stad } as never)
          .eq('id', checkIn.id)
          .select('id, status')
          .single();
        if (error) throw error;
        nieuweCheckIn = data as CheckIn | null;
      } else {
        const { data, error } = await supabase
          .from('check_ins')
          .insert({ user_id: user.id, date: today, city: stad } as never)
          .select('id, status')
          .single();
        if (error) throw error;
        nieuweCheckIn = data as CheckIn | null;
      }

      if (nieuweCheckIn) {
        setCheckIn(nieuweCheckIn);
        setStad(gevondenStad);
        setCount(c => c + 1);
      }
    } catch (e) {
      console.error('inchecken mislukt:', e);
      Alert.alert('Inchecken mislukt', 'Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  async function uitchecken() {
    if (!checkIn) return;
    setBusy(true);
    const { error } = await supabase
      .from('check_ins')
      .update({ status: 'cancelled', checked_out_at: new Date().toISOString() })
      .eq('id', checkIn.id);
    if (!error) {
      setCheckIn(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setStad(null);
      setCount(c => Math.max(0, c - 1));
    }
    setBusy(false);
  }

  const isIngecheckt = checkIn?.status === 'active';

  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bottom + 80 }]}>
      <View style={styles.inhoud}>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : isIngecheckt ? (
          /* ── Bevestigingsscherm ── */
          <View style={styles.bevestiging}>
            <View style={styles.pulseWrapper}>
              <PulseRing actief />
              <View style={styles.vinkjeCircle}>
                <Ionicons name="checkmark" size={28} color="#fff" />
              </View>
            </View>

            <View style={styles.bevestigingTeksten}>
              <Text style={styles.bevestigingTitel}>
                Je bent ingecheckt{stad ? ` in ${stad}` : ''}!
              </Text>
              <Text style={styles.bevestigingSubtitel}>
                We laten je weten wanneer we mensen hebben gevonden die bij je passen.
              </Text>
            </View>

            <View style={styles.tellerBlok}>
              <Text style={styles.teller}>{count}</Text>
              <Text style={styles.tellerLabel}>
                {count === 1 ? 'persoon gaat vanavond uit' : 'mensen gaan vanavond uit'}
                {stad ? ` in ${stad}` : ''}
              </Text>
            </View>

            <Pressable style={styles.annuleerKnop} onPress={uitchecken} disabled={busy}>
              {busy
                ? <ActivityIndicator color={COLORS.textLight} />
                : <Text style={styles.annuleerTekst}>Toch niet</Text>}
            </Pressable>
          </View>
        ) : (
          /* ── Incheck scherm ── */
          <View style={styles.voor}>
            <Text style={styles.koptekst}>Vanavond in Groningen</Text>

            <View style={styles.tellerBlok}>
              <Text style={styles.teller}>{count}</Text>
              <Text style={styles.tellerLabel}>
                {count === 1 ? 'persoon gaat vanavond uit' : 'mensen gaan vanavond uit'}
              </Text>
            </View>

            <Pressable
              style={[styles.incheckenKnop, busy && styles.knopDisabled]}
              onPress={inchecken}
              disabled={busy}
            >
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.incheckenTekst}>Ik ga vanavond uit</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const ORANJE = COLORS.primary;

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  inhoud:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  // Voor inchecken
  voor:           { width: '100%', alignItems: 'center', gap: 36 },
  koptekst:       { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  tellerBlok:     { alignItems: 'center', gap: 8 },
  teller:         { fontSize: 88, fontWeight: '800', color: ORANJE, lineHeight: 96 },
  tellerLabel:    { fontSize: 16, color: COLORS.textLight, textAlign: 'center' },
  incheckenKnop:  { width: '100%', paddingVertical: 18, borderRadius: 16, backgroundColor: ORANJE, alignItems: 'center' },
  knopDisabled:   { opacity: 0.6 },
  incheckenTekst: { fontSize: 17, fontWeight: '700', color: '#fff' },

  // Na inchecken
  bevestiging:       { width: '100%', alignItems: 'center', gap: 32 },
  pulseWrapper:      { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  pulseRing:         {
    position: 'absolute',
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: ORANJE,
  },
  vinkjeCircle:      { width: 64, height: 64, borderRadius: 32, backgroundColor: ORANJE, alignItems: 'center', justifyContent: 'center' },
  bevestigingTeksten: { alignItems: 'center', gap: 10 },
  bevestigingTitel:   { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  bevestigingSubtitel: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 22 },
  annuleerKnop:      { paddingVertical: 12, paddingHorizontal: 24 },
  annuleerTekst:     { fontSize: 15, color: COLORS.textLight, textDecorationLine: 'underline' },
});
