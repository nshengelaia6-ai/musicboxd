
import { useAppTheme } from '@/context/ThemeContext';
import { sendMusicToFriend, shareMusicItem } from '@/utils/sharing';
import { recordActivity } from '@/utils/activity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import StarRating from './StarRating';


const DOTS = '\u00B7\u00B7\u00B7';
const BULLET = '\u2022';
const BACK = '\u2039';
const CHECK = '\u2713';
const HEART_FILLED = '\u2665';
const HEART_EMPTY = '\u2661';
const EYE = '\u{1F441}\uFE0F';
const CLOCK = '\u{1F550}';

type Friend = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

export default function AlbumPage() {
  const { id, highlightTrackId } = useLocalSearchParams();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();

  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [albumReviews, setAlbumReviews] = useState<any[]>([]);
  const [albumReviewPeople, setAlbumReviewPeople] = useState<Record<string, any>>({});
  const [trackReviews, setTrackReviews] = useState<any[]>([]);
  const [trackReviewPeople, setTrackReviewPeople] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [menuVisible, setMenuVisible] = useState(false);
  const [listened, setListened] = useState(false);
  const [liked, setLiked] = useState(false);
  const [wantToListen, setWantToListen] = useState(false);
  const [rating, setRating] = useState(0);

  const [trackMenuVisible, setTrackMenuVisible] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [trackListened, setTrackListened] = useState(false);
  const [trackLiked, setTrackLiked] = useState(false);
  const [trackWantToListen, setTrackWantToListen] = useState(false);
  const [trackRating, setTrackRating] = useState(0);

  const [showLists, setShowLists] = useState(false);
  const [userLists, setUserLists] = useState<any[]>([]);
  const [showReviewSaved, setShowReviewSaved] = useState(false);

  const [shareFriendsVisible, setShareFriendsVisible] = useState(false);
  const [shareFriends, setShareFriends] = useState<Friend[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareItem, setShareItem] = useState<any>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const [shareSuccess, setShareSuccess] = useState('');

  const scrollViewRef = useRef<ScrollView>(null);
  const trackRowOffsets = useRef<{ [key: string]: number }>({});
  const headerHeight = useRef(0);

  useEffect(() => {
    if (!highlightTrackId || tracks.length === 0) return;

    const timer = setTimeout(() => {
      const y = trackRowOffsets.current[highlightTrackId as string];

      if (typeof y === 'number') {
        scrollViewRef.current?.scrollTo({
          y: Math.max(y - 100, 0),
          animated: true,
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [highlightTrackId, tracks]);

  const checkReviewSavedNotification = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem('review_saved_notification');
      if (!data) return;

      const notification = JSON.parse(data);

      if (!notification?.time) {
        await AsyncStorage.removeItem('review_saved_notification');
        return;
      }

      if (Date.now() - notification.time > 5000) {
        await AsyncStorage.removeItem('review_saved_notification');
        return;
      }

      setShowReviewSaved(true);
      await AsyncStorage.removeItem('review_saved_notification');

      setTimeout(() => setShowReviewSaved(false), 2000);
    } catch (e) {
      console.log('Notification error:', e);
    }
  }, []);

  // Load album through Supabase instead of the user's Spotify account.
  const loadAlbum = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const albumId = Array.isArray(id) ? id[0] : id;

      if (!albumId) {
        throw new Error('Album ID is missing.');
      }

      const { data, error } = await supabase.functions.invoke(
        'spotify-search',
        {
          body: {
            action: 'album',
            id: albumId,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.id) {
        throw new Error('Album not found.');
      }

      setAlbum(data);
      setTracks(data.tracks?.items || []);

      try {
        const { data: recentReviews, error: recentReviewsError } = await supabase
          .from('music_reviews')
          .select('id,user_id,rating,review_text,created_at,updated_at')
          .eq('item_type', 'album')
          .eq('item_id', String(data.id))
          .order('updated_at', { ascending: false })
          .limit(3);
        if (recentReviewsError) throw recentReviewsError;
        const reviewerIds = [...new Set((recentReviews || []).map((review: any) => review.user_id))];
        const { data: reviewerProfiles, error: reviewerProfilesError } = reviewerIds.length
          ? await supabase.from('users').select('id,username,avatar_url').in('id', reviewerIds)
          : { data: [], error: null };
        if (reviewerProfilesError) throw reviewerProfilesError;
        const reviewerMap: Record<string, any> = {};
        (reviewerProfiles || []).forEach((person: any) => { reviewerMap[person.id] = person; });
        setAlbumReviews(recentReviews || []);
        setAlbumReviewPeople(reviewerMap);
      } catch (reviewLoadError) {
        console.warn('Could not load album reviews:', reviewLoadError);
        setAlbumReviews([]);
        setAlbumReviewPeople({});
      }

      const listenedData = await AsyncStorage.getItem('listened');
      const listenedList = listenedData ? JSON.parse(listenedData) : [];
      const foundListened = listenedList.find(
        (i: any) => i.id === data.id
      );

      setListened(!!foundListened);
      setRating(foundListened?.rating || 0);

      const wantData = await AsyncStorage.getItem('wantToListen');
      const wantList = wantData ? JSON.parse(wantData) : [];
      setWantToListen(
        !!wantList.find((i: any) => i.id === data.id)
      );

      const likedData = await AsyncStorage.getItem('liked');
      const likedList = likedData ? JSON.parse(likedData) : [];
      setLiked(
        !!likedList.find((i: any) => i.id === data.id)
      );

      const reviewsData = await AsyncStorage.getItem('reviews');
      const reviewsList = reviewsData ? JSON.parse(reviewsData) : [];
      const foundReview = reviewsList.find(
        (i: any) => i.albumId === data.id
      );

      if (foundReview?.rating) {
        setRating(foundReview.rating);
      }
    } catch (error) {
      console.log('Album loading error:', error);

      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load this album.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadAlbum();
      checkReviewSavedNotification();
    }, [loadAlbum, checkReviewSavedNotification])
  );

  async function openTrackMenu(track: any) {
    setSelectedTrack(track);
    setTrackMenuVisible(true);
    setTrackReviews([]);
    setTrackReviewPeople({});
    try {
      const { data: recentTrackReviews, error: trackReviewsError } = await supabase
        .from('music_reviews')
        .select('id,user_id,rating,review_text,created_at,updated_at')
        .eq('item_type', 'track')
        .eq('item_id', String(track.id))
        .order('updated_at', { ascending: false })
        .limit(3);
      if (trackReviewsError) throw trackReviewsError;
      const reviewerIds = [...new Set((recentTrackReviews || []).map((review: any) => review.user_id))];
      const { data: reviewerProfiles, error: reviewerProfilesError } = reviewerIds.length
        ? await supabase.from('users').select('id,username,avatar_url').in('id', reviewerIds)
        : { data: [], error: null };
      if (reviewerProfilesError) throw reviewerProfilesError;
      const reviewerMap: Record<string, any> = {};
      (reviewerProfiles || []).forEach((person: any) => { reviewerMap[person.id] = person; });
      setTrackReviews(recentTrackReviews || []);
      setTrackReviewPeople(reviewerMap);
    } catch (trackReviewLoadError) {
      console.warn('Could not load track reviews:', trackReviewLoadError);
    }

    const listenedData = await AsyncStorage.getItem('listened');
    const listenedList = listenedData ? JSON.parse(listenedData) : [];
    const foundListened = listenedList.find(
      (i: any) => i.id === track.id
    );

    setTrackListened(!!foundListened);
    setTrackRating(foundListened?.rating || 0);

    const wantData = await AsyncStorage.getItem('wantToListen');
    const wantList = wantData ? JSON.parse(wantData) : [];
    setTrackWantToListen(
      !!wantList.find((i: any) => i.id === track.id)
    );

    const likedData = await AsyncStorage.getItem('liked');
    const likedList = likedData ? JSON.parse(likedData) : [];
    setTrackLiked(
      !!likedList.find((i: any) => i.id === track.id)
    );

    const reviewsData = await AsyncStorage.getItem('reviews');
    const reviewsList = reviewsData ? JSON.parse(reviewsData) : [];
    const foundReview = reviewsList.find(
      (i: any) => i.albumId === track.id
    );

    if (foundReview?.rating) setTrackRating(foundReview.rating);
  }

  async function openShareWithFriends(item: any) {
    setMenuVisible(false);
    setTrackMenuVisible(false);

    setShareItem(item);
    setSelectedFriendId('');
    setShareMessage('');
    setShareError('');
    setShareSuccess('');
    setShareFriends([]);
    setShareFriendsVisible(true);
    setShareLoading(true);

    try {
      const myId = await AsyncStorage.getItem('supabase_user_id');

      if (!myId) {
        setShareError('Please sign in again to share music.');
        return;
      }

      const { data, error } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${myId},friend_id.eq.${myId}`);

      if (error) throw error;

      const friendIds = [...new Set((data || [])
        .map((row: any) => row.user_id === myId ? row.friend_id : row.user_id)
        .filter(Boolean))];

      if (friendIds.length === 0) {
        setShareError('No friends found. Follow people first.');
        return;
      }

      const { data: people, error: peopleError } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', friendIds)
        .order('username');

      if (peopleError) throw peopleError;

      setShareFriends(people || []);

      if (!people?.length) {
        setShareError('No friends found. Follow people first.');
      }
    } catch (error) {
      console.log('Load friends error:', error);
      setShareError('Could not load friends. Please try again.');
    } finally {
      setShareLoading(false);
    }
  }

  async function sendToSelectedFriend() {
    if (!shareItem || !selectedFriendId) {
      setShareError('Please select a friend first.');
      return;
    }

    setShareLoading(true);
    setShareError('');
    setShareSuccess('');

    try {
      await sendMusicToFriend(
        shareItem,
        selectedFriendId,
        shareMessage
      );

      setShareSuccess('Music sent successfully!');
      setShareMessage('');

      setTimeout(() => {
        setShareFriendsVisible(false);
        setShareSuccess('');
      }, 1000);
    } catch (error: any) {
      console.log('Send music error:', error);
      setShareError(
        error?.message || 'Could not send music. Please try again.'
      );
    } finally {
      setShareLoading(false);
    }
  }

  function openReviews(itemType: 'album' | 'track', itemId: string, itemName: string, artistName: string, coverUrl: string, parentAlbumId?: string) {
    router.push({
      pathname: '/reviews',
      params: { itemType, itemId, itemName, artistName, coverUrl, parentAlbumId: parentAlbumId || '' },
    } as any);
  }

  async function openTrack(track: any) {
    await WebBrowser.openBrowserAsync(
      `https://open.spotify.com/track/${track.id}`
    );
  }

  async function openListPicker() {
    const data = await AsyncStorage.getItem('lists');
    setUserLists(data ? JSON.parse(data) : []);
    setMenuVisible(false);
    setTrackMenuVisible(false);
    setShowLists(true);
  }

  async function updateRating(newRating: number) {
    setRating(newRating);
    setListened(true);

    const existing = await AsyncStorage.getItem('listened');
    const list = existing ? JSON.parse(existing) : [];
    const idx = list.findIndex((i: any) => i.id === album?.id);

    const itemData = {
      id: album?.id,
      name: album?.name,
      cover: album?.images?.[0]?.url,
      type: 'album',
      rating: newRating,
      date: new Date().toISOString(),
    };

    if (idx !== -1) {
      list[idx].rating = newRating;
    } else {
      list.unshift(itemData);
    }

    await AsyncStorage.setItem('listened', JSON.stringify(list));

    if (idx === -1 && album?.id) {
      await recordActivity('listened', album.id, itemData);
    }
  }

  async function updateTrackRating(newRating: number) {
    setTrackRating(newRating);
    setTrackListened(true);

    const existing = await AsyncStorage.getItem('listened');
    const list = existing ? JSON.parse(existing) : [];
    const idx = list.findIndex(
      (i: any) => i.id === selectedTrack?.id
    );

    const itemData = {
      id: selectedTrack?.id,
      name: selectedTrack?.name,
      artist: selectedTrack?.artists?.map((artist: any) => artist.name).join(', ') || '',
      cover: album?.images?.[0]?.url,
      type: 'track',
      albumId: album?.id,
      rating: newRating,
      date: new Date().toISOString(),
    };

    if (idx !== -1) {
      list[idx].rating = newRating;
      list[idx].albumId = album?.id;
    } else {
      list.unshift(itemData);
    }

    await AsyncStorage.setItem('listened', JSON.stringify(list));

    if (idx === -1 && selectedTrack?.id) {
      await recordActivity('listened', selectedTrack.id, itemData);
    }
  }
  return (
    <View style={[styles.screen, { backgroundColor }]}>
      {loading && (
        <ActivityIndicator
          color={accentColor}
          size="large"
          style={{ marginTop: 100 }}
        />
      )}

      {!loading && !!loadError && (
        <View style={styles.loadErrorContainer}>
          <Text style={styles.loadErrorText}>{loadError}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: accentColor }]}
            onPress={loadAlbum}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.container}
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {album && (
          <View
            style={styles.header}
            onLayout={e => {
              headerHeight.current = e.nativeEvent.layout.height;
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>{BACK}</Text>
            </TouchableOpacity>

            {album.images?.[0]?.url ? (
              <Image
                source={{ uri: album.images[0].url }}
                style={styles.cover}
              />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]} />
            )}

            <Text style={styles.albumName}>{album.name}</Text>
            <Text style={styles.meta}>
              {album.artists?.[0]?.name}
            </Text>
            <Text style={styles.meta}>
              {`${album.album_type} ${BULLET} ${album.release_date} ${BULLET} ${album.total_tracks} tracks`}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setSelectedTrack(null);
                setMenuVisible(true);
              }}
              style={styles.dotsBtn}
            >
              <Text style={styles.dots}>{DOTS}</Text>
            </TouchableOpacity>
          </View>
        )}

        {album && (
          <TouchableOpacity
            style={{ paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#252525', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            onPress={() => openReviews('album', album.id, album.name, album.artists?.[0]?.name || '', album.images?.[0]?.url || '', album.id)}
          >
            <View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Reviews</Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>What listeners think about this album</Text>
            </View>
            <Text style={{ color: accentColor, fontSize: 14, fontWeight: '700' }}>See all ›</Text>
          </TouchableOpacity>
        )}

        {album && (
          <View style={{ paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#252525' }}>
            <TouchableOpacity
              onPress={() => openReviews('album', album.id, album.name, album.artists?.[0]?.name || '', album.images?.[0]?.url || '', album.id)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: albumReviews.length ? 12 : 0 }}
            >
              <View>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Reviews</Text>
                <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{albumReviews.length ? 'Recent listener reviews' : 'Be the first to review this album'}</Text>
              </View>
              <Text style={{ color: accentColor, fontSize: 14, fontWeight: '700' }}>See all ›</Text>
            </TouchableOpacity>
            {albumReviews.map((review: any) => (
              <View key={review.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#252525' }}>
                <Text style={{ color: '#ddd', fontSize: 13, fontWeight: '600' }}>@{albumReviewPeople[review.user_id]?.username || 'listener'}  ·  {'★'.repeat(Math.floor(Number(review.rating) || 0))}{Number(review.rating) % 1 ? '½' : ''}</Text>
                {!!review.review_text && <Text style={{ color: '#aaa', fontSize: 13, lineHeight: 19, marginTop: 5 }} numberOfLines={3}>{review.review_text}</Text>}
              </View>
            ))}
          </View>
        )}

        <View>
          {tracks.map((item, index) => {
            const isHighlighted =
              highlightTrackId && item.id === highlightTrackId;

            return (
              <View
                key={item.id ? `${item.id}-${index}` : String(index)}
                style={[
                  styles.row,
                  isHighlighted && { backgroundColor: accentColor + '26' },
                ]}
                onLayout={e => {
                  trackRowOffsets.current[item.id] =
                    headerHeight.current + e.nativeEvent.layout.y;
                }}
              >
                <TouchableOpacity
                  style={styles.rowMain}
                  onPress={() => openTrack(item)}
                >
                  <Text style={styles.num}>{index + 1}</Text>
                  <View style={styles.info}>
                    <Text
                      style={[
                        styles.trackName,
                        isHighlighted && {
                          color: accentColor,
                          fontWeight: 'bold',
                        },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.artist}>
                      {item.artists?.[0]?.name}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.trackDotsBtn}
                  onPress={() => openTrackMenu(item)}
                >
                  <Text style={styles.trackDots}>{DOTS}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {showReviewSaved && (
        <View style={styles.toast}>
          <Text style={styles.toastCheck}>{CHECK}</Text>
          <Text style={styles.toastText}>Review saved</Text>
        </View>
      )}

      {/* ALBUM MENU */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => setMenuVisible(false)}
        />

        <View style={styles.sheet}>
          {album && (
            <View style={styles.sheetHeader}>
              <Image
                source={{ uri: album.images?.[0]?.url }}
                style={styles.sheetCover}
              />
              <View style={styles.sheetInfo}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {album.name}
                </Text>
                <Text style={styles.sheetArtist}>
                  {album.artists?.[0]?.name}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                const newVal = !listened;
                setListened(newVal);

                const existing = await AsyncStorage.getItem('listened');
                const list = existing ? JSON.parse(existing) : [];

                if (newVal) {
                  if (!list.find((i: any) => i.id === album.id)) {
                    list.unshift({
                      id: album.id,
                      name: album.name,
                      cover: album.images?.[0]?.url,
                      type: 'album',
                      rating,
                      date: new Date().toISOString(),
                    });
                    await recordActivity('listened', album.id, list[0]);
}
                } else {
                  const idx = list.findIndex((i: any) => i.id === album.id);
                  if (idx !== -1) list.splice(idx, 1);
                  setRating(0);
                }

                await AsyncStorage.setItem('listened', JSON.stringify(list));
              }}
            >
              <View
                style={[
                  styles.actionIcon,
                  listened && { backgroundColor: accentColor },
                ]}
              >
                <Text style={styles.actionEmoji}>{EYE}</Text>
              </View>
              <Text style={styles.actionText}>Listened</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                const newVal = !liked;
                setLiked(newVal);

                const existing = await AsyncStorage.getItem('liked');
                const list = existing ? JSON.parse(existing) : [];

                if (newVal) {
                  if (!list.find((i: any) => i.id === album.id)) {
                    list.unshift({
                      id: album.id,
                      name: album.name,
                      cover: album.images?.[0]?.url,
                      type: 'album',
                      date: new Date().toISOString(),
                    });
                    await recordActivity('liked', album.id, list[0]);
}
                } else {
                  const idx = list.findIndex((i: any) => i.id === album.id);
                  if (idx !== -1) list.splice(idx, 1);
                }

                await AsyncStorage.setItem('liked', JSON.stringify(list));
              }}
            >
              <View
                style={[
                  styles.actionIcon,
                  liked && { backgroundColor: accentColor },
                ]}
              >
                <Text style={styles.actionEmoji}>
                  {liked ? HEART_FILLED : HEART_EMPTY}
                </Text>
              </View>
              <Text style={styles.actionText}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                const newVal = !wantToListen;
                setWantToListen(newVal);

                const existing = await AsyncStorage.getItem('wantToListen');
                const list = existing ? JSON.parse(existing) : [];

                if (newVal) {
                  if (!list.find((i: any) => i.id === album.id)) {
                    list.unshift({
                      id: album.id,
                      name: album.name,
                      cover: album.images?.[0]?.url,
                      type: 'album',
                    });
                    await recordActivity('wants_to_listen', album.id, list[0]);
}
                } else {
                  const idx = list.findIndex((i: any) => i.id === album.id);
                  if (idx !== -1) list.splice(idx, 1);
                }

                await AsyncStorage.setItem('wantToListen', JSON.stringify(list));
              }}
            >
              <View
                style={[
                  styles.actionIcon,
                  wantToListen && { backgroundColor: accentColor },
                ]}
              >
                <Text style={styles.actionEmoji}>{CLOCK}</Text>
              </View>
              <Text style={styles.actionText}>Want to Listen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rateSection}>
            <Text style={styles.rateLabel}>Rate</Text>
            <StarRating rating={rating} onChange={updateRating} />
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setMenuVisible(false);
              router.push({
                pathname: '/review/new',
                params: {
                  albumId: album.id,
                  albumName: album.name,
                  albumArtist: album.artists?.[0]?.name,
                  albumCover: album.images?.[0]?.url,
                  itemType: 'album',
                  parentAlbumId: album.id,
                  currentRating: String(rating),
                },
              });
}}
          >
            <Text style={styles.menuText}>Review or log</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={openListPicker}
          >
            <Text style={styles.menuText}>Add to lists</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              openShareWithFriends({
                id: album.id,
                type: 'album',
                name: album.name,
                artist: album.artists?.[0]?.name,
                cover: album.images?.[0]?.url,
              })
            }
          >
            <Text style={styles.menuText}>Share with friends</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={async () => {
              setMenuVisible(false);
              await shareMusicItem({
                id: album.id,
                type: 'album',
                name: album.name,
                artist: album.artists?.[0]?.name,
                cover: album.images?.[0]?.url,
              });
}}
          >
            <Text style={styles.menuText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => setMenuVisible(false)}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* TRACK MENU */}
      <Modal visible={trackMenuVisible} transparent animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => setTrackMenuVisible(false)}
        />

        <View style={styles.sheet}>
          {selectedTrack && (
            <View style={styles.sheetHeader}>
              <Image
                source={{ uri: album?.images?.[0]?.url }}
                style={styles.sheetCover}
              />
              <View style={styles.sheetInfo}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {selectedTrack.name}
                </Text>
                <Text style={styles.sheetArtist}>
                  {selectedTrack.artists?.[0]?.name}
                </Text>
              </View>
            </View>
          )}

          {trackReviews.length > 0 && (
            <View style={{ maxHeight: 150, marginBottom: 12 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Recent reviews</Text>
              {trackReviews.map((review: any) => (
                <View key={review.id} style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#333' }}>
                  <Text style={{ color: '#ddd', fontSize: 12, fontWeight: '600' }}>@{trackReviewPeople[review.user_id]?.username || 'listener'}  ·  {'★'.repeat(Math.floor(Number(review.rating) || 0))}{Number(review.rating) % 1 ? '½' : ''}</Text>
                  {!!review.review_text && <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }} numberOfLines={2}>{review.review_text}</Text>}
                </View>
              ))}
            </View>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                const newVal = !trackListened;
                setTrackListened(newVal);

                const existing = await AsyncStorage.getItem('listened');
                const list = existing ? JSON.parse(existing) : [];

                if (newVal) {
                  if (!list.find((i: any) => i.id === selectedTrack.id)) {
                    list.unshift({
                      id: selectedTrack.id,
                      name: selectedTrack.name,
                      cover: album?.images?.[0]?.url,
                      type: 'track',
                      albumId: album?.id,
                      rating: trackRating,
                      date: new Date().toISOString(),
                    });
                    await recordActivity('listened', selectedTrack.id, list[0]);
}
                } else {
                  const idx = list.findIndex(
                    (i: any) => i.id === selectedTrack.id
                  );
                  if (idx !== -1) list.splice(idx, 1);
                  setTrackRating(0);
                }

                await AsyncStorage.setItem('listened', JSON.stringify(list));
              }}
            >
              <View
                style={[
                  styles.actionIcon,
                  trackListened && { backgroundColor: accentColor },
                ]}
              >
                <Text style={styles.actionEmoji}>{EYE}</Text>
              </View>
              <Text style={styles.actionText}>Listened</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                const newVal = !trackLiked;
                setTrackLiked(newVal);

                const existing = await AsyncStorage.getItem('liked');
                const list = existing ? JSON.parse(existing) : [];

                if (newVal) {
                  if (!list.find((i: any) => i.id === selectedTrack.id)) {
                    list.unshift({
                      id: selectedTrack.id,
                      name: selectedTrack.name,
                      cover: album?.images?.[0]?.url,
                      type: 'track',
                      albumId: album?.id,
                      date: new Date().toISOString(),
                    });
                    await recordActivity('liked', selectedTrack.id, list[0]);
}
                } else {
                  const idx = list.findIndex(
                    (i: any) => i.id === selectedTrack.id
                  );
                  if (idx !== -1) list.splice(idx, 1);
                }

                await AsyncStorage.setItem('liked', JSON.stringify(list));
              }}
            >
              <View
                style={[
                  styles.actionIcon,
                  trackLiked && { backgroundColor: accentColor },
                ]}
              >
                <Text style={styles.actionEmoji}>
                  {trackLiked ? HEART_FILLED : HEART_EMPTY}
                </Text>
              </View>
              <Text style={styles.actionText}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                const newVal = !trackWantToListen;
                setTrackWantToListen(newVal);

                const existing = await AsyncStorage.getItem('wantToListen');
                const list = existing ? JSON.parse(existing) : [];

                if (newVal) {
                  if (!list.find((i: any) => i.id === selectedTrack.id)) {
                    list.unshift({
                      id: selectedTrack.id,
                      name: selectedTrack.name,
                      cover: album?.images?.[0]?.url,
                      type: 'track',
                      albumId: album?.id,
                    });
                    await recordActivity('wants_to_listen', selectedTrack.id, list[0]);
}
                } else {
                  const idx = list.findIndex(
                    (i: any) => i.id === selectedTrack.id
                  );
                  if (idx !== -1) list.splice(idx, 1);
                }

                await AsyncStorage.setItem('wantToListen', JSON.stringify(list));
              }}
            >
              <View
                style={[
                  styles.actionIcon,
                  trackWantToListen && { backgroundColor: accentColor },
                ]}
              >
                <Text style={styles.actionEmoji}>{CLOCK}</Text>
              </View>
              <Text style={styles.actionText}>Want to Listen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rateSection}>
            <Text style={styles.rateLabel}>Rate</Text>
            <StarRating
              rating={trackRating}
              onChange={updateTrackRating}
            />
          </View>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setTrackMenuVisible(false);
              router.push({
                pathname: '/review/new',
                params: {
                  albumId: selectedTrack?.id,
                  albumName: selectedTrack?.name,
                  albumArtist: selectedTrack?.artists?.[0]?.name,
                  albumCover: album?.images?.[0]?.url,
                  itemType: 'track',
                  parentAlbumId: album?.id,
                  currentRating: String(trackRating),
                },
              });
}}
          >
            <Text style={styles.menuText}>Review or log</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setTrackMenuVisible(false);
              openReviews('track', selectedTrack.id, selectedTrack.name, selectedTrack.artists?.[0]?.name || '', album?.images?.[0]?.url || '', album?.id);
            }}
          >
            <Text style={styles.menuText}>Read track reviews</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={openListPicker}
          >
            <Text style={styles.menuText}>Add to lists</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              openShareWithFriends({
                id: selectedTrack.id,
                type: 'track',
                albumId: album?.id,
                name: selectedTrack.name,
                artist: selectedTrack.artists?.[0]?.name,
                cover: album?.images?.[0]?.url,
              })
            }
          >
            <Text style={styles.menuText}>Share with friends</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={async () => {
              setTrackMenuVisible(false);
              await shareMusicItem({
                id: selectedTrack.id,
                type: 'track',
                albumId: album?.id,
                name: selectedTrack.name,
                artist: selectedTrack.artists?.[0]?.name,
                cover: album?.images?.[0]?.url,
              });
}}
          >
            <Text style={styles.menuText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => setTrackMenuVisible(false)}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* SHARE WITH FRIENDS */}
      <Modal
        visible={shareFriendsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareFriendsVisible(false)}
      >
        <View style={styles.shareModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShareFriendsVisible(false)}
          />

          <View style={styles.shareSheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.shareTitle}>Share with friends</Text>

            {shareItem && (
              <View style={styles.shareItemRow}>
                {shareItem.cover ? (
                  <Image
                    source={{ uri: shareItem.cover }}
                    style={styles.sheetCover}
                  />
                ) : (
                  <View style={styles.sheetCoverPlaceholder} />
                )}

                <View style={styles.shareItemInfo}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {shareItem.name}
                  </Text>
                  <Text style={styles.sheetArtist} numberOfLines={1}>
                    {shareItem.artist || 'Unknown artist'}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.shareSectionLabel}>Choose a friend</Text>

            {shareLoading && shareFriends.length === 0 ? (
              <ActivityIndicator
                color={accentColor}
                style={{ marginVertical: 24 }}
              />
            ) : (
              <ScrollView
                style={styles.friendList}
                keyboardShouldPersistTaps="handled"
              >
                {shareFriends.map(friend => {
                  const selected = selectedFriendId === friend.id;

                  return (
                    <TouchableOpacity
                      key={friend.id}
                      style={[
                        styles.friendRow,
                        selected && {
                          borderColor: accentColor,
                          backgroundColor: '#252525',
                        },
                      ]}
                      onPress={() => {
                        setSelectedFriendId(friend.id);
                        setShareError('');
                      }}
                    >
                      {friend.avatar_url ? (
                        <Image
                          source={{ uri: friend.avatar_url }}
                          style={styles.friendAvatar}
                        />
                      ) : (
                        <View style={styles.friendAvatarPlaceholder}>
                          <Text style={styles.friendAvatarLetter}>
                            {(friend.username || '?')
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <Text style={styles.friendName} numberOfLines={1}>
                        {friend.username || 'Spotify listener'}
                      </Text>

                      <View
                        style={[
                          styles.radioOuter,
                          selected && { borderColor: accentColor },
                        ]}
                      >
                        {selected && (
                          <View
                            style={[
                              styles.radioInner,
                              { backgroundColor: accentColor },
                            ]}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.shareSectionLabel}>
              Add a message (optional)
            </Text>

            <TextInput
              style={styles.messageInput}
              value={shareMessage}
              onChangeText={setShareMessage}
              placeholder="What do you want to say?"
              placeholderTextColor="#888"
              multiline
              maxLength={500}
              editable={!shareLoading}
            />

            {!!shareError && (
              <Text style={styles.shareError}>{shareError}</Text>
            )}

            {!!shareSuccess && (
              <Text style={styles.shareSuccess}>{shareSuccess}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: accentColor,
                  opacity:
                    shareLoading || !selectedFriendId ? 0.5 : 1,
                },
              ]}
              onPress={sendToSelectedFriend}
              disabled={shareLoading || !selectedFriendId}
            >
              {shareLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShareFriendsVisible(false);
                setShareError('');
                setShareSuccess('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADD TO LIST */}
      <Modal visible={showLists} transparent animationType="slide">
        <Pressable
          style={styles.overlay}
          onPress={() => setShowLists(false)}
        />

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <Text
            style={[
              styles.sheetTitle,
              { textAlign: 'center', marginBottom: 16 },
            ]}
          >
            Add to List
          </Text>

          {userLists.length === 0 ? (
            <Text
              style={{
                color: '#888',
                textAlign: 'center',
                paddingVertical: 20,
              }}
            >
              No lists yet
            </Text>
          ) : (
            userLists.map(list => (
              <TouchableOpacity
                key={list.id}
                style={styles.menuItem}
                onPress={async () => {
                  const data = await AsyncStorage.getItem('lists');
                  const lists = data ? JSON.parse(data) : [];
                  const idx = lists.findIndex(
                    (l: any) => l.id === list.id
                  );

                  if (idx !== -1) {
                    const listItem = selectedTrack
                      ? {
                          id: selectedTrack.id,
                          name: selectedTrack.name,
                          artist: selectedTrack.artists?.[0]?.name,
                          cover: album.images?.[0]?.url,
                          type: 'track',
                          albumId: album.id,
                        }
                      : {
                          id: album.id,
                          name: album.name,
                          artist: album.artists?.[0]?.name,
                          cover: album.images?.[0]?.url,
                          type: 'album',
                        };

                    const items = lists[idx].albums || [];
                    const alreadyAdded = items.some(
                      (entry: any) =>
                        entry.id === listItem.id &&
                        (entry.type || 'album') === listItem.type
                    );

                    if (!alreadyAdded) {
                      lists[idx].albums = [listItem, ...items];
                    }

                    await AsyncStorage.setItem(
                      'lists',
                      JSON.stringify(lists)
                    );
                  }

                  setShowLists(false);
                }}
              >
                <Text style={styles.menuText}>{list.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  header: { alignItems: 'center', padding: 24, paddingTop: 60 },
  cover: { width: 200, height: 200, borderRadius: 8, marginBottom: 16 },
  coverPlaceholder: { backgroundColor: '#2a2a2a' },
  albumName: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  meta: { color: '#888', fontSize: 14, marginTop: 4, textAlign: 'center' },
  backBtn: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 8,
    zIndex: 10,
  },
  backText: { color: 'white', fontSize: 36, lineHeight: 36 },
  dotsBtn: { position: 'absolute', top: 60, right: 20, padding: 8 },
  dots: { color: 'white', fontSize: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  num: { color: '#555', fontSize: 14, width: 28 },
  info: { flex: 1 },
  trackName: { color: 'white', fontSize: 15 },
  artist: { color: '#888', fontSize: 13, marginTop: 2 },
  trackDotsBtn: { padding: 8, paddingLeft: 12 },
  trackDots: { color: '#888', fontSize: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#1c1c1e',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetInfo: { flex: 1 },
  sheetCover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginRight: 12,
  },
  sheetTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  sheetArtist: { color: '#888', fontSize: 13, marginTop: 2 },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  actionBtn: { alignItems: 'center' },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionEmoji: { fontSize: 24 },
  actionText: { color: '#aaa', fontSize: 12 },
  rateSection: { alignItems: 'center', marginBottom: 24 },
  rateLabel: { color: '#888', fontSize: 13, marginBottom: 10 },
  menuItem: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    alignItems: 'center',
  },
  menuText: { color: 'white', fontSize: 16 },
  doneBtn: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  doneBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
    backgroundColor: '#ffb6c1',
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.25)',
    elevation: 6,
  },
  toastCheck: { color: '#fff', fontSize: 18, fontWeight: '700' },
  toastText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  loadErrorContainer: {
    alignItems: 'center',
    padding: 24,
    marginTop: 70,
  },
  loadErrorText: {
    color: '#ff8b8b',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },

  // Share with friends modal
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  shareSheet: {
    maxHeight: '90%',
    backgroundColor: '#1c1c1e',
    padding: 22,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  shareTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  shareItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#272729',
    borderRadius: 12,
    marginBottom: 18,
  },
  shareItemInfo: { flex: 1 },
  sheetCoverPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#444',
    marginRight: 12,
  },
  shareSectionLabel: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 9,
  },
  friendList: { maxHeight: 190, marginBottom: 16 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#363636',
    borderRadius: 10,
    padding: 10,
    marginBottom: 7,
  },
  friendAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
  },
  friendAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarLetter: { color: '#fff', fontSize: 15, fontWeight: '600' },
  friendName: { color: '#fff', fontSize: 14, flex: 1 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#777',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  messageInput: {
    minHeight: 76,
    maxHeight: 120,
    color: '#fff',
    backgroundColor: '#29292b',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  shareError: {
    color: '#ff8b8b',
    fontSize: 13,
    marginBottom: 10,
  },
  shareSuccess: {
    color: '#72df9a',
    fontSize: 13,
    marginBottom: 10,
  },
  sendButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: {
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelButtonText: { color: '#bbb', fontSize: 15 },
});








