import { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';

function normalizePhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-]/g, '');
  if (/^06\d{8}$/.test(cleaned)) return '+31' + cleaned.slice(1);
  if (/^\+316\d{8}$/.test(cleaned)) return cleaned;
  return null;
}

export default function RegisterScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendSms() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError('Vul een geldig Nederlands telefoonnummer in (bijv. 0612345678)');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOtp({ phone: normalized });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push({ pathname: '/(auth)/verify', params: { phone: normalized } });
  }

  return (
    <View>
      <Text>Telefoonnummer</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="0612345678"
        keyboardType="phone-pad"
        autoComplete="tel"
        autoFocus
      />
      {error && <Text>{error}</Text>}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Verstuur SMS code" onPress={handleSendSms} />
      )}
    </View>
  );
}
