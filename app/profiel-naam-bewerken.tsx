import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { GeboortedatumKiezer } from '../components/GeboortedatumKiezer';
import { COLORS } from '../constants/colors';
import { supabase } from '../services/supabase';
import {
  defaultGeboorteDatum,
  formatGeboorteDb,
  grenzenGeboortedatum,
  leeftijdUitGeboortedatum,
  parseGeboorteDb,
  validatieGeboortedatum,
} from '../utils/geboorte';

const PAARS = COLORS.secondary;

type GebruikersnaamStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function valideerGebruikersnaamFormaat(u: string): boolean {
  return /^[a-zA-Z0-9_]{3,}$/.test(u);
}

function dagenTotWijzigen(changedAt: string): number {
  const volgende = new Date(changedAt);
  volgende.setMonth(volgende.getMonth() + 1);
  return Math.ceil((volgende.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function ProfielNaamBewerkScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [naam, setNaam] = useState('');
  const [email, setEmail] = useState('');
  const [geboorteDatum, setGeboorteDatum] = useState(defaultGeboorteDatum);
  const [geboorteDatumVergrendeld, setGeboorteDatumVergrendeld] = useState(false);
  const [gebruikersnaam, setGebruikersnaam] = useState('');
  const [origGebruikersnaam, setOrigGebruikersnaam] = useState('');
  const [gebruikersnaamChangedAt, setGebruikersnaamChangedAt] = useState<string | null>(null);
  const [gebruikersnaamStatus, setGebruikersnaamStatus] = useState<GebruikersnaamStatus>('idle');
  const gebruikersnaamTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bezig, setBezig] = useState(false);

  const grenzen = useMemo(() => grenzenGeboortedatum(), []);
  const geboorteCheck = useMemo(() => validatieGeboortedatum(geboorteDatum), [geboorteDatum]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('name, email, birth_date, age, username, username_changed_at')
        .eq('id', session.user.id)
        .single();
      if (data) {
        setNaam(data.name ?? '');
        setEmail(data.email ?? '');
        setGebruikersnaam(data.username ?? '');
        setOrigGebruikersnaam(data.username ?? '');
        setGebruikersnaamChangedAt(data.username_changed_at ?? null);
        const parsed = parseGeboorteDb(data.birth_date);
        if (parsed) {
          setGeboorteDatum(parsed);
          setGeboorteDatumVergrendeld(true);
        } else if (typeof data.age === 'number' && data.age > 0) {
          const d = new Date();
          d.setFullYear(d.getFullYear() - data.age);
          setGeboorteDatum(d);
        }
      }
    })();
  }, []);

  function handleGebruikersnaamChange(waarde: string) {
    const gefilterd = waarde.replace(/[^a-zA-Z0-9_]/g, '');
    setGebruikersnaam(gefilterd);
    if (gebruikersnaamTimer.current) clearTimeout(gebruikersnaamTimer.current);
    if (gefilterd.toLowerCase() === origGebruikersnaam.toLowerCase()) {
      setGebruikersnaamStatus('idle');
      return;
    }
    if (!valideerGebruikersnaamFormaat(gefilterd)) {
      setGebruikersnaamStatus(gefilterd.length === 0 ? 'idle' : 'invalid');
      return;
    }
    setGebruikersnaamStatus('checking');
    gebruikersnaamTimer.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', gefilterd.toLowerCase()).maybeSingle();
      setGebruikersnaamStatus(data ? 'taken' : 'available');
    }, 500);
  }

  async function opslaan() {
    if (!naam.trim()) {
      Alert.alert('Naam vereist', 'Voer een naam in om op te slaan.');
      return;
    }
    if (!geboorteDatumVergrendeld && !geboorteCheck.ok) {
      Alert.alert('Geboortedatum', geboorteCheck.message);
      return;
    }
    setBezig(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBezig(false); return; }
    const gebruikersnaamGewijzigd = gebruikersnaam.toLowerCase() !== origGebruikersnaam.toLowerCase();
    if (gebruikersnaamGewijzigd && gebruikersnaamStatus !== 'available') {
      Alert.alert('Gebruikersnaam', gebruikersnaamStatus === 'taken' ? 'Deze gebruikersnaam is al bezet.' : 'Kies een geldige gebruikersnaam.');
      setBezig(false);
      return;
    }

    const update: Record<string, unknown> = {
      name: naam.trim(),
      email: email.trim() ? email.trim().toLowerCase() : null,
    };
    if (!geboorteDatumVergrendeld) {
      update.birth_date = formatGeboorteDb(geboorteDatum);
      update.age = geboorteCheck.age;
    }
    if (gebruikersnaamGewijzigd) {
      update.username = gebruikersnaam.toLowerCase();
      update.username_changed_at = new Date().toISOString();
    }
    const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
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
          <Text style={styles.titel}>Persoonlijke gegevens</Text>
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
            <Text style={styles.label}>Gebruikersnaam</Text>
            {(() => {
              const dagenOver = gebruikersnaamChangedAt ? dagenTotWijzigen(gebruikersnaamChangedAt) : 0;
              if (dagenOver > 0) {
                return (
                  <>
                    <Text style={styles.input}>@{origGebruikersnaam}</Text>
                    <Text style={styles.vergrendeldTekst}>
                      Nog {dagenOver} {dagenOver === 1 ? 'dag' : 'dagen'} voor je dit weer kunt wijzigen.
                    </Text>
                  </>
                );
              }
              return (
                <View style={styles.gebruikersnaamRij}>
                  <Text style={styles.atTeken}>@</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={gebruikersnaam}
                    onChangeText={handleGebruikersnaamChange}
                    placeholder="gebruikersnaam"
                    placeholderTextColor={COLORS.textLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {gebruikersnaamStatus === 'checking' && <ActivityIndicator size="small" color={COLORS.primary} />}
                  {gebruikersnaamStatus === 'available' && <Ionicons name="checkmark-circle" size={20} color="#38A169" />}
                  {(gebruikersnaamStatus === 'taken' || gebruikersnaamStatus === 'invalid') && <Ionicons name="close-circle" size={20} color="#E53E3E" />}
                </View>
              );
            })()}
            {gebruikersnaamStatus === 'taken' && <Text style={styles.veldFout}>Al bezet.</Text>}
            {gebruikersnaamStatus === 'invalid' && gebruikersnaam.length > 0 && <Text style={styles.veldFout}>Min. 3 tekens, alleen letters, cijfers en _.</Text>}
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
            {geboorteDatumVergrendeld ? (
              <>
                <Text style={styles.leeftijd}>{leeftijdUitGeboortedatum(geboorteDatum)} jaar</Text>
                <Text style={styles.vergrendeldTekst}>
                  Geboortedatum kan niet worden gewijzigd. Neem contact op via{' '}
                  <Text style={styles.vergrendeldLink}>opstap@pascal.services</Text>.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.leeftijd}>Leeftijd: {leeftijdUitGeboortedatum(geboorteDatum)} jaar</Text>
                <GeboortedatumKiezer
                  value={geboorteDatum}
                  minimumDate={grenzen.min}
                  maximumDate={grenzen.max}
                  onChange={setGeboorteDatum}
                />
                {!geboorteCheck.ok && <Text style={styles.fout}>{geboorteCheck.message}</Text>}
              </>
            )}
          </View>

          <Pressable
            style={[styles.opslaanKnop, (bezig || (!geboorteDatumVergrendeld && !geboorteCheck.ok)) && styles.disabled]}
            onPress={opslaan}
            disabled={bezig || (!geboorteDatumVergrendeld && !geboorteCheck.ok)}
          >
            <Text style={styles.opslaanTekst}>{bezig ? 'Opslaan…' : 'Opslaan'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  terugKnop: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  titel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  sectie: { paddingHorizontal: 16, gap: 12 },
  veld: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 6 },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.6 },
  leeftijd: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 4 },
  fout: { fontSize: 13, color: '#C53030', marginTop: 4 },
  vergrendeldTekst: { fontSize: 13, color: COLORS.textLight, lineHeight: 19 },
  vergrendeldLink: { color: COLORS.primary },
  gebruikersnaamRij: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  atTeken: { fontSize: 16, fontWeight: '700', color: COLORS.textLight },
  veldFout: { fontSize: 12, color: '#C53030', marginTop: 2 },
  input: { fontSize: 16, color: COLORS.text, padding: 0 },
  opslaanKnop: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  disabled: { opacity: 0.6 },
  opslaanTekst: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
