import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';

const ORANJE = COLORS.primary;
const PAARS = COLORS.secondary;

type Reactie = 'pending' | 'accepted' | 'declined';

interface Lid {
  memberId: string
  userId: string
  naam: string
  leeftijd: number | null
  avatarUrl: string | null
  interesses: string[]
  response: Reactie
}

type MatchStatus = 'proposed' | 'confirmed' | 'cancelled' | 'completed'

// ── Helpers ──────────────────────────────────────────────────────────────────

function Initialen({ naam, size }: { naam: string; size: number }) {
  const init = naam.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <View style={[styles.avatarPlaat, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitialen, { fontSize: size * 0.35 }]}>{init}</Text>
    </View>
  )
}

function Avatar({ url, naam, size }: { url: string | null; naam: string; size: number }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  return <Initialen naam={naam} size={size} />
}

function ReactieBadge({ response }: { response: Reactie }) {
  if (response === 'accepted') return (
    <View style={styles.badgeGroen}><Ionicons name="checkmark" size={10} color="#fff" /></View>
  )
  if (response === 'declined') return (
    <View style={styles.badgeRood}><Ionicons name="close" size={10} color="#fff" /></View>
  )
  return <View style={styles.badgeGrijs} />
}

// ── Hoofd scherm ─────────────────────────────────────────────────────────────

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { top, bottom } = useSafeAreaInsets()

  const [ikUserId, setIkUserId] = useState<string | null>(null)
  const [mijnInteresses, setMijnInteresses] = useState<string[]>([])
  const [leden, setLeden] = useState<Lid[]>([])
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('proposed')
  const [groupChatId, setGroupChatId] = useState<string | null>(null)
  const [mijnResponse, setMijnResponse] = useState<Reactie>('pending')
  const [loading, setLoading] = useState(true)
  const [bezig, setBezig] = useState(false)

  // ── Data laden ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    laadMatch()
  }, [id])

  async function laadMatch() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setIkUserId(user.id)

    const [matchRes, membersRes, mijnInteressesRes] = await Promise.all([
      supabase.from('matches').select('id, status, group_chat_id').eq('id', id).single(),
      supabase.from('match_members').select('id, user_id, response').eq('match_id', id),
      supabase.from('user_interests').select('interest').eq('user_id', user.id),
    ])

    if (matchRes.data) {
      setMatchStatus(matchRes.data.status as MatchStatus)
      setGroupChatId(matchRes.data.group_chat_id)
    }

    const eigenInteresses = (mijnInteressesRes.data ?? []).map(r => r.interest)
    setMijnInteresses(eigenInteresses)

    const members = membersRes.data ?? []
    const userIds = members.map(m => m.user_id)

    const [profielRes, interesseRes] = await Promise.all([
      supabase.from('profiles').select('id, name, avatar_url, age').in('id', userIds),
      supabase.from('user_interests').select('user_id, interest').in('user_id', userIds),
    ])

    const interesseMap: Record<string, string[]> = {}
    for (const r of interesseRes.data ?? []) {
      if (!interesseMap[r.user_id]) interesseMap[r.user_id] = []
      interesseMap[r.user_id].push(r.interest)
    }

    const ledenData: Lid[] = members.map(m => {
      const profiel = (profielRes.data ?? []).find(p => p.id === m.user_id)
      return {
        memberId: m.id,
        userId: m.user_id,
        naam: profiel?.name ?? 'Onbekend',
        leeftijd: profiel?.age ?? null,
        avatarUrl: profiel?.avatar_url ?? null,
        interesses: interesseMap[m.user_id] ?? [],
        response: m.response as Reactie,
      }
    })

    setLeden(ledenData)

    const eigen = members.find(m => m.user_id === user.id)
    if (eigen) setMijnResponse(eigen.response as Reactie)

    setLoading(false)
  }

  // ── Realtime subscription ────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return

    const kanaal = supabase
      .channel(`match-detail-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
        (payload) => {
          const nieuweStatus = payload.new.status as MatchStatus
          setMatchStatus(nieuweStatus)
          setGroupChatId(payload.new.group_chat_id ?? null)
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'match_members', filter: `match_id=eq.${id}` },
        (payload) => {
          setLeden(prev =>
            prev.map(l =>
              l.memberId === payload.new.id
                ? { ...l, response: payload.new.response as Reactie }
                : l,
            ),
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(kanaal) }
  }, [id])

  // Automatisch navigeren naar chat zodra match bevestigd is
  useEffect(() => {
    if (matchStatus === 'confirmed' && mijnResponse === 'accepted') {
      router.replace('/(tabs)/chat')
    }
  }, [matchStatus, mijnResponse])

  // ── Reageren ─────────────────────────────────────────────────────────────

  async function reageer(response: 'accepted' | 'declined') {
    if (!ikUserId || bezig) return
    setBezig(true)

    const eigen = leden.find(l => l.userId === ikUserId)
    if (!eigen) { setBezig(false); return }

    const { error } = await supabase
      .from('match_members')
      .update({ response, responded_at: new Date().toISOString() })
      .eq('id', eigen.memberId)

    if (!error) {
      setMijnResponse(response)
      setLeden(prev => prev.map(l => l.userId === ikUserId ? { ...l, response } : l))
    }
    setBezig(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.wrapper, { paddingTop: top }]}>
        <ActivityIndicator color={ORANJE} style={{ marginTop: 60 }} />
      </View>
    )
  }

  const andereLeden = leden.filter(l => l.userId !== ikUserId)

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.terugKnop} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={PAARS} />
        </Pressable>
        <Text style={styles.headerTitel}>Je match voor vanavond</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.inhoud, { paddingBottom: bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar rij */}
        <View style={styles.avatarRij}>
          {andereLeden.map(lid => (
            <View key={lid.userId} style={styles.avatarWrapper}>
              <Avatar url={lid.avatarUrl} naam={lid.naam} size={72} />
              <ReactieBadge response={lid.response} />
            </View>
          ))}
        </View>

        {/* Ledenprofiel cards */}
        {andereLeden.map(lid => {
          const gedeeld = lid.interesses.filter(i => mijnInteresses.includes(i))
          const overig = lid.interesses.filter(i => !mijnInteresses.includes(i))

          return (
            <View key={lid.userId} style={styles.lidKaart}>
              <View style={styles.lidHeader}>
                <Avatar url={lid.avatarUrl} naam={lid.naam} size={48} />
                <View style={styles.lidInfo}>
                  <View style={styles.naamRij}>
                    <Text style={styles.naamVet}>{lid.naam}</Text>
                    {lid.leeftijd != null && (
                      <Text style={styles.leeftijd}> {lid.leeftijd}</Text>
                    )}
                  </View>
                  <ReactieLabel response={lid.response} />
                </View>
              </View>

              {lid.interesses.length > 0 && (
                <View style={styles.chipsRij}>
                  {gedeeld.map(i => (
                    <View key={i} style={styles.chipGedeeld}>
                      <Text style={styles.chipGedeeldTekst}>{i}</Text>
                    </View>
                  ))}
                  {overig.map(i => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipTekst}>{i}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </ScrollView>

      {/* Onderste actie zone */}
      <View style={[styles.actieZone, { paddingBottom: bottom + 16 }]}>
        {mijnResponse === 'pending' && (
          <>
            <Pressable
              style={[styles.komKnop, bezig && styles.knopDisabled]}
              onPress={() => reageer('accepted')}
              disabled={bezig}
            >
              {bezig
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.komTekst}>Ik kom! 🎉</Text>}
            </Pressable>
            <Pressable
              style={styles.nietKnop}
              onPress={() => reageer('declined')}
              disabled={bezig}
            >
              <Text style={styles.nietTekst}>Toch niet</Text>
            </Pressable>
          </>
        )}

        {mijnResponse === 'accepted' && (
          <View style={styles.bevestigingBlok}>
            <Ionicons name="checkmark-circle" size={36} color={ORANJE} />
            <Text style={styles.bevestigingTitel}>Goed zo!</Text>
            <Text style={styles.bevestigingSubtitel}>
              We wachten op de anderen. Je hoort het zodra iedereen heeft gereageerd.
            </Text>
          </View>
        )}

        {mijnResponse === 'declined' && (
          <View style={styles.bevestigingBlok}>
            <Ionicons name="heart-outline" size={36} color={COLORS.textLight} />
            <Text style={styles.bevestigingTitel}>Geen probleem.</Text>
            <Text style={styles.bevestigingSubtitel}>
              We hopen je een volgende keer te zien!
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

function ReactieLabel({ response }: { response: Reactie }) {
  if (response === 'accepted') return <Text style={styles.reactieAceppteerd}>Komt!</Text>
  if (response === 'declined') return <Text style={styles.reactieGeweigerd}>Kan niet</Text>
  return <Text style={styles.reactieWacht}>Nog niet gereageerd</Text>
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper:           { flex: 1, backgroundColor: '#fff' },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  terugKnop:         { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  headerTitel:       { fontSize: 17, fontWeight: '700', color: COLORS.text },

  inhoud:            { paddingHorizontal: 16, gap: 16, paddingTop: 8 },

  avatarRij:         { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 8 },
  avatarWrapper:     { position: 'relative' },
  avatarPlaat:       { backgroundColor: ORANJE, alignItems: 'center', justifyContent: 'center' },
  avatarInitialen:   { color: '#fff', fontWeight: '700' },
  badgeGroen:        { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeRood:         { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeGrijs:        { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#D1D5DB', borderWidth: 2, borderColor: '#fff' },

  lidKaart:          { backgroundColor: '#F9F9F9', borderRadius: 16, padding: 16, gap: 12 },
  lidHeader:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lidInfo:           { flex: 1 },
  naamRij:           { flexDirection: 'row', alignItems: 'baseline' },
  naamVet:           { fontSize: 17, fontWeight: '700', color: COLORS.text },
  leeftijd:          { fontSize: 17, color: '#C7C7CC' },
  reactieAceppteerd: { fontSize: 13, color: '#22C55E', fontWeight: '600' },
  reactieGeweigerd:  { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  reactieWacht:      { fontSize: 13, color: COLORS.textLight },

  chipsRij:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipGedeeld:       { backgroundColor: ORANJE, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipGedeeldTekst:  { fontSize: 13, fontWeight: '600', color: '#fff' },
  chip:              { backgroundColor: '#EFEFEF', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipTekst:         { fontSize: 13, color: COLORS.text },

  actieZone:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)' },
  komKnop:           { backgroundColor: ORANJE, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  knopDisabled:      { opacity: 0.6 },
  komTekst:          { fontSize: 17, fontWeight: '700', color: '#fff' },
  nietKnop:          { alignItems: 'center', paddingVertical: 10 },
  nietTekst:         { fontSize: 15, color: COLORS.textLight, textDecorationLine: 'underline' },

  bevestigingBlok:   { alignItems: 'center', gap: 8, paddingVertical: 8 },
  bevestigingTitel:  { fontSize: 18, fontWeight: '700', color: COLORS.text },
  bevestigingSubtitel: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20 },
})
