import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId } from '@/utils/currentUser';

export default function Followers() {
  const router = useRouter();
  const [followers, setFollowers] = useState<any[]>([]);
  const [followingBack, setFollowingBack] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const myId = await getCurrentUserId();
    if (!myId) return;
    try {
      const res = await fetch(`${API_BASE}/follows/${myId}/followers`);
      const data = await res.json();
      setFollowers(data);

      const checks = await Promise.all(
        data.map((u: any) =>
          fetch(`${API_BASE}/follows/${myId}/is-following/${u.id}`).then(r => r.json())
        )
      );
      const set = new Set<string>();
      data.forEach((u: any, i: number) => {
        if (checks[i]?.isFollowing) set.add(u.id);
      });
      setFollowingBack(set);
    } catch (e) {
      console.log('failed to load followers', e);
    }
  }

  async function toggleFollowBack(targetId: string) {
    const myId = await getCurrentUserId();
    if (!myId) return;
    const isFollowing = followingBack.has(targetId);
    const next = new Set(followingBack);
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
      setFollowingBack(next);
    } catch (e) {
      console.log('toggle follow back failed', e);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Followers</Text>
        <View style={{ width: 24 }} />
      </View>

      {followers.length === 0 ? (
        <Text style={styles.empty}>ჯერ არავინ მოგდევია</Text>
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
              style={[styles.followBtn, followingBack.has(user.id) && { backgroundColor: '#2a2a2a' }]}
              onPress={() => toggleFollowBack(user.id)}
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
