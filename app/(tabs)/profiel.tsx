import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { Tables } from '../../types/supabase';

type Profiel = Pick<Tables<'profiles'>, 'name' | 'avatar_url' | 'age' | 'bio' | 'trust_score'>;

export default function ProfielScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [profiel, setProfiel] = useState<Profiel | null>(null);
  const [telefoon, setTelefoon] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;
        setTelefoon(user.phone ?? null);
        const { data } = await supabase
          .from('profiles')
          .select('name, avatar_url, age, bio, trust_score')
          .eq('id', user.id)
          .single();
        if (data) setProfiel(data as Profiel);
      } catch (e) {
        console.error('profiel laden mislukt:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function uitloggen() {
    Alert.alert('Uitloggen', 'Weet je zeker dat je wil uitloggen?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Uitloggen',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/register');
        },
      },
    ]);
  }

  const initialen = profiel?.name
    ? profiel.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: top, paddingBottom: bottom + 110 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTekst}>{initialen}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />
        ) : (
          <>
            <Text style={styles.naam}>{profiel?.name ?? '—'}</Text>
            <View style={styles.scorePill}>
              <Ionicons name="star" size={12} color="#fff" />
              <Text style={styles.scoreTekst}>{profiel?.trust_score?.toFixed(1) ?? '5.0'}</Text>
            </View>
          </>
        )}
      </View>

      {!loading && (
        <View style={styles.sectie}>
          {/* Bio */}
          {profiel?.bio ? (
            <View style={styles.kaart}>
              <Text style={styles.kaartLabel}>Over mij</Text>
              <Text style={styles.kaartTekst}>{profiel.bio}</Text>
            </View>
          ) : null}

          {/* Info rij */}
          <View style={styles.kaart}>
            <View style={styles.infoRij}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoLabel}>Leeftijd</Text>
                <Text style={styles.infoWaarde}>{profiel?.age ?? '—'}</Text>
              </View>
              <View style={styles.infoScherm} />
              <View style={styles.infoItem}>
                <Ionicons name="call-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoLabel}>Telefoon</Text>
                <Text style={styles.infoWaarde} numberOfLines={1}>{telefoon ?? '—'}</Text>
              </View>
            </View>
          </View>

          {/* Acties */}
          <View style={styles.kaart}>
            <Pressable style={styles.actieRij} onPress={() => router.push('/profiel-bewerken')}>
              <Ionicons name="pencil-outline" size={20} color={COLORS.text} />
              <Text style={styles.actieTekst}>Profiel bewerken</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} style={{ marginLeft: 'auto' }} />
            </Pressable>
            <View style={styles.actieScheiding} />
            <Pressable style={styles.actieRij}>
              <Ionicons name="heart-outline" size={20} color={COLORS.text} />
              <Text style={styles.actieTekst}>Favoriete venues</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} style={{ marginLeft: 'auto' }} />
            </Pressable>
          </View>

          <Pressable style={[styles.kaart, styles.uitloggenRij]} onPress={uitloggen}>
            <Ionicons name="log-out-outline" size={20} color="#E53E3E" />
            <Text style={styles.uitloggenTekst}>Uitloggen</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    backgroundColor: COLORS.background,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
    marginBottom: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarTekst: { fontSize: 34, fontWeight: '700', color: '#fff' },
  naam:        { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  scoreTekst: { fontSize: 13, fontWeight: '700', color: '#fff' },

  sectie: { paddingHorizontal: 16, gap: 12 },

  kaart: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
  },
  kaartLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  kaartTekst: { fontSize: 15, color: COLORS.text, lineHeight: 22 },

  infoRij:    { flexDirection: 'row', alignItems: 'center' },
  infoItem:   { flex: 1, alignItems: 'center', gap: 5 },
  infoLabel:  { fontSize: 11, color: COLORS.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoWaarde: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  infoScherm: { width: 1, height: 44, backgroundColor: COLORS.surface },

  actieRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actieTekst: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  actieScheiding: { height: 1, backgroundColor: COLORS.surface, marginVertical: 12 },

  uitloggenRij: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  uitloggenTekst: { fontSize: 15, fontWeight: '600', color: '#E53E3E' },
});
