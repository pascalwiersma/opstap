import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { getPostAuthHref } from '../../hooks/profileOnboarding';

function maskPhone(p: string): string {
  if (!p || p.length < 8) return p ?? '';
  const start = p.startsWith('+31') ? '+31 ' : '';
  const rest = p.replace(/^\+31/, '');
  if (rest.length >= 8) return `${start}${rest.slice(0, 2)} ··· ${rest.slice(-2)}`;
  return p;
}

const RESEND_COOLDOWN_SEC = 60;

export default function VerifyScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleVerify() {
    if (code.length !== 6) {
      setError('Vul de 6-cijferige code in');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.verifyOtp({
      phone: phone ?? '',
      token: code,
      type: 'sms',
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (!data.session) {
      setError('Inloggen mislukt. Probeer de code opnieuw.');
      return;
    }

    const href = await getPostAuthHref(data.session.user.id);
    router.replace(href);
  }

  async function handleResend() {
    if (!phone || cooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOtp({ phone });
    setResendLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setCooldown(RESEND_COOLDOWN_SEC);
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.blob, styles.blobOranje]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobPaars]} pointerEvents="none" />

      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingTop: top + 20, paddingBottom: bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inhoud}>
            <Pressable
              style={styles.terug}
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Terug"
            >
              <Ionicons name="chevron-back" size={28} color={COLORS.text} />
            </Pressable>

            <Ionicons
              name="chatbubble-ellipses"
              size={28}
              color={COLORS.primary}
              style={styles.chatIcoon}
            />

            <View style={styles.middenBlok}>
              <Text style={styles.titel}>Voer je code in</Text>
              <Text style={styles.subtitel}>
                We hebben een code gestuurd naar{`\n`}
                <Text style={styles.telefoonGemaskeerd}>{maskPhone(phone ?? '')}</Text>
              </Text>

              <Text style={styles.label}>SMS-code</Text>
              <TextInput
                value={code}
                onChangeText={(text) => {
                  setCode(text.replace(/\D/g, '').slice(0, 6));
                  if (error) setError(null);
                }}
                placeholder="• • • • • •"
                placeholderTextColor={COLORS.textLight}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={styles.codeInput}
                editable={!loading}
              />

              {error ? (
                <View style={styles.foutBalk}>
                  <Ionicons name="alert-circle" size={18} color="#C53030" />
                  <Text style={styles.foutTekst}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                style={[styles.primairKnop, (loading || code.length !== 6) && styles.primairKnopDisabled]}
                onPress={handleVerify}
                disabled={loading || code.length !== 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primairKnopTekst}>Bevestigen</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.secundairKnop, (cooldown > 0 || resendLoading) && styles.secundairDisabled]}
                onPress={handleResend}
                disabled={cooldown > 0 || resendLoading || !phone}
              >
                {resendLoading ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Text style={styles.secundairTekst}>
                    {cooldown > 0 ? `Nieuwe code over ${cooldown}s` : 'Code opnieuw versturen'}
                  </Text>
                )}
              </Pressable>
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

  scroll: { flexGrow: 1, paddingHorizontal: 28, maxWidth: 480, width: '100%', alignSelf: 'center' },
  inhoud: { flex: 1 },

  terug: { alignSelf: 'flex-start', marginBottom: 8, paddingVertical: 4 },
  chatIcoon: { alignSelf: 'center', marginTop: 4, marginBottom: 10 },
  middenBlok: { marginTop: 'auto', marginBottom: 'auto' },

  titel: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitel: { fontSize: 15, color: COLORS.textLight, lineHeight: 22, marginBottom: 20, textAlign: 'center' },
  telefoonGemaskeerd: { fontWeight: '700', color: COLORS.text },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, marginBottom: 8, textAlign: 'center' },

  codeInput: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ECECEC',
    borderRadius: 18,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    paddingHorizontal: 16,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    color: COLORS.text,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  foutBalk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
  primairKnopDisabled: { opacity: 0.78 },
  primairKnopTekst: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  secundairKnop: { alignItems: 'center', paddingVertical: 18, marginTop: 8 },
  secundairDisabled: { opacity: 0.45 },
  secundairTekst: { fontSize: 15, fontWeight: '600', color: COLORS.primary },

  productTekst: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textLight,
    opacity: 0.9,
  },
});
