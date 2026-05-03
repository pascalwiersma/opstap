import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GeboortedatumKiezer } from '../components/GeboortedatumKiezer';
import { supabase } from '../services/supabase';
import { COLORS } from '../constants/colors';
import {
  defaultGeboorteDatum,
  formatGeboorteDb,
  grenzenGeboortedatum,
  leeftijdUitGeboortedatum,
  parseGeboorteDb,
  validatieGeboortedatum,
} from '../utils/geboorte';

export default function ProfielBewerkScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [geboorteDatum, setGeboorteDatum] = useState(defaultGeboorteDatum);
  const [bio, setBio] = useState('');
  const [bezig, setBezig] = useState(false);

  const grenzen = useMemo(() => grenzenGeboortedatum(), []);
  const geboorteCheck = useMemo(() => validatieGeboortedatum(geboorteDatum), [geboorteDatum]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('name, age, bio, email, birth_date')
        .eq('id', user.id)
        .single();
      if (data) {
        setNaam(data.name ?? '');
        setEmail(data.email ?? '');
        setBio(data.bio ?? '');
        const parsed = parseGeboorteDb(data.birth_date);
        if (parsed) setGeboorteDatum(parsed);
        else if (typeof data.age === 'number' && data.age > 0) {
          const d = new Date();
          d.setFullYear(d.getFullYear() - data.age);
          setGeboorteDatum(d);
        }
      }
    })();
  }, []);

  async function opslaan() {
    if (!naam.trim()) {
      Alert.alert('Naam vereist', 'Voer een naam in om op te slaan.');
      return;
    }
    if (!geboorteCheck.ok) {
      Alert.alert('Geboortedatum', geboorteCheck.message);
      return;
    }

    setBezig(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBezig(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        name: naam.trim(),
        email: email.trim() ? email.trim().toLowerCase() : null,
        birth_date: formatGeboorteDb(geboorteDatum),
        age: geboorteCheck.age,
        bio: bio.trim() || null,
      })
      .eq('id', user.id);

    setBezig(false);
    if (error) {
      Alert.alert('Fout', 'Kon profiel niet opslaan. Probeer opnieuw.');
    } else {
      router.back();
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: top + 8, paddingBottom: bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.terugKnop}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            <Text style={styles.terugTekst}>Profiel</Text>
          </Pressable>
          <Text style={styles.titel}>Bewerken</Text>
          <View style={{ width: 80 }} />
        </View>

        <View style={styles.sectie}>
          <View style={styles.veld}>
            <Text style={styles.veldLabel}>Naam</Text>
            <TextInput
              style={styles.input}
              value={naam}
              onChangeText={setNaam}
              placeholder="Jouw naam"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.veld}>
            <Text style={styles.veldLabel}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="naam@voorbeeld.nl"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
            />
          </View>

          <View style={styles.veld}>
            <Text style={styles.veldLabel}>Geboortedatum</Text>
            <Text style={styles.veldSub}>Leeftijd: {leeftijdUitGeboortedatum(geboorteDatum)} jaar</Text>
            <GeboortedatumKiezer
              value={geboorteDatum}
              minimumDate={grenzen.min}
              maximumDate={grenzen.max}
              onChange={setGeboorteDatum}
            />
            {!geboorteCheck.ok ? (
              <Text style={styles.veldFout}>{geboorteCheck.message}</Text>
            ) : null}
          </View>

          <View style={styles.veld}>
            <Text style={styles.veldLabel}>Over mij</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Schrijf iets over jezelf…"
              placeholderTextColor={COLORS.textLight}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={[styles.opslaanKnop, (bezig || !geboorteCheck.ok) && styles.knopDisabled]}
            onPress={opslaan}
            disabled={bezig || !geboorteCheck.ok}
          >
            <Text style={styles.opslaanTekst}>{bezig ? 'Opslaan…' : 'Opslaan'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  terugKnop:  { flexDirection: 'row', alignItems: 'center', gap: 2, width: 80 },
  terugTekst: { fontSize: 17, color: COLORS.text },
  titel:      { fontSize: 17, fontWeight: '600', color: COLORS.text },

  sectie: { paddingHorizontal: 16, gap: 12 },

  veld: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  veldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  veldSub: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 4 },
  veldFout: { fontSize: 13, color: '#C53030', marginTop: 4 },
  input:    { fontSize: 16, color: COLORS.text, padding: 0 },
  textarea: { height: 100 },

  opslaanKnop: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  knopDisabled: { opacity: 0.6 },
  opslaanTekst: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
