import { useEffect } from 'react';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { getPostAuthHref } from './profileOnboarding';

export function useProtectedRoute(session: Session | null | undefined) {
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wacht tot de navigator gemount is; zonder deze check gooit router.replace() stil weg
    if (!navigationState?.key) return;
    // Wacht tot de sessie bepaald is (undefined = nog aan het laden)
    if (session === undefined) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/register');
    } else if (session?.user && inAuthGroup) {
      void (async () => {
        const href = await getPostAuthHref(session.user.id);
        router.replace(href);
      })();
    }
  }, [navigationState?.key, session, segments]);
}
