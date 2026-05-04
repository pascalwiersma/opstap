import { useEffect, useState } from 'react';
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
import { supabase } from '../services/supabase';
import { COLORS } from '../constants/colors';

const PAARS = COLORS.secondary;

export default function ProfielBioBewerkScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [bio, setBio] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('bio')
        .eq('id', session.user.id)
        .single();
      if (data) setBio(data.bio ?? '');
    })();
  }, []);

  async function opslaan() {
    setBezig(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBezig(false); return; }
    const { error } = await supabase
      .from('profiles')
      .update({ bio: bio.trim() || null })
      .eq('id', user.id);
    setBezig(false);
    if (error) {
      Alert.alert('Fout', 'Kon omschrijving niet opslaan. Probeer opnieuw.');
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
          <Text style={styles.titel}>Profielomschrijving</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.sectie}>
          <View style={styles.veld}>
            <Text style={styles.label}>Over mij</Text>
            <TextInput
              style={styles.textarea}
              value={bio}
              onChangeText={setBio}
              placeholder="Schrijf iets over jezelf…"
              placeholderTextColor={COLORS.textLight}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={[styles.opslaanKnop, bezig && styles.disabled]}
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
  wrapper:      { flex: 1, backgroundColor: '#F2F2F7' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  terugKnop:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  titel:        { fontSize: 17, fontWeight: '700', color: COLORS.text },
  sectie:       { paddingHorizontal: 16, gap: 12 },
  veld:         { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 6 },
  label:        { fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.6 },
  textarea:     { fontSize: 16, color: COLORS.text, padding: 0, minHeight: 120 },
  opslaanKnop:  { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 4 },
  disabled:     { opacity: 0.6 },
  opslaanTekst: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
