import { supabase } from '../services/supabase';

/** `true` als onboarding is afgerond (`onboarding_completed_at` gezet). */
export async function isProfileOnboardingComplete(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', userId)
    .single();

  if (error || !data) return false;
  return data.onboarding_completed_at != null;
}

export async function getPostAuthHref(
  userId: string,
): Promise<'/onboarding' | '/(tabs)/kaart'> {
  const done = await isProfileOnboardingComplete(userId);
  return done ? '/(tabs)/kaart' : '/onboarding';
}
