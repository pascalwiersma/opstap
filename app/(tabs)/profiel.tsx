import { View, Text, StyleSheet } from 'react-native';

export default function ProfielScreen() {
  return (
    <View style={styles.container}>
      <Text>Profiel</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
