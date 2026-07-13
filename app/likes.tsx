import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Likes() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'Tracks' | 'Albums'>('Tracks');
  const [albums, setAlbums] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);

  useEffect(() => { loadLikes(); }, []);

  async function loadLikes() {
    const data = await AsyncStorage.getItem('liked');
    const list = data ? JSON.parse(data) : [];
    setAlbums(list.filter((i: any) => i.type === 'album'));
    setTracks(list.filter((i: any) => i.type === 'track'));
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Likes</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        {['Tracks', 'Albums'].map(tab => (
          <Pressable key={tab} onPress={() => setActiveTab(tab as any)} style={styles.tab}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabActive]}>{tab}</Text>
            {activeTab === tab && <View style={styles.tabLine} />}
          </Pressable>
        ))}
      </View>

      <View style={styles.grid}>
        {(activeTab === 'Albums' ? albums : tracks).map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.item}
            onPress={() => {
              if (activeTab === 'Albums') {
                router.push(`/album/${item.id}` as any);
              } else if (item.albumId) {
                router.push({
                  pathname: `/album/${item.albumId}` as any,
                  params: { highlightTrackId: item.id },
                });
              }
            }}
          >
            <Image source={{ uri: item.cover }} style={styles.cover} />
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  item: { width: '30%' },
  cover: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  name: { color: 'white', fontSize: 12, marginTop: 4 },
});
