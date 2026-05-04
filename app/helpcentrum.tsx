import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';

const VRAGEN = [
  {
    categorie: 'Account',
    items: [
      {
        vraag: 'Hoe verander ik mijn profielfoto?',
        antwoord: 'Ga naar Account → Bewerk profiel en tik op je huidige foto om een nieuwe te kiezen.',
      },
      {
        vraag: 'Hoe verwijder ik mijn account?',
        antwoord: 'Stuur een e-mail naar support@opstap.nl met je telefoonnummer. We verwijderen je account binnen 5 werkdagen.',
      },
    ],
  },
  {
    categorie: 'Inchecken',
    items: [
      {
        vraag: 'Hoe check ik in bij een locatie?',
        antwoord: 'Tik op de oranje knop onderin en kies de locatie waar je naartoe gaat. Je kunt anderen uitnodigen om mee te gaan.',
      },
      {
        vraag: 'Hoe keur ik aanmeldingen goed?',
        antwoord: 'Open je inchecksessie via de kaart of je profiel. Onder "Aanmeldingen" zie je wie zich heeft aangemeld — tik op ✓ of ✗.',
      },
      {
        vraag: 'Wat gebeurt er als ik niet kom opdagen?',
        antwoord: 'Na een inchecksessie wordt aanwezigheid gecheckt. Een no-show verlaagt je trust score, waardoor het moeilijker wordt om goedgekeurd te worden.',
      },
    ],
  },
  {
    categorie: 'Trust score',
    items: [
      {
        vraag: 'Wat is de trust score?',
        antwoord: 'De trust score geeft aan hoe betrouwbaar je bent. Hij begint op 5.0 en stijgt als je daadwerkelijk verschijnt bij events.',
      },
      {
        vraag: 'Hoe verhoog ik mijn trust score?',
        antwoord: 'Meld je aan voor events en kom ook echt opdagen. Bij elke aanwezigheid stijgt je score.',
      },
    ],
  },
  {
    categorie: 'Groepschat',
    items: [
      {
        vraag: 'Wanneer krijg ik toegang tot de groepschat?',
        antwoord: 'Zodra de event-maker je aanmelding goedkeurt, word je automatisch toegevoegd aan de groepschat.',
      },
    ],
  },
];

function VraagRij({ vraag, antwoord }: { vraag: string; antwoord: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={styles.vraagRij}>
      <View style={styles.vraagHeader}>
        <Text style={styles.vraagTekst}>{vraag}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={COLORS.textLight}
        />
      </View>
      {open && <Text style={styles.antwoordTekst}>{antwoord}</Text>}
    </Pressable>
  );
}

export default function HelpcentrumScreen() {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </Pressable>
        <Text style={styles.titel}>Helpcentrum</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.inhoud, { paddingBottom: bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {VRAGEN.map((blok) => (
          <View key={blok.categorie} style={styles.blok}>
            <Text style={styles.categorie}>{blok.categorie}</Text>
            <View style={styles.kaart}>
              {blok.items.map((item, i) => (
                <View key={item.vraag}>
                  {i > 0 && <View style={styles.scheidingslijn} />}
                  <VraagRij vraag={item.vraag} antwoord={item.antwoord} />
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.contactBlok}>
          <Text style={styles.contactTitel}>Nog vragen?</Text>
          <Text style={styles.contactTekst}>
            Stuur een e-mail naar{' '}
            <Text style={styles.contactLink}>support@opstap.nl</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:         { flex: 1, backgroundColor: COLORS.surface },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  titel:           { fontSize: 28, fontWeight: '700', color: COLORS.text },
  inhoud:          { paddingHorizontal: 16, gap: 24 },
  blok:            { gap: 8 },
  categorie:       { fontSize: 13, fontWeight: '600', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.8 },
  kaart:           { backgroundColor: COLORS.background, borderRadius: 12 },
  scheidingslijn:  { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginHorizontal: 16 },
  vraagRij:        { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  vraagHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  vraagTekst:      { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.text },
  antwoordTekst:   { fontSize: 14, color: COLORS.textLight, lineHeight: 21 },
  contactBlok:     { backgroundColor: COLORS.background, borderRadius: 12, padding: 16, gap: 4 },
  contactTitel:    { fontSize: 15, fontWeight: '600', color: COLORS.text },
  contactTekst:    { fontSize: 14, color: COLORS.textLight, lineHeight: 21 },
  contactLink:     { color: COLORS.primary, fontWeight: '500' },
});
