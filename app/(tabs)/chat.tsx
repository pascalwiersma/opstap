import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
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

interface Lid {
  userId: string
  naam: string
  avatarUrl: string | null
}

interface MatchPreview {
  matchId: string
  groupChatId: string
  datum: string
  leden: Lid[]
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
          {lid.avatarUrl ? (
            <Image source={{ uri: lid.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitiaal}>
                {lid.naam.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
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
  const d = new Date(datum)
  const nu = new Date()
  const gisteren = new Date(nu)
  gisteren.setDate(nu.getDate() - 1)

  const isoVandaag = nu.toISOString().split('T')[0]
  const isoGisteren = gisteren.toISOString().split('T')[0]

  if (datum === isoVandaag) return <Text style={styles.datumChip}>Vanavond</Text>
  if (datum === isoGisteren) return <Text style={styles.datumChip}>Gisteren</Text>

  return (
    <Text style={styles.datumChip}>
      {d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
    </Text>
  )
}

export default function ChatScreen() {
  const { top } = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<MatchPreview[]>([])

  useFocusEffect(
    useCallback(() => {
      laadMatches()
    }, []),
  )

  async function laadMatches() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: mijnMatches } = await supabase
      .from('match_members')
      .select('match_id, matches!inner(id, status, date, group_chat_id)')
      .eq('user_id', user.id)
      .eq('response', 'accepted')
      .eq('matches.status', 'confirmed')

    if (!mijnMatches || mijnMatches.length === 0) {
      setMatches([])
      setLoading(false)
      return
    }

    const matchIds = mijnMatches.map(m => m.match_id)

    const { data: alleLeden } = await supabase
      .from('match_members')
      .select('match_id, user_id, response, profiles!inner(id, name, avatar_url)')
      .in('match_id', matchIds)
      .eq('response', 'accepted')

    const previews: MatchPreview[] = mijnMatches.map(m => {
      const matchData = m.matches as unknown as {
        id: string; status: string; date: string; group_chat_id: string
      }
      const leden: Lid[] = (alleLeden ?? [])
        .filter(l => l.match_id === m.match_id)
        .map(l => {
          const p = l.profiles as unknown as { id: string; name: string; avatar_url: string | null }
          return { userId: l.user_id, naam: p.name, avatarUrl: p.avatar_url }
        })

      return {
        matchId: matchData.id,
        groupChatId: matchData.group_chat_id,
        datum: matchData.date,
        leden,
      }
    })

    previews.sort((a, b) => b.datum.localeCompare(a.datum))
    setMatches(previews)
    setLoading(false)
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    )
  }

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitel}>Chats</Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.leegBlok}>
          <Ionicons name="chatbubbles-outline" size={48} color="#C7C7CC" />
          <Text style={styles.leegTitel}>Nog geen chats</Text>
          <Text style={styles.leegSubtitel}>
            Zodra jouw match bevestigd is, verschijnt hier de groepschat.
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={item => item.matchId}
          contentContainerStyle={styles.lijst}
          ItemSeparatorComponent={() => <View style={styles.scheidslijn} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.rij, pressed && styles.rijGedrukt]}
              onPress={() => router.push(`/chatroom/${item.groupChatId}`)}
            >
              <AvatarGroep leden={item.leden} />
              <View style={styles.rijInfo}>
                <Text style={styles.groepNaam}>
                  {item.leden.map(l => l.naam.split(' ')[0]).join(', ')}
                </Text>
                <Text style={styles.groepSub}>
                  {item.leden.length} mensen · <DatumLabel datum={item.datum} />
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:          { flex: 1, backgroundColor: '#fff' },
  container:        { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  header:           { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerTitel:      { fontSize: 28, fontWeight: '700', color: COLORS.text },

  lijst:            { paddingHorizontal: 16 },
  scheidslijn:      { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginLeft: 76 },

  rij:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  rijGedrukt:       { opacity: 0.6 },
  rijInfo:          { flex: 1, gap: 3 },
  groepNaam:        { fontSize: 16, fontWeight: '600', color: COLORS.text },
  groepSub:         { fontSize: 13, color: COLORS.textLight },

  avatarGroep:      { flexDirection: 'row', alignItems: 'center' },
  avatarRing:       { borderWidth: 2, borderColor: '#fff', borderRadius: 24 },
  avatar:           { width: 44, height: 44, borderRadius: 22 },
  avatarFallback:   { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitiaal:   { fontSize: 17, fontWeight: '700', color: '#fff' },
  avatarExtra:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  avatarExtraTekst: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },

  datumChip:        { color: COLORS.textLight },

  leegBlok:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  leegTitel:        { fontSize: 20, fontWeight: '700', color: COLORS.text },
  leegSubtitel:     { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 21 },
})
