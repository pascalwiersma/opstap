import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { supabase } from '../services/supabase';

const PAARS = COLORS.secondary;

type Rij = {
  label: string;
  icoon: keyof typeof Ionicons.glyphMap;
  actie: () => void;
  destructief?: boolean;
};

export default function InstellingenScreen() {
  const { top, bottom } = useSafeAreaInsets();

  function bevestigUitloggen() {
    Alert.alert('Uitloggen', 'Weet je zeker dat je wil uitloggen?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Uitloggen', style: 'destructive',
        onPress: async () => { await supabase.auth.signOut(); router.replace('/(auth)/register'); },
      },
    ]);
  }

  function bevestigVerwijderen() {
    Alert.alert(
      'Account verwijderen',
      'Je profiel en gegevens worden permanent gewist. Dit kun je niet terugdraaien.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Definitief verwijderen', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_own_account');
            if (error) { Alert.alert('Verwijderen mislukt', error.message); return; }
            await supabase.auth.signOut();
            router.replace('/(auth)/register');
          },
        },
      ],
    );
  }

  const SECTIES: { titel: string; rijen: Rij[] }[] = [
    {
      titel: 'Account',
      rijen: [
        { label: 'Profiel bewerken', icoon: 'person-outline', actie: () => router.push('/profiel-bewerken') },
        { label: 'Persoonlijke gegevens', icoon: 'id-card-outline', actie: () => router.push('/profiel-naam-bewerken') },
        { label: 'Favorieten', icoon: 'heart-outline', actie: () => router.push('/favorieten') },
        { label: 'Meldingen', icoon: 'notifications-outline', actie: () => router.push('/meldingen') },
      ],
    },
    {
      titel: 'Informatie',
      rijen: [
        { label: 'Helpcentrum', icoon: 'help-circle-outline', actie: () => router.push('/helpcentrum') },
        { label: 'Voorwaarden & privacy', icoon: 'document-text-outline', actie: () => router.push('/voorwaarden') },
      ],
    },
    {
      titel: '',
      rijen: [
        { label: 'Uitloggen', icoon: 'log-out-outline', actie: bevestigUitloggen, destructief: true },
        { label: 'Account verwijderen', icoon: 'trash-outline', actie: bevestigVerwijderen, destructief: true },
      ],
    },
  ];

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.terugKnop} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={PAARS} />
        </Pressable>
        <Text style={styles.titel}>Instellingen</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.inhoud, { paddingBottom: bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {SECTIES.map((sectie, si) => (
          <View key={si} style={styles.sectie}>
            {sectie.titel ? <Text style={styles.sectieKop}>{sectie.titel}</Text> : null}
            <View style={styles.kaart}>
              {sectie.rijen.map((rij, ri) => (
                <View key={rij.label}>
                  {ri > 0 && <View style={styles.scheidingslijn} />}
                  <Pressable style={styles.rij} onPress={rij.actie}>
                    <View style={[styles.icoonRond, rij.destructief && styles.icoonRondRood]}>
                      <Ionicons
                        name={rij.icoon}
                        size={18}
                        color={rij.destructief ? '#E53E3E' : PAARS}
                      />
                    </View>
                    <Text style={[styles.rijLabel, rij.destructief && styles.rijLabelRood]}>
                      {rij.label}
                    </Text>
                    {!rij.destructief && (
                      <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerVersie}>
            Versie {Constants.expoConfig?.version ?? '1.0.0'} ({Constants.expoConfig?.ios?.buildNumber ?? '1'})
          </Text>
          <Text style={styles.footerGemaakt}>Met ❤️ gemaakt in Groningen</Text>
          <Text style={styles.footerGemaakt}>door Pascal Services.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  terugKnop: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  titel: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  inhoud: { paddingHorizontal: 16, gap: 24 },
  sectie: { gap: 8 },
  sectieKop: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 4 },
  kaart: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  scheidingslijn: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginLeft: 60 },

  rij: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  icoonRond: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EDE9FF', alignItems: 'center', justifyContent: 'center' },
  icoonRondRood: { backgroundColor: '#FFF0F0' },
  rijLabel: { flex: 1, fontSize: 16, color: COLORS.text },
  rijLabelRood: { color: '#E53E3E' },

  footer: { alignItems: 'center', gap: 4, paddingTop: 8 },
  footerVersie: { fontSize: 13, color: COLORS.textLight },
  footerGemaakt: { fontSize: 12, color: '#C7C7CC' },
});
