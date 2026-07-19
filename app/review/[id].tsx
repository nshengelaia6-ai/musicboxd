import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function Stars({ count }: { count: number }) {
  const starWidth = 22;
  return (
    <View style={{ flexDirection: 'row', marginTop: 10 }}>
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = count >= s;
        const half = !filled && count >= s - 0.5;
        return (
          <View key={s} style={{ width: starWidth, height: starWidth }}>
            <Text style={{ fontSize: starWidth, color: '#333', position: 'absolute' }}>★</Text>
            {(filled || half) && (
              <View style={{ overflow: 'hidden', width: filled ? starWidth : starWidth / 2, position: 'absolute' }}>
                <Text style={{ fontSize: starWidth, color: '#ffb6c1' }}>★</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function ReviewDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [entry, setEntry] = useState<any>(null);
  const [username, setUsername] = useState('nia');
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const data = await AsyncStorage.getItem('reviews');
    const reviews = data ? JSON.parse(data) : [];
    const found = reviews.find((r: any) => r.id === id);
    setEntry(found || null);

    const profileData = await AsyncStorage.getItem('profile');
    if (profileData) {
      const p = JSON.parse(profileData);
      setUsername(p.username || 'nia');
      setAvatar(p.avatar || null);
    }
  }

  async function goToAlbum() {
    if (!entry) return;

    // თუ ალბომის review-ია — პირდაპირ გადავიდეთ
    if (!entry.albumArtist || entry.type === 'album') {
      router.push(`/album/${entry.albumId}` as any);
      return;
    }

    // თუ ტრეკის review-ია — Spotify-დან ვიღებთ ალბომის ID-ს
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) {
      router.push(`/album/${entry.albumId}` as any);
      return;
    }
    try {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${entry.albumId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const realAlbumId = data.album?.id;
      if (realAlbumId) {
        router.push({
          pathname: '/album/[id]',
          params: { id: realAlbumId, highlightTrackId: entry.albumId },
        } as any);
      } else {
        router.push(`/album/${entry.albumId}` as any);
      }
    } catch {
      router.push(`/album/${entry.albumId}` as any);
    }
  }

  if (!entry) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backText}>‹ Diary</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.empty}>რევიუ ვერ მოიძებნა</Text>
      </View>
    );
  }

  const formattedDate = new Date(entry.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const year = new Date(entry.date).getFullYear();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backText}>‹ Diary</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review</Text>
        <TouchableOpacity>
          <Text style={styles.dots}>•••</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.userRow}>
          {avatar
            ? <Image source={{ uri: avatar }} style={styles.avatar} />
            : <View style={styles.avatar} />}
          <Text style={styles.username}>{username}</Text>
        </View>

        <View style={styles.mainRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.title}>{entry.albumName}</Text>
            <Text style={styles.year}>{year}</Text>
            <Stars count={entry.rating} />
            <Text style={styles.listenedText}>Listened {formattedDate}</Text>
          </View>
          <Pressable onPress={goToAlbum}>
            {entry.albumCover
              ? <Image source={{ uri: entry.albumCover }} style={styles.cover} />
              : <View style={[styles.cover, { backgroundColor: '#2a2a2a' }]} />}
          </Pressable>
        </View>

        {entry.review ? (
          <Text style={styles.reviewText}>{entry.review}</Text>
        ) : null}

        <TouchableOpacity style={styles.likeRow}>
          <Text style={styles.heartIcon}>♡</Text>
          <Text style={styles.likeText}>No likes yet</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.pillBtn}>
          <Text style={styles.pillText}>Reply</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pillBtn} onPress={goToAlbum}>
          <Text style={styles.pillText}>Album  ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#aaa', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  dots: { color: '#aaa', fontSize: 16 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40 },
  content: { padding: 20, paddingBottom: 40 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333' },
  username: { color: '#fff', fontSize: 15, fontWeight: '600' },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  year: { color: '#888', fontSize: 15, marginTop: 2 },
  listenedText: { color: '#888', fontSize: 13, marginTop: 12 },
  cover: { width: 100, height: 140, borderRadius: 6 },
  reviewText: { color: '#eee', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1e1e1e' },
  heartIcon: { color: '#888', fontSize: 18 },
  likeText: { color: '#888', fontSize: 14 },
  bottomBar: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#1e1e1e' },
  pillBtn: { backgroundColor: '#1c1c1c', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  pillText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
