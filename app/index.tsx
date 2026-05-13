import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { COLORS } from '../constants/colors';
import { supabase } from '../services/supabase';

type Bestemming = '/(auth)/register' | '/onboarding' | '/verificatie' | '/(tabs)/kaart'

export default function Index() {
  const [bestemming, setBestemming] = useState<Bestemming | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setBestemming('/(auth)/register'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed_at, identity_verified')
        .eq('id', session.user.id)
        .single();

      if (!data?.onboarding_completed_at) {
        setBestemming('/onboarding');
      } else if (!data?.identity_verified) {
        setBestemming('/verificatie');
      } else {
        setBestemming('/(tabs)/kaart');
      }
    })();
  }, []);

  if (!bestemming) {
    return (
      <View style={styles.midden}>
        <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <ActivityIndicator size="small" color={COLORS.primary} style={styles.spinner} />
      </View>
    );
  }

  return <Redirect href={bestemming} />;
}

const styles = StyleSheet.create({
  midden: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 72, height: 72 },
  spinner: { marginTop: 16 },
});
