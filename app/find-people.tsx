import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId } from '@/utils/currentUser';
import { useAppTheme } from '@/context/ThemeContext';

export default function FindPeople() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  async function search(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.log('search failed', e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow(targetId: string) {
    const myId = await getCurrentUserId();
    if (!myId) return;

    const isFollowing = followingIds.has(targetId);
    const next = new Set(followingIds);

    try {
      if (isFollowing) {
        await fetch(`${API_BASE}/follows`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerId: myId, followingId: targetId }),
        });
        next.delete(targetId);
      } else {
        await fetch(`${API_BASE}/follows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerId: myId, followingId: targetId }),
        });
        next.add(targetId);
      }
      setFollowingIds(next);
    } catch (e) {
      console.log('follow toggle failed', e);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Find People</Text>
        <View style={{ width: 24 }} />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Search username..."
        placeholderTextColor="#666"
        value={query}
        onChangeText={search}
        autoCapitalize="none"
      />

      {loading && <ActivityIndicator color={accentColor} style={{ marginTop: 20 }} />}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
            <Text style={styles.username}>{item.username}</Text>
            <TouchableOpacity
              style={[styles.followBtn, followingIds.has(item.id) && { backgroundColor: '#2a2a2a' }]}
              onPress={() => toggleFollow(item.id)}
            >
              <Text style={[styles.followBtnText, followingIds.has(item.id) ? { color: '#aaa' } : { color: '#000' }]}>
                {followingIds.has(item.id) ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60 },
  back: { color: 'white', fontSize: 32 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  input: { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 10, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', marginRight: 12 },
  username: { flex: 1, color: '#fff', fontSize: 15 },
  followBtn: { backgroundColor: '#1DB954', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  followBtnText: { fontSize: 13, fontWeight: '600' },
});
