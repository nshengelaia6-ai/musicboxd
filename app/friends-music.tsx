import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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

async function loadFriendActivityRows(friendIds: string[]) {
  const rows: any[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('user_activity')
      .select('id,user_id,activity_type,item_key,data,created_at')
      .in('user_id', friendIds)
      .in('activity_type', ['listened', 'reviewed'])
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export default function FriendsMusicScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { backgroundColor, accentColor } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();

  const isPopular = type === 'popular';
  const title = isPopular ? 'Popular with Friends' : 'New from Friends';

  const columns = windowWidth >= 1024 ? 5 : windowWidth >= 720 ? 4 : 3;
  const gridWidth = Math.min(windowWidth, 960);
  const tileWidth = Math.max(
    72,
    (gridWidth - 24 - (columns - 1) * 12) / columns
  );

  const [items, setItems] = useState<any[]>([]);
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
        setItems([]);
        return;
      }

      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id);

      if (friendshipsError) throw friendshipsError;

      const friendIds = [
        ...new Set(
          (friendships || [])
            .map((friend: any) => friend.friend_id)
            .filter(Boolean)
        ),
      ];

      if (friendIds.length === 0) {
        setItems([]);
        return;
      }

      const [activities, usersResult] = await Promise.all([
        loadFriendActivityRows(friendIds),
        supabase
          .from('users')
          .select('id,username')
          .in('id', friendIds),
      ]);

      if (usersResult.error) throw usersResult.error;
      const users = usersResult.data;

      const trackActivities = (activities || []).filter(
        (activity: any) =>
          activity.data?.type === 'track' &&
          (activity.data?.name || activity.item_key)
      );

      // Keep only the newest event for each friend/track pair.
      const seenFriendTracks = new Set<string>();
      const uniqueTrackActivities = trackActivities.filter((activity: any) => {
        const trackId = activity.item_key || activity.data?.id;
        const key = `${activity.user_id}:${trackId}`;
        if (!trackId || seenFriendTracks.has(key)) return false;
        seenFriendTracks.add(key);
        return true;
      });

      if (!isPopular) {
        const recentTracks = uniqueTrackActivities.map((activity: any) => {
          const friend = (users || []).find(
            (item: any) => item.id === activity.user_id
          );

          return {
            id: activity.id,
            item_id: activity.item_key || activity.data?.id,
            item_name: activity.data?.name || 'Unknown track',
            artist_name:
              activity.data?.artist_name ||
              activity.data?.artistName ||
              activity.data?.artist ||
              '',
            cover_url:
              activity.data?.cover ||
              activity.data?.cover_url ||
              '',
            username: friend?.username || 'User',
            created_at: activity.created_at,
          };
        });

        setItems(recentTracks);
      } else {
        const counts: Record<string, any> = {};

        uniqueTrackActivities.forEach((activity: any) => {
          const trackId = activity.item_key || activity.data?.id;
          if (!trackId) return;

          if (!counts[trackId]) {
            counts[trackId] = {
              item_id: trackId,
              item_name: activity.data?.name || 'Unknown track',
              artist_name:
                activity.data?.artist_name ||
                activity.data?.artistName ||
                activity.data?.artist ||
                activity.data?.artists ||
                '',
              cover_url:
                activity.data?.cover ||
                activity.data?.cover_url ||
                '',
              friend_user_ids: [],
            };
          }

          if (!counts[trackId].friend_user_ids.includes(activity.user_id)) {
            counts[trackId].friend_user_ids.push(activity.user_id);
          }
        });

        const popularTracks = Object.values(counts)
          .map((item: any) => ({
            ...item,
            count: item.friend_user_ids.length,
          }))
          .sort((a: any, b: any) => b.count - a.count);

        setItems(popularTracks);
      }
    } catch (loadError) {
      console.log('Friends music page failed:', loadError);
      setItems([]);
      setError('Friends music is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [isPopular]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function openFriendTrack(item: any) {
    const trackId = item.item_id ?? item.track_id;
    const trackName = item.item_name ?? item.track_name;
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
      console.log('Could not open friend track:', openError);
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
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={accentColor} style={{ marginTop: 32 }} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>
            {isPopular
              ? 'No popular tracks from friends yet.'
              : 'No new tracks from friends yet.'}
          </Text>
        ) : (
          <View style={[styles.grid, { maxWidth: gridWidth }]}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={item.id || item.item_id || index}
                style={[styles.gridItem, { width: tileWidth }]}
                onPress={() => openFriendTrack(item)}
                activeOpacity={0.75}
              >
                {item.cover_url ? (
                  <Image
                    source={{ uri: item.cover_url }}
                    style={styles.gridCover}
                  />
                ) : (
                  <View style={[styles.gridCover, styles.noCover]}>
                    <Text style={styles.noCoverText}>♪</Text>
                  </View>
                )}

                <Text style={styles.gridTitle} numberOfLines={2}>
                  {item.item_name}
                </Text>

                {!!item.artist_name && (
                  <Text style={styles.gridArtist} numberOfLines={1}>
                    {item.artist_name}
                  </Text>
                )}

                {isPopular ? (
                  <Text style={[styles.gridMeta, { color: accentColor }]}>
                    {item.count} {item.count === 1 ? 'friend' : 'friends'}
                  </Text>
                ) : (
                  <Text style={styles.gridMeta} numberOfLines={1}>
                    {item.username}
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
  gridTitle: {
    color: '#ccc',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },
  gridArtist: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  gridMeta: {
    color: '#777',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
