import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { flushPendingActivities } from '@/utils/activity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const tabs = ['Friends', 'Incoming', 'You'] as const;
type ActivityTab = (typeof tabs)[number];

type ActivityEntry = {
  id: string;
  user_id: string;
  activity_type: string;
  item_key: string;
  data: any;
  created_at: string;
};

const activityLabels: Record<string, string> = {
  listened: 'listened to',
  liked: 'liked',
  wants_to_listen: 'wants to listen to',
  reviewed: 'reviewed',
  created_list: 'created a list',
  liked_list: 'liked a list',
  followed_artist: 'followed',
};

function timeAgo(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function titleOf(item: any, fallback = '') {
  return (
    item?.name ||
    item?.title ||
    item?.albumName ||
    item?.track_name ||
    item?.item_name ||
    item?.artistName ||
    fallback ||
    'Untitled'
  );
}

function subtitleOf(item: any) {
  if (item?.artist || item?.artist_name || item?.artistName) {
    return item.artist || item.artist_name || item.artistName;
  }
  if (Array.isArray(item?.artists)) {
    return item.artists.map((artist: any) => artist?.name || artist).filter(Boolean).join(', ');
  }
  if (item?.artists) return String(item.artists);
  if (item?.type === 'list' && item?.itemCount != null) {
    return `${item.itemCount} items`;
  }
  return '';
}

async function loadActivityPages(userIds: string[]) {
  if (!userIds.length) return [] as ActivityEntry[];
  const all: ActivityEntry[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('user_activity')
      .select('id,user_id,activity_type,item_key,data,created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const page = (data || []) as ActivityEntry[];
    all.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export default function Activity() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<ActivityTab>(params.tab === 'You' ? 'You' : 'Friends');
  const [youItems, setYouItems] = useState<ActivityEntry[]>([]);
  const [friendItems, setFriendItems] = useState<ActivityEntry[]>([]);
  const [incomingItems, setIncomingItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const loadAll = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const myId = authData.user?.id;
      if (!myId) {
        setPendingSyncCount(0);
        setYouItems([]);
        setFriendItems([]);
        setIncomingItems([]);
        setProfiles({});
        return;
      }

      const pendingCount = await flushPendingActivities();
      setPendingSyncCount(pendingCount);

      const [followingResult, incomingWithDateResult] = await Promise.all([
        supabase.from('friendships').select('friend_id').eq('user_id', myId),
        supabase.from('friendships').select('user_id,created_at').eq('friend_id', myId),
      ]);
      if (followingResult.error) throw followingResult.error;

      // Some older deployments may not have created_at on friendships.
      // Keep Incoming working even when that optional timestamp is unavailable.
      let incomingRowsData: any[] = incomingWithDateResult.data || [];
      if (incomingWithDateResult.error) {
        const incomingFallback = await supabase
          .from('friendships')
          .select('user_id')
          .eq('friend_id', myId);
        if (incomingFallback.error) throw incomingFallback.error;
        incomingRowsData = incomingFallback.data || [];
      }

      const friendIds = [...new Set(
        (followingResult.data || []).map((row: any) => row.friend_id).filter(Boolean)
      )];
      const incomingIds: string[] = [...new Set<string>(
        incomingRowsData
          .map((row: any) => row.user_id)
          .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      )];
      const profileIds = [...new Set([...friendIds, ...incomingIds, myId])];

      const [ownActivities, friendsActivities, legacyReviews, usersResult] = await Promise.all([
        loadActivityPages([myId]),
        loadActivityPages(friendIds),
        (async () => {
          const raw = await AsyncStorage.getItem('reviews');
          try {
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })(),
        profileIds.length
          ? supabase.from('users').select('id,username,avatar_url').in('id', profileIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (usersResult.error) throw usersResult.error;
      const profileMap: Record<string, any> = {};
      (usersResult.data || []).forEach((user: any) => {
        profileMap[user.id] = {
          username: user.username || 'User',
          avatar: user.avatar_url || null,
        };
      });

      // Keep older device-only reviews visible, without duplicating cloud review events.
      const cloudReviewKeys = new Set(
        ownActivities
          .filter((entry) => entry.activity_type === 'reviewed')
          .map((entry) => String(entry.item_key))
      );
      const legacyEntries: ActivityEntry[] = legacyReviews
        .filter((review: any) => review?.albumId && !cloudReviewKeys.has(String(review.albumId)))
        .map((review: any, index: number) => ({
          id: `legacy-review-${review.id || review.albumId || index}`,
          user_id: myId,
          activity_type: 'reviewed',
          item_key: String(review.albumId),
          data: {
            id: review.albumId,
            name: review.albumName,
            artist: review.albumArtist,
            cover: review.albumCover,
            type: review.itemType || 'album',
            albumId: review.parentAlbumId,
            rating: review.rating,
            review: review.review,
          },
          created_at: review.date || new Date(0).toISOString(),
        }));

      setProfiles(profileMap);
      setYouItems([...ownActivities, ...legacyEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
      setFriendItems(friendsActivities);
      const incomingRows = new Map<string, any>(
        incomingRowsData.map((row: any) => [String(row.user_id), row])
      );
      setIncomingItems(incomingIds.map((id) => ({
        id,
        username: profileMap[id]?.username || 'User',
        avatar: profileMap[id]?.avatar || null,
        created_at: incomingRows.get(id)?.created_at || '',
      })).sort((left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      ));
    } catch (loadError) {
      console.error('Activity loading failed:', loadError);
      setError('Could not load activity. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
      const channel = supabase
        .channel('main-activity-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_activity' },
          () => { void loadAll(false); }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friendships' },
          () => { void loadAll(false); }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }, [loadAll])
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadAll(false);
  }, [loadAll]);

  function openEntry(entry: ActivityEntry) {
    const item = entry.data || {};
    if (entry.activity_type === 'followed_artist' || item.type === 'artist') {
      const artistId = item.id || entry.item_key;
      if (artistId) router.push(`/artist/${artistId}` as any);
      return;
    }
    if (entry.activity_type === 'created_list' || item.type === 'list') {
      router.push({
        pathname: '/lists',
        params: { userId: entry.user_id },
      } as any);
      return;
    }
    const albumId = item.type === 'track'
      ? item.albumId || item.parentAlbumId
      : item.id || entry.item_key;
    if (albumId) router.push(`/album/${albumId}` as any);
  }

  function renderActivity(entry: ActivityEntry, isOwn = false) {
    const item = entry.data || {};
    const user = profiles[entry.user_id];
    const username = isOwn ? 'You' : (user?.username || 'User');
    const avatar = user?.avatar;
    const action = activityLabels[entry.activity_type] || 'updated';
    const title = titleOf(item, entry.item_key);
    const subtitle = subtitleOf(item);
    const comment = item.review || item.comment || item.notes || (entry.activity_type === 'created_list' ? item.description : '');

    return (
      <TouchableOpacity
        key={entry.id}
        style={styles.row}
        activeOpacity={0.75}
        onPress={() => openEntry(entry)}
        accessibilityRole="button"
        accessibilityLabel={`${username} ${action} ${title}`}
      >
        {avatar
          ? <Image source={{ uri: avatar }} style={styles.avatar} />
          : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{username.charAt(0).toUpperCase()}</Text></View>}
        <View style={styles.info}>
          <Text style={styles.text}>
            <Text style={styles.username}>{username}</Text>
            {' '}{action}{' '}
            <Text style={styles.song}>{title}</Text>
          </Text>
          {!!subtitle && <Text style={styles.subtitle}>{String(subtitle)}</Text>}
          {Number(item.rating) > 0 && (
            <View style={styles.ratingStars}>
              {Array.from({ length: 5 }, (_, index) => (
                <Text
                  key={index}
                  style={[
                    styles.ratingStar,
                    Number(item.rating) >= index + 1 && styles.ratingStarActive,
                  ]}
                >
                  ★
                </Text>
              ))}
            </View>
          )}
          {!!comment && <Text style={styles.comment} numberOfLines={3}>{String(comment)}</Text>}
          <Text style={styles.time}>{timeAgo(entry.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderIncoming(item: any) {
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.row}
        activeOpacity={0.75}
        onPress={() => router.push(`/user/${item.id}` as any)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.username}'s profile`}
      >
        {item.avatar
          ? <Image source={{ uri: item.avatar }} style={styles.avatar} />
          : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{item.username.charAt(0).toUpperCase()}</Text></View>}
        <View style={styles.info}>
          <Text style={styles.text}>
            <Text style={styles.username}>{item.username}</Text>
            {' '}started following you
          </Text>
          <Text style={styles.time}>
            {item.created_at ? timeAgo(item.created_at) : 'View profile'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const itemsCount = activeTab === 'You'
    ? youItems.length
    : activeTab === 'Incoming'
      ? incomingItems.length
      : friendItems.length;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={styles.header}>Activity</Text>
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTab]}>{tab}</Text>
            {activeTab === tab && <View style={[styles.underline, { backgroundColor: accentColor }]} />}
          </TouchableOpacity>
        ))}
      </View>
      {pendingSyncCount > 0 && (
        <Text style={styles.syncWarning}>
          {pendingSyncCount} activity {pendingSyncCount === 1 ? 'update is' : 'updates are'} waiting to sync. Keep the app online and reopen Activity to retry.
        </Text>
      )}
      {loading ? (
        <ActivityIndicator color={accentColor} style={{ marginTop: 32 }} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.empty}>{error}</Text>
          <TouchableOpacity onPress={() => loadAll()} style={styles.retryButton}>
            <Text style={[styles.retryText, { color: accentColor }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={accentColor} />}
        >
          {itemsCount === 0 ? (
            <Text style={styles.empty}>
              {activeTab === 'Friends'
                ? 'შენი მეგობრების აქტივობა ჯერ არ არის'
                : activeTab === 'Incoming'
                  ? 'No new followers yet.'
                  : 'ჯერ არ გაქვს აქტივობა'}
            </Text>
          ) : activeTab === 'You' ? (
            youItems.map((entry) => renderActivity(entry, true))
          ) : activeTab === 'Incoming' ? (
            incomingItems.map(renderIncoming)
          ) : (
            friendItems.map((entry) => renderActivity(entry))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#fff', paddingHorizontal: 20, marginBottom: 16 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  tabBtn: { marginRight: 24, alignItems: 'center' },
  tabText: { color: '#777', fontSize: 16, fontWeight: '600', paddingBottom: 4 },
  activeTab: { color: '#fff' },
  underline: { height: 2, width: '100%' },
  listContent: { paddingTop: 2, paddingBottom: 32 },
  row: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 22 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#333', marginRight: 12 },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#333', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#ddd', fontSize: 16, fontWeight: '700' },
  info: { flex: 1 },
  text: { color: '#ccc', fontSize: 14, lineHeight: 20 },
  username: { color: '#fff', fontWeight: 'bold' },
  song: { color: '#00b4d8', fontWeight: '600' },
  subtitle: { color: '#999', fontSize: 12, marginTop: 3 },
  ratingStars: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingStar: { color: '#555', fontSize: 15, marginRight: 2 },
  ratingStarActive: { color: '#ffc2d4' },
  comment: { color: '#bbb', fontSize: 12, lineHeight: 18, marginTop: 5 },
  time: { color: '#666', fontSize: 11, marginTop: 5 },
  emptyState: { alignItems: 'center', paddingHorizontal: 24 },
  empty: { color: '#777', textAlign: 'center', marginTop: 40, fontSize: 15 },
  retryButton: { padding: 12, marginTop: 8 },
  retryText: { fontSize: 14, fontWeight: '700' },
  syncWarning: { color: '#e6b85c', fontSize: 12, paddingHorizontal: 20, marginBottom: 10, lineHeight: 17 },
});
