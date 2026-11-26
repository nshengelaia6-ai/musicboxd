import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { subscribeToSpotifySession } from '@/utils/spotify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function getMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

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

export default function Home() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();

  const [displayName, setDisplayName] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [newFromFriends, setNewFromFriends] = useState<any[]>([]);
  const [popularThisWeek, setPopularThisWeek] = useState<any[]>([]);
  const [friendFeedLoading, setFriendFeedLoading] = useState(true);
  const [friendFeedError, setFriendFeedError] = useState('');
  const [popularThisWeekLoading, setPopularThisWeekLoading] = useState(true);
  const [popularThisWeekError, setPopularThisWeekError] = useState('');
  const friendIdsRef = useRef<Set<string>>(new Set());

  // Monthly Favs
  const [monthlyFavs, setMonthlyFavs] = useState<any[]>([]);
  const [friendsMonthlyFavs, setFriendsMonthlyFavs] = useState<any[]>([]);
  const [friendsMonthlyLoading, setFriendsMonthlyLoading] = useState(true);
  const [friendsMonthlyError, setFriendsMonthlyError] = useState('');

  const [pickerVisible, setPickerVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [activeFavIndex, setActiveFavIndex] = useState(0);

  // Spotify song search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingTracks, setSearchingTracks] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [formError, setFormError] = useState('');
  const [, setSessionVersion] = useState(0);

  // Re-load everything when the Spotify account changes (new login / switch).
  useEffect(() => {
    const unsubscribe = subscribeToSpotifySession(() => {
      setSessionVersion((v) => v + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Load Monthly Favs shared by friends only.
  const loadPublicMonthlyFavs = useCallback(async (userId: string | null) => {
    setFriendsMonthlyLoading(true);
    setFriendsMonthlyError('');

    try {
      if (!userId) {
        setFriendsMonthlyFavs([]);
        return;
      }

      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId);

      if (friendshipsError) throw friendshipsError;

      const friendIds = [
        ...new Set((friendships || []).map((row: any) => row.friend_id).filter(Boolean)),
      ];

      if (friendIds.length === 0) {
        setFriendsMonthlyFavs([]);
        return;
      }

      const { data, error } = await supabase
        .from('monthly_favorites')
        .select(
          'id,user_id,username,month_key,slot_index,track_id,track_name,artist_name,cover_url,spotify_url,comment,picked_at'
        )
        .eq('month_key', getMonthKey())
        .in('user_id', friendIds)
        .order('picked_at', { ascending: false });

      if (error) throw error;

      setFriendsMonthlyFavs(data || []);
    } catch (error) {
      console.log('Public Monthly Favs failed:', error);
      setFriendsMonthlyFavs([]);
      setFriendsMonthlyError(
        'Monthly favorites are temporarily unavailable.'
      );
    } finally {
      setFriendsMonthlyLoading(false);
    }
  }, []);


  // Load own favorites, profile and authenticated user
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadData() {
        try {
          const [rawFavorite, profileRaw, userId] = await Promise.all([
            AsyncStorage.getItem(`monthly_fav_${getMonthKey()}`),
            AsyncStorage.getItem('profile'),
            AsyncStorage.getItem('supabase_user_id'),
          ]);

          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!active) return;

          const parsedLocal = rawFavorite ? JSON.parse(rawFavorite) : [];
          const localFavorites = (Array.isArray(parsedLocal)
            ? parsedLocal
            : parsedLocal
              ? [parsedLocal]
              : []).slice(0, 3);

          let favorites = localFavorites;

          // Restore this month's favorites from the account when available.
          if (user?.id) {
            const { data: cloudFavorites, error: cloudError } = await supabase
              .from('monthly_favorites')
              .select('slot_index,track_id,track_name,artist_name,cover_url,spotify_url,comment,picked_at')
              .eq('user_id', user.id)
              .eq('month_key', getMonthKey())
              .order('slot_index', { ascending: true });

            if (cloudError) {
              console.log('Could not restore Monthly Favs from cloud:', cloudError);
            }

            if (!cloudError && cloudFavorites?.length) {
              const merged = [...localFavorites];
              cloudFavorites.forEach((item: any) => {
                const slot = Number(item.slot_index);
                if (slot < 0 || slot > 2) return;
                merged[slot] = {
                  id: item.track_id,
                  name: item.track_name,
                  artist: item.artist_name || '',
                  cover: item.cover_url || '',
                  spotifyUrl: item.spotify_url || '',
                  comment: item.comment || '',
                  pickedAt: item.picked_at,
                };
              });
              favorites = merged.slice(0, 3);
              await AsyncStorage.setItem(
                `monthly_fav_${getMonthKey()}`,
                JSON.stringify(favorites)
              );
            }
          }

          if (active) setMonthlyFavs(favorites);

          setCurrentUserId(user?.id || userId);
          const activeUserId = user?.id || userId;
          if (activeUserId) {
            const { count, error: notificationCountError } = await supabase
              .from('notifications')
              .select('id', { count: 'exact', head: true })
              .eq('recipient_id', activeUserId)
              .is('read_at', null);
            if (!notificationCountError && active) setUnreadNotificationCount(count || 0);
          }

          if (profileRaw) {
            const profile = JSON.parse(profileRaw);
            setDisplayName(profile.username || '');
          } else if (user?.user_metadata?.username) {
            setDisplayName(user.user_metadata.username);
          } else {
            setDisplayName('');
          }

          await loadPublicMonthlyFavs(user?.id || null);
        } catch (error) {
          console.log('Failed to load Monthly Favs data', error);
        }
      }

      loadData();

      return () => {
        active = false;
      };
    }, [loadPublicMonthlyFavs])
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentUserId) return;
      const refreshUnreadCount = async () => {
        const { count, error } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', currentUserId)
          .is('read_at', null);
        if (!error) setUnreadNotificationCount(count || 0);
      };
      const channel = supabase
        .channel(`home-notifications-${currentUserId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'notifications',
          filter: `recipient_id=eq.${currentUserId}`,
        }, () => { void refreshUnreadCount(); })
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    }, [currentUserId])
  );

  // Load globally aggregated track popularity from the last seven days.
  // The database function returns counts only, never individual listening activity.
  const loadPopularThisWeek = useCallback(async () => {
    setPopularThisWeekLoading(true);
    setPopularThisWeekError('');

    try {
      const { data, error } = await supabase.rpc('get_popular_tracks_this_week');
      if (error) throw error;
      setPopularThisWeek(data || []);
    } catch (error) {
      console.log('Popular This Week failed', error);
      setPopularThisWeek([]);
      setPopularThisWeekError('Popular tracks are temporarily unavailable.');
    } finally {
      setPopularThisWeekLoading(false);
    }
  }, []);

  // Load friends activity from user_activity
  const loadFriendsActivity = useCallback(async (userId: string) => {
    setFriendFeedLoading(true);
    setFriendFeedError('');

    try {
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', userId);

      if (friendshipsError) throw friendshipsError;

      const friendIds = [
        ...new Set(
          (friendships || [])
            .map((friend: any) => friend.friend_id)
            .filter(Boolean)
        ),
      ];

      friendIdsRef.current = new Set(friendIds);

      if (friendIds.length === 0) {
        setNewFromFriends([]);
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

      // A newly reviewed track can also create a listened event.
      // Keep only the newest event for each friend/track pair.
      const seenFriendTracks = new Set<string>();
      const uniqueTrackActivities = trackActivities.filter((activity: any) => {
        const trackId = activity.item_key || activity.data?.id;
        const key = `${activity.user_id}:${trackId}`;
        if (!trackId || seenFriendTracks.has(key)) return false;
        seenFriendTracks.add(key);
        return true;
      });

      const recentTracks = uniqueTrackActivities.map((activity: any) => {
        const user = (users || []).find(
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
          users: {
            username: user?.username || 'User',
          },
          rating: activity.data?.rating ?? '',
          review: typeof activity.data?.review === 'string' ? activity.data.review : '',
          created_at: activity.created_at,
        };
      });

      setNewFromFriends(recentTracks);

    } catch (error) {
      console.log('Friends feed failed', error);
      setNewFromFriends([]);
      setFriendFeedError('Friends activity is temporarily unavailable.');
    } finally {
      setFriendFeedLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (!currentUserId) {
        setFriendFeedLoading(false);
        return;
      }

      loadFriendsActivity(currentUserId);
      loadPopularThisWeek();

      const channel = supabase
        .channel(`friends-feed-${currentUserId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_activity',
          },
          (payload) => {
            const activity = payload.new as any;
            const previousActivity = payload.old as any;
            const activityUserId = activity?.user_id || previousActivity?.user_id;

            // Reload for friend inserts/updates/deletes. For deletes, Postgres may
            // send only the primary key unless REPLICA IDENTITY FULL is enabled,
            // so an unknown user ID also triggers a safe refresh.
            if (
              !activityUserId ||
              (activityUserId !== currentUserId &&
                friendIdsRef.current.has(activityUserId))
            ) {
              loadFriendsActivity(currentUserId);
            }
            loadPopularThisWeek();
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }, [currentUserId, loadFriendsActivity, loadPopularThisWeek])
  );

  // Spotify track search
  useEffect(() => {
    if (
      !pickerVisible ||
      selectedTrack ||
      searchQuery.trim().length < 2
    ) {
      setSearchResults([]);
      setSearchingTracks(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setSearchingTracks(true);
      setFormError('');

      try {
        const { data, error } = await supabase.functions.invoke(
          'spotify-search',
          {
            body: {
              action: 'search',
              query: searchQuery.trim(),
              type: 'track',
            },
          }
        );

        if (error) throw error;

        if (!cancelled) {
          setSearchResults(data?.tracks?.items ?? []);
        }
      } catch (error) {
        console.log('Spotify track search failed:', error);

        if (!cancelled) {
          setSearchResults([]);
          setFormError('Search failed. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setSearchingTracks(false);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, pickerVisible, selectedTrack]);

  function openPicker(index: number) {
    setActiveFavIndex(index);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedTrack(null);
    setComment('');
    setFormError('');
    setPickerVisible(true);
  }

  function closePicker() {
    setPickerVisible(false);
    setFormError('');
    setSelectedTrack(null);
  }

  // Save selected song locally and, if logged in, publicly
  async function saveFavorite() {
    if (!selectedTrack) {
      setFormError('Please select a song first.');
      return;
    }

    const favorite = {
      id: selectedTrack.id,
      name: selectedTrack.name,
      artist:
        selectedTrack.artists
          ?.map((artist: any) => artist.name)
          .join(', ') || 'Unknown artist',
      cover: selectedTrack.album?.images?.[0]?.url || '',
      spotifyUrl: selectedTrack.external_urls?.spotify || '',
      comment: comment.trim(),
      pickedAt: new Date().toISOString(),
    };

    setSavingFavorite(true);
    setFormError('');

    try {
      const updatedFavorites = [...monthlyFavs];
      updatedFavorites[activeFavIndex] = favorite;

      // Keep the three positions stable.
      const finalFavorites = updatedFavorites.slice(0, 3);

      await AsyncStorage.setItem(
        `monthly_fav_${getMonthKey()}`,
        JSON.stringify(finalFavorites)
      );

      setMonthlyFavs(finalFavorites);

      // Public sync requires a real authenticated Supabase account.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (user) {
        const username =
          displayName ||
          user.user_metadata?.username ||
          'Music lover';

        const { error: saveError } = await supabase
          .from('monthly_favorites')
          .upsert(
            {
              user_id: user.id,
              username,
              month_key: getMonthKey(),
              slot_index: activeFavIndex,
              track_id: favorite.id,
              track_name: favorite.name,
              artist_name: favorite.artist,
              cover_url: favorite.cover,
              spotify_url: favorite.spotifyUrl,
              comment: favorite.comment,
              picked_at: favorite.pickedAt,
            },
            {
              onConflict: 'user_id,month_key,slot_index',
            }
          );

        if (saveError) {
          console.log('Public favorite sync failed:', saveError);
          setFormError(
            'Saved on this device, but could not publish. Please try again after signing in.'
          );
          return;
        }

        await loadPublicMonthlyFavs(user.id);
      }

      setPickerVisible(false);
      setSelectedTrack(null);
      setSearchQuery('');
      setSearchResults([]);
      setComment('');
    } catch (error) {
      console.log('Failed to save monthly favorite', error);
      setFormError('Could not save your favorite. Please try again.');
    } finally {
      setSavingFavorite(false);
    }
  }

  function changeFavorite() {
    setDetailVisible(false);
    openPicker(activeFavIndex);
  }

  async function removeFavorite() {
    try {
      const updatedFavorites = [...monthlyFavs];
      updatedFavorites[activeFavIndex] = null;

      await AsyncStorage.setItem(
        `monthly_fav_${getMonthKey()}`,
        JSON.stringify(updatedFavorites)
      );

      setMonthlyFavs(updatedFavorites);
      setDetailVisible(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from('monthly_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('month_key', getMonthKey())
          .eq('slot_index', activeFavIndex);

        if (error) {
          console.log('Could not delete public favorite:', error);
        } else {
          await loadPublicMonthlyFavs(user.id);
        }
      }
    } catch (error) {
      console.log('Failed to remove favorite', error);
    }
  }

  async function openFriendTrack(item: any) {
    const trackId = item.item_id ?? item.track_id;
    const trackName = item.item_name ?? item.track_name;
    const artistName = item.artist_name || "";

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
    } catch (error) {
      console.log('Could not open friend track:', error);
    }
  }
  const activeFavorite = monthlyFavs[activeFavIndex];

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor }]}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Musicboxd</Text>
          <TouchableOpacity onPress={() => router.push('/notifications' as any)} style={styles.notificationsButton} accessibilityRole="button" accessibilityLabel="Open notifications">
            <Text style={styles.notificationsIcon}>🔔</Text>
            {unreadNotificationCount > 0 && <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</Text></View>}
          </TouchableOpacity>
        </View>
        <View style={styles.homeNav}>
          <View style={[styles.homeNavTab, styles.homeNavTabActive]}>
            <Text style={[styles.homeNavText, styles.homeNavActive]}>Songs</Text>
          </View>
          <TouchableOpacity style={styles.homeNavTab} onPress={() => router.push('/friends-reviews' as any)}>
            <Text style={styles.homeNavText}>Reviews</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeNavTab} onPress={() => router.push('/friends-lists' as any)}>
            <Text style={styles.homeNavText}>Lists</Text>
          </TouchableOpacity>
        </View>

        {/* MY MONTHLY FAVS */}
        <View style={styles.headingRow}>
          <Text style={styles.headingInline}>Monthly Favs</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.favoritesRow}
        >
          {[0, 1, 2].map((index) => {
            const favorite = monthlyFavs[index];

            return (
              <View key={index} style={styles.favItem}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    if (favorite) {
                      setActiveFavIndex(index);
                      setDetailVisible(true);
                    } else {
                      openPicker(index);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    favorite
                      ? `Open monthly favorite ${index + 1}`
                      : `Add monthly favorite ${index + 1}`
                  }
                >
                  {favorite?.cover ? (
                    <Image
                      source={{ uri: favorite.cover }}
                      style={styles.favCover}
                    />
                  ) : favorite ? (
                    <View style={[styles.favCover, styles.noCover]}>
                      <Text style={styles.noCoverText}>♪</Text>
                    </View>
                  ) : (
                    <View style={[styles.favCover, styles.favPlus]}>
                      <Text style={styles.favPlusText}>+</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {favorite ? (
                  <>
                    <Text style={styles.favUser} numberOfLines={1}>
                      {displayName || 'You'}
                    </Text>

                    <Text style={styles.favSongName} numberOfLines={1}>
                      {favorite.name}
                    </Text>

                    {!!favorite.comment && (
                      <Text style={styles.monthlyComment} numberOfLines={2}>
                        {favorite.comment}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.addSongLabel}>Add song</Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* POPULAR THIS WEEK */}
        <View style={styles.headingRow}>
          <Text style={styles.headingInline}>Popular This Week</Text>
        </View>
        {popularThisWeekLoading ? (
          <ActivityIndicator
            color={accentColor}
            style={styles.sectionLoading}
          />
        ) : popularThisWeekError ? (
          <Text style={styles.sectionError}>
            {popularThisWeekError}
          </Text>
        ) : popularThisWeek.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>
              Popular tracks from this week will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={popularThisWeek.slice(0, 12)}
            keyExtractor={(item: any) => item.item_id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }: any) => (
              <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => openFriendTrack(item)}>
                {item.cover_url ? (
                  <Image
                    source={{ uri: item.cover_url }}
                    style={styles.cover}
                  />
                ) : (
                  <View style={[styles.cover, styles.noCover]}>
                    <Text style={styles.noCoverText}>♪</Text>
                  </View>
                )}

                <Text style={styles.trackName} numberOfLines={1}>
                  {item.item_name}
                </Text>

                <Text style={styles.artistName} numberOfLines={1}>
                  {item.artist_name}
                </Text>

                <Text style={styles.friendName}>
                  {item.listener_count} listeners this week
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
        {/* FRIENDS' MONTHLY FAVS */}
        <View style={styles.headingRow}>
          <Text style={styles.headingInline}>Friends&apos; Monthly Favs</Text>
          <TouchableOpacity onPress={() => router.push('/friends-monthly-favs' as any)} accessibilityRole="button" hitSlop={10}>
            <Text style={{ color: accentColor, fontSize: 25, fontWeight: '400' }}>›</Text>
          </TouchableOpacity>
        </View>
        {friendsMonthlyLoading ? (
          <ActivityIndicator
            color={accentColor}
            style={styles.sectionLoading}
          />
        ) : friendsMonthlyError ? (
          <Text style={styles.sectionError}>
            {friendsMonthlyError}
          </Text>
        ) : friendsMonthlyFavs.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>
              Your friends&apos; monthly favorites will appear here.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesRow}
          >
            {friendsMonthlyFavs.map((favorite) => (
              <TouchableOpacity key={favorite.id} style={styles.friendsFavItem} activeOpacity={0.8} onPress={() => openFriendTrack(favorite)}>
                {favorite.cover_url ? (
                  <Image
                    source={{ uri: favorite.cover_url }}
                    style={styles.friendsFavCover}
                  />
                ) : (
                  <View style={[styles.friendsFavCover, styles.noCover]}>
                    <Text style={styles.noCoverText}>♪</Text>
                  </View>
                )}

                <Text style={styles.favUser} numberOfLines={1}>
                  {favorite.username || 'Music lover'}
                </Text>

                <Text style={styles.favSongName} numberOfLines={1}>
                  {favorite.track_name}
                </Text>

                <Text style={styles.favSongName} numberOfLines={1}>
                  {favorite.artist_name}
                </Text>

                {!!favorite.comment && (
                  <Text style={styles.monthlyComment} numberOfLines={2}>
                    {favorite.comment}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* NEW FROM FRIENDS */}
        <View style={styles.headingRow}>
          <Text style={styles.headingInline}>New from Friends</Text>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/friends-music', params: { type: 'new' } } as any)}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text style={{ color: accentColor, fontSize: 25, fontWeight: '400' }}>›</Text>
          </TouchableOpacity>
        </View>
        {friendFeedLoading ? (
          <ActivityIndicator
            color={accentColor}
            style={styles.sectionLoading}
          />
        ) : friendFeedError ? (
          <Text style={styles.sectionError}>
            {friendFeedError}
          </Text>
        ) : newFromFriends.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>
              Your friends&apos; music activity will appear here.
            </Text>

            <TouchableOpacity
              onPress={() => router.push('/find-people' as any)}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.discoverLink,
                  { color: accentColor },
                ]}
              >
                Find people
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            horizontal
            data={newFromFriends.slice(0, 12)}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => openFriendTrack(item)}>
                {item.cover_url ? (
                  <Image
                    source={{ uri: item.cover_url }}
                    style={styles.cover}
                  />
                ) : (
                  <View style={[styles.cover, styles.noCover]}>
                    <Text style={styles.noCoverText}>♪</Text>
                  </View>
                )}

                <Text style={styles.trackName} numberOfLines={1}>
                  {item.item_name}
                </Text>

                <Text style={styles.artistName} numberOfLines={1}>
                  {item.artist_name}
                </Text>

                {Number(item.rating) > 0 ? (
                  <Text style={styles.ratingText}>
                    {'\u2605'} {Number(item.rating).toFixed(1)}
                  </Text>
                ) : null}
                {item.review?.trim() ? (
                  <Text style={styles.reviewSnippet} numberOfLines={2}>
                    {item.review}
                  </Text>
                ) : null}

                <Text style={styles.friendName}>
                  {item.users?.username}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}

      </ScrollView>

      {/* MONTHLY FAVORITE PICKER */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        onRequestClose={closePicker}
      >
        <View style={[styles.pickerScreen, { backgroundColor }]}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity
              onPress={closePicker}
              style={styles.pickerSide}
            >
              <Text style={styles.pickerCancel}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.pickerTitle}>
              Monthly favorite {activeFavIndex + 1}/3
            </Text>

            <View style={styles.pickerSide} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContent}
          >
            <TextInput
              style={styles.pickerInput}
              placeholder="Search songs..."
              placeholderTextColor="#777"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setSelectedTrack(null);
                setFormError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {searchingTracks && (
              <ActivityIndicator
                color={accentColor}
                style={{ marginVertical: 20 }}
              />
            )}

            {!selectedTrack &&
              searchQuery.trim().length >= 2 &&
              !searchingTracks &&
              searchResults.length === 0 &&
              !formError && (
                <Text style={styles.statusText}>
                  No songs found.
                </Text>
              )}

            {!!formError && (
              <Text style={styles.formError}>
                {formError}
              </Text>
            )}

            {!selectedTrack &&
              searchResults.map((track) => (
                <TouchableOpacity
                  key={track.id}
                  style={styles.searchResult}
                  onPress={() => {
                    setSelectedTrack(track);
                    setSearchResults([]);
                    setFormError('');
                  }}
                >
                  {track.album?.images?.[0]?.url ? (
                    <Image
                      source={{
                        uri: track.album.images[0].url,
                      }}
                      style={styles.searchCover}
                    />
                  ) : (
                    <View
                      style={[
                        styles.searchCover,
                        styles.noCover,
                      ]}
                    >
                      <Text style={styles.noCoverText}>♪</Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text
                      style={styles.searchSongName}
                      numberOfLines={1}
                    >
                      {track.name}
                    </Text>

                    <Text
                      style={styles.searchArtistName}
                      numberOfLines={1}
                    >
                      {track.artists
                        ?.map((artist: any) => artist.name)
                        .join(', ')}
                    </Text>
                  </View>

                  <Text style={styles.addTrackButton}>+</Text>
                </TouchableOpacity>
              ))}

            {selectedTrack && (
              <>
                <Text style={styles.fieldLabel}>
                  Selected song
                </Text>

                <View style={styles.selectedTrack}>
                  {selectedTrack.album?.images?.[0]?.url ? (
                    <Image
                      source={{
                        uri: selectedTrack.album.images[0].url,
                      }}
                      style={styles.searchCover}
                    />
                  ) : (
                    <View
                      style={[
                        styles.searchCover,
                        styles.noCover,
                      ]}
                    >
                      <Text style={styles.noCoverText}>♪</Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text
                      style={styles.searchSongName}
                      numberOfLines={1}
                    >
                      {selectedTrack.name}
                    </Text>

                    <Text
                      style={styles.searchArtistName}
                      numberOfLines={1}
                    >
                      {selectedTrack.artists
                        ?.map((artist: any) => artist.name)
                        .join(', ')}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedTrack(null);
                      setSearchQuery('');
                      setComment('');
                      setFormError('');
                    }}
                  >
                    <Text style={styles.changeTrackText}>
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>
                  Your comment
                </Text>

                <TextInput
                  style={styles.commentInput}
                  placeholder="Describe this song in 7 words..."
                  placeholderTextColor="#777"
                  value={comment}
                  onChangeText={(text) => {
                    if (countWords(text) <= 7) {
                      setComment(text);
                    }
                  }}
                  multiline
                  maxLength={150}
                  textAlignVertical="top"
                />

                <Text
                  style={[
                    styles.characterCount,
                    countWords(comment) === 7 && {
                      color: accentColor,
                    },
                  ]}
                >
                  {countWords(comment)}/7 words
                </Text>
              </>
            )}

            {!!formError && selectedTrack && (
              <Text style={styles.formError}>
                {formError}
              </Text>
            )}

            {selectedTrack && (
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: accentColor },
                  savingFavorite && styles.disabledButton,
                ]}
                onPress={saveFavorite}
                disabled={savingFavorite}
                accessibilityRole="button"
              >
                {savingFavorite ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    Save Favorite
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* FAVORITE DETAILS */}
      <Modal
        visible={detailVisible && !!activeFavorite}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setDetailVisible(false)}
        />

        <View style={styles.sheet}>
          {activeFavorite && (
            <>
              {activeFavorite.cover ? (
                <Image
                  source={{ uri: activeFavorite.cover }}
                  style={styles.sheetCover}
                />
              ) : (
                <View style={[styles.sheetCover, styles.noCover]}>
                  <Text style={styles.noCoverText}>♪</Text>
                </View>
              )}

              <Text style={styles.sheetTitle} numberOfLines={2}>
                {activeFavorite.name}
              </Text>

              <Text style={styles.sheetArtist} numberOfLines={1}>
                {activeFavorite.artist}
              </Text>

              {!!activeFavorite.comment && (
                <View style={styles.commentDisplay}>
                  <Text style={styles.commentDisplayLabel}>
                    YOUR COMMENT
                  </Text>

                  <Text style={styles.commentDisplayText}>
                    {activeFavorite.comment}
                  </Text>
                </View>
              )}

              {!!activeFavorite.spotifyUrl && (
                <TouchableOpacity
                  style={styles.spotifyLink}
                  onPress={() => {
                    router.push({
                      pathname: '/modal' as any,
                      params: { url: activeFavorite.spotifyUrl },
                    });
                  }}
                >
                  <Text style={styles.spotifyLinkText}>
                    Spotify
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.sheetBtn}
                onPress={changeFavorite}
              >
                <Text style={styles.sheetBtnText}>
                  Change favorite
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.removeButton}
                onPress={removeFavorite}
              >
                <Text style={styles.removeButtonText}>
                  Remove favorite
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 42,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  content: {
    paddingBottom: 32,
  },
  notificationsButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notificationsIcon: { color: '#fff', fontSize: 23 },
  notificationBadge: { position: 'absolute', top: 0, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#e04444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notificationBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 10,
  },
  pageTitle: {
    color: 'white',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  homeNav: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#292929',
  },
  homeNavTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 6,
  },
  homeNavTabActive: {
    backgroundColor: '#555555',
  },
  homeNavText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  homeNavActive: {
    color: '#fff',
  },
  heading: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    margin: 16,
    marginBottom: 8,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  headingInline: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  monthLabel: {
    color: '#888',
    fontSize: 13,
  },
  favoritesRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 8,
  },
  favItem: {
    width: 112,
    marginBottom: 8,
  },
  friendsFavItem: {
    width: 100,
    marginBottom: 8,
  },
  friendsFavCover: {
    width: 100,
    height: 100,
    borderRadius: 5,
    backgroundColor: '#1a1a1a',
  },
  favCover: {
    width: 112,
    height: 112,
    borderRadius: 5,
    backgroundColor: '#1a1a1a',
  },
  favPlus: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(29,185,84,0.12)',
    borderWidth: 1.5,
    borderColor: '#1DB954',
  },
  favPlusText: {
    color: '#1DB954',
    fontSize: 42,
    fontWeight: '300',
  },
  favUser: {
    color: 'white',
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  favSongName: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 3,
  },
  addSongLabel: {
    color: '#777',
    fontSize: 12,
    marginTop: 7,
    textAlign: 'center',
  },
  monthlyComment: {
    color: '#aaa',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    fontStyle: 'italic',
  },
  noCover: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#333',
  },
  noCoverText: {
    color: '#888',
    fontSize: 42,
  },
  card: {
    width: 112,
    marginLeft: 12,
    marginBottom: 8,
  },
  cover: {
    width: 112,
    height: 112,
    borderRadius: 5,
    backgroundColor: '#1a1a1a',
  },
  trackName: {
    color: 'white',
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  artistName: {
    color: '#888',
    fontSize: 12,
  },
  ratingText: {
    color: '#1DB954',
    fontSize: 12,
    marginTop: 2,
  },
  reviewSnippet: {
    color: '#aaa',
    fontSize: 10,
    lineHeight: 13,
    marginTop: 3,
  },
  friendName: {
    color: '#555',
    fontSize: 11,
  },
  emptySection: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  emptyText: {
    color: '#777',
    fontSize: 14,
    textAlign: 'center',
  },
  sectionLoading: {
    marginVertical: 18,
  },
  sectionError: {
    color: '#ff8b8b',
    marginHorizontal: 16,
    marginVertical: 12,
  },
  discoverLink: {
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '700',
  },
  pickerScreen: {
    flex: 1,
    paddingTop: 60,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  pickerSide: {
    width: 70,
  },
  pickerCancel: {
    color: '#aaa',
    fontSize: 16,
  },
  pickerTitle: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  formContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  pickerInput: {
    backgroundColor: '#2a2a2a',
    color: 'white',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  statusText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#292929',
  },
  searchCover: {
    width: 54,
    height: 54,
    borderRadius: 6,
    backgroundColor: '#242424',
  },
  searchSongName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  searchArtistName: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  addTrackButton: {
    color: '#1DB954',
    fontSize: 26,
    paddingHorizontal: 8,
  },
  selectedTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#202020',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  changeTrackText: {
    color: '#1DB954',
    fontSize: 12,
    fontWeight: '600',
  },
  fieldLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  commentInput: {
    minHeight: 90,
    backgroundColor: '#2a2a2a',
    color: 'white',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 4,
  },
  characterCount: {
    color: '#777',
    fontSize: 11,
    textAlign: 'right',
  },
  formError: {
    color: '#ff8b8b',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
  },
  saveButton: {
    borderRadius: 24,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1c1c1e',
    padding: 24,
    paddingBottom: 36,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
  },
  sheetCover: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#242424',
  },
  sheetTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sheetArtist: {
    color: '#888',
    fontSize: 15,
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
  },
  commentDisplay: {
    alignSelf: 'stretch',
    backgroundColor: '#252525',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  commentDisplayLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  commentDisplayText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 21,
  },
  spotifyLink: {
    marginBottom: 14,
  },
  spotifyLinkText: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '600',
  },
  sheetBtn: {
    backgroundColor: '#2a2a2a',
    borderRadius: 24,
    paddingVertical: 13,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 10,
  },
  sheetBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    paddingVertical: 12,
  },
  removeButtonText: {
    color: '#ff7777',
    fontSize: 14,
  },
});




