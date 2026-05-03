import { View, Text, StyleSheet } from 'react-native';

export default function OntdekScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.tekst}>Ontdek</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  tekst:     { fontSize: 17, color: '#666' },
});
