import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ArtistPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [artist, setArtist] = useState<any>(null);
  const [albums, setAlbums] = useState<any[]>([]);

  useEffect(() => {
    loadArtist();
  }, []);

  async function loadArtist() {
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) return;

    const artistRes = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const artistData = await artistRes.json();
    setArtist(artistData);

    const albumsRes = await fetch(
      `https://api.spotify.com/v1/artists/${id}/albums?limit=10&include_groups=album,single&market=US`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const albumsData = await albumsRes.json();
    setAlbums(albumsData.items || []);
  }

  return (
    <ScrollView style={styles.container}>
      <ImageBackground
        source={{ uri: artist?.images?.[0]?.url }}
        style={styles.heroBackground}
        blurRadius={2}
      >
        <View style={styles.heroOverlay}>
          <Image source={{ uri: artist?.images?.[0]?.url }} style={styles.artistImage} />
          <Text style={styles.artistName}>{artist?.name}</Text>
        </View>
      </ImageBackground>

      <Text style={styles.heading}>Albums & Singles</Text>
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => router.push(`/album/${item.id}`)}>
            <Image source={{ uri: item.images?.[0]?.url }} style={styles.cover} />
            <View style={styles.info}>
              <Text style={styles.albumName}>{item.name}</Text>
              <Text style={styles.albumMeta}>{item.album_type} • {item.release_date?.slice(0, 4)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  heroBackground: { width: '100%', height: 300 },
  heroOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24 },
  artistImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 12, borderColor: 'white' },
  artistName: { color: 'white', fontSize: 28, fontWeight: 'bold', textShadowColor: 'black', textShadowRadius: 10 },
  heading: { color: 'white', fontSize: 20, fontWeight: 'bold', margin: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  cover: { width: 60, height: 60, borderRadius: 6 },
  info: { flex: 1 },
  albumName: { color: 'white', fontSize: 15, fontWeight: '600' },
  albumMeta: { color: '#888', fontSize: 13, marginTop: 2 },
});
