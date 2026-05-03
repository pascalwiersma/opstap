import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/colors';
import { Tables } from '../../types/supabase';

type CheckIn = Pick<Tables<'check_ins'>, 'id' | 'status'>;

export default function IncheckenScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function laadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [eigenResult, telResult] = await Promise.all([
      supabase
        .from('check_ins')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .eq('status', 'active'),
    ]);

    setCheckIn(eigenResult.data as CheckIn | null);
    setCount(telResult.count ?? 0);
    setLoading(false);
  }

  useEffect(() => { laadData(); }, []);

  async function inchecken() {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }

    let nieuweCheckIn: CheckIn | null = null;

    if (checkIn) {
      const { data } = await supabase
        .from('check_ins')
        .update({ status: 'active' })
        .eq('id', checkIn.id)
        .select('id, status')
        .single();
      nieuweCheckIn = data as CheckIn | null;
    } else {
      const { data } = await supabase
        .from('check_ins')
        .insert({ user_id: user.id, date: today })
        .select('id, status')
        .single();
      nieuweCheckIn = data as CheckIn | null;
    }

    if (nieuweCheckIn) {
      setCheckIn(nieuweCheckIn);
      setCount(c => c + 1);
    }
    setBusy(false);
  }

  async function uitchecken() {
    if (!checkIn) return;
    setBusy(true);
    const { error } = await supabase
      .from('check_ins')
      .update({ status: 'cancelled', checked_out_at: new Date().toISOString() })
      .eq('id', checkIn.id);

    if (!error) {
      setCheckIn(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setCount(c => Math.max(0, c - 1));
    }
    setBusy(false);
  }

  const isIngecheckt = checkIn?.status === 'active';

  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bottom + 80 }]}>
      <View style={styles.inhoud}>
        <Text style={styles.koptekst}>Vanavond in Groningen</Text>

        <View style={styles.tellerBlok}>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : (
            <>
              <Text style={styles.teller}>{count}</Text>
              <Text style={styles.tellerLabel}>
                {count === 1 ? 'persoon gaat vanavond uit' : 'mensen gaan vanavond uit'}
              </Text>
            </>
          )}
        </View>

        {!loading && (
          <View style={styles.actieBlok}>
            {isIngecheckt ? (
              <>
                <View style={styles.bevestigingRij}>
                  <View style={styles.vinkjeCircle}>
                    <Ionicons name="checkmark" size={22} color="#fff" />
                  </View>
                  <Text style={styles.bevestigingTekst}>Je bent ingecheckt!</Text>
                </View>
                <Pressable style={styles.annuleerKnop} onPress={uitchecken} disabled={busy}>
                  <Text style={styles.annuleerTekst}>Toch niet</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.incheckenKnop, busy && styles.knopDisabled]}
                onPress={inchecken}
                disabled={busy}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.incheckenTekst}>Ik ga vanavond uit</Text>
                }
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  inhoud: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 36,
  },
  koptekst:    { fontSize: 22, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  tellerBlok:  { alignItems: 'center', gap: 8 },
  teller:      { fontSize: 88, fontWeight: '800', color: COLORS.primary, lineHeight: 96 },
  tellerLabel: { fontSize: 16, color: COLORS.textLight, textAlign: 'center' },
  actieBlok:   { width: '100%', alignItems: 'center', gap: 16 },
  incheckenKnop: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  knopDisabled:     { opacity: 0.6 },
  incheckenTekst:   { fontSize: 17, fontWeight: '700', color: '#fff' },
  bevestigingRij:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vinkjeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bevestigingTekst: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  annuleerKnop:     { paddingVertical: 12, paddingHorizontal: 24 },
  annuleerTekst:    { fontSize: 15, color: COLORS.textLight, textDecorationLine: 'underline' },
});
