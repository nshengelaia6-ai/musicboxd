cat > ~/musicboxd/my-app/app/pick-album/index.tsx << 'EOF'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function PickAlbum() {
  const router = useRouter();
  const { index } = useLocalSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const searchAlbums = async (text: string) => {
    setQuery(text);
    if (text.length < 2) { setResults([]); return; }
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) return;
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(text)}&type=album`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    setResults(data.albums?.items || []);
  };

  async function pickAlbum(album: any) {
    const data = await AsyncStorage.getItem('profile');
    const profile = data ? JSON.parse(data) : {};
    const albums = profile.favoriteAlbums || [null, null, null, null];
    albums[Number(index)] = {
      id: album.id,
      title: album.name,
      cover: album.images?.[0]?.url,
    };
    profile.favoriteAlbums = albums;
    await AsyncStorage.setItem('profile', JSON.stringify(profile));
    router.push('/(tabs)/profile');
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose Album</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Search albums..."
        placeholderTextColor="#555"
        value={query}
        onChangeText={searchAlbums}
        autoFocus
      />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => pickAlbum(item)}>
            <Image source={{ uri: item.images?.[0]?.url }} style={styles.albumArt} />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.artist} numberOfLines={1}>{item.artists?.[0]?.name}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 60, paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  backBtn: { color: '#fff', fontSize: 32, lineHeight: 36 },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  input: { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 12 },
  albumArt: { width: 50, height: 50, borderRadius: 4 },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  artist: { color: '#888', fontSize: 13 },
});
EOF
