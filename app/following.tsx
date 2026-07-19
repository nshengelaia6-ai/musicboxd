import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId } from '@/utils/currentUser';

export default function Following() {
  const router = useRouter();
  const [following, setFollowing] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const myId = await getCurrentUserId();
    if (!myId) return;
    try {
      const res = await fetch(`${API_BASE}/follows/${myId}/following`);
      const raw = await res.json();

      if (!res.ok) {
        console.log('following request failed', res.status, raw);
        setFollowing([]);
        return;
      }

      // Backend might return a bare array, or wrap it as { following: [...] } / { data: [...] }.
      const data: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.following)
          ? raw.following
          : Array.isArray(raw?.data)
            ? raw.data
            : [];

      setFollowing(data);
    } catch (e) {
      console.log('failed to load following', e);
      setFollowing([]);
    }
  }

  async function unfollow(targetId: string) {
    const myId = await getCurrentUserId();
    if (!myId) return;
    try {
      await fetch(`${API_BASE}/follows`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: myId, followingId: targetId }),
      });
      setFollowing(prev => prev.filter(u => u.id !== targetId));
    } catch (e) {
      console.log('unfollow failed', e);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Following</Text>
        <View style={{ width: 24 }} />
      </View>

      {following.length === 0 ? (
        <Text style={styles.empty}>ჯერ არავის მისდევ</Text>
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
            <TouchableOpacity style={styles.checkBtn} onPress={() => unfollow(user.id)}>
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
