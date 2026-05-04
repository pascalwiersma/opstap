import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Channel,
  Chat,
  MessageComposer,
  MessageList,
  OverlayProvider,
} from 'stream-chat-expo';
import type { Channel as StreamChannel } from 'stream-chat';
import { streamClient } from '../../services/stream';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';

export default function ChatroomScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>()
  const { top, bottom } = useSafeAreaInsets()
  const [kanaal, setKanaal] = useState<StreamChannel | null>(null)
  const [loading, setLoading] = useState(true)
  const [fout, setFout] = useState<string | null>(null)
  const verbonden = useRef(false)

  useEffect(() => {
    verbindEnLaad()
    return () => {
      if (verbonden.current) {
        streamClient.disconnectUser().catch(() => {})
        verbonden.current = false
      }
    }
  }, [channelId])

  async function verbindEnLaad() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Niet ingelogd')

      if (!streamClient.userID) {
        const { data: profiel } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', user.id)
          .single()

        await streamClient.connectUser(
          {
            id: user.id,
            name: profiel?.name ?? 'Gebruiker',
            image: profiel?.avatar_url ?? undefined,
          },
          streamClient.devToken(user.id),
        )
        verbonden.current = true
      }

      const channel = streamClient.channel('messaging', channelId)
      await channel.watch()
      setKanaal(channel)
    } catch (e) {
      console.error('Stream Chat fout:', e)
      setFout('Kon de chat niet laden. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.midden, { paddingTop: top }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    )
  }

  if (fout || !kanaal) {
    return (
      <View style={[styles.midden, { paddingTop: top }]}>
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.textLight} />
        <Text style={styles.foutTekst}>{fout ?? 'Onbekende fout'}</Text>
        <Pressable style={styles.terugKnop} onPress={() => router.back()}>
          <Text style={styles.terugTekst}>Terug</Text>
        </Pressable>
      </View>
    )
  }

  const groepsNaam = (kanaal.data as { name?: string } | undefined)?.name ?? 'Groepschat'

  return (
    <OverlayProvider>
      <View style={[styles.wrapper, { paddingTop: top }]}>
        <View style={styles.header}>
          <Pressable style={styles.terugRond} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={COLORS.secondary} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitel} numberOfLines={1}>{groepsNaam}</Text>
            <Text style={styles.headerSub}>
              {(kanaal.state.members ? Object.keys(kanaal.state.members).length : 0)} leden
            </Text>
          </View>
        </View>

        <Chat client={streamClient}>
          <Channel
            channel={kanaal}
            keyboardVerticalOffset={top + 56}
          >
            <MessageList />
            <MessageComposer />
          </Channel>
        </Chat>
      </View>
    </OverlayProvider>
  )
}

const styles = StyleSheet.create({
  wrapper:      { flex: 1, backgroundColor: '#fff' },
  midden:       { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  terugRond:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  headerInfo:   { flex: 1 },
  headerTitel:  { fontSize: 17, fontWeight: '700', color: COLORS.text },
  headerSub:    { fontSize: 12, color: COLORS.textLight },

  foutTekst:    { fontSize: 15, color: COLORS.textLight, textAlign: 'center' },
  terugKnop:    { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  terugTekst:   { fontSize: 15, fontWeight: '700', color: '#fff' },
})
