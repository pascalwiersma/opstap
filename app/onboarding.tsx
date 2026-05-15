import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GeboortedatumKiezer } from '../components/GeboortedatumKiezer';
import { COLORS } from '../constants/colors';
import { ALLE_INTERESSES } from './interesses-bewerken';
import { useIdentityVerification } from '../hooks/useIdentityVerification';
import { supabase } from '../services/supabase';
import {
  defaultGeboorteDatum,
  formatGeboorteDb,
  grenzenGeboortedatum,
  validatieGeboortedatum,
} from '../utils/geboorte';

const MIN_INTERESSES = 2;
const MAX_INTERESSES = 10;

function isGeldigEmail(s: string): boolean {
  const t = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

type GebruikersnaamStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function valideerGebruikersnaamFormaat(u: string): boolean {
  return /^[a-zA-Z0-9_]{3,}$/.test(u);
}

export default function OnboardingScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { startIdentiteitsVerificatie, bezig: verificatieBezig } = useIdentityVerification();
  const [authCheck, setAuthCheck] = useState(true);
  const [stap, setStap] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [naam, setNaam] = useState('');
  const [gebruikersnaam, setGebruikersnaam] = useState('');
  const [gebruikersnaamStatus, setGebruikersnaamStatus] = useState<GebruikersnaamStatus>('idle');
  const gebruikersnaamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [email, setEmail] = useState('');
  const [geboorteDatum, setGeboorteDatum] = useState(defaultGeboorteDatum);
  const [geboorteDoorUserGewijzigd, setGeboorteDoorUserGewijzigd] = useState(false);
  const [interesses, setInteresses] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const grenzen = useMemo(() => grenzenGeboortedatum(), []);
  const geboorteCheck = useMemo(() => validatieGeboortedatum(geboorteDatum), [geboorteDatum]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/(auth)/register');
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', session.user.id)
        .single();
      if (data?.onboarding_completed_at) {
        router.replace('/(tabs)/kaart');
        return;
      }
      setAuthCheck(false);
    })();
  }, []);

  function toggleInteresse(interesse: string) {
    setInteresses((prev) => {
      const nieuw = new Set(prev);
      if (nieuw.has(interesse)) {
        nieuw.delete(interesse);
      } else {
        if (nieuw.size >= MAX_INTERESSES) return prev;
        nieuw.add(interesse);
      }
      return nieuw;
    });
    if (fout) setFout(null);
  }

  function handleGebruikersnaamChange(waarde: string) {
    const gefilterd = waarde.replace(/[^a-zA-Z0-9_]/g, '');
    setGebruikersnaam(gefilterd);
    setFout(null);

    if (gebruikersnaamTimerRef.current) clearTimeout(gebruikersnaamTimerRef.current);

    if (!valideerGebruikersnaamFormaat(gefilterd)) {
      setGebruikersnaamStatus(gefilterd.length === 0 ? 'idle' : 'invalid');
      return;
    }

    setGebruikersnaamStatus('checking');
    gebruikersnaamTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', gefilterd.toLowerCase())
        .maybeSingle();
      setGebruikersnaamStatus(data ? 'taken' : 'available');
    }, 500);
  }

  function volgendeVanStap1() {
    if (!naam.trim() || naam.trim().length < 2) {
      setFout('Vul minimaal 2 letters voor je naam in.');
      return;
    }
    setFout(null);
    setStap(2);
  }

  function volgendeVanStap2() {
    if (!valideerGebruikersnaamFormaat(gebruikersnaam)) {
      setFout('Minimaal 3 tekens, alleen letters, cijfers en _.');
      return;
    }
    if (gebruikersnaamStatus === 'taken') {
      setFout('Deze gebruikersnaam is al bezet.');
      return;
    }
    if (gebruikersnaamStatus !== 'available') {
      setFout('Wacht even tot de beschikbaarheid is gecheckt.');
      return;
    }
    setFout(null);
    setStap(3);
  }

  function volgendeVanStap3() {
    if (!isGeldigEmail(email)) {
      setFout('Vul een geldig e-mailadres in.');
      return;
    }
    setFout(null);
    setGeboorteDoorUserGewijzigd(false);
    setStap(4);
  }

  function volgendeVanStap4() {
    const val = validatieGeboortedatum(geboorteDatum);
    if (!val.ok) {
      setFout(val.message);
      return;
    }
    setFout(null);
    setStap(5);
  }

  function volgendeVanStap5() {
    if (interesses.size < MIN_INTERESSES) {
      setFout(`Kies minimaal ${MIN_INTERESSES} interesses.`);
      return;
    }
    setFout(null);
    setStap(6);
  }

  async function slaProfielOp(userId: string): Promise<boolean> {
    const val = validatieGeboortedatum(geboorteDatum);
    const [profielRes, interesseRes] = await Promise.all([
      supabase
        .from('profiles')
        .update({
          name: naam.trim(),
          username: gebruikersnaam.toLowerCase(),
          email: email.trim().toLowerCase(),
          birth_date: formatGeboorteDb(geboorteDatum),
          age: val.age,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', userId),
      supabase
        .from('user_interests')
        .insert([...interesses].map((interesse) => ({ user_id: userId, interest: interesse }))),
    ]);
    if (profielRes.error) { setFout(profielRes.error.message || 'Opslaan mislukt.'); return false; }
    if (interesseRes.error) { setFout('Interesses opslaan mislukt.'); return false; }
    return true;
  }

  async function verifieerEnAfronden() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/(auth)/register'); return; }

    setBezig(true);
    setFout(null);

    const opgeslagen = await slaProfielOp(user.id);
    if (!opgeslagen) { setBezig(false); return; }

    setBezig(false);

    const result = await startIdentiteitsVerificatie();

    switch (result.type) {
      case 'approved':
        router.replace('/(tabs)/kaart');
        break;
      case 'pending':
        router.replace('/(tabs)/kaart');
        break;
      case 'declined':
        setFout('Je identiteit kon niet worden geverifieerd. Probeer het opnieuw.');
        break;
      case 'cancelled':
        setFout('Verificatie is verplicht om OpStap te gebruiken.');
        break;
      case 'error':
        setFout(result.melding);
        break;
    }
  }

  if (authCheck) {
    return (
      <View style={[styles.flex, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const titels: Record<number, string> = {
    1: 'Hoe mogen we je noemen?',
    2: 'Kies een gebruikersnaam',
    3: 'Je e-mailadres',
    4: 'Je geboortedatum',
    5: 'Wat vind jij leuk?',
    6: 'Verifieer je identiteit',
  };
  const subtitels: Record<number, string> = {
    1: 'Zo zien andere gebruikers je in de app.',
    2: 'Anderen kunnen je hiermee vinden. Minimaal 3 tekens, alleen letters, cijfers en _.',
    3: 'We gebruiken je e-mailadres alleen voor belangrijke updates en om je account veilig te houden.',
    4: 'Zo weten we je leeftijd en kunnen we passende plekken voorstellen.',
    5: `Kies minimaal ${MIN_INTERESSES} interesses. We gebruiken dit om je te matchen met anderen.`,
    6: 'OpStap vereist een identiteitsverificatie zodat iedereen veilig de app kan gebruiken. Dit duurt ongeveer 2 minuten.',
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.blob, styles.blobOranje]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobPaars]} pointerEvents="none" />

      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingTop: top + 20, paddingBottom: bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stappen}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <View
                key={n}
                style={[styles.stapBol, stap === n && styles.stapBolActief, stap > n && styles.stapBolKlaar]}
              />
            ))}
          </View>

          <Text style={styles.titel}>{titels[stap]}</Text>
          <Text style={styles.subtitel}>{subtitels[stap]}</Text>

          {stap === 1 && (
            <TextInput
              style={styles.input}
              value={naam}
              onChangeText={(t) => { setNaam(t); if (fout) setFout(null); }}
              placeholder="Wat is je naam?"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={volgendeVanStap1}
            />
          )}

          {stap === 2 && (
            <View style={styles.gebruikersnaamBlok}>
              <View style={styles.gebruikersnaamRij}>
                <Text style={styles.atTeken}>@</Text>
                <TextInput
                  style={styles.gebruikersnaamInput}
                  value={gebruikersnaam}
                  onChangeText={handleGebruikersnaamChange}
                  placeholder="jouwNaam_123"
                  placeholderTextColor={COLORS.textLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={volgendeVanStap2}
                />
                {gebruikersnaamStatus === 'checking' && (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                )}
                {gebruikersnaamStatus === 'available' && (
                  <Ionicons name="checkmark-circle" size={22} color="#38A169" />
                )}
                {(gebruikersnaamStatus === 'taken' || gebruikersnaamStatus === 'invalid') && (
                  <Ionicons name="close-circle" size={22} color="#E53E3E" />
                )}
              </View>
              {gebruikersnaamStatus === 'taken' && (
                <Text style={styles.gebruikersnaamHint}>Deze gebruikersnaam is al bezet.</Text>
              )}
              {gebruikersnaamStatus === 'invalid' && gebruikersnaam.length > 0 && (
                <Text style={styles.gebruikersnaamHint}>Minimaal 3 tekens, alleen letters, cijfers en _.</Text>
              )}
              {gebruikersnaamStatus === 'available' && (
                <Text style={[styles.gebruikersnaamHint, { color: '#38A169' }]}>Beschikbaar!</Text>
              )}
            </View>
          )}

          {stap === 3 && (
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => { setEmail(t); if (fout) setFout(null); }}
              placeholder="naam@mijnemail.nl"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={volgendeVanStap3}
            />
          )}

          {stap === 4 && (
            <View style={styles.datumBlok}>
              <GeboortedatumKiezer
                value={geboorteDatum}
                minimumDate={grenzen.min}
                maximumDate={grenzen.max}
                onChange={(d) => {
                  setGeboorteDatum(d);
                  setGeboorteDoorUserGewijzigd(true);
                  if (fout) setFout(null);
                }}
                onBevestigd={() => setGeboorteDoorUserGewijzigd(true)}
              />
              {!geboorteCheck.ok ? (
                <Text style={styles.leeftijdFout}>{geboorteCheck.message}</Text>
              ) : geboorteDoorUserGewijzigd ? (
                <Text style={styles.leeftijdHint}>Je bent {geboorteCheck.age} jaar.</Text>
              ) : (
                <Text style={styles.leeftijdNeutraal}>
                  Kies je geboortedatum — je leeftijd bepalen we automatisch.
                </Text>
              )}
            </View>
          )}

          {stap === 5 && (
            <View style={styles.interesseBlok}>
              <Text style={styles.interesseTeller}>
                {interesses.size} / {MAX_INTERESSES} geselecteerd
              </Text>
              <View style={styles.grid}>
                {ALLE_INTERESSES.map((interesse) => {
                  const actief = interesses.has(interesse);
                  const geblokkeerd = !actief && interesses.size >= MAX_INTERESSES;
                  return (
                    <Pressable
                      key={interesse}
                      style={[
                        styles.tag,
                        actief ? styles.tagActief : styles.tagInactief,
                        geblokkeerd && styles.tagGeblokkeerd,
                      ]}
                      onPress={() => toggleInteresse(interesse)}
                    >
                      {actief && (
                        <Ionicons name="checkmark" size={13} color="#fff" style={styles.vinkje} />
                      )}
                      <Text style={[styles.tagTekst, actief ? styles.tagTekstActief : styles.tagTekstInactief]}>
                        {interesse}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {fout && (
            <View style={styles.foutBalk}>
              <Ionicons name="alert-circle" size={18} color="#C53030" />
              <Text style={styles.foutTekst}>{fout}</Text>
            </View>
          )}

          {stap === 1 && (
            <Pressable style={styles.primairKnop} onPress={volgendeVanStap1}>
              <Text style={styles.primairKnopTekst}>Volgende</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          )}

          {stap === 2 && (
            <View style={styles.knopRij}>
              <Pressable style={styles.secundairKnop} onPress={() => { setStap(1); setFout(null); }}>
                <Text style={styles.secundairTekst}>Terug</Text>
              </Pressable>
              <Pressable style={[styles.primairKnop, styles.primairKlein]} onPress={volgendeVanStap2}>
                <Text style={styles.primairKnopTekst}>Volgende</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </Pressable>
            </View>
          )}

          {stap === 3 && (
            <View style={styles.knopRij}>
              <Pressable style={styles.secundairKnop} onPress={() => { setStap(2); setFout(null); }}>
                <Text style={styles.secundairTekst}>Terug</Text>
              </Pressable>
              <Pressable style={[styles.primairKnop, styles.primairKlein]} onPress={volgendeVanStap3}>
                <Text style={styles.primairKnopTekst}>Volgende</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </Pressable>
            </View>
          )}

          {stap === 4 && (
            <View style={styles.knopRij}>
              <Pressable style={styles.secundairKnop} onPress={() => { setStap(3); setFout(null); }}>
                <Text style={styles.secundairTekst}>Terug</Text>
              </Pressable>
              <Pressable
                style={[styles.primairKnop, styles.primairKlein, !geboorteCheck.ok && styles.knopDisabled]}
                onPress={volgendeVanStap4}
                disabled={!geboorteCheck.ok}
              >
                <Text style={styles.primairKnopTekst}>Volgende</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </Pressable>
            </View>
          )}

          {stap === 5 && (
            <View style={styles.knopRij}>
              <Pressable style={styles.secundairKnop} onPress={() => { setStap(4); setFout(null); }}>
                <Text style={styles.secundairTekst}>Terug</Text>
              </Pressable>
              <Pressable
                style={[styles.primairKnop, styles.primairKlein, interesses.size < MIN_INTERESSES && styles.knopDisabled]}
                onPress={volgendeVanStap5}
                disabled={interesses.size < MIN_INTERESSES}
              >
                <Text style={styles.primairKnopTekst}>Volgende</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </Pressable>
            </View>
          )}

          {stap === 6 && (
            <View style={styles.knopRij}>
              <Pressable style={styles.secundairKnop} onPress={() => { setStap(5); setFout(null); }} disabled={bezig || verificatieBezig}>
                <Text style={styles.secundairTekst}>Terug</Text>
              </Pressable>
              <Pressable
                style={[styles.primairKnop, styles.primairKlein, (bezig || verificatieBezig) && styles.knopDisabled]}
                onPress={() => { void verifieerEnAfronden(); }}
                disabled={bezig || verificatieBezig}
              >
                {bezig || verificatieBezig ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primairKnopTekst}>Identiteit verifiëren</Text>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FAFAFA', overflow: 'hidden' },
  center: { justifyContent: 'center', alignItems: 'center' },
  keyboard: { flex: 1 },

  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 150 },
  blobOranje: { top: -100, right: -70, backgroundColor: COLORS.primary, opacity: 0.09 },
  blobPaars:  { bottom: '8%', left: -120, backgroundColor: COLORS.secondary, opacity: 0.07 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },

  stappen: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 28 },
  stapBol:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#D8D8D8' },
  stapBolActief: { width: 28, backgroundColor: COLORS.primary },
  stapBolKlaar:  { backgroundColor: COLORS.primary, opacity: 0.45 },

  titel:    { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' },
  subtitel: { fontSize: 15, color: COLORS.textLight, lineHeight: 22, marginBottom: 24, textAlign: 'center' },

  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ECECEC',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  datumBlok: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#ECECEC',
    paddingVertical: 4,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  leeftijdHint:    { textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.primary, paddingBottom: 8, paddingTop: 4 },
  leeftijdNeutraal: { textAlign: 'center', fontSize: 14, color: COLORS.textLight, paddingBottom: 8, paddingTop: 4, lineHeight: 20, paddingHorizontal: 8 },
  leeftijdFout:    { textAlign: 'center', fontSize: 14, color: COLORS.textLight, paddingBottom: 8, paddingHorizontal: 8 },

  gebruikersnaamBlok: { marginBottom: 16 },
  gebruikersnaamRij: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ECECEC',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  atTeken: { fontSize: 20, fontWeight: '700', color: COLORS.textLight },
  gebruikersnaamInput: { flex: 1, fontSize: 18, fontWeight: '600', color: COLORS.text },
  gebruikersnaamHint: { marginTop: 8, fontSize: 13, color: '#E53E3E', textAlign: 'center' },

  interesseBlok:   { marginBottom: 16, gap: 12 },
  interesseTeller: { fontSize: 13, fontWeight: '600', color: COLORS.secondary, textAlign: 'center' },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:             { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 22 },
  tagActief:       { backgroundColor: COLORS.primary },
  tagInactief:     { backgroundColor: '#fff' },
  tagGeblokkeerd:  { opacity: 0.35 },
  vinkje:          { marginRight: 4 },
  tagTekst:        { fontSize: 14, fontWeight: '600' },
  tagTekstActief:  { color: '#fff' },
  tagTekstInactief: { color: COLORS.text },

  foutBalk: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF5F5', borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#FED7D7',
  },
  foutTekst: { flex: 1, fontSize: 14, color: '#9B2C2C', lineHeight: 20 },

  primairKnop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 17,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  primairKlein:    { flex: 1 },
  primairKnopTekst: { fontSize: 17, fontWeight: '800', color: '#fff' },
  knopDisabled:    { opacity: 0.75 },

  knopRij: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  secundairKnop: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: 17, borderRadius: 18, borderWidth: 2, borderColor: '#E0E0E0', backgroundColor: '#fff',
  },
  secundairTekst: { fontSize: 16, fontWeight: '700', color: COLORS.text },
});
