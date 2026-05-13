import 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, router } from 'expo-router';
import { supabase } from '../services/supabase';

export default function RootLayout() {
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    import('expo-notifications').then((Notifications) => {
      responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        if (data?.type === 'match_proposed' && typeof data?.matchId === 'string') {
          router.push(`/match/${data.matchId}`);
        }
      });
    }).catch(() => {});

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="verificatie" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profiel-bewerken" options={{ headerShown: false }} />
        <Stack.Screen name="profiel-naam-bewerken" options={{ headerShown: false }} />
        <Stack.Screen name="interesses-bewerken" options={{ headerShown: false }} />
        <Stack.Screen name="profiel-bio-bewerken" options={{ headerShown: false }} />
        <Stack.Screen name="instellingen" options={{ headerShown: false }} />
        <Stack.Screen name="meldingen" options={{ headerShown: false }} />
        <Stack.Screen name="helpcentrum" options={{ headerShown: false }} />
        <Stack.Screen name="voorwaarden" options={{ headerShown: false }} />
        <Stack.Screen name="match/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chatroom/[channelId]" options={{ headerShown: false }} />
        <Stack.Screen name="event/aanmaken" options={{ title: 'Event aanmaken' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="venue/[id]" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
