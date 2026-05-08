import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';
import { COLORS } from '../constants/colors';
import { kiesEnUploadFoto } from '../utils/fotoUpload';

const PAARS = COLORS.secondary;
const MAX_FOTOS = 5;
const FOTO_GROOTTE = 110;

const MENU_RIJEN = [
  { label: 'Naam en leeftijd aanpassen', route: '/profiel-naam-bewerken' },
  { label: 'Profielomschrijving wijzigen', route: '/profiel-bio-bewerken' },
  { label: 'Interesses aanpassen', route: '/interesses-bewerken' },
  { label: 'Eigenschappen aanpassen', route: null },
] as const;

type ExtraFoto = { id: string; photo_url: string };

export default function ProfielBewerkScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [extraFotos, setExtraFotos] = useState<ExtraFoto[]>([]);
  const [avatarBezig, setAvatarBezig] = useState(false);
  const [fotoBezig, setFotoBezig] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);

      const [profielRes, fotosRes] = await Promise.all([
        supabase.from('profiles').select('avatar_url').eq('id', session.user.id).single(),
        supabase.from('profile_photos').select('id, photo_url').eq('user_id', session.user.id).order('position'),
      ]);

      if (profielRes.data) setAvatarUrl(profielRes.data.avatar_url);
      if (fotosRes.data) setExtraFotos(fotosRes.data);
    })();
  }, []);

  async function wijzigAvatar() {
    if (!userId || avatarBezig) return;
    setAvatarBezig(true);
    try {
      const url = await kiesEnUploadFoto(`${userId}/avatar.jpg`);
      if (!url) return;
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
      setAvatarUrl(`${url}?t=${Date.now()}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      Alert.alert('Fout', msg);
    } finally {
      setAvatarBezig(false);
    }
  }

  async function voegFotoToe() {
    if (!userId || fotoBezig) return;
    if (extraFotos.length >= MAX_FOTOS) {
      Alert.alert('Maximum bereikt', `Je kunt maximaal ${MAX_FOTOS} extra foto's toevoegen.`);
      return;
    }
    setFotoBezig(true);
    try {
      const pad = `${userId}/photos/${Date.now()}.jpg`;
      const url = await kiesEnUploadFoto(pad);
      if (!url) return;
      const { data, error } = await supabase
        .from('profile_photos')
        .insert({ user_id: userId, photo_url: url, position: extraFotos.length })
        .select('id, photo_url')
        .single();
      if (error) throw error;
      if (data) setExtraFotos((v) => [...v, data]);
    } catch {
      Alert.alert('Fout', 'Kon foto niet toevoegen. Probeer opnieuw.');
    } finally {
      setFotoBezig(false);
    }
  }

  async function verwijderFoto(id: string) {
    Alert.alert('Foto verwijderen', 'Wil je deze foto verwijderen?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen', style: 'destructive',
        onPress: async () => {
          await supabase.from('profile_photos').delete().eq('id', id);
          setExtraFotos((v) => v.filter((f) => f.id !== id));
        },
      },
    ]);
  }

  function drukOpRij(route: string | null) {
    if (route) router.push(route as never);
    else Alert.alert('Binnenkort', 'Deze functie is nog niet beschikbaar.');
  }

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.terugKnop} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={PAARS} />
        </Pressable>
        <Text style={styles.titel}>Profiel bewerken</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.inhoud, { paddingBottom: bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profielfoto */}
        <View style={styles.fotoRij}>
          <Pressable style={styles.fotoOmhulsel} onPress={wijzigAvatar} disabled={avatarBezig}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.foto} />
            ) : (
              <View style={[styles.foto, styles.fotoPlaceholder]}>
                <Ionicons name="person" size={52} color="#C7C7CC" />
              </View>
            )}
            <View style={styles.fotoBadge}>
              {avatarBezig
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="add" size={20} color="#fff" />}
            </View>
          </Pressable>
        </View>

        {/* Extra foto's rij */}
        <Pressable style={styles.extraFotoKnop} onPress={voegFotoToe} disabled={fotoBezig}>
          <View style={styles.plusRond}>
            {fotoBezig
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="add" size={18} color="#fff" />}
          </View>
          <Text style={styles.extraFotoTekst}>Voeg extra foto's toe</Text>
        </Pressable>

        {/* Foto horizontale scroll */}
        {extraFotos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.fotoScroll}
            contentContainerStyle={styles.fotoScrollInhoud}
          >
            {extraFotos.map((foto) => (
              <View key={foto.id} style={styles.fotoItem}>
                <Image source={{ uri: foto.photo_url }} style={styles.fotoItemAfb} />
                <Pressable
                  style={styles.verwijderBadge}
                  onPress={() => verwijderFoto(foto.id)}
                  hitSlop={4}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Menu */}
        <View style={styles.menu}>
          {MENU_RIJEN.map((rij) => (
            <Pressable key={rij.label} style={styles.menuRij} onPress={() => drukOpRij(rij.route)}>
              <Text style={styles.menuTekst}>{rij.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:         { flex: 1, backgroundColor: '#F2F2F7' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  terugKnop:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  titel:           { fontSize: 17, fontWeight: '700', color: COLORS.text },

  inhoud:          { paddingHorizontal: 16, gap: 20 },

  fotoRij:         { alignItems: 'center', paddingTop: 8 },
  fotoOmhulsel:    { width: 110, height: 110 },
  foto:            { width: 110, height: 110, borderRadius: 55 },
  fotoPlaceholder: { backgroundColor: '#E5E5EA', alignItems: 'center', justifyContent: 'center' },
  fotoBadge:       {
    position: 'absolute', bottom: 4, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: PAARS,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#F2F2F7',
  },

  extraFotoKnop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  plusRond:        { width: 32, height: 32, borderRadius: 16, backgroundColor: PAARS, alignItems: 'center', justifyContent: 'center' },
  extraFotoTekst:  { fontSize: 16, fontWeight: '600', color: PAARS },

  fotoScroll:      { marginHorizontal: -16 },
  fotoScrollInhoud: { paddingHorizontal: 16, gap: 10 },
  fotoItem:        { position: 'relative', width: FOTO_GROOTTE, height: FOTO_GROOTTE },
  fotoItemAfb:     { width: FOTO_GROOTTE, height: FOTO_GROOTTE, borderRadius: 12 },
  verwijderBadge:  {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  menu:            { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  menuRij:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  menuTekst:       { fontSize: 16, color: COLORS.text },
});
