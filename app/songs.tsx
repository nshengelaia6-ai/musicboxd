import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function Stars({ count }: { count: number }) {
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
                <Text style={{ fontSize: starSize, color: '#ffb6c1' }}>★</Text>
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
  const [listened, setListened] = useState<any[]>([]);
  const [tab, setTab] = useState<'albums' | 'tracks'>('albums');

  useEffect(() => {
    async function load() {
      const data = await AsyncStorage.getItem('listened');
      if (data) {
        const all = JSON.parse(data);
        const seen = new Set();
        const unique = all.filter((item: any) => {
          const key = `${item.id}-${item.type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setListened(unique);
        await AsyncStorage.setItem('listened', JSON.stringify(unique));
      }
    }
    load();
  }, []);

  function openItem(item: any) {
    if (item.type === 'album') {
      router.push(`/album/${item.id}` as any);
    } else {
      if (!item.albumId) return;
      router.push(`/album/${item.albumId}` as any);
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Songs</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'albums' && styles.tabActive]} onPress={() => setTab('albums')}>
          <Text style={[styles.tabText, tab === 'albums' && styles.tabTextActive]}>Albums</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'tracks' && styles.tabActive]} onPress={() => setTab('tracks')}>
          <Text style={[styles.tabText, tab === 'tracks' && styles.tabTextActive]}>Tracks</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {listened.length === 0 ? (
          <Text style={styles.empty}>ჯერ არ გაქვს listened items</Text>
        ) : (
          <View style={styles.grid}>
            {listened
              .filter(item => tab === 'albums' ? item.type === 'album' : item.type === 'track')
              .map(item => (
                <TouchableOpacity
                  key={`${item.id}-${item.type}`}
                  style={styles.gridItem}
                  onPress={() => openItem(item)}
                >
                  {item.cover
                    ? <Image source={{ uri: item.cover }} style={styles.gridCover} />
                    : <View style={[styles.gridCover, { backgroundColor: '#2a2a2a' }]} />}
                  {item.rating ? <Stars count={item.rating} /> : null}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 12, gap: 12 },
  gridItem: { width: '30%', alignItems: 'center' },
  gridCover: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  gridTitle: { color: '#ccc', fontSize: 11, marginTop: 4, textAlign: 'center' },
});
