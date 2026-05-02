import { useEffect, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../services/supabase';

export default function AuthLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (session) return <Redirect href="/(tabs)/kaart" />;

  return <Stack initialRouteName="register" screenOptions={{ headerShown: false }} />;
}
