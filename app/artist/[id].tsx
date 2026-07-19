import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ArtistPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [artist, setArtist] = useState<any>(null);
  const [albums, setAlbums] = useState<any[]>([]);
  const [topTracks, setTopTracks] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) return;

    try {
      const [artistRes, albumsRes, tracksRes] = await Promise.all([
        fetch(`https://api.spotify.com/v1/artists/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`https://api.spotify.com/v1/artists/${id}/albums?limit=10&include_groups=album,single`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`https://api.spotify.com/v1/artists/${id}/top-tracks?market=US`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (artistRes.ok) setArtist(await artistRes.json());
      if (albumsRes.ok) {
        const d = await albumsRes.json();
        setAlbums(d.items || []);
      }
      if (tracksRes.ok) {
        const d = await tracksRes.json();
        setTopTracks((d.tracks || []).slice(0, 5));
      }
    } catch (e) {
      console.log('artist load failed', e);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>

      {artist && (
        <View style={styles.heroSection}>
          {artist.images?.[0]?.url ? (
            <Image source={{ uri: artist.images[0].url }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: '#2a2a2a' }]} />
          )}
          <Text style={styles.artistName}>{artist.name}</Text>
          <Text style={styles.followers}>
            {artist.followers?.total?.toLocaleString()} followers
          </Text>
        </View>
      )}

      {topTracks.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Popular</Text>
          {topTracks.map((track, index) => (
            <View key={track.id} style={styles.trackRow}>
              <Text style={styles.trackNum}>{index + 1}</Text>
              <Image source={{ uri: track.album?.images?.[0]?.url }} style={styles.trackCover} />
              <View style={styles.trackInfo}>
                <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
                <Text style={styles.trackMeta} numberOfLines={1}>
                  {(track.popularity || 0)}% popularity
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {albums.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Discography</Text>
          <FlatList
            data={albums}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.albumCard}
                onPress={() => router.push(`/album/${item.id}` as any)}
              >
                {item.images?.[0]?.url ? (
                  <Image source={{ uri: item.images[0].url }} style={styles.albumCover} />
                ) : (
                  <View style={[styles.albumCover, { backgroundColor: '#2a2a2a' }]} />
                )}
                <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.albumYear}>
                  {new Date(item.release_date).getFullYear()} • {item.album_type}
                </Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  backBtn: { position: 'absolute', top: 60, left: 16, zIndex: 10, padding: 8 },
  backText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  heroSection: { alignItems: 'center', paddingTop: 40 },
  heroImage: { width: '100%', height: 300 },
  artistName: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 16, textAlign: 'center', paddingHorizontal: 20 },
  followers: { color: '#888', fontSize: 14, marginTop: 4, marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  trackNum: { color: '#555', fontSize: 14, width: 20, textAlign: 'center' },
  trackCover: { width: 44, height: 44, borderRadius: 4 },
  trackInfo: { flex: 1 },
  trackName: { color: '#fff', fontSize: 15 },
  trackMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  albumCard: { width: 130 },
  albumCover: { width: 130, height: 130, borderRadius: 6, marginBottom: 6 },
  albumName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  albumYear: { color: '#888', fontSize: 11, marginTop: 2 },
});
