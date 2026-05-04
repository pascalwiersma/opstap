import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export default function RootLayout() {
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

  return (
    <Stack initialRouteName={session ? '(tabs)' : '(auth)'}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profiel-bewerken" options={{ headerShown: false }} />
      <Stack.Screen name="profiel-naam-bewerken" options={{ headerShown: false }} />
      <Stack.Screen name="profiel-bio-bewerken" options={{ headerShown: false }} />
      <Stack.Screen name="instellingen" options={{ headerShown: false }} />
      <Stack.Screen name="meldingen" options={{ headerShown: false }} />
      <Stack.Screen name="helpcentrum" options={{ headerShown: false }} />
      <Stack.Screen name="event/aanmaken" options={{ title: 'Event aanmaken' }} />
      <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
      <Stack.Screen name="venue/[id]" options={{ title: 'Venue' }} />
    </Stack>
  );
}
