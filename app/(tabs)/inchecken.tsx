import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { Tables } from '../../types/supabase';
import {
  avondFase,
  checkInVensterStatus,
  checkInVensterTeksten,
  formatAftellen,
  isCheckInVensterOpen,
  msTotAmsterdamKlokVandaag,
  type AvondFase,
  vandaagAmsterdam,
} from '../../utils/checkInWindow';

type CheckIn = Pick<Tables<'check_ins'>, 'id' | 'status'>;

type MatchUitslag =
  | { fase: 'laden' }
  | { fase: 'geen_match' }
  | { fase: 'bevestigd'; matchId: string; namen: string[] }
  | { fase: 'afgezegd' }
  | { fase: 'reageer_nog'; matchId: string };

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

function TimerKaart({ titel, subtitel, ms }: { titel: string; subtitel: string; ms: number }) {
  return (
    <View style={styles.timerKaart}>
      <Text style={styles.timerTitel}>{titel}</Text>
      <Text style={styles.timerGroot}>{formatAftellen(ms)}</Text>
      <Text style={styles.timerSub}>{subtitel}</Text>
    </View>
  );
}

export default function IncheckenScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [count, setCount] = useState(0);
  const [stad, setStad] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [, setClock] = useState(0);
  const [, setTick1s] = useState(0);
  const [uitslag, setUitslag] = useState<MatchUitslag>({ fase: 'laden' });
  /** Tussen 22–23: link naar voorgestelde match na push/cron */
  const [matchIdVandaag, setMatchIdVandaag] = useState<string | null>(null);

  const today = vandaagAmsterdam();
  const faseAvond: AvondFase = avondFase();

  useEffect(() => {
    const id = setInterval(() => setClock((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (faseAvond === 'na_23') return;
    const id = setInterval(() => setTick1s((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [faseAvond]);

  useEffect(() => {
    let weg = false;

    async function laadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || weg) return;

      const [eigenResult, telResult] = await Promise.all([
        supabase.from('check_ins').select('id, status').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('check_ins').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'active'),
      ]);

      if (weg) return;
      setCheckIn(eigenResult.data as CheckIn | null);
      setCount(telResult.count ?? 0);
      setLoading(false);
    }

    setLoading(true);
    laadData();
    return () => {
      weg = true;
    };
  }, [today]);

  async function laadUitslag(userId: string) {
    setUitslag({ fase: 'laden' });

    const { data: lidRows } = await supabase.from('match_members').select('match_id').eq('user_id', userId);
    const mids = [...new Set((lidRows ?? []).map((r) => r.match_id))];
    if (mids.length === 0) {
      setUitslag({ fase: 'geen_match' });
      return;
    }

    const { data: vandaagMatches } = await supabase
      .from('matches')
      .select('id, status')
      .in('id', mids)
      .eq('date', today);

    const m = vandaagMatches?.[0];
    if (!m) {
      setUitslag({ fase: 'geen_match' });
      return;
    }

    if (m.status === 'confirmed') {
      const { data: leden } = await supabase.from('match_members').select('user_id').eq('match_id', m.id);
      const anderen = (leden ?? []).map((l) => l.user_id).filter((id) => id !== userId);
      if (anderen.length === 0) {
        setUitslag({ fase: 'bevestigd', matchId: m.id, namen: [] });
        return;
      }
      const { data: profielen } = await supabase.from('profiles').select('name').in('id', anderen);
      const namen = (profielen ?? []).map((p) => p.name).filter(Boolean) as string[];
      setUitslag({ fase: 'bevestigd', matchId: m.id, namen });
      return;
    }

    if (m.status === 'cancelled') {
      setUitslag({ fase: 'afgezegd' });
      return;
    }

    if (m.status === 'proposed') {
      setUitslag({ fase: 'reageer_nog', matchId: m.id });
      return;
    }

    setUitslag({ fase: 'geen_match' });
  }

  useEffect(() => {
    if (faseAvond !== 'na_23') return;
    if (!checkIn || (checkIn.status !== 'active' && checkIn.status !== 'matched')) return;

    let weg = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || weg) return;
      await laadUitslag(user.id);
    })();
    return () => {
      weg = true;
    };
  }, [faseAvond, today, checkIn?.id, checkIn?.status]);

  useEffect(() => {
    if (faseAvond !== 'tussen_22_23' || checkIn?.status !== 'matched') {
      setMatchIdVandaag(null);
      return;
    }
    let weg = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || weg) return;
      const { data: mmRows } = await supabase.from('match_members').select('match_id').eq('user_id', user.id);
      const ids = [...new Set((mmRows ?? []).map((r) => r.match_id))];
      if (ids.length === 0) return;
      const { data: ma } = await supabase.from('matches').select('id').in('id', ids).eq('date', today).maybeSingle();
      if (!weg && ma?.id) setMatchIdVandaag(ma.id);
    })();
    return () => {
      weg = true;
    };
  }, [faseAvond, checkIn?.status, today]);

  const msTot22 = msTotAmsterdamKlokVandaag(22, 0);
  const msTot23 = msTotAmsterdamKlokVandaag(23, 0);

  async function inchecken() {
    if (!isCheckInVensterOpen()) {
      const { titel, uitleg } = checkInVensterTeksten();
      Alert.alert(titel || 'Niet mogelijk', uitleg);
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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

      if (pushToken) {
        supabase.from('profiles').update({ push_token: pushToken } as never).eq('id', user.id).then();
      }

      const stadLocal = gevondenStad ?? 'Groningen';
      let nieuweCheckIn: CheckIn | null = null;

      if (checkIn) {
        const { data, error } = await supabase
          .from('check_ins')
          .update({ status: 'active', city: stadLocal } as never)
          .eq('id', checkIn.id)
          .select('id, status')
          .single();
        if (error) throw error;
        nieuweCheckIn = data as CheckIn | null;
      } else {
        const { data, error } = await supabase
          .from('check_ins')
          .insert({ user_id: user.id, date: today, city: stadLocal } as never)
          .select('id, status')
          .single();
        if (error) throw error;
        nieuweCheckIn = data as CheckIn | null;
      }

      if (nieuweCheckIn) {
        setCheckIn(nieuweCheckIn);
        setStad(gevondenStad);
        setCount((c) => c + 1);
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
      setCheckIn((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
      setStad(null);
      setCount((c) => Math.max(0, c - 1));
    }
    setBusy(false);
  }

  const ingechecktActiefOfGematched =
    checkIn && (checkIn.status === 'active' || checkIn.status === 'matched');

  const magAnnuleren =
    checkIn?.status === 'active' && faseAvond === 'voor_22';

  const geslotenBericht = checkInVensterTeksten();

  function renderIncheckBlok() {
    if (!ingechecktActiefOfGematched) return null;

    if (faseAvond === 'voor_22') {
      return (
        <>
          <TimerKaart
            titel="Groepen worden om 22:00 samengesteld"
            subtitel="Om 22:00 koppelen we iedereen die vanavond uitgaat."
            ms={msTot22}
          />
          {magAnnuleren ? (
            <Pressable style={styles.annuleerKnop} onPress={uitchecken} disabled={busy}>
              {busy
                ? <ActivityIndicator color={COLORS.textLight} />
                : <Text style={styles.annuleerTekst}>Toch niet</Text>}
            </Pressable>
          ) : null}
        </>
      );
    }

    if (faseAvond === 'tussen_22_23') {
      return (
        <>
          <View style={styles.statusKaart}>
            <Ionicons name="people-outline" size={36} color={COLORS.primary} />
            <Text style={styles.statusKaartTitel}>We zijn bezig met groepen maken</Text>
            <Text style={styles.statusKaartTekst}>
              We verdelen iedereen in groepen op basis van jullie voorkeuren. Rond 23:00 weten jullie of de match
              doorgaat.
            </Text>
          </View>
          <TimerKaart
            titel="Rond 23:00 definitief"
            subtitel="Daarna zie je hier met wie je gematched bent, of dat het vanavond helaas niet lukt."
            ms={msTot23}
          />
          {checkIn.status === 'matched' && matchIdVandaag ? (
            <Pressable
              style={styles.secundairKnop}
              onPress={() => router.push(`/match/${matchIdVandaag}`)}
            >
              <Text style={styles.secundairKnopTekst}>Open je match</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
            </Pressable>
          ) : null}
        </>
      );
    }

    return renderNa23Uitslag();
  }

  function renderNa23Uitslag() {
    if (uitslag.fase === 'laden') {
      return (
        <View style={styles.uitslagLaden}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.uitslagLadenTekst}>Uitslag laden…</Text>
        </View>
      );
    }

    if (uitslag.fase === 'bevestigd') {
      const namenTekst =
        uitslag.namen.length > 0
          ? uitslag.namen.join(', ')
          : 'Je groep';
      return (
        <View style={styles.uitslagCard}>
          <Ionicons name="heart-circle" size={44} color={COLORS.primary} />
          <Text style={styles.uitslagTitel}>Je matched voor vanavond</Text>
          <Text style={styles.uitslagTekst}>
            {uitslag.namen.length > 0
              ? `Samen met: ${namenTekst}.`
              : 'Je match staat klaar.'}
          </Text>
          <Pressable
            style={styles.primairKnop}
            onPress={() => router.push(`/match/${uitslag.matchId}`)}
          >
            <Text style={styles.primairKnopTekst}>Open match</Text>
          </Pressable>
        </View>
      );
    }

    if (uitslag.fase === 'reageer_nog') {
      return (
        <View style={styles.uitslagCard}>
          <Ionicons name="hourglass-outline" size={44} color={COLORS.primary} />
          <Text style={styles.uitslagTitel}>Reageer op je uitnodiging</Text>
          <Text style={styles.uitslagTekst}>
            De planning is nog niet afgerond. Open je match en geef aan of je meegaat.
          </Text>
          <Pressable
            style={styles.primairKnop}
            onPress={() => router.push(`/match/${uitslag.matchId}`)}
          >
            <Text style={styles.primairKnopTekst}>Naar match</Text>
          </Pressable>
        </View>
      );
    }

    if (uitslag.fase === 'afgezegd') {
      return (
        <View style={styles.uitslagCard}>
          <Ionicons name="sad-outline" size={44} color={COLORS.textLight} />
          <Text style={styles.uitslagTitel}>Geen groep vanavond</Text>
          <Text style={styles.uitslagTekst}>
            Er waren te weinig mensen die meededen of konden bevestigen. Geen zorgen: morgen om 08:00 kun je
            opnieuw inchecken voor de volgende avond.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.uitslagCard}>
        <Ionicons name="person-outline" size={44} color={COLORS.textLight} />
        <Text style={styles.uitslagTitel}>We konden je niet matchen</Text>
        <Text style={styles.uitslagTekst}>
          Er waren onvoldoende mensen om een groep te vormen, of het kwam niet uit met anderen. Probeer het morgen
          om 08:00 opnieuw als je weer uit wilt.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { paddingTop: top }]}
      contentContainerStyle={[styles.scrollInhoud, { paddingBottom: bottom + 80 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inhoud}>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : ingechecktActiefOfGematched ? (
          <View style={styles.bevestiging}>
            <View style={styles.pulseWrapper}>
              <PulseRing actief={faseAvond !== 'na_23'} />
              <View style={styles.vinkjeCircle}>
                <Ionicons name="checkmark" size={28} color="#fff" />
              </View>
            </View>

            <View style={styles.bevestigingTeksten}>
              <Text style={styles.bevestigingTitel}>
                Je bent ingecheckt{stad ? ` in ${stad}` : ''}!
              </Text>
              <Text style={styles.bevestigingSubtitel}>
                {faseAvond === 'voor_22'
                  ? 'We laten je weten wanneer we mensen hebben gevonden die bij je passen.'
                  : faseAvond === 'tussen_22_23'
                    ? 'Even geduld — we stellen de groepen samen.'
                    : 'Hieronder zie je hoe het vanavond verder gaat.'}
              </Text>
            </View>

            <View style={styles.tellerBlok}>
              <Text style={styles.teller}>{count}</Text>
              <Text style={styles.tellerLabel}>
                {count === 1 ? 'persoon gaat vanavond uit' : 'mensen gaan vanavond uit'}
                {stad ? ` in ${stad}` : ''}
              </Text>
            </View>

            {renderIncheckBlok()}
          </View>
        ) : checkInVensterStatus() !== 'open' ? (
          <View style={styles.voor}>
            <Text style={styles.koptekst}>Vanavond in Groningen</Text>

            <View style={styles.tellerBlok}>
              <Text style={styles.teller}>{count}</Text>
              <Text style={styles.tellerLabel}>
                {count === 1 ? 'persoon gaat vanavond uit' : 'mensen gaan vanavond uit'}
              </Text>
            </View>

            <View style={styles.geslotenCard}>
              <Ionicons name="time-outline" size={40} color={COLORS.primary} style={{ marginBottom: 8 }} />
              <Text style={styles.geslotenTitel}>{geslotenBericht.titel}</Text>
              <Text style={styles.geslotenUitleg}>{geslotenBericht.uitleg}</Text>
            </View>
          </View>
        ) : (
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
    </ScrollView>
  );
}

const ORANJE = COLORS.primary;

const styles = StyleSheet.create({
  scroll:      { flex: 1, backgroundColor: COLORS.background },
  scrollInhoud: { flexGrow: 1 },
  container:  { flex: 1, backgroundColor: COLORS.background },
  inhoud:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  voor:           { width: '100%', alignItems: 'center', gap: 36 },
  koptekst:       { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  tellerBlok:     { alignItems: 'center', gap: 8 },
  teller:         { fontSize: 88, fontWeight: '800', color: ORANJE, lineHeight: 96 },
  tellerLabel:    { fontSize: 16, color: COLORS.textLight, textAlign: 'center' },
  incheckenKnop:  { width: '100%', paddingVertical: 18, borderRadius: 16, backgroundColor: ORANJE, alignItems: 'center' },
  knopDisabled:   { opacity: 0.6 },
  incheckenTekst: { fontSize: 17, fontWeight: '700', color: '#fff' },

  geslotenCard:   {
    width: '100%',
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#FFF5EF',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.25)',
    alignItems: 'center',
    gap: 10,
  },
  geslotenTitel:  { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  geslotenUitleg: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 22 },

  bevestiging:       { width: '100%', alignItems: 'center', gap: 24 },
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

  timerKaart: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFF8F4',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    alignItems: 'center',
    gap: 6,
  },
  timerTitel:   { fontSize: 15, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  timerGroot:   { fontSize: 40, fontWeight: '800', color: ORANJE },
  timerSub:     { fontSize: 13, color: COLORS.textLight, textAlign: 'center', lineHeight: 18 },

  statusKaart: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFF8F4',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    alignItems: 'center',
    gap: 10,
  },
  statusKaartTitel: { fontSize: 17, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  statusKaartTekst: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },

  secundairKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  secundairKnopTekst: { fontSize: 16, fontWeight: '600', color: COLORS.primary },

  uitslagLaden: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  uitslagLadenTekst: { fontSize: 14, color: COLORS.textLight },

  uitslagCard: {
    width: '100%',
    padding: 22,
    borderRadius: 16,
    backgroundColor: '#FFF8F4',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    alignItems: 'center',
    gap: 14,
  },
  uitslagTitel: { fontSize: 19, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  uitslagTekst: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 22 },

  primairKnop: {
    marginTop: 4,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: ORANJE,
    alignItems: 'center',
  },
  primairKnopTekst: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
