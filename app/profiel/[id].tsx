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
import { verbindStream, getOrCreateDm } from '../../services/dm';
import { COLORS } from '../../constants/colors';

const ORANJE = COLORS.primary;

const INTERESSE_EMOJI: Record<string, string> = {
  uitgaan: '🕺', spelletjes: '🎲', evenement: '🎪', huisfeest: '🎵',
  feestje: '🎉', sport: '⚽', muziek: '🎸', film: '🎬',
  kunst: '🎨', reizen: '✈️', koken: '🍳', natuur: '🌿',
  gaming: '🎮', yoga: '🧘', fitness: '💪',
};

function interesseEmoji(i: string) { return INTERESSE_EMOJI[i.toLowerCase()] ?? '✨' }

interface ProfielData {
  id: string
  name: string
  age: number | null
  avatar_url: string | null
  bio: string | null
  trust_score: number | null
}

interface Vriendschap {
  id: string
  user_id: string
  friend_id: string
  status: 'pending' | 'accepted' | 'declined'
}

function TrustSterren({ score }: { score: number | null }) {
  if (score === null) return null
  const sterrenFloat = score / 2
  const vol = Math.floor(sterrenFloat)
  const half = (sterrenFloat - vol) >= 0.5 ? 1 : 0
  const leeg = 5 - vol - half
  return (
    <View style={styles.sterrenRij}>
      {Array.from({ length: vol }).map((_, i) => <Ionicons key={`v${i}`} name="star" size={16} color="#F59E0B" />)}
      {half === 1 && <Ionicons name="star-half" size={16} color="#F59E0B" />}
      {Array.from({ length: leeg }).map((_, i) => <Ionicons key={`l${i}`} name="star-outline" size={16} color="#D1D5DB" />)}
      <Text style={styles.scoreText}>{score.toFixed(1)}/10</Text>
    </View>
  )
}

export default function GebruikersProfielScreen() {
  const { id: profielId } = useLocalSearchParams<{ id: string }>()
  const { top } = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [actieBusy, setActieBusy] = useState(false)
  const [profiel, setProfiel] = useState<ProfielData | null>(null)
  const [interesses, setInteresses] = useState<string[]>([])
  const [mijnInteresses, setMijnInteresses] = useState<string[]>([])
  const [vriendschap, setVriendschap] = useState<Vriendschap | null>(null)
  const [mijnId, setMijnId] = useState<string | null>(null)

  useEffect(() => { laadAlles() }, [profielId])

  async function laadAlles() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profielId) { setLoading(false); return }
    setMijnId(user.id)

    const [profielRes, interessesRes, mijnInteressesRes, vriendschapRes] = await Promise.all([
      supabase.from('profiles').select('id, name, age, avatar_url, bio, trust_score').eq('id', profielId).single(),
      supabase.from('user_interests').select('interest').eq('user_id', profielId),
      supabase.from('user_interests').select('interest').eq('user_id', user.id),
      supabase.from('friendships').select('id, user_id, friend_id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${profielId}),and(user_id.eq.${profielId},friend_id.eq.${user.id})`)
        .maybeSingle(),
    ])

    if (profielRes.data) setProfiel(profielRes.data)
    setInteresses((interessesRes.data ?? []).map(r => r.interest))
    setMijnInteresses((mijnInteressesRes.data ?? []).map(r => r.interest))
    if (vriendschapRes.data) setVriendschap(vriendschapRes.data as Vriendschap)
    setLoading(false)
  }

  async function stuurVerzoek() {
    if (!mijnId || !profielId || actieBusy) return
    setActieBusy(true)
    const { data, error } = await supabase
      .from('friendships')
      .insert({ user_id: mijnId, friend_id: profielId, status: 'pending' })
      .select('id, user_id, friend_id, status')
      .single()
    if (!error && data) setVriendschap(data as Vriendschap)
    setActieBusy(false)
  }

  async function accepteerVerzoek() {
    if (!vriendschap || actieBusy) return
    setActieBusy(true)
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', vriendschap.id)
      .select('id, user_id, friend_id, status')
      .single()
    if (!error && data) setVriendschap(data as Vriendschap)
    setActieBusy(false)
  }

  async function openDm() {
    if (!mijnId || !profielId || actieBusy) return
    setActieBusy(true)
    try {
      const { data: mijnProfiel } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', mijnId)
        .single()
      await verbindStream(mijnId, mijnProfiel?.name ?? 'Gebruiker', mijnProfiel?.avatar_url ?? null)
      const channelId = await getOrCreateDm(mijnId, profielId)
      router.push(`/chatroom/${channelId}`)
    } catch (e) {
      console.error('DM openen mislukt:', e)
    } finally {
      setActieBusy(false)
    }
  }

  function renderActieKnop() {
    if (!vriendschap || vriendschap.status === 'declined') {
      return (
        <Pressable
          style={[styles.knopPrimair, actieBusy && styles.knopDisabled]}
          onPress={stuurVerzoek}
          disabled={actieBusy}
        >
          {actieBusy
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="person-add-outline" size={18} color="#fff" /><Text style={styles.knopTekstWit}>Vrienden worden</Text></>
          }
        </Pressable>
      )
    }

    if (vriendschap.status === 'pending') {
      if (vriendschap.user_id === mijnId) {
        return (
          <View style={[styles.knopPrimair, styles.knopDisabled]}>
            <Ionicons name="time-outline" size={18} color="#fff" />
            <Text style={styles.knopTekstWit}>Verzoek gestuurd</Text>
          </View>
        )
      }
      return (
        <Pressable
          style={[styles.knopPrimair, actieBusy && styles.knopDisabled]}
          onPress={accepteerVerzoek}
          disabled={actieBusy}
        >
          {actieBusy
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="checkmark-outline" size={18} color="#fff" /><Text style={styles.knopTekstWit}>Accepteer verzoek</Text></>
          }
        </Pressable>
      )
    }

    return (
      <Pressable
        style={[styles.knopSecundair, actieBusy && styles.knopDisabled]}
        onPress={openDm}
        disabled={actieBusy}
      >
        {actieBusy
          ? <ActivityIndicator color={COLORS.secondary} size="small" />
          : <><Ionicons name="chatbubble-outline" size={18} color={COLORS.secondary} /><Text style={styles.knopTekstSecundair}>Stuur bericht</Text></>
        }
      </Pressable>
    )
  }

  if (loading) {
    return (
      <View style={[styles.midden, { paddingTop: top }]}>
        <ActivityIndicator color={ORANJE} size="large" />
      </View>
    )
  }

  if (!profiel) {
    return (
      <View style={[styles.midden, { paddingTop: top }]}>
        <Ionicons name="alert-circle-outline" size={40} color={COLORS.textLight} />
        <Text style={styles.foutTekst}>Gebruiker niet gevonden</Text>
        <Pressable style={styles.knopPrimair} onPress={() => router.back()}>
          <Text style={styles.knopTekstWit}>Terug</Text>
        </Pressable>
      </View>
    )
  }

  const gedeeld = interesses.filter(i => mijnInteresses.includes(i))
  const overig = interesses.filter(i => !mijnInteresses.includes(i))

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.navHeader}>
        <Pressable style={styles.terugKnop} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.secondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrapper}>
          {profiel.avatar_url ? (
            <Image source={{ uri: profiel.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitiaal}>{profiel.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.profielKop}>
          <Text style={styles.naam}>
            {profiel.name}
            {profiel.age != null && <Text style={styles.leeftijd}> {profiel.age}</Text>}
          </Text>
          <TrustSterren score={profiel.trust_score} />
        </View>

        {profiel.bio ? <Text style={styles.bio}>{profiel.bio}</Text> : null}

        <View style={styles.knoppen}>{renderActieKnop()}</View>

        {interesses.length > 0 && (
          <View style={styles.sectie}>
            <View style={styles.sectieHeader}>
              <Text style={styles.sectieLabel}>Interesses</Text>
              {gedeeld.length > 0 && (
                <Text style={styles.gedeeldHint}>
                  {gedeeld.length} gemeen
                </Text>
              )}
            </View>
            <View style={styles.chipsGrid}>
              {[...gedeeld, ...overig].map(int => {
                const isGedeeld = mijnInteresses.includes(int)
                return (
                  <View key={int} style={[styles.chip, isGedeeld && styles.chipGedeeld]}>
                    <Text style={[styles.chipTekst, isGedeeld && styles.chipTekstGedeeld]}>
                      {interesseEmoji(int)} {int}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:      { flex: 1, backgroundColor: '#fff' },
  midden:       { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },

  navHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  terugKnop:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },

  scroll:       { paddingHorizontal: 24, paddingBottom: 48 },

  avatarWrapper: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  avatar:        { width: 120, height: 120, borderRadius: 60 },
  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitiaal: { fontSize: 48, fontWeight: '700', color: '#fff' },

  profielKop:   { alignItems: 'center', gap: 8, marginBottom: 12 },
  naam:         { fontSize: 26, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  leeftijd:     { fontSize: 26, fontWeight: '400', color: '#C7C7CC' },
  bio:          { fontSize: 15, color: COLORS.textLight, lineHeight: 22, textAlign: 'center', marginBottom: 20 },

  sterrenRij:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  scoreText:    { fontSize: 14, color: COLORS.textLight, marginLeft: 4 },

  knoppen:      { marginBottom: 28 },
  knopPrimair:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ORANJE, borderRadius: 14, paddingVertical: 14 },
  knopSecundair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F0EEFF', borderRadius: 14, paddingVertical: 14 },
  knopDisabled: { opacity: 0.6 },
  knopTekstWit: { fontSize: 16, fontWeight: '700', color: '#fff' },
  knopTekstSecundair: { fontSize: 16, fontWeight: '700', color: COLORS.secondary },

  sectie:       { gap: 12 },
  sectieHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectieLabel:  { fontSize: 16, fontWeight: '700', color: COLORS.text },
  gedeeldHint:  { fontSize: 13, fontWeight: '600', color: ORANJE },
  chipsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:         { backgroundColor: '#F2F2F7', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  chipGedeeld:  { backgroundColor: '#FFF3EE', borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)' },
  chipTekst:    { fontSize: 14, fontWeight: '500', color: COLORS.text },
  chipTekstGedeeld: { color: ORANJE },

  foutTekst:    { fontSize: 15, color: COLORS.textLight, textAlign: 'center' },
})
