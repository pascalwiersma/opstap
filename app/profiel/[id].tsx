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
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../services/supabase';
import { verbindStream, getOrCreateDm } from '../../services/dm';
import { StatsTab } from '../../components/StatsTab';
import { COLORS } from '../../constants/colors';

const PAARS = COLORS.secondary;

const INTERESSE_EMOJI: Record<string, string> = {
  'Housemuziek': '🎧', 'R&B': '🎵', 'Latin': '💃', 'Rock': '🎸', 'Pop': '🎤',
  'Terrasjes': '☀️', 'Pubquiz': '🧠', 'Cocktailbars': '🍹', 'Sportcafes': '⚽', 'Clubbing': '🕺',
  'Jazz': '🎷', 'Techno': '🔊', 'Indie': '🎼', 'Karaoke': '🎙️', 'Livemuziek': '🎶',
  kunst: '🎨', reizen: '✈️', koken: '🍳', natuur: '🌿', gaming: '🎮', yoga: '🧘', fitness: '💪',
};

function interesseEmoji(i: string) { return INTERESSE_EMOJI[i] ?? INTERESSE_EMOJI[i.toLowerCase()] ?? '✨'; }

const MAANDEN_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
function lidSindsTekst(created_at: string | null): string | null {
  if (!created_at) return null;
  const d = new Date(created_at);
  return `${MAANDEN_NL[d.getMonth()]} ${d.getFullYear()}`;
}

const TABS = ['Info', 'Stats'] as const;
type TabNaam = typeof TABS[number];

interface ProfielData {
  id: string; name: string; age: number | null; avatar_url: string | null;
  bio: string | null; trust_score: number | null; created_at: string | null;
  verification_status: string | null;
}

interface Vriendschap {
  id: string; user_id: string; friend_id: string; status: 'pending' | 'accepted' | 'declined';
}

export default function GebruikersProfielScreen() {
  const { id: profielId } = useLocalSearchParams<{ id: string }>();
  const { top, bottom } = useSafeAreaInsets();
  const [actieveTab, setActieveTab] = useState<TabNaam>('Info');
  const [loading, setLoading] = useState(true);
  const [actieBusy, setActieBusy] = useState(false);
  const [profiel, setProfiel] = useState<ProfielData | null>(null);
  const [interesses, setInteresses] = useState<string[]>([]);
  const [mijnInteresses, setMijnInteresses] = useState<string[]>([]);
  const [extraFotos, setExtraFotos] = useState<{ id: string; photo_url: string }[]>([]);
  const [vriendschap, setVriendschap] = useState<Vriendschap | null>(null);
  const [mijnId, setMijnId] = useState<string | null>(null);

  useEffect(() => { laadAlles(); }, [profielId]);

  async function laadAlles() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profielId) { setLoading(false); return; }
    setMijnId(user.id);

    const [profielRes, interessesRes, mijnIntRes, fotosRes, vriendRes] = await Promise.all([
      supabase.from('profiles')
        .select('id, name, age, avatar_url, bio, trust_score, created_at, verification_status')
        .eq('id', profielId).single(),
      supabase.from('user_interests').select('interest').eq('user_id', profielId),
      supabase.from('user_interests').select('interest').eq('user_id', user.id),
      supabase.from('profile_photos').select('id, photo_url').eq('user_id', profielId).order('position'),
      supabase.from('friendships').select('id, user_id, friend_id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${profielId}),and(user_id.eq.${profielId},friend_id.eq.${user.id})`)
        .maybeSingle(),
    ]);

    if (profielRes.data) setProfiel(profielRes.data);
    setInteresses((interessesRes.data ?? []).map(r => r.interest));
    setMijnInteresses((mijnIntRes.data ?? []).map(r => r.interest));
    if (fotosRes.data) setExtraFotos(fotosRes.data);
    if (vriendRes.data) setVriendschap(vriendRes.data as Vriendschap);
    setLoading(false);
  }

  async function stuurVerzoek() {
    if (!mijnId || !profielId || actieBusy) return;
    setActieBusy(true);
    const { data, error } = await supabase.from('friendships')
      .insert({ user_id: mijnId, friend_id: profielId, status: 'pending' })
      .select('id, user_id, friend_id, status').single();
    if (!error && data) setVriendschap(data as Vriendschap);
    setActieBusy(false);
  }

  async function accepteerVerzoek() {
    if (!vriendschap || actieBusy) return;
    setActieBusy(true);
    const { data, error } = await supabase.from('friendships')
      .update({ status: 'accepted' }).eq('id', vriendschap.id)
      .select('id, user_id, friend_id, status').single();
    if (!error && data) setVriendschap(data as Vriendschap);
    setActieBusy(false);
  }

  async function openDm() {
    if (!mijnId || !profielId || actieBusy) return;
    setActieBusy(true);
    try {
      const { data: mijnProfiel } = await supabase.from('profiles')
        .select('name, avatar_url').eq('id', mijnId).single();
      await verbindStream(mijnId, mijnProfiel?.name ?? 'Gebruiker', mijnProfiel?.avatar_url ?? null);
      const channelId = await getOrCreateDm(mijnId, profielId);
      router.push(`/chatroom/${channelId}`);
    } catch (e) { console.error('DM openen mislukt:', e); }
    finally { setActieBusy(false); }
  }

  function renderActieKnop() {
    if (!vriendschap || vriendschap.status === 'declined') {
      return (
        <Pressable style={[styles.actieKnop, { backgroundColor: COLORS.primary }, actieBusy && { opacity: 0.6 }]}
          onPress={stuurVerzoek} disabled={actieBusy}>
          {actieBusy
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="person-add-outline" size={16} color="#fff" /><Text style={styles.actieKnopTekst}>Vrienden worden</Text></>}
        </Pressable>
      );
    }
    if (vriendschap.status === 'pending') {
      if (vriendschap.user_id === mijnId) {
        return (
          <View style={[styles.actieKnop, { backgroundColor: '#E5E7EB' }]}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={[styles.actieKnopTekst, { color: '#6B7280' }]}>Verzoek gestuurd</Text>
          </View>
        );
      }
      return (
        <Pressable style={[styles.actieKnop, { backgroundColor: COLORS.primary }, actieBusy && { opacity: 0.6 }]}
          onPress={accepteerVerzoek} disabled={actieBusy}>
          {actieBusy
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="checkmark-outline" size={16} color="#fff" /><Text style={styles.actieKnopTekst}>Accepteer verzoek</Text></>}
        </Pressable>
      );
    }
    return (
      <Pressable style={[styles.actieKnop, { backgroundColor: '#F0EEFF' }, actieBusy && { opacity: 0.6 }]}
        onPress={openDm} disabled={actieBusy}>
        {actieBusy
          ? <ActivityIndicator color={PAARS} size="small" />
          : <><Ionicons name="chatbubble-outline" size={16} color={PAARS} /><Text style={[styles.actieKnopTekst, { color: PAARS }]}>Stuur bericht</Text></>}
      </Pressable>
    );
  }

  const initialen = profiel?.name
    ? profiel.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const gedeeld = interesses.filter(i => mijnInteresses.includes(i));
  const lidSinds = lidSindsTekst(profiel?.created_at ?? null);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.wrapper, { paddingTop: top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.rondeKnop} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={PAARS} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 48 }} />
        ) : !profiel ? (
          <View style={styles.midden}>
            <Text style={{ color: COLORS.textLight }}>Gebruiker niet gevonden</Text>
          </View>
        ) : (
          <>
            {/* Profiel rij — zelfde als eigen profiel */}
            <View style={styles.profielRij}>
              {profiel.avatar_url ? (
                <Image source={{ uri: profiel.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaat]}>
                  <Text style={styles.avatarLetters}>{initialen}</Text>
                </View>
              )}
              <View style={styles.profielTekst}>
                <View style={styles.naamRij}>
                  <Text style={styles.naamVet} numberOfLines={1}>{profiel.name}</Text>
                  {profiel.verification_status === 'approved' && (
                    <Ionicons name="checkmark-circle" size={20} color="#3B82F6" style={{ marginLeft: 6 }} />
                  )}
                  {profiel.age != null && (
                    <Text style={styles.leeftijdTekst}> {profiel.age}</Text>
                  )}
                </View>
                {lidSinds && <Text style={styles.lidSinds}>Lid sinds {lidSinds}</Text>}
                <View style={{ marginTop: 8 }}>{renderActieKnop()}</View>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabBalk}>
              {TABS.map(tab => (
                <Pressable key={tab} style={styles.tabItem} onPress={() => setActieveTab(tab)}>
                  <Text style={[styles.tabTekst, actieveTab === tab && styles.tabActief]}>{tab}</Text>
                  {actieveTab === tab && <View style={styles.tabLijn} />}
                </Pressable>
              ))}
            </View>

            {/* Tab inhoud */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.scrollInhoud, { paddingBottom: bottom + 100 }]}
              showsVerticalScrollIndicator={false}
            >
              {actieveTab === 'Info' && (
                <View style={styles.tabInhoud}>
                  {/* Bio */}
                  {profiel.bio ? (
                    <View style={styles.sectie}>
                      <Text style={styles.sectieLabel}>Bio</Text>
                      <Text style={styles.bioTekst}>{profiel.bio}</Text>
                    </View>
                  ) : null}

                  {/* Interesses */}
                  <View style={styles.sectie}>
                    <View style={styles.sectieHeader}>
                      <Text style={styles.sectieLabel}>Interesses</Text>
                      {interesses.length > 0 && <Text style={styles.sectieAantal}>{interesses.length}</Text>}
                    </View>
                    {interesses.length === 0 ? (
                      <Text style={styles.leegTekst}>Nog geen interesses toegevoegd.</Text>
                    ) : (
                      <View style={styles.chipsGrid}>
                        {interesses.map(int => (
                          <View key={int} style={styles.chip}>
                            <Text style={styles.chipTekst}>{interesseEmoji(int)} {int}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Gemeenschappelijke interesses */}
                  {gedeeld.length > 0 && (
                    <View style={styles.gedeeldBlok}>
                      <View style={styles.gedeeldHeader}>
                        <Ionicons name="flame" size={14} color={COLORS.primary} />
                        <Text style={styles.gedeeldTitel}>Gemeenschappelijk</Text>
                      </View>
                      <View style={styles.chipsGrid}>
                        {gedeeld.map(int => (
                          <View key={int} style={[styles.chip, { backgroundColor: `${COLORS.primary}18` }]}>
                            <Text style={[styles.chipTekst, { color: COLORS.primary }]}>{interesseEmoji(int)} {int}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Foto's */}
                  {extraFotos.length > 0 && (
                    <View style={styles.sectie}>
                      <View style={styles.sectieHeader}>
                        <Text style={styles.sectieLabel}>Foto's</Text>
                        <Text style={styles.sectieAantal}>{extraFotos.length}</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}
                        style={styles.fotoScroll} contentContainerStyle={styles.fotoScrollInhoud}>
                        {extraFotos.map(foto => (
                          <Image key={foto.id} source={{ uri: foto.photo_url }} style={styles.fotoItem} />
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {actieveTab === 'Stats' && (
                <StatsTab userId={profielId ?? null} trustScore={profiel?.trust_score} />
              )}

            </ScrollView>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper:        { flex: 1, backgroundColor: '#fff' },
  midden:         { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:         { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 16, paddingBottom: 12 },
  rondeKnop:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },

  profielRij:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  avatar:         { width: 90, height: 90, borderRadius: 45 },
  avatarPlaat:    { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetters:  { fontSize: 32, fontWeight: '700', color: '#fff' },
  profielTekst:   { flex: 1, gap: 2 },
  naamRij:        { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  naamVet:        { fontSize: 26, fontWeight: '700', color: COLORS.text, letterSpacing: -0.5 },
  leeftijdTekst:  { fontSize: 26, fontWeight: '400', color: '#C7C7CC', letterSpacing: -0.5 },
  lidSinds:       { fontSize: 13, color: COLORS.textLight },

  actieKnop:      { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  actieKnopTekst: { fontSize: 14, fontWeight: '700', color: '#fff' },

  tabBalk:        { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.12)', paddingHorizontal: 16 },
  tabItem:        { marginRight: 24, paddingBottom: 10 },
  tabTekst:       { fontSize: 16, fontWeight: '600', color: '#C7C7CC' },
  tabActief:      { color: COLORS.text },
  tabLijn:        { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: PAARS, borderRadius: 2 },

  scroll:         { flex: 1 },
  scrollInhoud:   { paddingHorizontal: 16, paddingTop: 20 },
  tabInhoud:      { gap: 28 },

  sectie:         { gap: 14 },
  sectieHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectieLabel:    { fontSize: 16, fontWeight: '700', color: COLORS.text },
  sectieAantal:   { fontSize: 15, fontWeight: '500', color: '#C7C7CC' },
  bioTekst:       { fontSize: 15, color: COLORS.textLight, lineHeight: 22 },
  leegTekst:      { fontSize: 14, color: COLORS.textLight },

  chipsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:           { backgroundColor: '#F2F2F7', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  chipTekst:      { fontSize: 14, fontWeight: '500', color: COLORS.text },

  gedeeldBlok:    { backgroundColor: '#F9F9F9', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  gedeeldHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gedeeldTitel:   { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  fotoScroll:       { marginHorizontal: -16 },
  fotoScrollInhoud: { paddingHorizontal: 16, gap: 10 },
  fotoItem:         { width: 120, height: 120, borderRadius: 12 },
});
