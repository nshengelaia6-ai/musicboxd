import { useAppTheme } from '@/context/ThemeContext';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId } from '@/utils/currentUser';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Following() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError('');
      async function load() {
        const myId = await getCurrentUserId();
        if (!myId) {
          if (active) {
            setFollowing([]);
            setError('Sign in to view the people you follow.');
          }
          setLoading(false);
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/follows/${myId}/following`);
          if (!res.ok) throw new Error(`Following request failed (${res.status})`);
          const raw = await res.json();
          const data: any[] = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.following)
              ? raw.following
              : Array.isArray(raw?.data)
                ? raw.data
                : [];
          if (active) setFollowing(data);
        } catch {
          if (active) {
            setFollowing([]);
            setError('Could not load following. Try again later.');
          }
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => { active = false; };
    }, [])
  );

  async function unfollow(targetId: string) {
    const myId = await getCurrentUserId();
    if (!myId) {
      setError('Your Spotify session has expired.');
      return;
    }
    setPendingIds(previous => new Set(previous).add(targetId));
    try {
      const response = await fetch(`${API_BASE}/follows`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: myId, followingId: targetId }),
      });
      if (!response.ok) throw new Error(`Unfollow failed (${response.status})`);
      setFollowing(prev => prev.filter(u => u.id !== targetId));
    } catch {
      setError('Could not unfollow this person. Please try again.');
    } finally {
      setPendingIds(previous => {
        const next = new Set(previous);
        next.delete(targetId);
        return next;
      });
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Following</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#1DB954" style={{ marginTop: 32 }} />
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.empty}>{error}</Text>
      ) : following.length === 0 ? (
        <Text style={styles.empty}>You are not following anyone yet.</Text>
      ) : (
        following.map(user => (
          <View key={user.id} style={styles.row}>
            <View style={styles.avatar}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
            </View>
            <Text style={styles.username}>{user.username}</Text>
            <TouchableOpacity style={[styles.checkBtn, { backgroundColor: accentColor }]} onPress={() => unfollow(user.id)} disabled={pendingIds.has(user.id)} accessibilityRole="button" accessibilityLabel={`Unfollow ${user.username}`}>
              <Text style={styles.checkIcon}>✓</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60 },
  back: { color: 'white', fontSize: 32 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  empty: { color: '#555', padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  avatar: { marginRight: 12 },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' },
  username: { flex: 1, color: 'white', fontSize: 15 },
  checkBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  checkIcon: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
