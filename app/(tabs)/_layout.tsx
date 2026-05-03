import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

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

export default function TabsLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <Redirect href="/(auth)/register" />;

  return (
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
          title: 'Profiel',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="events" options={{ href: null }} />
    </Tabs>
  );
}
