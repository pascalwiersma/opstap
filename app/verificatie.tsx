import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { useIdentityVerification } from '../hooks/useIdentityVerification';

export default function VerificatieScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { startIdentiteitsVerificatie, bezig } = useIdentityVerification();
  const [fout, setFout] = useState<string | null>(null);

  async function verifieer() {
    setFout(null);
    const result = await startIdentiteitsVerificatie();

    switch (result.type) {
      case 'approved':
        router.replace('/(tabs)/kaart');
        break;
      case 'pending':
        Alert.alert(
          'In behandeling',
          'Je identiteit wordt handmatig beoordeeld. Je hoort zo snel mogelijk van ons.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)/kaart') }],
        );
        break;
      case 'declined':
        setFout('Je identiteit kon niet worden geverifieerd. Probeer het opnieuw of neem contact op met support.');
        break;
      case 'cancelled':
        break;
      case 'error':
        setFout(result.melding);
        break;
    }
  }

  return (
    <View style={[styles.wrapper, { paddingTop: top, paddingBottom: bottom + 24 }]}>
      <View style={styles.inhoud}>
        <View style={styles.icoonRond}>
          <Ionicons name="shield-checkmark" size={48} color={COLORS.primary} />
        </View>

        <Text style={styles.titel}>Verifieer je identiteit</Text>
        <Text style={styles.subtitel}>
          OpStap vereist een identiteitsverificatie zodat iedereen veilig de app kan gebruiken.
          Dit duurt ongeveer 2 minuten.
        </Text>

        <View style={styles.stappenLijst}>
          {[
            { icon: 'document-outline', tekst: 'Scan je paspoort of ID-kaart' },
            { icon: 'camera-outline', tekst: 'Maak een selfie' },
            { icon: 'checkmark-circle-outline', tekst: 'Ontvang directe bevestiging' },
          ].map(({ icon, tekst }) => (
            <View key={tekst} style={styles.stapRij}>
              <Ionicons name={icon as never} size={20} color={COLORS.secondary} />
              <Text style={styles.stapTekst}>{tekst}</Text>
            </View>
          ))}
        </View>

        {fout && (
          <View style={styles.foutBalk}>
            <Ionicons name="alert-circle" size={18} color="#C53030" />
            <Text style={styles.foutTekst}>{fout}</Text>
          </View>
        )}
      </View>

      <View style={styles.bodem}>
        <Pressable
          style={[styles.knop, bezig && styles.knopDisabled]}
          onPress={verifieer}
          disabled={bezig}
        >
          {bezig ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
              <Text style={styles.knopTekst}>Identiteit verifiëren</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.privacyTekst}>
          Je gegevens worden veilig verwerkt en niet gedeeld met derden.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:   { flex: 1, backgroundColor: '#FAFAFA', justifyContent: 'space-between' },
  inhoud:    { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', gap: 20 },

  icoonRond: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },

  titel:    { fontSize: 26, fontWeight: '800', color: COLORS.text, textAlign: 'center', letterSpacing: -0.5 },
  subtitel: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 22 },

  stappenLijst: { gap: 14, alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  stapRij:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stapTekst:    { fontSize: 15, color: COLORS.text, fontWeight: '500' },

  foutBalk: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF5F5', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#FED7D7', alignSelf: 'stretch',
  },
  foutTekst: { flex: 1, fontSize: 14, color: '#9B2C2C', lineHeight: 20 },

  bodem:       { paddingHorizontal: 28, gap: 12 },
  knop:        {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 18,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  knopDisabled: { opacity: 0.6 },
  knopTekst:    { fontSize: 17, fontWeight: '800', color: '#fff' },
  privacyTekst: { fontSize: 12, color: COLORS.textLight, textAlign: 'center', lineHeight: 18 },
});
