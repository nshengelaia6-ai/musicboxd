import { useAppTheme } from '@/context/ThemeContext';
import { getValidSpotifyToken } from '@/utils/spotify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

export default function Likes() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const columns = windowWidth >= 1024 ? 5 : windowWidth >= 720 ? 4 : 3;
  const gridWidth = Math.min(windowWidth, 960);
  const tileWidth = Math.max(72, (gridWidth - 24 - (columns - 1) * 8) / columns);
  const [activeTab, setActiveTab] = useState<'Tracks' | 'Albums'>('Tracks');
  const [albums, setAlbums] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLikes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await AsyncStorage.getItem('liked');
      const list = data ? JSON.parse(data) : [];
      setAlbums(list.filter((i: any) => i.type === 'album'));
      setTracks(list.filter((i: any) => i.type === 'track'));
    } catch {
      setError('Could not load your likes. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadLikes(); }, [loadLikes]));

  async function openTrack(item: any) {
    // Newer liked tracks already carry albumId — use it directly.
    if (item.albumId) {
      router.push({
        pathname: `/album/${item.albumId}` as any,
        params: { highlightTrackId: item.id },
      });
      return;
    }

    // Older liked tracks (saved before albumId was tracked) — look it up from Spotify.
    const token = await getValidSpotifyToken();
    if (!token) return;
    try {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const albumId = data.album?.id;
      if (!albumId) return;

      // Backfill albumId onto the stored liked item so this lookup isn't needed again.
      const stored = await AsyncStorage.getItem('liked');
      const list = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex((i: any) => i.id === item.id);
      if (idx !== -1) {
        list[idx].albumId = albumId;
        await AsyncStorage.setItem('liked', JSON.stringify(list));
      }

      router.push({
        pathname: `/album/${albumId}` as any,
        params: { highlightTrackId: item.id },
      });
    } catch (e) {
      console.log('failed to resolve album for track', e);
    }
  }

  const visibleItems = activeTab === 'Albums' ? albums : tracks;

  return (
    <ScrollView style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Likes</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        {['Tracks', 'Albums'].map(tab => (
          <Pressable key={tab} onPress={() => setActiveTab(tab as any)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabActive]}>{tab}</Text>
            {activeTab === tab && <View style={[styles.tabLine, { backgroundColor: accentColor }]} />}
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={accentColor} style={{ marginTop: 32 }} />
      ) : error ? (
        <Text accessibilityRole="alert" style={styles.empty}>{error}</Text>
      ) : visibleItems.length === 0 ? (
        <Text style={styles.empty}>No {activeTab.toLowerCase()} liked yet.</Text>
      ) : (
      <View style={[styles.grid, { maxWidth: gridWidth }]}>
        {visibleItems.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.item, { width: tileWidth }]}
            onPress={() => {
              if (activeTab === 'Albums') {
                router.push(`/album/${item.id}` as any);
              } else {
                openTrack(item);
              }
            }}
          >
            <Image source={{ uri: item.cover }} style={styles.cover} />
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60 },
  back: { color: 'white', fontSize: 32 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', marginHorizontal: 20 },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 12 },
  tabText: { color: '#888', fontSize: 15, fontWeight: '600' },
  tabActive: { color: 'white' },
  tabLine: { position: 'absolute', bottom: 0, height: 2, width: '100%', backgroundColor: '#1DB954' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'center', width: '100%', padding: 12, gap: 8 },
  item: {},
  cover: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  name: { color: 'white', fontSize: 12, marginTop: 4 },
  empty: { color: '#888', textAlign: 'center', paddingHorizontal: 20, paddingVertical: 24 },
});
