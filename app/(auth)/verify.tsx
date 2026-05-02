import { View, Text, StyleSheet } from 'react-native';

export default function VerifyScreen() {
  return (
    <View style={styles.container}>
      <Text>Verificatie</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
