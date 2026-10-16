import { useAppTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Shared() {
  const router = useRouter();
  const { backgroundColor } = useAppTheme();
  const [sharedSongs, setSharedSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadShared();
    }, [])
  );

  async function loadShared() {
    setLoading(true);
    setError('');
    try {
      const data = await AsyncStorage.getItem('shared_songs');
      setSharedSongs(data ? JSON.parse(data) : []);
    } catch {
      setError('Could not load your shared history. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function openSharedItem(item: any) {
    if (item.type === 'track' && item.albumId) {
      router.push({ pathname: '/album/[id]', params: { id: item.albumId, highlightTrackId: item.itemId || item.id } } as any);
    } else if (item.type === 'album' && (item.itemId || item.id)) {
      router.push(`/album/${item.itemId || item.id}` as any);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <Text style={styles.heading}>Shared Songs</Text>
      {loading ? (
        <ActivityIndicator color="#1DB954" style={{ marginTop: 32 }} />
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.empty}>{error}</Text>
      ) : sharedSongs.length === 0 ? (
        <Text style={styles.empty}>Nothing shared yet. Share an album or track to start your history.</Text>
      ) : (
        sharedSongs.map(item => (
          <TouchableOpacity key={item.id} style={styles.card} onPress={() => openSharedItem(item)} disabled={!item.type} accessibilityRole={item.type ? 'button' : undefined}>
            <View style={styles.cardInner}>
              <Image source={{ uri: item.cover }} style={styles.cover} />
              <View style={styles.info}>
                <Text style={styles.songName}>{item.name}</Text>
                <Text style={styles.artist}>{item.artist}</Text>
                {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
                <Text style={styles.meta}>from {item.from} • {formatDate(item.date)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60 },
  heading: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 20, paddingHorizontal: 16 },
  empty: { color: '#888', fontSize: 14, paddingHorizontal: 16 },
  card: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden' },
  cardInner: { flexDirection: 'row', padding: 16, alignItems: 'flex-start' },
  cover: { width: 80, height: 80, borderRadius: 10, marginRight: 14 },
  info: { flex: 1, justifyContent: 'center' },
  songName: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  artist: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  message: { color: '#ddd', fontSize: 14, marginBottom: 8, lineHeight: 20 },
  meta: { color: '#666', fontSize: 12 },
});
