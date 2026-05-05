import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';

const ORANJE = COLORS.primary;

const INTERESSE_EMOJI: Record<string, string> = {
  uitgaan: '🕺', spelletjes: '🎲', evenement: '🎪', huisfeest: '🎵',
  feestje: '🎉', sport: '⚽', muziek: '🎸', film: '🎬',
  kunst: '🎨', reizen: '✈️', koken: '🍳', natuur: '🌿',
  gaming: '🎮', yoga: '🧘', fitness: '💪',
};

function interesseEmoji(i: string) { return INTERESSE_EMOJI[i.toLowerCase()] ?? '✨' }

interface Profiel {
  id: string
  name: string
  age: number | null
  avatar_url: string | null
  trust_score: number | null
  interesses: string[]
}

function Avatar({ url, naam, size }: { url: string | null; naam: string; size: number }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: '#fff' }}>
        {naam.charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

function TrustSterren({ score }: { score: number | null }) {
  if (score === null) return null
  const sterrenFloat = score / 2
  const vol = Math.floor(sterrenFloat)
  const half = (sterrenFloat - vol) >= 0.5 ? 1 : 0
  const leeg = 5 - vol - half
  return (
    <View style={styles.sterrenRij}>
      {Array.from({ length: vol }).map((_, i) => (
        <Ionicons key={`v${i}`} name="star" size={12} color="#F59E0B" />
      ))}
      {half === 1 && <Ionicons name="star-half" size={12} color="#F59E0B" />}
      {Array.from({ length: leeg }).map((_, i) => (
        <Ionicons key={`l${i}`} name="star-outline" size={12} color="#D1D5DB" />
      ))}
      <Text style={styles.scoreText}>{score.toFixed(1)}</Text>
    </View>
  )
}

export default function OntdekScreen() {
  const { top } = useSafeAreaInsets()
  const [zoekterm, setZoekterm] = useState('')
  const [resultaten, setResultaten] = useState<Profiel[]>([])
  const [loading, setLoading] = useState(false)
  const [mijnInteresses, setMijnInteresses] = useState<string[]>([])
  const [mijnId, setMijnId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    laadMijnProfiel()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  async function laadMijnProfiel() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMijnId(user.id)
    const { data } = await supabase
      .from('user_interests')
      .select('interest')
      .eq('user_id', user.id)
    setMijnInteresses((data ?? []).map(r => r.interest))
  }

  function onZoekChange(tekst: string) {
    setZoekterm(tekst)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!tekst.trim()) { setResultaten([]); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(() => zoek(tekst.trim()), 300)
  }

  async function zoek(naam: string) {
    const { data: profielen } = await supabase
      .from('profiles')
      .select('id, name, age, avatar_url, trust_score')
      .ilike('name', `%${naam}%`)
      .neq('id', mijnId ?? '')
      .limit(30)

    if (!profielen || profielen.length === 0) {
      setResultaten([])
      setLoading(false)
      return
    }

    const ids = profielen.map(p => p.id)
    const { data: interesses } = await supabase
      .from('user_interests')
      .select('user_id, interest')
      .in('user_id', ids)

    const interesseMap: Record<string, string[]> = {}
    for (const r of (interesses ?? [])) {
      if (!interesseMap[r.user_id]) interesseMap[r.user_id] = []
      interesseMap[r.user_id].push(r.interest)
    }

    setResultaten(profielen.map(p => ({ ...p, interesses: interesseMap[p.id] ?? [] })))
    setLoading(false)
  }

  function renderRij({ item }: { item: Profiel }) {
    const gedeeld = item.interesses.filter(i => mijnInteresses.includes(i))
    const overig = item.interesses.filter(i => !mijnInteresses.includes(i))
    const zichtbaar = [...gedeeld, ...overig].slice(0, 4)

    return (
      <Pressable
        style={({ pressed }) => [styles.rij, pressed && styles.rijGedrukt]}
        onPress={() => router.push(`/profiel/${item.id}`)}
      >
        <Avatar url={item.avatar_url} naam={item.name} size={56} />
        <View style={styles.rijInfo}>
          <View style={styles.naamRij}>
            <Text style={styles.naam}>{item.name}</Text>
            {item.age != null && <Text style={styles.leeftijd}> {item.age}</Text>}
          </View>
          <TrustSterren score={item.trust_score} />
          {zichtbaar.length > 0 && (
            <View style={styles.chips}>
              {zichtbaar.map(int => {
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
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
      </Pressable>
    )
  }

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitel}>Ontdek</Text>
      </View>

      <View style={styles.zoekBalkWrapper}>
        <Ionicons name="search" size={18} color={COLORS.textLight} style={styles.zoekIcoon} />
        <TextInput
          style={styles.zoekBalk}
          placeholder="Zoek op naam..."
          placeholderTextColor={COLORS.textLight}
          value={zoekterm}
          onChangeText={onZoekChange}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.midden}>
          <ActivityIndicator color={ORANJE} />
        </View>
      ) : zoekterm.trim() !== '' && resultaten.length === 0 ? (
        <View style={styles.midden}>
          <Text style={styles.geenResultatenTekst}>Geen gebruikers gevonden voor "{zoekterm}"</Text>
        </View>
      ) : zoekterm.trim() === '' ? (
        <View style={styles.midden}>
          <Ionicons name="people-outline" size={48} color="#C7C7CC" />
          <Text style={styles.leegTitel}>Vind mensen in Groningen</Text>
          <Text style={styles.leegSubtitel}>Typ een naam om andere gebruikers te zoeken.</Text>
        </View>
      ) : (
        <FlatList
          data={resultaten}
          keyExtractor={item => item.id}
          renderItem={renderRij}
          contentContainerStyle={styles.lijst}
          ItemSeparatorComponent={() => <View style={styles.scheidslijn} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:       { flex: 1, backgroundColor: '#fff' },
  header:        { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  headerTitel:   { fontSize: 28, fontWeight: '700', color: COLORS.text },

  zoekBalkWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7',
    borderRadius: 12, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, height: 44,
  },
  zoekIcoon:     { marginRight: 8 },
  zoekBalk:      { flex: 1, fontSize: 16, color: COLORS.text },

  midden:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  geenResultatenTekst: { fontSize: 15, color: COLORS.textLight, textAlign: 'center' },
  leegTitel:     { fontSize: 18, fontWeight: '700', color: COLORS.text },
  leegSubtitel:  { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 21 },

  lijst:         { paddingHorizontal: 16, paddingBottom: 24 },
  rij:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  rijGedrukt:    { opacity: 0.6 },
  rijInfo:       { flex: 1, gap: 4 },
  naamRij:       { flexDirection: 'row', alignItems: 'baseline' },
  naam:          { fontSize: 17, fontWeight: '600', color: COLORS.text },
  leeftijd:      { fontSize: 17, fontWeight: '400', color: '#C7C7CC' },

  sterrenRij:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  scoreText:     { fontSize: 11, color: COLORS.textLight, marginLeft: 3 },

  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip:          { backgroundColor: '#F2F2F7', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  chipGedeeld:   { backgroundColor: '#FFF3EE', borderWidth: 1, borderColor: 'rgba(255,107,53,0.3)' },
  chipTekst:     { fontSize: 12, fontWeight: '500', color: COLORS.text },
  chipTekstGedeeld: { color: ORANJE },

  scheidslijn:   { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginLeft: 80 },
  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
})
