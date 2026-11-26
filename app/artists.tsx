import { useAppTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
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
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data, error } = await supabase.from('artist_follows').select('artist_id,artist_name,artist_image,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) throw error;
            let cloudArtists = (data || []).map((row: any) => ({ id: String(row.artist_id), name: row.artist_name, image: row.artist_image || '' }));
            if (cloudArtists.length === 0) {
              const legacyData = await AsyncStorage.getItem('followed_artists');
              const legacyArtists = legacyData ? JSON.parse(legacyData) : [];
              if (Array.isArray(legacyArtists) && legacyArtists.length) {
                const { error: migrationError } = await supabase.from('artist_follows').upsert(
                  legacyArtists.filter((item: any) => item?.id).map((item: any) => ({
                    user_id: user.id,
                    artist_id: String(item.id),
                    artist_name: String(item.name || ''),
                    artist_image: String(item.image || ''),
                  })),
                  { onConflict: 'user_id,artist_id' }
                );
                if (migrationError) throw migrationError;
                cloudArtists = legacyArtists;
              }
            }
            await AsyncStorage.setItem('followed_artists', JSON.stringify(cloudArtists));
            if (active) setArtists(cloudArtists);
          } else {
            const data = await AsyncStorage.getItem('followed_artists');
            if (active) setArtists(data ? JSON.parse(data) : []);
          }
        } catch (loadError) {
          console.error('Could not load followed artists:', loadError);
          try {
            const data = await AsyncStorage.getItem('followed_artists');
            if (active) setArtists(data ? JSON.parse(data) : []);
          } catch {
            if (active) setError('Could not load followed artists.');
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
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
