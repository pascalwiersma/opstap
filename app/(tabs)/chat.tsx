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
}

interface PriveChat {
  type: 'prive'
  dmId: string
  channelId: string
  anderePersoon: Lid
  aangemaakt: string | null
}

type ChatItem = GroepsChat | PriveChat

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
  const [priveChats, setPriveChats] = useState<PriveChat[]>([])

  useFocusEffect(
    useCallback(() => {
      laadAlles()
    }, []),
  )

  async function laadAlles() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    await Promise.all([laadGroepsChats(user.id), laadPriveChats(user.id)])
    setLoading(false)
  }

  async function laadGroepsChats(userId: string) {
    const { data: mijnMatches } = await supabase
      .from('match_members')
      .select('match_id, matches!inner(id, status, date, group_chat_id)')
      .eq('user_id', userId)
      .eq('response', 'accepted')
      .eq('matches.status', 'confirmed')

    if (!mijnMatches || mijnMatches.length === 0) { setGroepsChats([]); return }

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
  }

  async function laadPriveChats(userId: string) {
    const { data: dms } = await supabase
      .from('direct_messages')
      .select('id, user1_id, user2_id, stream_channel_id, created_at')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (!dms || dms.length === 0) { setPriveChats([]); return }

    const anderIds = dms.map(d => d.user1_id === userId ? d.user2_id : d.user1_id)
    const { data: profielen } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', anderIds)

    const profielMap = Object.fromEntries((profielen ?? []).map(p => [p.id, p]))

    const previews: PriveChat[] = dms.map(d => {
      const andereId = d.user1_id === userId ? d.user2_id : d.user1_id
      const p = profielMap[andereId]
      return {
        type: 'prive',
        dmId: d.id,
        channelId: d.stream_channel_id,
        anderePersoon: { userId: andereId, naam: p?.name ?? 'Onbekend', avatarUrl: p?.avatar_url ?? null },
        aangemaakt: d.created_at,
      }
    })

    setPriveChats(previews)
  }

  if (loading) {
    return (
      <View style={[styles.midden, { paddingTop: top }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  const leeg = groepsChats.length === 0 && priveChats.length === 0

  const secties = [
    ...(groepsChats.length > 0 ? [{ title: 'Groepsavonden', data: groepsChats as ChatItem[] }] : []),
    ...(priveChats.length > 0 ? [{ title: 'Privéchats', data: priveChats as ChatItem[] }] : []),
  ]

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
            Zodra jouw match bevestigd is, verschijnt hier de groepschat. Je kunt vanuit een groepschat ook privé chatten.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={secties}
          keyExtractor={item => item.type === 'groep' ? item.matchId : item.dmId}
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
                    <Text style={styles.naam} numberOfLines={1}>
                      {item.leden.map(l => l.naam.split(' ')[0]).join(', ')}
                    </Text>
                    <Text style={styles.sub}>
                      {item.leden.length} mensen · <DatumLabel datum={item.datum} />
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
                </Pressable>
              )
            }

            return (
              <Pressable
                style={({ pressed }) => [styles.rij, pressed && styles.rijGedrukt]}
                onPress={() => router.push(`/chatroom/${item.channelId}`)}
              >
                <View style={styles.avatarRing}>
                  <Avatar url={item.anderePersoon.avatarUrl} naam={item.anderePersoon.naam} size={44} />
                </View>
                <View style={styles.rijInfo}>
                  <Text style={styles.naam}>{item.anderePersoon.naam}</Text>
                  <Text style={styles.sub}>Privégesprek</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
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
