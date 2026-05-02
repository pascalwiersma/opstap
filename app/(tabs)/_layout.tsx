import { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../services/supabase';

export default function TabsLayout() {
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
  if (!session) return <Redirect href="/(auth)/register" />;

  return (
    <Tabs>
      <Tabs.Screen name="kaart" options={{ title: 'Kaart' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="profiel" options={{ title: 'Profiel' }} />
    </Tabs>
  );
}
