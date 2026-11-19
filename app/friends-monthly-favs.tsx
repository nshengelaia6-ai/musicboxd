import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

function getMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function FriendsMonthlyFavsScreen() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();

  const columns = windowWidth >= 1024 ? 5 : windowWidth >= 720 ? 4 : 3;
  const gridWidth = Math.min(windowWidth, 960);
  const tileWidth = Math.max(
    72,
    (gridWidth - 24 - (columns - 1) * 12) / columns
  );

  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setFavorites([]);
        return;
      }

      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id);

      if (friendshipsError) throw friendshipsError;

      const friendIds = [
        ...new Set((friendships || []).map((row: any) => row.friend_id).filter(Boolean)),
      ];

      if (friendIds.length === 0) {
        setFavorites([]);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('monthly_favorites')
        .select(
          'id,user_id,username,month_key,slot_index,track_id,track_name,artist_name,cover_url,spotify_url,comment,picked_at'
        )
        .eq('month_key', getMonthKey())
        .in('user_id', friendIds)
        .order('picked_at', { ascending: false });

      if (queryError) throw queryError;

      setFavorites(data || []);
    } catch (loadError) {
      console.log('Friends Monthly Favs failed:', loadError);
      setFavorites([]);
      setError('Monthly favorites are temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function openFriendTrack(item: any) {
    const trackId = item.track_id;
    const trackName = item.track_name;
    const artistName = item.artist_name || '';

    if (!trackId || !trackName) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        'spotify-search',
        {
          body: {
            action: 'search',
            query: `${trackName} ${artistName}`.trim(),
            type: 'track',
          },
        }
      );

      if (error) throw error;

      const track = (data?.tracks?.items ?? []).find(
        (result: any) => result.id === trackId
      );

      const albumId = track?.album?.id;

      if (!albumId) {
        console.log('Could not find the track album');
        return;
      }

      router.push({
        pathname: '/album/[id]',
        params: {
          id: albumId,
          highlightTrackId: trackId,
        },
      } as any);
    } catch (openError) {
      console.log('Could not open monthly favorite:', openError);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backText, { color: accentColor }]}>‹</Text>
        </Pressable>

        <Text style={styles.headerTitle}>Friends&apos; Monthly Favs</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={accentColor} style={{ marginTop: 32 }} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : favorites.length === 0 ? (
          <Text style={styles.empty}>
            Other users&apos; monthly favorites will appear here.
          </Text>
        ) : (
          <View style={[styles.grid, { maxWidth: gridWidth }]}>
            {favorites.map((favorite) => (
              <TouchableOpacity
                key={favorite.id}
                style={[styles.gridItem, { width: tileWidth }]}
                onPress={() => openFriendTrack(favorite)}
                activeOpacity={0.75}
              >
                {favorite.cover_url ? (
                  <Image
                    source={{ uri: favorite.cover_url }}
                    style={styles.gridCover}
                  />
                ) : (
                  <View style={[styles.gridCover, styles.noCover]}>
                    <Text style={styles.noCoverText}>♪</Text>
                  </View>
                )}

                <Text style={styles.gridUser} numberOfLines={1}>
                  {favorite.username || 'Music lover'}
                </Text>

                <Text style={styles.gridTitle} numberOfLines={2}>
                  {favorite.track_name}
                </Text>

                <Text style={styles.gridArtist} numberOfLines={1}>
                  {favorite.artist_name}
                </Text>

                {!!favorite.comment && (
                  <Text style={styles.gridComment} numberOfLines={3}>
                    {favorite.comment}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: {
    marginRight: 12,
  },
  backText: {
    fontSize: 32,
    lineHeight: 36,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  empty: {
    color: '#777',
    paddingHorizontal: 20,
    paddingVertical: 24,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  gridItem: {
    alignItems: 'center',
  },
  gridCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: '#222',
  },
  noCover: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noCoverText: {
    color: '#888',
    fontSize: 32,
  },
  gridUser: {
    color: '#aaa',
    fontSize: 10,
    marginTop: 5,
    textAlign: 'center',
  },
  gridTitle: {
    color: '#ccc',
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
  gridArtist: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  gridComment: {
    color: '#777',
    fontSize: 10,
    marginTop: 5,
    textAlign: 'center',
  },
});
