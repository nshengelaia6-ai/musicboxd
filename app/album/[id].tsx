import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AlbumPage() {
  const { id } = useLocalSearchParams();
  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [listened, setListened] = useState(false);
  const [liked, setLiked] = useState(false);
  const [wantToListen, setWantToListen] = useState(false);

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
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.dotsBtn}>
            <Text style={styles.dots}>···</Text>
          </TouchableOpacity>
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

      <Modal visible={menuVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setListened(!listened)}>
              <Text style={styles.actionIcon}>{listened ? '✅' : '👁'}</Text>
              <Text style={styles.actionText}>Listened</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setLiked(!liked)}>
              <Text style={styles.actionIcon}>{liked ? '❤️' : '🤍'}</Text>
              <Text style={styles.actionText}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setWantToListen(!wantToListen)}>
              <Text style={styles.actionIcon}>{wantToListen ? '🔖' : '🔖'}</Text>
              <Text style={styles.actionText}>Want to Listen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { alignItems: 'center', padding: 24, paddingTop: 60 },
  cover: { width: 200, height: 200, borderRadius: 8, marginBottom: 16 },
  albumName: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  meta: { color: '#888', fontSize: 14, marginTop: 4, textAlign: 'center' },
  dotsBtn: { position: 'absolute', top: 60, right: 20, padding: 8 },
  dots: { color: 'white', fontSize: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  num: { color: '#555', fontSize: 14, width: 28 },
  info: { flex: 1 },
  trackName: { color: 'white', fontSize: 15 },
  artist: { color: '#888', fontSize: 13, marginTop: 2 },
  playBtn: { fontSize: 16, color: '#1DB954' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#1a1a1a', padding: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-around' },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionIcon: { fontSize: 28 },
  actionText: { color: 'white', fontSize: 13 },
});
