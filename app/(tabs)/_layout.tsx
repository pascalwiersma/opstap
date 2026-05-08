import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, Tabs, usePathname } from 'expo-router';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { isProfileOnboardingComplete } from '../../hooks/profileOnboarding';

const ORANJE = '#FF6B35';

/**
 * Incheck gebruikt géén tabBarShowLabel: false → die optie komt in React Navigation uit de
 * *focused* route en geldt dan voor ÁLLE tabs, waardoor labels verdwijnen op het Incheck-scherm.
 * We renderen de default children niet; daardoor is er geen zichtbaar label onder deze knop.
 */
const INCHECKEN_ICOON_RUIMTE_BOVEN_LABEL = 24;

function IncheckenOranjeRond({ children: _negeren, ...rest }: BottomTabBarButtonProps) {
  const actief = rest['aria-selected'] === true;
  return (
    <PlatformPressable
      {...rest}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={[
        rest.style,
        {
          alignItems: 'center',
          justifyContent: 'flex-end',
          flex: 1,
          paddingBottom: INCHECKEN_ICOON_RUIMTE_BOVEN_LABEL,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: ORANJE,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: '#FFFFFF',
          shadowColor: ORANJE,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: actief ? 0.5 : 0.38,
          shadowRadius: actief ? 10 : 7,
          elevation: actief ? 10 : 7,
        }}
      >
        <Ionicons name="flash" size={30} color="#FFFFFF" />
      </View>
    </PlatformPressable>
  );
}

function PendingBanner() {
  const { top } = useSafeAreaInsets();
  return (
    <View style={[banner.wrapper, { paddingTop: top + 6 }]}>
      <Ionicons name="time-outline" size={15} color="#fff" />
      <Text style={banner.tekst}>
        Je identiteit wordt handmatig beoordeeld. Je hoort snel van ons.
      </Text>
    </View>
  );
}

const banner = StyleSheet.create({
  wrapper: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingBottom: 10,
  },
  tekst: { flex: 1, fontSize: 12, fontWeight: '600', color: '#fff', lineHeight: 18 },
});

export default function TabsLayout() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [onboardingAfgerond, setOnboardingAfgerond] = useState<boolean | null>(null);
  const [verificatieStatus, setVerificatieStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setOnboardingAfgerond(null);
      setVerificatieStatus(null);
      return;
    }
    let weg = false;
    Promise.all([
      isProfileOnboardingComplete(session.user.id),
      supabase.from('profiles').select('verification_status').eq('id', session.user.id).single(),
    ]).then(([ok, profielRes]) => {
      if (weg) return;
      setOnboardingAfgerond(ok);
      setVerificatieStatus(profielRes.data?.verification_status ?? null);
    });
    return () => { weg = true; };
  }, [session?.user?.id, pathname]);

  if (session === undefined) return null;
  if (!session) return <Redirect href="/(auth)/register" />;
  if (onboardingAfgerond === null) return null;
  if (!onboardingAfgerond) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1 }}>
    {verificatieStatus === 'pending' && <PendingBanner />}
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          overflow: 'visible',
          minHeight: 92,
          paddingTop: 8,
          paddingBottom: 2,
          backgroundColor: '#FFFFFF',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(0,0,0,0.1)',
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="kaart"
        options={{
          title: 'Kaart',
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ontdek"
        options={{
          title: 'Ontdek',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inchecken"
        options={{
          title: 'Inchecken',
          tabBarAccessibilityLabel: 'Inchecken',
          tabBarIcon: () => null,
          tabBarButton: (props) => <IncheckenOranjeRond {...props} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profiel"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="events" options={{ href: null }} />
    </Tabs>
    </View>
  );
}
