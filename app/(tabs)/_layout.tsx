import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

function IncheckenKnop(props: any) {
  return (
    <View style={[props.style, { alignItems: 'center', justifyContent: 'center' }]}>
      <Pressable
        onPress={() => props.onPress?.()}
        style={{
          top: -20,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#FF6B35',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#FF6B35',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45,
          shadowRadius: 10,
          elevation: 8,
          borderWidth: 3,
          borderColor: '#fff',
        }}
      >
        <Ionicons name="flash" size={26} color="#fff" />
      </Pressable>
    </View>
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
        tabBarActiveTintColor: '#FF6B35',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'rgba(255,255,255,0.95)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          overflow: 'visible',
          height: 62,
          marginBottom: 16,
          marginHorizontal: 16,
          borderRadius: 20,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
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
          title: '',
          tabBarButton: IncheckenKnop,
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
