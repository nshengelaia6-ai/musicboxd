
import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function PickAlbum() {
  const router = useRouter();
  const { index } = useLocalSearchParams<{ index: string }>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRequestId = useRef(0);

  useEffect(() => {
    return () => {
      searchRequestId.current += 1;
    };
  }, []);

  const searchAlbums = async (text: string) => {
    setQuery(text);
    const requestId = ++searchRequestId.current;

    if (text.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      console.log('Searching albums:', text.trim());

      const { data, error } = await supabase.functions.invoke(
        'spotify-search',
        {
          body: {
            action: 'search',
            query: text.trim(),
            type: 'album',
          },
        }
      );

      if (requestId !== searchRequestId.current) return;

      if (error) {
        console.error('Album search failed:', error);
        setResults([]);
        return;
      }

      if (data?.error) {
        console.error('Spotify function error:', data.error);
        setResults([]);
        return;
      }

      const albums = data?.albums?.items ?? [];
      setResults(albums);
    } catch (error) {
      if (requestId === searchRequestId.current) {
        console.error('Unexpected album search error:', error);
        setResults([]);
      }
    } finally {
      if (requestId === searchRequestId.current) {
        setLoading(false);
      }
    }
  };

  function goBackToProfile() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile' as any);
    }
  }

  async function returnToProfileSettings() {
    try {
      await AsyncStorage.setItem('returnToSettings', '1');
      goBackToProfile();
    } catch (error) {
      console.error('Could not return to profile:', error);
    }
  }

  async function pickAlbum(album: any) {
    try {
      const slotIndex = Number(index);

      if (
        !Number.isInteger(slotIndex) ||
        slotIndex < 0 ||
        slotIndex > 3
      ) {
        console.error('Invalid favorite album slot:', index);
        return;
      }

      const pendingRaw = await AsyncStorage.getItem(
        'pendingFavoriteAlbums'
      );

      let albums: any[];

      if (pendingRaw) {
        const parsed = JSON.parse(pendingRaw);
        albums = Array.isArray(parsed) ? [...parsed] : [];
      } else {
        const profileRaw = await AsyncStorage.getItem('profile');
        const profile = profileRaw ? JSON.parse(profileRaw) : {};

        albums = Array.isArray(profile.favoriteAlbums)
          ? [...profile.favoriteAlbums]
          : [null, null, null, null];
      }

      while (albums.length < 4) {
        albums.push(null);
      }

      albums[slotIndex] = {
        id: album.id,
        title: album.name,
        cover: album.images?.[0]?.url || '',
      };

      await AsyncStorage.setItem(
        'pendingFavoriteAlbums',
        JSON.stringify(albums.slice(0, 4))
      );

      await AsyncStorage.setItem('returnToSettings', '1');

      goBackToProfile();
    } catch (error) {
      console.error('Could not select favorite album:', error);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={returnToProfileSettings}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Choose Album</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Search albums..."
        placeholderTextColor="#888"
        value={query}
        onChangeText={searchAlbums}
        autoFocus
      />

      {loading && (
        <Text style={styles.status}>Searching...</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => pickAlbum(item)}
          >
            {item.images?.[0]?.url ? (
              <Image
                source={{ uri: item.images[0].url }}
                style={styles.albumArt}
              />
            ) : (
              <View style={styles.albumArt} />
            )}

            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>

              <Text style={styles.artist} numberOfLines={1}>
                {item.artists
                  ?.map((artist: any) => artist.name)
                  .join(', ') || 'Unknown artist'}
              </Text>
            </View>

            <Text style={styles.addButton}>+</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.trim().length >= 2 && !loading ? (
            <Text style={styles.status}>No albums found.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  backBtn: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 36,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 12,
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#2a2a2a',
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  artist: {
    color: '#888',
    fontSize: 13,
    marginTop: 3,
  },
  addButton: {
    color: '#fff',
    fontSize: 24,
  },
  status: {
    color: '#888',
    fontSize: 14,
    marginVertical: 12,
  },
});
