import { useAppTheme } from '@/context/ThemeContext';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId } from '@/utils/currentUser';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function FindPeople() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadFollowing() {
        const myId = await getCurrentUserId();
        if (!myId) return;
        try {
          const response = await fetch(`${API_BASE}/follows/${myId}/following`);
          if (!response.ok) return;
          const raw = await response.json();
          const users: any[] = Array.isArray(raw) ? raw : raw?.following || raw?.data || [];
          if (active) setFollowingIds(new Set(users.map(user => user.id)));
        } catch {
          if (active) setError('Could not load your follow status.');
        }
      }
      loadFollowing();
      return () => { active = false; };
    }, [])
  );

  async function search(text: string) {
    setQuery(text);
    const currentRequest = ++requestId.current;
    if (text.trim().length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(text)}`);
      if (!res.ok) throw new Error(`People search failed (${res.status})`);
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw : raw?.users || raw?.data || [];
      if (currentRequest === requestId.current) setResults(data);
    } catch {
      if (currentRequest === requestId.current) {
        setResults([]);
        setError('Could not search people. Try again later.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  async function toggleFollow(targetId: string) {
    const myId = await getCurrentUserId();
    if (!myId) {
      setError('Sign in again to follow people.');
      return;
    }

    const isFollowing = followingIds.has(targetId);
    const next = new Set(followingIds);

    setPendingIds(previous => new Set(previous).add(targetId));
    try {
      let response: Response;
      if (isFollowing) {
        response = await fetch(`${API_BASE}/follows`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerId: myId, followingId: targetId }),
        });
        next.delete(targetId);
      } else {
        response = await fetch(`${API_BASE}/follows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerId: myId, followingId: targetId }),
        });
        next.add(targetId);
      }
      if (!response.ok) throw new Error(`Follow request failed (${response.status})`);
      setFollowingIds(next);
      setError('');
    } catch {
      setError('Could not update your follow. Please try again.');
    } finally {
      setPendingIds(previous => {
        const next = new Set(previous);
        next.delete(targetId);
        return next;
      });
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
        accessibilityLabel="Search usernames"
      />

      {loading && <ActivityIndicator color={accentColor} style={{ marginTop: 20 }} />}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && !error
            ? <Text style={styles.empty}>{query.trim().length >= 2 ? 'No people found.' : 'Search for listeners by username.'}</Text>
            : null
        }
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
              disabled={pendingIds.has(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${followingIds.has(item.id) ? 'Unfollow' : 'Follow'} ${item.username}`}
              accessibilityState={{ disabled: pendingIds.has(item.id) }}
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
  error: { color: '#ff8b8b', fontSize: 13, marginHorizontal: 20, marginBottom: 8 },
  empty: { color: '#888', textAlign: 'center', paddingHorizontal: 20, paddingVertical: 24 },
});
