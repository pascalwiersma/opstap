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

const PAARS = COLORS.secondary;

export default function ProfielNaamBewerkScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [geboorteDatum, setGeboorteDatum] = useState(defaultGeboorteDatum);
  const [bezig, setBezig] = useState(false);

  const grenzen = useMemo(() => grenzenGeboortedatum(), []);
  const geboorteCheck = useMemo(() => validatieGeboortedatum(geboorteDatum), [geboorteDatum]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('name, email, birth_date, age')
        .eq('id', session.user.id)
        .single();
      if (data) {
        setNaam(data.name ?? '');
        setEmail(data.email ?? '');
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
    if (!user) { setBezig(false); return; }
    const { error } = await supabase
      .from('profiles')
      .update({
        name: naam.trim(),
        email: email.trim() ? email.trim().toLowerCase() : null,
        birth_date: formatGeboorteDb(geboorteDatum),
        age: geboorteCheck.age,
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.wrapper, { paddingTop: top }]}
        contentContainerStyle={{ paddingBottom: bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.terugKnop} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={PAARS} />
          </Pressable>
          <Text style={styles.titel}>Naam en leeftijd</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.sectie}>
          <View style={styles.veld}>
            <Text style={styles.label}>Naam</Text>
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
            <Text style={styles.label}>E-mail</Text>
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
            <Text style={styles.label}>Geboortedatum</Text>
            <Text style={styles.leeftijd}>Leeftijd: {leeftijdUitGeboortedatum(geboorteDatum)} jaar</Text>
            <GeboortedatumKiezer
              value={geboorteDatum}
              minimumDate={grenzen.min}
              maximumDate={grenzen.max}
              onChange={setGeboorteDatum}
            />
            {!geboorteCheck.ok && <Text style={styles.fout}>{geboorteCheck.message}</Text>}
          </View>

          <Pressable
            style={[styles.opslaanKnop, (bezig || !geboorteCheck.ok) && styles.disabled]}
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
  wrapper:     { flex: 1, backgroundColor: '#F2F2F7' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  terugKnop:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  titel:       { fontSize: 17, fontWeight: '700', color: COLORS.text },
  sectie:      { paddingHorizontal: 16, gap: 12 },
  veld:        { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 6 },
  label:       { fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.6 },
  leeftijd:    { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 4 },
  fout:        { fontSize: 13, color: '#C53030', marginTop: 4 },
  input:       { fontSize: 16, color: COLORS.text, padding: 0 },
  opslaanKnop: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  disabled:    { opacity: 0.6 },
  opslaanTekst: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
