import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AlbumPage() {
  const { id } = useLocalSearchParams();
  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);

  useEffect(() => {
    loadAlbum();
  }, []);

  async function loadAlbum() {
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) return;
    const res = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setAlbum(data);
    setTracks(data.tracks?.items || []);
  }

  async function openTrack(track: any) {
    const url = `https://open.spotify.com/track/${track.id}`;
    await WebBrowser.openBrowserAsync(url);
  }

  return (
    <ScrollView style={styles.container}>
      {album && (
        <View style={styles.header}>
          <Image source={{ uri: album.images?.[0]?.url }} style={styles.cover} />
          <Text style={styles.albumName}>{album.name}</Text>
          <Text style={styles.meta}>{album.artists?.[0]?.name}</Text>
          <Text style={styles.meta}>{album.album_type} • {album.release_date} • {album.total_tracks} tracks</Text>
        </View>
      )}
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.row} onPress={() => openTrack(item)}>
            <Text style={styles.num}>{index + 1}</Text>
            <View style={styles.info}>
              <Text style={styles.trackName}>{item.name}</Text>
              <Text style={styles.artist}>{item.artists?.[0]?.name}</Text>
            </View>
            <Text style={styles.playBtn}>▶</Text>
          </TouchableOpacity>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { alignItems: 'center', padding: 24, paddingTop: 60 },
  cover: { width: 200, height: 200, borderRadius: 8, marginBottom: 16 },
  albumName: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  meta: { color: '#888', fontSize: 14, marginTop: 4, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  num: { color: '#555', fontSize: 14, width: 28 },
  info: { flex: 1 },
  trackName: { color: 'white', fontSize: 15 },
  artist: { color: '#888', fontSize: 13, marginTop: 2 },
  playBtn: { fontSize: 16, color: '#1DB954' },
});
