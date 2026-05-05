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
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../services/supabase';
import { COLORS } from '../constants/colors';

interface VriendschapVerzoek {
  id: string
  user_id: string
  naam: string
  avatar_url: string | null
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

export default function MeldingenScreen() {
  const { top, bottom } = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [verzoeken, setVerzoeken] = useState<VriendschapVerzoek[]>([])
  const [actieBezig, setActieBezig] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => { laadVerzoeken() }, [])
  )

  async function laadVerzoeken() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: vriendschappen } = await supabase
      .from('friendships')
      .select('id, user_id')
      .eq('friend_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!vriendschappen || vriendschappen.length === 0) { setVerzoeken([]); setLoading(false); return }

    const senderIds = vriendschappen.map(v => v.user_id)
    const { data: profielen } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', senderIds)

    const profielMap = Object.fromEntries((profielen ?? []).map(p => [p.id, p]))

    setVerzoeken(vriendschappen.map(v => ({
      id: v.id,
      user_id: v.user_id,
      naam: profielMap[v.user_id]?.name ?? 'Onbekend',
      avatar_url: profielMap[v.user_id]?.avatar_url ?? null,
    })))
    setLoading(false)
  }

  async function accepteer(verzoekId: string) {
    setActieBezig(verzoekId)
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', verzoekId)
    if (!error) setVerzoeken(prev => prev.filter(v => v.id !== verzoekId))
    setActieBezig(null)
  }

  async function weiger(verzoekId: string) {
    setActieBezig(verzoekId)
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'declined' })
      .eq('id', verzoekId)
    if (!error) setVerzoeken(prev => prev.filter(v => v.id !== verzoekId))
    setActieBezig(null)
  }

  return (
    <View style={[styles.wrapper, { paddingTop: top, paddingBottom: bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </Pressable>
        <Text style={styles.titel}>Meldingen</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : verzoeken.length === 0 ? (
        <View style={styles.leegBlok}>
          <Ionicons name="notifications-outline" size={48} color="#C7C7CC" />
          <Text style={styles.leegTitel}>Geen nieuwe meldingen</Text>
          <Text style={styles.leegSubtitel}>
            Hier verschijnen vriendschapsverzoeken en andere updates.
          </Text>
        </View>
      ) : (
        <FlatList
          data={verzoeken}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.lijst}
          ListHeaderComponent={<Text style={styles.sectieKop}>Vriendschapsverzoeken</Text>}
          ItemSeparatorComponent={() => <View style={styles.scheidslijn} />}
          renderItem={({ item }) => (
            <View style={styles.verzoekRij}>
              <Pressable onPress={() => router.push(`/profiel/${item.user_id}`)}>
                <Avatar url={item.avatar_url} naam={item.naam} size={48} />
              </Pressable>
              <View style={styles.verzoekInfo}>
                <Text style={styles.verzoekNaam}>{item.naam}</Text>
                <Text style={styles.verzoekSub}>wil bevriend met je worden</Text>
              </View>
              <View style={styles.actieKnoppen}>
                <Pressable
                  style={[styles.accepteerKnop, actieBezig === item.id && styles.knopDisabled]}
                  onPress={() => accepteer(item.id)}
                  disabled={actieBezig === item.id}
                  accessibilityLabel="Accepteren"
                >
                  {actieBezig === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="checkmark" size={18} color="#fff" />
                  }
                </Pressable>
                <Pressable
                  style={[styles.weigerKnop, actieBezig === item.id && styles.knopDisabled]}
                  onPress={() => weiger(item.id)}
                  disabled={actieBezig === item.id}
                  accessibilityLabel="Weigeren"
                >
                  <Ionicons name="close" size={18} color={COLORS.textLight} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:    { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  titel:      { fontSize: 28, fontWeight: '700', color: COLORS.text },

  leegBlok:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  leegTitel:  { fontSize: 18, fontWeight: '700', color: COLORS.text },
  leegSubtitel: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 21 },

  lijst:       { paddingBottom: 24 },
  sectieKop:   { fontSize: 13, fontWeight: '600', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  scheidslijn: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginLeft: 60 },

  verzoekRij:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  verzoekInfo: { flex: 1 },
  verzoekNaam: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  verzoekSub:  { fontSize: 13, color: COLORS.textLight },

  actieKnoppen:  { flexDirection: 'row', gap: 8 },
  accepteerKnop: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  weigerKnop:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  knopDisabled:  { opacity: 0.5 },

  avatarFallback: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
})
