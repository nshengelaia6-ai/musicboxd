import { useAppTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

function Stars({ count, color }: { count: number; color: string }) {
  const starSize = 10;
  return (
    <View style={{ flexDirection: 'row', marginTop: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = count >= s;
        const half = !filled && count >= s - 0.5;
        return (
          <View key={s} style={{ width: starSize, height: starSize }}>
            <Text style={{ fontSize: starSize, color: '#555', position: 'absolute' }}>★</Text>
            {(filled || half) && (
              <View style={{ overflow: 'hidden', width: filled ? starSize : starSize / 2, position: 'absolute' }}>
                <Text style={{ fontSize: starSize, color }}>★</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function SongsScreen() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const columns = windowWidth >= 1024 ? 5 : windowWidth >= 720 ? 4 : 3;
  const gridWidth = Math.min(windowWidth, 960);
  const tileWidth = Math.max(72, (gridWidth - 24 - (columns - 1) * 12) / columns);
  const [listened, setListened] = useState<any[]>([]);
  const [tab, setTab] = useState<'albums' | 'tracks'>('tracks');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await AsyncStorage.getItem('listened');
      const all = data ? JSON.parse(data) : [];
      const seen = new Set<string>();
      const unique = all.filter((item: any) => {
        const key = `${item.id}-${item.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setListened(unique);
      if (unique.length !== all.length) await AsyncStorage.setItem('listened', JSON.stringify(unique));
    } catch {
      setError('Could not load your listening history. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openItem(item: any) {
      if (item.type === 'album') {
        router.push(`/album/${item.id}` as any);
      } else if (item.albumId) {
        router.push({ pathname: '/album/[id]', params: { id: item.albumId, highlightTrackId: item.id } } as any);
      }
    }

    const visibleItems = listened.filter(item => tab === 'albums' ? item.type === 'album' : item.type === 'track');

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Songs</Text>
      </View>

      <View style={styles.tabs}>
         <TouchableOpacity style={[styles.tab, tab === 'tracks' && styles.tabActive, tab === 'tracks' && { borderBottomColor: accentColor }]} onPress={() => setTab('tracks')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'tracks' }}>
  <Text style={[styles.tabText, tab === 'tracks' && styles.tabTextActive]}>Tracks</Text>
</TouchableOpacity>
<TouchableOpacity style={[styles.tab, tab === 'albums' && styles.tabActive, tab === 'albums' && { borderBottomColor: accentColor }]} onPress={() => setTab('albums')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'albums' }}>
  <Text style={[styles.tabText, tab === 'albums' && styles.tabTextActive]}>Albums</Text>
</TouchableOpacity>

      </View>

      <ScrollView>
        {loading ? (
          <ActivityIndicator color={accentColor} style={{ marginTop: 32 }} />
        ) : error ? (
          <Text accessibilityRole="alert" style={styles.empty}>{error}</Text>
        ) : visibleItems.length === 0 ? (
          <Text style={styles.empty}>No {tab} logged yet.</Text>
        ) : (
          <View style={[styles.grid, { maxWidth: gridWidth }]}>
            {visibleItems.map(item => (
                <TouchableOpacity
                  key={`${item.id}-${item.type}`}
                  style={[styles.gridItem, { width: tileWidth }]}
                  onPress={() => openItem(item)}
                >
                  {item.cover
                    ? <Image source={{ uri: item.cover }} style={styles.gridCover} />
                    : <View style={[styles.gridCover, { backgroundColor: '#2a2a2a' }]} />}
                  {item.rating ? <Stars count={item.rating} color={accentColor} /> : null}
                  <Text style={styles.gridTitle} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  backBtn: { marginRight: 12 },
  backText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1DB954' },
  tabText: { color: '#888', fontSize: 15 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  empty: { color: '#555', paddingHorizontal: 20, paddingVertical: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'center', width: '100%', paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  gridItem: { width: '30%', alignItems: 'center' },
  gridCover: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  gridTitle: { color: '#ccc', fontSize: 11, marginTop: 4, textAlign: 'center' },
});
