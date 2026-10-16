import { useAppTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ArtistsScreen() {
  const router = useRouter();
  const { backgroundColor } = useAppTheme();
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      AsyncStorage.getItem('followed_artists')
        .then(data => {
          if (active) setArtists(data ? JSON.parse(data) : []);
        })
        .catch(() => {
          if (active) setError('Could not load followed artists.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Artists</Text>
      </View>

      <ScrollView>
        {loading ? (
          <ActivityIndicator color="#1DB954" style={{ marginTop: 32 }} />
        ) : error ? (
          <Text accessibilityRole="alert" style={styles.empty}>{error}</Text>
        ) : artists.length === 0 ? (
          <Text style={styles.empty}>No followed artists yet.</Text>
        ) : (
          artists.map(artist => (
            <Pressable
              key={artist.id}
              style={styles.row}
              onPress={() => router.push(`/artist/${artist.id}`)}
            >
              {artist.image
                ? <Image source={{ uri: artist.image }} style={styles.avatar} />
                : <View style={styles.avatar} />}
              <Text style={styles.name}>{artist.name}</Text>
            </Pressable>
          ))
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
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  empty: { color: '#555', padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e1e1e', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2a2a2a' },
  name: { color: '#fff', fontSize: 16 },
});
