import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { COLORS } from '../constants/colors';

export default function ProfielBewerkScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [naam, setNaam] = useState('');
  const [leeftijd, setLeeftijd] = useState('');
  const [bio, setBio] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('name, age, bio')
        .eq('id', user.id)
        .single();
      if (data) {
        setNaam(data.name ?? '');
        setLeeftijd(data.age?.toString() ?? '');
        setBio(data.bio ?? '');
      }
    })();
  }, []);

  async function opslaan() {
    if (!naam.trim()) {
      Alert.alert('Naam vereist', 'Voer een naam in om op te slaan.');
      return;
    }
    setBezig(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBezig(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({
        name: naam.trim(),
        age: leeftijd ? parseInt(leeftijd, 10) : null,
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
            <Text style={styles.veldLabel}>Leeftijd</Text>
            <TextInput
              style={styles.input}
              value={leeftijd}
              onChangeText={setLeeftijd}
              placeholder="Bijv. 23"
              placeholderTextColor={COLORS.textLight}
              keyboardType="number-pad"
              maxLength={2}
            />
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
            style={[styles.opslaanKnop, bezig && styles.knopDisabled]}
            onPress={opslaan}
            disabled={bezig}
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
