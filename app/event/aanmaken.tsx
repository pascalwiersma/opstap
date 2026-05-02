import { View, Text, StyleSheet } from 'react-native';

export default function EventAanmakenScreen() {
  return (
    <View style={styles.container}>
      <Text>Event aanmaken</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
