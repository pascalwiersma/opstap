import 'react-native-reanimated';
import { useEffect, useRef, useState } from 'react';
import { Stack, router } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Push notificatie listener — werkt alleen op echte devices met push capability
    import('expo-notifications').then((Notifications) => {
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        if (data?.type === 'match_proposed' && typeof data?.matchId === 'string') {
          router.push(`/match/${data.matchId}`);
        }
      });
    }).catch(() => {});

    return () => {
      subscription.unsubscribe();
      responseListener.current?.remove();
    };
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
      <Stack.Screen name="voorwaarden" options={{ headerShown: false }} />
      <Stack.Screen name="match/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="chatroom/[channelId]" options={{ headerShown: false }} />
      <Stack.Screen name="event/aanmaken" options={{ title: 'Event aanmaken' }} />
      <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
      <Stack.Screen name="venue/[id]" options={{ title: 'Venue' }} />
    </Stack>
  );
}
