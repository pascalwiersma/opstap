import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="kaart" options={{ title: 'Kaart' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="profiel" options={{ title: 'Profiel' }} />
    </Tabs>
  );
}
