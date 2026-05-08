import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Channel as StreamChannel } from 'stream-chat';
import {
  Channel,
  Chat,
  MessageComposer,
  MessageList,
  OverlayProvider,
} from 'stream-chat-expo';
import { COLORS } from '../../constants/colors';
import { getOrCreateDm, verbindStream } from '../../services/dm';
import { streamClient } from '../../services/stream';
import { supabase } from '../../services/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lid {
  userId: string
  naam: string
  avatarUrl: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ url, naam, size }: { url: string | null; naam: string; size: number }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitiaal, { fontSize: size * 0.38 }]}>
        {naam.charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

// ── Ledenlijst modal ──────────────────────────────────────────────────────────

function LedenModal({
  zichtbaar,
  leden,
  mijnUserId,
  onSluiten,
  onDm,
}: {
  zichtbaar: boolean
  leden: Lid[]
  mijnUserId: string
  onSluiten: () => void
  onDm: (lid: Lid) => void
}) {
  return (
    <Modal visible={zichtbaar} animationType="slide" presentationStyle="pageSheet" onRequestClose={onSluiten}>
      <View style={styles.modalWrapper}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitel}>Deelnemers</Text>
          <Pressable onPress={onSluiten} hitSlop={12}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalLijst}>
          {leden.map(lid => (
            <View key={lid.userId} style={styles.lidRij}>
              <Avatar url={lid.avatarUrl} naam={lid.naam} size={44} />
              <Text style={styles.lidNaam}>{lid.naam}</Text>
              {lid.userId !== mijnUserId && (
                <Pressable
                  style={styles.dmKnop}
                  onPress={() => onDm(lid)}
                >
                  <Ionicons name="chatbubble-outline" size={15} color={COLORS.secondary} />
                  <Text style={styles.dmTekst}>Stuur bericht</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

// ── Hoofd scherm ──────────────────────────────────────────────────────────────

export default function ChatroomScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>()
  const { top, bottom } = useSafeAreaInsets()
  const [kanaal, setKanaal] = useState<StreamChannel | null>(null)
  const [loading, setLoading] = useState(true)
  const [fout, setFout] = useState<string | null>(null)
  const [ledenOpen, setLedenOpen] = useState(false)
  const [leden, setLeden] = useState<Lid[]>([])
  const [dmBezig, setDmBezig] = useState(false)
  const mijnUserIdRef = useRef<string | null>(null)
  const anderePersoonRef = useRef<Lid | null>(null)
  const verbonden = useRef(false)

  const isGroepsChat = channelId?.startsWith('match-')

  useEffect(() => {
    verbindEnLaad()
    return () => {
      if (verbonden.current) {
        streamClient.disconnectUser().catch(() => { })
        verbonden.current = false
      }
    }
  }, [channelId])

  async function verbindEnLaad() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Niet ingelogd')
      mijnUserIdRef.current = user.id

      if (!streamClient.userID) {
        const { data: profiel } = await supabase
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', user.id)
          .single()

        await verbindStream(user.id, profiel?.name ?? 'Gebruiker', profiel?.avatar_url ?? null)
        verbonden.current = true
      }

      const channel = streamClient.channel('messaging', channelId)
      await channel.watch()
      setKanaal(channel)

      await laadLeden(channel)
    } catch (e) {
      console.error('Stream Chat fout:', e)
      setFout('Kon de chat niet laden. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  async function laadLeden(channel: StreamChannel) {
    const memberIds = Object.keys(channel.state.members ?? {})
    if (memberIds.length === 0) return

    const { data: profielen } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', memberIds)

    setLeden((profielen ?? []).map(p => ({
      userId: p.id,
      naam: p.name,
      avatarUrl: p.avatar_url,
    })))
  }

  async function startDm(lid: Lid) {
    if (!mijnUserIdRef.current || dmBezig) return
    setDmBezig(true)
    setLedenOpen(false)
    try {
      const dmChannelId = await getOrCreateDm(mijnUserIdRef.current, lid.userId)
      router.push(`/chatroom/${dmChannelId}`)
    } catch (e) {
      console.error('DM aanmaken mislukt:', e)
    } finally {
      setDmBezig(false)
    }
  }

  function openActiemenu() {
    if (!anderePersoonRef.current) return
    const naam = anderePersoonRef.current.naam
    Alert.alert(naam, undefined, [
      {
        text: 'Rapporteer',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Rapporteer',
          `Waarom wil je ${naam} rapporteren?`,
          [
            { text: 'Ongepast gedrag', onPress: () => verstuurRapport('ongepast_gedrag') },
            { text: 'Spam', onPress: () => verstuurRapport('spam') },
            { text: 'Annuleer', style: 'cancel' },
          ],
        ),
      },
      {
        text: 'Blokkeer',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Blokkeer',
          `Weet je zeker dat je ${naam} wilt blokkeren? Je ziet dan elkaars berichten niet meer.`,
          [
            { text: 'Annuleer', style: 'cancel' },
            { text: 'Blokkeer', style: 'destructive', onPress: voerBlokkeringUit },
          ],
        ),
      },
      { text: 'Annuleer', style: 'cancel' },
    ])
  }

  async function verstuurRapport(reden: string) {
    if (!anderePersoonRef.current || !mijnUserIdRef.current) return
    await supabase.from('reports').insert({
      reporter_id: mijnUserIdRef.current,
      reported_id: anderePersoonRef.current.userId,
      reason: reden,
    })
    Alert.alert('Gemeld', 'We nemen je melding in behandeling. Dank je.')
  }

  async function voerBlokkeringUit() {
    if (!anderePersoonRef.current || !mijnUserIdRef.current) return
    await supabase.from('blocks').insert({
      blocker_id: mijnUserIdRef.current,
      blocked_id: anderePersoonRef.current.userId,
    })
    router.back()
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
        <Pressable style={styles.terugKnopPrimary} onPress={() => router.back()}>
          <Text style={styles.terugTekst}>Terug</Text>
        </Pressable>
      </View>
    )
  }

  const anderePersoon = !isGroepsChat
    ? leden.find(l => l.userId !== mijnUserIdRef.current) ?? null
    : null
  anderePersoonRef.current = anderePersoon

  const groepsNaam = isGroepsChat
    ? ((kanaal.data as { name?: string } | undefined)?.name ?? 'Groepschat')
    : (anderePersoon?.naam ?? 'Privégesprek')

  const aantalLeden = Object.keys(kanaal.state.members ?? {}).length

  return (
    <OverlayProvider>
      <View style={[styles.wrapper, { paddingTop: top }]}>
        <View style={styles.header}>
          <Pressable style={styles.terugRond} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={COLORS.secondary} />
          </Pressable>
          <Pressable
            style={styles.headerInfoRij}
            onPress={anderePersoon ? () => router.push(`/profiel/${anderePersoon.userId}`) : undefined}
            disabled={!anderePersoon}
          >
            {anderePersoon && (
              <Avatar url={anderePersoon.avatarUrl} naam={anderePersoon.naam} size={36} />
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitel} numberOfLines={1}>{groepsNaam}</Text>
              {isGroepsChat && (
                <Text style={styles.headerSub}>{aantalLeden} deelnemers</Text>
              )}
            </View>
          </Pressable>
          {isGroepsChat ? (
            <Pressable style={styles.ledenKnop} onPress={() => setLedenOpen(true)} hitSlop={8}>
              <Ionicons name="people-outline" size={22} color={COLORS.secondary} />
            </Pressable>
          ) : (
            <Pressable style={styles.ledenKnop} onPress={openActiemenu} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.secondary} />
            </Pressable>
          )}
        </View>

        <View style={{ flex: 1, paddingBottom: Math.max(0, bottom - 50) }}>
          <Chat client={streamClient}>
            <Channel channel={kanaal} keyboardVerticalOffset={top + 56}>
              <MessageList />
              <MessageComposer />
            </Channel>
          </Chat>
        </View>

        {isGroepsChat && (
          <LedenModal
            zichtbaar={ledenOpen}
            leden={leden}
            mijnUserId={mijnUserIdRef.current ?? ''}
            onSluiten={() => setLedenOpen(false)}
            onDm={startDm}
          />
        )}

        {dmBezig && (
          <View style={styles.dmOverlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.dmOverlayTekst}>Chat openen…</Text>
          </View>
        )}
      </View>
    </OverlayProvider>
  )
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#fff' },
  midden: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  terugRond: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  headerInfoRij: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerInfo: { flex: 1 },
  headerTitel: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textLight },
  ledenKnop: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },

  foutTekst: { fontSize: 15, color: COLORS.textLight, textAlign: 'center' },
  terugKnopPrimary: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  terugTekst: { fontSize: 15, fontWeight: '700', color: '#fff' },

  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitiaal: { fontWeight: '700', color: '#fff' },

  modalWrapper: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  modalTitel: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalLijst: { padding: 16, gap: 8 },
  lidRij: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  lidNaam: { flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.text },
  dmKnop: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: COLORS.secondary },
  dmTekst: { fontSize: 13, fontWeight: '600', color: COLORS.secondary },

  dmOverlay: { position: 'absolute', bottom: 40, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.75)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24 },
  dmOverlayTekst: { fontSize: 14, color: '#fff', fontWeight: '600' },
})
