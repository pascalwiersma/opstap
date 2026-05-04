import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { supabase } from '../services/supabase';
import {
  defaultGeboorteDatum,
  formatGeboorteDb,
  grenzenGeboortedatum,
  validatieGeboortedatum,
} from '../utils/geboorte';

function isGeldigEmail(s: string): boolean {
  const t = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export default function OnboardingScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [authCheck, setAuthCheck] = useState(true);
  const [stap, setStap] = useState<1 | 2 | 3>(1);
  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [geboorteDatum, setGeboorteDatum] = useState(defaultGeboorteDatum);
  const [geboorteDoorUserGewijzigd, setGeboorteDoorUserGewijzigd] = useState(false);
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

  function volgendeVanStap1() {
    if (!naam.trim() || naam.trim().length < 2) {
      setFout('Vul minimaal 2 letters voor je naam in.');
      return;
    }
    setFout(null);
    setStap(2);
  }

  function volgendeVanStap2() {
    if (!isGeldigEmail(email)) {
      setFout('Vul een geldig e-mailadres in.');
      return;
    }
    setFout(null);
    setGeboorteDoorUserGewijzigd(false);
    setStap(3);
  }

  async function afronden() {
    const val = validatieGeboortedatum(geboorteDatum);
    if (!val.ok) {
      setFout(val.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/(auth)/register');
      return;
    }

    setBezig(true);
    setFout(null);

    const { error } = await supabase
      .from('profiles')
      .update({
        name: naam.trim(),
        email: email.trim().toLowerCase(),
        birth_date: formatGeboorteDb(geboorteDatum),
        age: val.age,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setBezig(false);

    if (error) {
      setFout(error.message || 'Opslaan mislukt. Probeer opnieuw.');
      return;
    }

    router.replace('/(tabs)/kaart');
  }

  if (authCheck) {
    return (
      <View style={[styles.flex, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const titel =
    stap === 1 ? 'Hoe mogen we je noemen?' : stap === 2 ? 'Je e-mailadres' : 'Je geboortedatum';

  const subtitel =
    stap === 1
      ? 'Zo zien andere gebruikers je in de app.'
      : stap === 2
        ? 'We gebruiken je e-mailadres alleen voor belangrijke updates en om je account veilig te houden.'
        : 'Zo weten we je leeftijd en kunnen we passende plekken voorstellen.';

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
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[styles.stapBol, stap === n && styles.stapBolActief, stap > n && styles.stapBolKlaar]}
              />
            ))}
          </View>

          <Text style={styles.titel}>{titel}</Text>
          <Text style={styles.subtitel}>{subtitel}</Text>

          {stap === 1 ? (
            <TextInput
              style={styles.input}
              value={naam}
              onChangeText={(t) => {
                setNaam(t);
                if (fout) setFout(null);
              }}
              placeholder="Wat is je naam?"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={volgendeVanStap1}
            />
          ) : null}

          {stap === 2 ? (
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (fout) setFout(null);
              }}
              placeholder="naam@mijnemail.nl"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={volgendeVanStap2}
            />
          ) : null}

          {stap === 3 ? (
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
          ) : null}

          {fout ? (
            <View style={styles.foutBalk}>
              <Ionicons name="alert-circle" size={18} color="#C53030" />
              <Text style={styles.foutTekst}>{fout}</Text>
            </View>
          ) : null}

          {stap === 1 ? (
            <Pressable style={styles.primairKnop} onPress={volgendeVanStap1}>
              <Text style={styles.primairKnopTekst}>Volgende</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          ) : null}

          {stap === 2 ? (
            <View style={styles.knopRij}>
              <Pressable style={styles.secundairKnop} onPress={() => { setStap(1); setFout(null); }}>
                <Text style={styles.secundairTekst}>Terug</Text>
              </Pressable>
              <Pressable style={[styles.primairKnop, styles.primairKlein]} onPress={volgendeVanStap2}>
                <Text style={styles.primairKnopTekst}>Volgende</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </Pressable>
            </View>
          ) : null}

          {stap === 3 ? (
            <View style={styles.knopRij}>
              <Pressable style={styles.secundairKnop} onPress={() => { setStap(2); setFout(null); }} disabled={bezig}>
                <Text style={styles.secundairTekst}>Terug</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primairKnop,
                  styles.primairKlein,
                  (bezig || !geboorteCheck.ok) && styles.knopDisabled,
                ]}
                onPress={() => { void afronden(); }}
                disabled={bezig || !geboorteCheck.ok}
              >
                {bezig ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primairKnopTekst}>Start met OpStap</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FAFAFA', overflow: 'hidden' },
  center: { justifyContent: 'center', alignItems: 'center' },
  keyboard: { flex: 1 },

  blob: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  blobOranje: {
    top: -100,
    right: -70,
    backgroundColor: COLORS.primary,
    opacity: 0.09,
  },
  blobPaars: {
    bottom: '8%',
    left: -120,
    backgroundColor: COLORS.secondary,
    opacity: 0.07,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },

  stappen: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 28 },
  stapBol: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D8D8D8',
  },
  stapBolActief: {
    width: 28,
    backgroundColor: COLORS.primary,
  },
  stapBolKlaar: {
    backgroundColor: COLORS.primary,
    opacity: 0.45,
  },

  titel: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitel: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },

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

  leeftijdHint: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    paddingBottom: 8,
    paddingTop: 4,
  },
  leeftijdNeutraal: {
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.textLight,
    paddingBottom: 8,
    paddingTop: 4,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  leeftijdFout: {
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.textLight,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },

  foutBalk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF5F5',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  foutTekst: { flex: 1, fontSize: 14, color: '#9B2C2C', lineHeight: 20 },

  primairKnop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 17,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  primairKlein: { flex: 1 },
  primairKnopTekst: { fontSize: 17, fontWeight: '800', color: '#fff' },
  knopDisabled: { opacity: 0.75 },

  knopRij: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  secundairKnop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 17,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  secundairTekst: { fontSize: 16, fontWeight: '700', color: COLORS.text },
});
