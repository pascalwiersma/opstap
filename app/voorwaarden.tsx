import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/colors';

const PAARS = COLORS.secondary;

const SECTIES = [
  {
    titel: 'Wie zijn wij?',
    tekst:
      'OpStap is een kaartgebaseerde sociale app voor studenten en jonge werkenden in Groningen. We helpen je een avondje uit te plannen en anderen te vinden om mee te gaan.',
  },
  {
    titel: 'Welke gegevens verzamelen we?',
    tekst:
      'We verzamelen je telefoonnummer voor verificatie, je profielnaam en -foto, je locatie (alleen tijdens gebruik van de kaart) en gegevens over je deelname aan check-ins. We slaan geen locatiegeschiedenis op.',
  },
  {
    titel: 'Waarvoor gebruiken we je gegevens?',
    tekst:
      'Je gegevens worden uitsluitend gebruikt om de app te laten werken: je profiel tonen aan anderen, check-ins organiseren en je trust score berekenen op basis van aanwezigheid.',
  },
  {
    titel: 'Trust score',
    tekst:
      'Je trust score wordt berekend op basis van je aanwezigheid bij check-ins. Een no-show verlaagt je score. De score is zichtbaar voor andere gebruikers en bepaalt hoe makkelijk je wordt goedgekeurd voor een avondje.',
  },
  {
    titel: 'Delen met derden',
    tekst:
      'We delen je gegevens niet met adverteerders. We gebruiken Supabase (EU-hosting) voor de database en Stream voor de groepschat. Beide partijen verwerken je gegevens alleen om de dienst te leveren.',
  },
  {
    titel: 'Jouw rechten',
    tekst:
      'Je kunt je account en alle bijbehorende gegevens op elk moment verwijderen via Instellingen → Account verwijderen. Je hebt ook het recht op inzage en correctie van je gegevens. Stuur hiervoor een e-mail naar privacy@opstap.app.',
  },
  {
    titel: 'Beveiliging',
    tekst:
      'Alle data is versleuteld opgeslagen en verstuurd via HTTPS. Toegang tot je account is beveiligd met telefoonnummerverificatie via SMS.',
  },
  {
    titel: 'Wijzigingen',
    tekst:
      'Als we deze voorwaarden wezenlijk wijzigen, informeren we je via een melding in de app. De meest recente versie is altijd beschikbaar in de app.',
  },
  {
    titel: 'Contact',
    tekst:
      'Vragen over privacy of de voorwaarden? Stuur een e-mail naar privacy@opstap.app.',
  },
];

export default function VoorwaardenScreen() {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingTop: top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.terugKnop} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={PAARS} />
        </Pressable>
        <Text style={styles.titel}>Voorwaarden & privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.inhoud, { paddingBottom: bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Hieronder vind je alles over hoe OpStap met jouw gegevens omgaat en wat je van ons kunt verwachten.
        </Text>

        {SECTIES.map((sectie) => (
          <View key={sectie.titel} style={styles.sectie}>
            <Text style={styles.sectieTitel}>{sectie.titel}</Text>
            <Text style={styles.sectieTekst}>{sectie.tekst}</Text>
          </View>
        ))}

        <Text style={styles.versie}>Laatste update: mei 2026</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  terugKnop: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  titel: { fontSize: 17, fontWeight: '700', color: COLORS.text },

  inhoud: { paddingHorizontal: 16, gap: 16 },
  intro: { fontSize: 15, color: COLORS.textLight, lineHeight: 22 },

  sectie: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 6 },
  sectieTitel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sectieTekst: { fontSize: 14, color: COLORS.textLight, lineHeight: 21 },

  versie: { fontSize: 12, color: '#C7C7CC', textAlign: 'center', marginTop: 8 },
});
