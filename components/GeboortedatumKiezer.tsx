import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';
import { formatGeboorteNl } from '../utils/geboorte';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate: Date;
  maximumDate: Date;
  /** Na sluiten met “Gereed” (ook zonder scrollen). */
  onBevestigd?: () => void;
};

/**
 * Geboortedatum in een modal i.p.v. in een ScrollView — anders pikt iOS (en soms Android)
 * de verticale gestures van het datumwiel af.
 */
export function GeboortedatumKiezer({
  value,
  onChange,
  minimumDate,
  maximumDate,
  onBevestigd,
}: Props) {
  const { bottom } = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  function sluit() {
    setOpen(false);
    onBevestigd?.();
  }

  return (
    <>
      <Pressable
        style={styles.knop}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Kies geboortedatum"
      >
        <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
        <Text style={styles.knopWaarde}>{formatGeboorteNl(value)}</Text>
        <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={sluit}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={sluit} accessibilityLabel="Sluiten" />
          <View style={[styles.sheet, { paddingBottom: Math.max(bottom, 20) + 12 }]}>
            <Text style={styles.sheetTitel}>Geboortedatum</Text>
            <DateTimePicker
              value={value}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              locale="nl-NL"
              themeVariant="light"
              onChange={(_, d) => {
                if (d) onChange(d);
              }}
              style={styles.picker}
            />
            <Pressable style={styles.gereedKnop} onPress={sluit}>
              <Text style={styles.gereedTekst}>Gereed</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  knop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  knopWaarde: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 8,
  },
  sheetTitel: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  picker: {
    alignSelf: 'stretch',
    height: 216,
  },
  gereedKnop: {
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  gereedTekst: { fontSize: 17, fontWeight: '800', color: '#fff' },
});
