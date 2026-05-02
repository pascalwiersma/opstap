import { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    if (code.length !== 6) {
      setError('Vul de 6-cijferige code in');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.verifyOtp({
      phone: phone ?? '',
      token: code,
      type: 'sms',
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.replace('/(tabs)/kaart');
  }

  return (
    <View>
      <Text>SMS code</Text>
      <Text>We hebben een code gestuurd naar {phone}</Text>
      <TextInput
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      {error && <Text>{error}</Text>}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Button title="Bevestig" onPress={handleVerify} />
      )}
    </View>
  );
}
