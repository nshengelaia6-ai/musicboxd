import { StyleSheet, Text, View } from 'react-native';

export default function Shared() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Shared Songs</Text>
      <Text style={styles.empty}>Nothing shared yet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 16, paddingTop: 60 },
  heading: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  empty: { color: '#888', fontSize: 14 },
});
