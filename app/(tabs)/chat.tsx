import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { streamClient } from '../../services/stream';
import { verbindStream, getOrCreateDm } from '../../services/dm';
import { COLORS } from '../../constants/colors';
import { gisterenKalenderdagAmsterdam, kalenderdagAmsterdam } from '../../utils/nlDate';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lid {
  userId: string
  naam: string
  avatarUrl: string | null
}

interface GroepsChat {
  type: 'groep'
  matchId: string
  groupChatId: string
  datum: string
  leden: Lid[]
  lastMessage?: string
}

interface VriendChat {
  type: 'vriend'
  vriendschapId: string
  channelId: string | null
  anderePersoon: Lid
  lastMessage?: string
}

type ChatItem = GroepsChat | VriendChat

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

function AvatarGroep({ leden }: { leden: Lid[] }) {
  const zichtbaar = leden.slice(0, 4)
  return (
    <View style={styles.avatarGroep}>
      {zichtbaar.map((lid, i) => (
        <View
          key={lid.userId}
          style={[styles.avatarRing, { zIndex: zichtbaar.length - i, marginLeft: i === 0 ? 0 : -10 }]}
        >
          <Avatar url={lid.avatarUrl} naam={lid.naam} size={44} />
        </View>
      ))}
      {leden.length > 4 && (
        <View style={[styles.avatarRing, styles.avatarExtra, { marginLeft: -10 }]}>
          <Text style={styles.avatarExtraTekst}>+{leden.length - 4}</Text>
        </View>
      )}
    </View>
  )
}

function DatumLabel({ datum }: { datum: string }) {
  const [jy, jm, jd] = datum.split('-').map(Number)
  const d = new Date(jy, jm - 1, jd)
  const nu = new Date()
  const isoVandaag = kalenderdagAmsterdam(nu)
  const isoGisteren = gisterenKalenderdagAmsterdam(nu)
  if (datum === isoVandaag) return <Text style={styles.datumTekst}>Vanavond</Text>
  if (datum === isoGisteren) return <Text style={styles.datumTekst}>Gisteren</Text>
  return <Text style={styles.datumTekst}>{d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</Text>
}

// ── Hoofd component ───────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { top } = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [groepsChats, setGroepsChats] = useState<GroepsChat[]>([])
  const [vriendChats, setVriendChats] = useState<VriendChat[]>([])
  const [dmBezig, setDmBezig] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      laadAlles()
    }, []),
  )

  async function laadAlles() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [groeps] = await Promise.all([laadGroepsChats(user.id), laadVrienden(user.id)])
    setLoading(false)

    if (groeps && groeps.length > 0) {
      laadStreamPreviews(user.id, groeps).catch(() => {})
    }
  }

  async function laadGroepsChats(userId: string): Promise<GroepsChat[]> {
    const { data: mijnMatches } = await supabase
      .from('match_members')
      .select('match_id, matches!inner(id, status, date, group_chat_id)')
      .eq('user_id', userId)
      .eq('response', 'accepted')
      .eq('matches.status', 'confirmed')

    if (!mijnMatches || mijnMatches.length === 0) { setGroepsChats([]); return [] }

    const matchIds = mijnMatches.map(m => m.match_id)
    const { data: alleLeden } = await supabase
      .from('match_members')
      .select('match_id, user_id, profiles!inner(id, name, avatar_url)')
      .in('match_id', matchIds)
      .eq('response', 'accepted')

    const previews: GroepsChat[] = mijnMatches.map(m => {
      const matchData = m.matches as unknown as { id: string; date: string; group_chat_id: string }
      const leden: Lid[] = (alleLeden ?? [])
        .filter(l => l.match_id === m.match_id)
        .map(l => {
          const p = l.profiles as unknown as { id: string; name: string; avatar_url: string | null }
          return { userId: l.user_id, naam: p.name, avatarUrl: p.avatar_url }
        })
      return { type: 'groep', matchId: matchData.id, groupChatId: matchData.group_chat_id, datum: matchData.date, leden }
    })

    previews.sort((a, b) => b.datum.localeCompare(a.datum))
    setGroepsChats(previews)
    return previews
  }

  async function laadStreamPreviews(userId: string, groeps: GroepsChat[]) {
    const chatIds = groeps.map(g => g.groupChatId).filter(Boolean)
    if (chatIds.length === 0) return

    const { data: profiel } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', userId)
      .single()

    await verbindStream(userId, profiel?.name ?? 'Gebruiker', profiel?.avatar_url ?? null)

    const channels = await streamClient.queryChannels(
      { type: 'messaging', id: { $in: chatIds } },
      {},
      { message_limit: 1, state: true },
    )

    const lastMessageMap: Record<string, string> = {}
    for (const ch of channels) {
      const msgs = ch.state.messages
      if (msgs && msgs.length > 0) {
        const last = msgs[msgs.length - 1]
        if (last.text) lastMessageMap[ch.id!] = last.text
      }
    }

    if (Object.keys(lastMessageMap).length > 0) {
      setGroepsChats(prev => prev.map(g => ({
        ...g,
        lastMessage: lastMessageMap[g.groupChatId] ?? g.lastMessage,
      })))
    }
  }

  async function laadVrienden(userId: string) {
    const { data: vriendschappen } = await supabase
      .from('friendships')
      .select('id, user_id, friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted')

    if (!vriendschappen || vriendschappen.length === 0) { setVriendChats([]); return }

    const vriendIds = vriendschappen.map(v => v.user_id === userId ? v.friend_id : v.user_id)

    const [profielenRes, dmsRes] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url').in('id', vriendIds),
      supabase.from('direct_messages').select('user1_id, user2_id, stream_channel_id')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
    ])

    const profielMap = Object.fromEntries((profielenRes.data ?? []).map(p => [p.id, p]))
    const dmMap: Record<string, string> = {}
    for (const dm of (dmsRes.data ?? [])) {
      const andereId = dm.user1_id === userId ? dm.user2_id : dm.user1_id
      dmMap[andereId] = dm.stream_channel_id
    }

    const previews: VriendChat[] = vriendschappen.map(v => {
      const andereId = v.user_id === userId ? v.friend_id : v.user_id
      const p = profielMap[andereId]
      return {
        type: 'vriend',
        vriendschapId: v.id,
        channelId: dmMap[andereId] ?? null,
        anderePersoon: { userId: andereId, naam: p?.name ?? 'Onbekend', avatarUrl: p?.avatar_url ?? null },
      }
    })

    setVriendChats(previews)
  }

  if (loading) {
    return (
      <View style={[styles.midden, { paddingTop: top }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  const leeg = groepsChats.length === 0 && vriendChats.length === 0

  const secties = [
    ...(groepsChats.length > 0 ? [{ title: 'Groepsavonden', data: groepsChats as ChatItem[] }] : []),
    ...(vriendChats.length > 0 ? [{ title: 'Vrienden', data: vriendChats as ChatItem[] }] : []),
  ]

  async function openVriendChat(item: VriendChat) {
    if (dmBezig) return
    if (item.channelId) { router.push(`/chatroom/${item.channelId}`); return }
    setDmBezig(item.vriendschapId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: mijnProfiel } = await supabase
        .from('profiles').select('name, avatar_url').eq('id', user.id).single()
      await verbindStream(user.id, mijnProfiel?.name ?? 'Gebruiker', mijnProfiel?.avatar_url ?? null)
      const channelId = await getOrCreateDm(user.id, item.anderePersoon.userId)
      setVriendChats(prev => prev.map(v =>
        v.vriendschapId === item.vriendschapId ? { ...v, channelId } : v
      ))
      router.push(`/chatroom/${channelId}`)
    } catch (e) {
      console.error('DM openen mislukt:', e)
    } finally {
      setDmBezig(null)
    }
  }

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitel}>Chats</Text>
      </View>

      {leeg ? (
        <View style={styles.leegBlok}>
          <Ionicons name="chatbubbles-outline" size={48} color="#C7C7CC" />
          <Text style={styles.leegTitel}>Nog geen chats</Text>
          <Text style={styles.leegSubtitel}>
            Zodra jouw match bevestigd is, verschijnt hier de groepschat. Voeg vrienden toe via Ontdek om privé te chatten.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={secties}
          keyExtractor={item => item.type === 'groep' ? item.matchId : item.vriendschapId}
          contentContainerStyle={styles.lijst}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectieKop}>{section.title}</Text>
          )}
          ItemSeparatorComponent={() => <View style={styles.scheidslijn} />}
          renderItem={({ item }) => {
            if (item.type === 'groep') {
              return (
                <Pressable
                  style={({ pressed }) => [styles.rij, pressed && styles.rijGedrukt]}
                  onPress={() => router.push(`/chatroom/${item.groupChatId}`)}
                >
                  <AvatarGroep leden={item.leden} />
                  <View style={styles.rijInfo}>
                    <Text style={styles.naam} numberOfLines={1}>Vanavond in Groningen</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {item.leden.map(l => l.naam.split(' ')[0]).join(', ')} · <DatumLabel datum={item.datum} />
                    </Text>
                    {item.lastMessage ? (
                      <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                </Pressable>
              )
            }

            const bezig = dmBezig === item.vriendschapId
            return (
              <Pressable
                style={({ pressed }) => [styles.rij, pressed && styles.rijGedrukt]}
                onPress={() => openVriendChat(item)}
                disabled={bezig}
              >
                <View style={styles.avatarRing}>
                  <Avatar url={item.anderePersoon.avatarUrl} naam={item.anderePersoon.naam} size={44} />
                </View>
                <View style={styles.rijInfo}>
                  <Text style={styles.naam}>{item.anderePersoon.naam}</Text>
                  {item.lastMessage
                    ? <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
                    : <Text style={styles.sub}>Tik om een bericht te sturen</Text>
                  }
                </View>
                {bezig
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                }
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:          { flex: 1, backgroundColor: '#fff' },
  midden:           { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  header:           { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerTitel:      { fontSize: 28, fontWeight: '700', color: COLORS.text },

  lijst:            { paddingHorizontal: 16, paddingBottom: 24 },
  sectieKop:        { fontSize: 13, fontWeight: '600', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 4 },
  scheidslijn:      { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginLeft: 68 },

  rij:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  rijGedrukt:       { opacity: 0.6 },
  rijInfo:          { flex: 1, gap: 3 },
  naam:             { fontSize: 16, fontWeight: '600', color: COLORS.text },
  sub:              { fontSize: 13, color: COLORS.textLight },
  preview:          { fontSize: 13, color: COLORS.textLight, opacity: 0.7 },

  avatarGroep:      { flexDirection: 'row', alignItems: 'center' },
  avatarRing:       { borderWidth: 2, borderColor: '#fff', borderRadius: 24 },
  avatarFallback:   { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitiaal:   { fontWeight: '700', color: '#fff' },
  avatarExtra:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  avatarExtraTekst: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },

  datumTekst:       { color: COLORS.textLight },

  leegBlok:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  leegTitel:        { fontSize: 20, fontWeight: '700', color: COLORS.text },
  leegSubtitel:     { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 21 },
})
