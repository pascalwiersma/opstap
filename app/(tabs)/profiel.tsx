import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { Tables } from '../../types/supabase';

type ProfielVelden = Pick<Tables<'profiles'>, 'name' | 'avatar_url'>;

function koppelTekst(user: User | null): string {
  const providers = user?.identities?.map((i) => i.provider) ?? [];
  if (providers.includes('apple')) return 'Gekoppeld met Apple';
  if (providers.includes('google')) return 'Gekoppeld met Google';
  if (providers.includes('phone')) return 'Gekoppeld met telefoon';
  return user?.phone ? 'Gekoppeld met telefoon' : 'Actief account';
}

function loginIdentiteit(user: User | null): string {
  if (user?.email) return user.email;
  if (user?.phone) return user.phone;
  return '—';
}

/** Placeholder — later koppel aan echte notificatie-teller */
const MOCK_MELDINGEN_TOTAAL = 22;

export default function ProfielScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [sessie, setSessie] = useState<Session | null>(null);
  const [profiel, setProfiel] = useState<ProfielVelden | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSessie(session);
        const user = session?.user;
        if (!user) {
          setLoading(false);
          return;
        }
        const { data } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', user.id)
          .single();
        if (data) setProfiel(data as ProfielVelden);
      } catch (e) {
        console.error('account laden mislukt:', e);
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

  function binnenkort() {
    Alert.alert('Binnenkort', 'Deze functie wordt later toegevoegd.');
  }

  const user = sessie?.user ?? null;
  const naam   = profiel?.name ?? '—';
  const initialen =
    naam !== '—'
      ? naam
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '?';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollInhoud, { paddingTop: top + 8, paddingBottom: bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pagetitel}>Account</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
      ) : (
        <>
          <Pressable style={styles.hoofdKaart} onPress={() => router.push('/profiel-bewerken')}>
            {profiel?.avatar_url ? (
              <Image source={{ uri: profiel.avatar_url }} style={styles.avatarFoto} />
            ) : (
              <View style={styles.avatarPlaat}>
                <Text style={styles.avatarLetters}>{initialen}</Text>
              </View>
            )}
            <View style={styles.hoofdKaartTekst}>
              <Text style={styles.naamVet}>{naam}</Text>
              <Text style={styles.subRegel}>{loginIdentiteit(user)}</Text>
              <Text style={styles.metaRegel}>{koppelTekst(user)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </Pressable>

          <View style={styles.actiePaar}>
            <Pressable style={styles.actieKaart} onPress={() => router.push('/profiel-bewerken')}>
              <Ionicons name="pencil-outline" size={26} color={COLORS.text} />
              <Text style={styles.actieKaartTekst}>Profiel bewerken</Text>
            </Pressable>
            <Pressable style={styles.actieKaart} onPress={() => router.push('/instellingen')}>
              <Ionicons name="settings-outline" size={26} color={COLORS.text} />
              <Text style={styles.actieKaartTekst}>Instellingen</Text>
            </Pressable>
          </View>

          <Text style={styles.sectieKop}>Meldingen & Connecties</Text>
          <View style={styles.kaartenStapel}>
            <Pressable style={styles.rijKaart} onPress={binnenkort}>
              <Text style={styles.rijLabel}>Meldingen</Text>
              <View style={styles.rechtsGroep}>
                {MOCK_MELDINGEN_TOTAAL > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTekst}>
                      {MOCK_MELDINGEN_TOTAAL > 99 ? '99+' : String(MOCK_MELDINGEN_TOTAAL)}
                    </Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
              </View>
            </Pressable>
            <Pressable style={styles.rijKaart} onPress={binnenkort}>
              <Text style={styles.rijLabel}>Jouw connecties</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </Pressable>
          </View>

          <Text style={styles.sectieKop}>Over de app</Text>
          <View style={styles.kaartenStapel}>
            <Pressable style={styles.rijKaart} onPress={binnenkort}>
              <Text style={styles.rijLabel}>Helpcentrum</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </Pressable>
            <Pressable style={styles.rijKaart} onPress={binnenkort}>
              <Text style={styles.rijLabel}>Voorwaarden & privacy</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </Pressable>
          </View>

          <Pressable style={[styles.rijKaart, styles.logoutKaart]} onPress={uitloggen}>
            <Ionicons name="log-out-outline" size={22} color="#E53E3E" />
            <Text style={styles.logoutTekst}>Uitloggen</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:     { flex: 1, backgroundColor: COLORS.surface },
  scrollInhoud: { paddingHorizontal: 16, gap: 0 },

  pagetitel: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.6,
    marginBottom: 20,
  },

  hoofdKaart: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarFoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
  },
  avatarPlaat: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetters: { fontSize: 20, fontWeight: '700', color: '#fff' },
  hoofdKaartTekst: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  naamVet:     { fontSize: 17, fontWeight: '700', color: COLORS.text },
  subRegel:    { fontSize: 14, color: COLORS.text, marginTop: 2 },
  metaRegel:   { fontSize: 12, color: COLORS.textLight, marginTop: 4 },

  actiePaar:      { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actieKaart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 96,
    backgroundColor: COLORS.background,
    borderRadius: 18,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  actieKaartTekst: { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'center' },

  sectieKop: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 10,
    marginTop: 4,
    letterSpacing: 0.2,
  },

  kaartenStapel: { gap: 8, marginBottom: 20 },
  rijKaart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  rijLabel: { fontSize: 16, fontWeight: '500', color: COLORS.text },
  rechtsGroep: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  badge: {
    backgroundColor: COLORS.primary,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTekst: { fontSize: 13, fontWeight: '700', color: '#fff' },

  logoutKaart: { justifyContent: 'flex-start', gap: 12, marginTop: 8 },
  logoutTekst: { fontSize: 16, fontWeight: '600', color: '#E53E3E' },
});
