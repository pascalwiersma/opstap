import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { kalenderdagAmsterdam } from '../../utils/nlDate';

const ORANJE = COLORS.primary;

type MatchStatus = 'proposed' | 'confirmed' | 'cancelled'
type CheckInStatus = 'active' | 'matched' | 'cancelled'

interface ActieveMatch {
  matchId: string
  status: MatchStatus
  aantalLeden: number
}

interface CheckInInfo {
  status: CheckInStatus
}

export default function OntdekScreen() {
  const { top, bottom } = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [match, setMatch] = useState<ActieveMatch | null>(null)
  const [checkIn, setCheckIn] = useState<CheckInInfo | null>(null)

  const today = kalenderdagAmsterdam()

  useEffect(() => {
    laadStatus()
  }, [])

  async function laadStatus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [matchRes, checkInRes] = await Promise.all([
      // Zoek actieve match via match_members
      supabase
        .from('match_members')
        .select('match_id, matches!inner(id, status, date)')
        .eq('user_id', user.id)
        .in('matches.status', ['proposed', 'confirmed'])
        .eq('matches.date', today)
        .maybeSingle(),
      // Huidige check-in
      supabase
        .from('check_ins')
        .select('status')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle(),
    ])

    if (matchRes.data?.match_id) {
      const matchId = matchRes.data.match_id
      const matchData = matchRes.data.matches as unknown as { id: string; status: MatchStatus }

      // Haal ledenaantal op
      const { count } = await supabase
        .from('match_members')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', matchId)

      setMatch({ matchId, status: matchData.status, aantalLeden: count ?? 0 })
    }

    if (checkInRes.data) {
      setCheckIn({ status: checkInRes.data.status as CheckInStatus })
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <ActivityIndicator color={ORANJE} />
      </View>
    )
  }

  // ── Actieve match ─────────────────────────────────────────────────────────
  if (match) {
    const isBevestigd = match.status === 'confirmed'
    return (
      <View style={[styles.container, { paddingTop: top, paddingBottom: bottom + 80 }]}>
        <View style={styles.matchKaart}>
          <View style={[styles.matchBadge, isBevestigd && styles.matchBadgeGroen]}>
            <Ionicons
              name={isBevestigd ? 'checkmark-circle' : 'people'}
              size={20}
              color="#fff"
            />
            <Text style={styles.matchBadgeTekst}>
              {isBevestigd ? 'Match bevestigd!' : 'Match gevonden'}
            </Text>
          </View>

          <Text style={styles.matchTitel}>
            {isBevestigd
              ? 'Jullie gaan vanavond uit! 🎉'
              : 'Er zijn mensen gevonden die ook uit willen!'}
          </Text>

          <Text style={styles.matchSubtitel}>
            {isBevestigd
              ? `${match.aantalLeden} mensen gaan vanavond de stad in. De groepschat staat klaar.`
              : `Een groepje van ${match.aantalLeden} mensen wacht op jouw reactie.`}
          </Text>

          <Pressable
            style={styles.matchKnop}
            onPress={() =>
              isBevestigd
                ? router.push('/(tabs)/chat')
                : router.push(`/match/${match.matchId}`)
            }
          >
            <Text style={styles.matchKnopTekst}>
              {isBevestigd ? 'Naar de groepschat' : 'Bekijk je match'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    )
  }

  // ── Ingecheckt maar nog geen match ────────────────────────────────────────
  if (checkIn?.status === 'active') {
    return (
      <View style={[styles.container, { paddingTop: top, paddingBottom: bottom + 80 }]}>
        <View style={styles.zoekBlok}>
          <ActivityIndicator size="large" color={ORANJE} />
          <Text style={styles.zoekTitel}>Aan het zoeken...</Text>
          <Text style={styles.zoekSubtitel}>
            We zijn op zoek naar mensen die bij jou passen. Om 22:00 weet je met wie je vanavond uit gaat.
          </Text>
        </View>
      </View>
    )
  }

  // ── Nog niet ingecheckt ───────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bottom + 80 }]}>
      <View style={styles.leegBlok}>
        <Ionicons name="flash-outline" size={48} color="#C7C7CC" />
        <Text style={styles.leegTitel}>Nog niet ingecheckt</Text>
        <Text style={styles.leegSubtitel}>
          Tik op de oranje knop onderaan om je in te checken voor vanavond.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  // Match kaart
  matchKaart:      { width: '100%', backgroundColor: '#FFF8F5', borderRadius: 20, padding: 24, gap: 14, borderWidth: 1, borderColor: 'rgba(255,107,53,0.15)' },
  matchBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ORANJE, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  matchBadgeGroen: { backgroundColor: '#22C55E' },
  matchBadgeTekst: { fontSize: 13, fontWeight: '700', color: '#fff' },
  matchTitel:      { fontSize: 20, fontWeight: '700', color: COLORS.text, lineHeight: 26 },
  matchSubtitel:   { fontSize: 14, color: COLORS.textLight, lineHeight: 21 },
  matchKnop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: ORANJE, borderRadius: 14, paddingVertical: 16 },
  matchKnopTekst:  { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Zoekend
  zoekBlok:        { alignItems: 'center', gap: 16 },
  zoekTitel:       { fontSize: 20, fontWeight: '700', color: COLORS.text },
  zoekSubtitel:    { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 21 },

  // Leeg
  leegBlok:        { alignItems: 'center', gap: 12 },
  leegTitel:       { fontSize: 20, fontWeight: '700', color: COLORS.text },
  leegSubtitel:    { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 21 },
})
