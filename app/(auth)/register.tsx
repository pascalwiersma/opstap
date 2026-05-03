import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { COLORS } from '../../constants/colors';
import { supabase } from '../../services/supabase';

function normalizePhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-]/g, '');
  if (/^06\d{8}$/.test(cleaned)) return '+31' + cleaned.slice(1);
  if (/^\+316\d{8}$/.test(cleaned)) return cleaned;
  return null;
}

export default function RegisterScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [veldActief, setVeldActief] = useState(false);

  async function handleSendSms() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError('Vul een geldig Nederlands telefoonnummer in');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({ phone: normalized });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push({ pathname: '/(auth)/verify', params: { phone: normalized } });
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.blob, styles.blobOranje]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobPaars]} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingTop: top + 20, paddingBottom: bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inhoud}>
            <Image
              source={require('../../assets/favicon.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="App logo"
            />

            <View style={styles.middenBlok}>
              <Text style={styles.wordmark}>Vul je telefoonnummer in</Text>

              <View style={[styles.inputBuiten, veldActief && styles.inputBuitenActief]}>
                <View style={[styles.ikonCirkel, veldActief && styles.ikonCirkelActief]}>
                  <Ionicons
                    name="call-outline"
                    size={22}
                    color={veldActief ? COLORS.primary : COLORS.textLight}
                  />
                </View>
                <TextInput
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t);
                    if (error) setError(null);
                  }}
                  placeholder="06 12345678"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  autoFocus
                  style={styles.input}
                  editable={!loading}
                  onFocus={() => setVeldActief(true)}
                  onBlur={() => setVeldActief(false)}
                />
              </View>

              {error ? (
                <View style={styles.foutBalk}>
                  <Ionicons name="alert-circle" size={18} color="#C53030" />
                  <Text style={styles.foutTekst}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.primairKnop,
                  loading && styles.primairKnopDisabled,
                  pressed && !loading && styles.primairKnopPressed,
                ]}
                onPress={handleSendSms}
                disabled={loading}
                android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primairKnopTekst}>Beginnen</Text>
                    <Ionicons name="arrow-forward-circle" size={24} color="#fff" style={styles.knopPijl} />
                  </>
                )}
              </Pressable>

              <Text style={styles.akkoordTekst}>
                Door je nummer in te voeren ga je akkoord met de algemene voorwaarden en het privacybeleid.
              </Text>

              <View style={styles.vertrouwen}>
                <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textLight} />
                <Text style={styles.vertrouwenTekst}>
                  We gebruiken je nummer alleen voor inloggen
                </Text>
              </View>
            </View>

            <Text style={styles.productTekst}>OpStap is een product van Pascal Services</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FAFAFA', overflow: 'hidden' },
  keyboard: { flex: 1 },

  blob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  blobOranje: {
    top: -120,
    right: -80,
    backgroundColor: COLORS.primary,
    opacity: 0.09,
  },
  blobPaars: {
    bottom: '12%',
    left: -140,
    backgroundColor: COLORS.secondary,
    opacity: 0.07,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  inhoud: {
    flex: 1,
  },

  logo: {
    alignSelf: 'center',
    width: 132,
    height: 132,
    marginTop: 0,
    marginBottom: 14,
  },

  middenBlok: {
    marginTop: 'auto',
    marginBottom: 'auto',
  },

  wordmark: {
    alignSelf: 'center',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.8,
    marginBottom: 28,
  },

  inputBuiten: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingLeft: 6,
    paddingRight: 16,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#ECECEC',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  inputBuitenActief: {
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  ikonCirkel: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ikonCirkelActief: {
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
  },
  input: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 19,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 0.3,
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
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 17,
    marginTop: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 6,
  },
  primairKnopPressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  primairKnopDisabled: { opacity: 0.78 },
  primairKnopTekst: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  knopPijl: { marginLeft: 8 },

  akkoordTekst: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 18,
    paddingHorizontal: 8,
  },

  vertrouwen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  vertrouwenTekst: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  productTekst: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textLight,
    opacity: 0.9,
  },
});
