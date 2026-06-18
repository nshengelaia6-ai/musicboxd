import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const mockFollowing = [
  { id: '1', username: 'GamaSpace', avatar: null },
  { id: '2', username: 'Snap', avatar: null },
  { id: '3', username: 'Mari___pap', avatar: null },
];

export default function Following() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Following</Text>
        <View style={{ width: 24 }} />
      </View>

      {mockFollowing.map(user => (
        <View key={user.id} style={styles.row}>
          <View style={styles.avatar}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
          </View>
          <Text style={styles.username}>{user.username}</Text>
          <View style={styles.dots}>
            <Text style={styles.dotsText}>···</Text>
          </View>
          <View style={styles.checkBtn}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60 },
  back: { color: 'white', fontSize: 32 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  avatar: { marginRight: 12 },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' },
  username: { flex: 1, color: 'white', fontSize: 15 },
  dots: { padding: 8 },
  dotsText: { color: '#555', fontSize: 18 },
  checkBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  checkIcon: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
