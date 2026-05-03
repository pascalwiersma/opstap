import { useEffect, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import type { Href } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../../services/supabase';
import { getPostAuthHref } from '../../hooks/profileOnboarding';

export default function AuthLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [naAuthHref, setNaAuthHref] = useState<Href | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setNaAuthHref(null);
      return;
    }
    let weg = false;
    (async () => {
      const href = await getPostAuthHref(session.user.id);
      if (!weg) setNaAuthHref(href);
    })();
    return () => {
      weg = true;
    };
  }, [session?.user?.id]);

  if (session === undefined) return null;

  if (session?.user) {
    if (naAuthHref === null) return null;
    return <Redirect href={naAuthHref} />;
  }

  return <Stack initialRouteName="register" screenOptions={{ headerShown: false }} />;
}
