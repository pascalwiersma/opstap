import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { COLORS } from '../constants/colors';
import { supabase } from '../services/supabase';

type Bestemming = '/(auth)/register' | '/onboarding' | '/(tabs)/kaart'

export default function Index() {
  const [bestemming, setBestemming] = useState<Bestemming | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setBestemming('/(auth)/register'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', session.user.id)
        .single();

      if (!data?.onboarding_completed_at) {
        setBestemming('/onboarding');
      } else {
        setBestemming('/(tabs)/kaart');
      }
    })();
  }, []);

  if (!bestemming) {
    return (
      <View style={styles.scherm}>
        <View style={styles.logoWrapper}>
          <Image source={require('../assets/icon.png')} style={styles.logo} resizeMode="cover" />
        </View>
        <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" style={styles.spinner} />
      </View>
    );
  }

  return <Redirect href={bestemming} />;
}

const styles = StyleSheet.create({
  scherm: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 140,
    height: 140,
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  logo: {
    width: 140,
    height: 140,
  },
  spinner: {
    position: 'absolute',
    bottom: '15%',
  },
});
