import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { supabase } from '../services/supabase';

type Props = {
  zichtbaar: boolean;
  contentType: 'venue' | 'city_event';
  contentId: string;
  opties: string[];
  onSluit: () => void;
};

export function MeldingModal({ zichtbaar, contentType, contentId, opties, onSluit }: Props) {
  const [geselecteerd, setGeselecteerd] = useState<string | null>(null);
  const [toelichting, setToelichting] = useState('');
  const [bezig, setBezig] = useState(false);
  const [verzonden, setVerzonden] = useState(false);

  function reset() {
    setGeselecteerd(null);
    setToelichting('');
    setBezig(false);
    setVerzonden(false);
  }

  function sluit() {
    reset();
    onSluit();
  }

  async function verstuur() {
    if (!geselecteerd) return;
    setBezig(true);
    await supabase.from('content_reports').insert({
      content_type: contentType,
      content_id: contentId,
      reden: geselecteerd,
      toelichting: toelichting.trim() || null,
    });
    setBezig(false);
    setVerzonden(true);
  }

  return (
    <Modal visible={zichtbaar} animationType="slide" transparent onRequestClose={sluit}>
      <Pressable style={styles.backdrop} onPress={sluit} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kvWrapper}
      >
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {verzonden ? (
            <View style={styles.bedanktWrapper}>
              <Ionicons name="checkmark-circle" size={52} color={COLORS.primary} />
              <Text style={styles.bedanktTitel}>Bedankt!</Text>
              <Text style={styles.bedanktTekst}>
                We hebben je melding ontvangen en kijken er naar.
              </Text>
              <Pressable style={styles.sluitKnop} onPress={sluit}>
                <Text style={styles.sluitKnopTekst}>Sluiten</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.titel}>Klopt er iets niet?</Text>
              <Text style={styles.subtitel}>Laat ons weten wat er niet klopt.</Text>

              <View style={styles.optiesLijst}>
                {opties.map((optie) => {
                  const actief = geselecteerd === optie;
                  return (
                    <Pressable
                      key={optie}
                      style={[styles.optieRij, actief && styles.optieRijActief]}
                      onPress={() => setGeselecteerd(optie)}
                    >
                      <View style={[styles.radio, actief && styles.radioActief]}>
                        {actief && <View style={styles.radioDot} />}
                      </View>
                      <Text style={[styles.optieTekst, actief && styles.optieTekstActief]}>
                        {optie}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                style={styles.invoer}
                placeholder="Aanvullende toelichting (optioneel)"
                placeholderTextColor="#999"
                value={toelichting}
                onChangeText={setToelichting}
                multiline
                numberOfLines={3}
              />

              <Pressable
                style={[styles.verstuurKnop, !geselecteerd && styles.verstuurKnopDisabled]}
                onPress={verstuur}
                disabled={!geselecteerd || bezig}
              >
                {bezig
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.verstuurTekst}>Verstuur melding</Text>}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  kvWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 4,
  },

  titel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  subtitel: {
    fontSize: 14,
    color: '#888',
    marginTop: -8,
  },

  optiesLijst: {
    gap: 8,
  },

  optieRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    backgroundColor: '#FAFAFA',
  },

  optieRijActief: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioActief: {
    borderColor: COLORS.primary,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },

  optieTekst: {
    fontSize: 15,
    color: '#555',
    flex: 1,
  },

  optieTekstActief: {
    color: '#1A1A1A',
    fontWeight: '600',
  },

  invoer: {
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1A1A1A',
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#FAFAFA',
  },

  verstuurKnop: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },

  verstuurKnopDisabled: {
    opacity: 0.4,
  },

  verstuurTekst: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  bedanktWrapper: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },

  bedanktTitel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  bedanktTekst: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },

  sluitKnop: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },

  sluitKnopTekst: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
});
