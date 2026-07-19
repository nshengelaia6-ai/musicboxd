import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WantToListenScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<'tracks' | 'albums'>('tracks');

  useEffect(() => {
    AsyncStorage.getItem('wantToListen').then(data => {
      if (data) setItems(JSON.parse(data));
    });
  }, []);

  async function openItem(item: any) {
    if (item.type === 'album') {
      router.push(`/album/${item.id}` as any);
      return;
    }

    // ტრეკი — albumId ინახება თუ არა
    let albumId = item.albumId;

    if (!albumId) {
      const token = await AsyncStorage.getItem('spotify_token');
      if (!token) return;
      try {
        const res = await fetch(`https://api.spotify.com/v1/tracks/${item.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        albumId = data.album?.id;
      } catch (e) {
        console.log('failed to resolve album', e);
        return;
      }
    }

    if (!albumId) return;

    router.push({
      pathname: '/album/[id]',
      params: { id: albumId, highlightTrackId: item.id },
    } as any);
  }

  const filtered = items.filter(i =>
    tab === 'albums' ? i.type === 'album' : i.type === 'track'
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Want to Listen</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'tracks' && styles.tabActive]}
          onPress={() => setTab('tracks')}
        >
          <Text style={[styles.tabText, tab === 'tracks' && styles.tabTextActive]}>Tracks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'albums' && styles.tabActive]}
          onPress={() => setTab('albums')}
        >
          <Text style={[styles.tabText, tab === 'albums' && styles.tabTextActive]}>Albums</Text>
        </TouchableOpacity>
      </View>

      <ScrollView>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>ჯერ არ გაქვს Want to Listen items</Text>
        ) : (
          <View style={styles.grid}>
            {filtered.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.gridItem}
                onPress={() => openItem(item)}
              >
                {item.cover
                  ? <Image source={{ uri: item.cover }} style={styles.gridCover} />
                  : <View style={[styles.gridCover, { backgroundColor: '#2a2a2a' }]} />}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  gridItem: { width: '23%', alignItems: 'center' },
  gridCover: { width: '100%', aspectRatio: 1, borderRadius: 4 },
  gridTitle: { color: '#ccc', fontSize: 10, marginTop: 3, textAlign: 'center' },
});
