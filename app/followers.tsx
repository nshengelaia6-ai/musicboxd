import { useAppTheme } from '@/context/ThemeContext';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId } from '@/utils/currentUser';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Followers() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [followers, setFollowers] = useState<any[]>([]);
  const [followingBack, setFollowingBack] = useState<Set<string>>(new Set());
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
            setFollowers([]);
            setError('Sign in to view your followers.');
          }
          setLoading(false);
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/follows/${myId}/followers`);
          if (!res.ok) throw new Error(`Followers request failed (${res.status})`);
          const raw = await res.json();
          const data: any[] = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.followers)
              ? raw.followers
              : Array.isArray(raw?.data)
                ? raw.data
                : [];
          if (active) setFollowers(data);
          if (data.length === 0) {
            if (active) setFollowingBack(new Set());
            return;
          }
          const checks = await Promise.all(data.map(async (user: any) => {
            try {
              const response = await fetch(`${API_BASE}/follows/${myId}/is-following/${user.id}`);
              if (!response.ok) return false;
              const result = await response.json();
              return !!result?.isFollowing;
            } catch {
              return false;
            }
          }));
          if (active) setFollowingBack(new Set(data.filter((_: any, index: number) => checks[index]).map((user: any) => user.id)));
        } catch {
          if (active) {
            setFollowers([]);
            setError('Could not load followers. Try again later.');
          }
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => { active = false; };
    }, [])
  );

  async function toggleFollowBack(targetId: string) {
    const myId = await getCurrentUserId();
    if (!myId) {
      setError('Your Spotify session has expired.');
      return;
    }
    const isFollowing = followingBack.has(targetId);
    const next = new Set(followingBack);
    setPendingIds(previous => new Set(previous).add(targetId));
    try {
      if (isFollowing) {
        const response = await fetch(`${API_BASE}/follows`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerId: myId, followingId: targetId }),
        });
        if (!response.ok) throw new Error(`Unfollow failed (${response.status})`);
        next.delete(targetId);
      } else {
        const response = await fetch(`${API_BASE}/follows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerId: myId, followingId: targetId }),
        });
        if (!response.ok) throw new Error(`Follow failed (${response.status})`);
        next.add(targetId);
      }
      setFollowingBack(next);
      setError('');
    } catch {
      setError('Could not update this follow. Please try again.');
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
        <Text style={styles.title}>Followers</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#1DB954" style={{ marginTop: 32 }} />
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.empty}>{error}</Text>
      ) : followers.length === 0 ? (
        <Text style={styles.empty}>No followers yet.</Text>
      ) : (
        followers.map(user => (
          <View key={user.id} style={styles.row}>
            <View style={styles.avatar}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder} />
              )}
            </View>
            <Text style={styles.username}>{user.username}</Text>
            <TouchableOpacity
              style={[styles.followBtn, { backgroundColor: followingBack.has(user.id) ? '#2a2a2a' : accentColor }]}
              onPress={() => toggleFollowBack(user.id)}
              disabled={pendingIds.has(user.id)}
              accessibilityRole="button"
              accessibilityLabel={`${followingBack.has(user.id) ? 'Unfollow' : 'Follow back'} ${user.username}`}
            >
              <Text style={[styles.followBtnText, followingBack.has(user.id) ? { color: '#aaa' } : { color: '#000' }]}>
                {followingBack.has(user.id) ? 'Following' : 'Follow Back'}
              </Text>
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
  followBtn: { backgroundColor: '#1DB954', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  followBtnText: { fontSize: 12, fontWeight: '600' },
});
