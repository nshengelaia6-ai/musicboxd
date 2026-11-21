
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useAppTheme } from '@/context/ThemeContext';
import { sendMusicToFriend, shareMusicItem } from '@/utils/sharing';
import { recordActivity } from '@/utils/activity';
import { addMusicItemToList, loadUserMusicLists } from '@/utils/musicLists';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';


const DOTS = '\u00B7\u00B7\u00B7';
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
  rating?: number | null;
};

export default function AlbumPage() {
  const { id, highlightTrackId } = useLocalSearchParams();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();

  const [album, setAlbum] = useState<any>(null);
  const [artist, setArtist] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [albumReviews, setAlbumReviews] = useState<any[]>([]);
  const [albumReviewPeople, setAlbumReviewPeople] = useState<Record<string, any>>({});
  const [albumReviewCount, setAlbumReviewCount] = useState(0);
  const [albumRatingAverage, setAlbumRatingAverage] = useState(0);
  const [albumRatingDistribution, setAlbumRatingDistribution] = useState<{ rating: number; count: number }[]>([]);
  const [listenedByFriends, setListenedByFriends] = useState<Friend[]>([]);
  const [wantToListenFriends, setWantToListenFriends] = useState<Friend[]>([]);
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

  async function loadFriendAlbumStatuses(albumId: string) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setListenedByFriends([]);
        setWantToListenFriends([]);
        return;
      }

      // Migrate this account's existing device-only album statuses when it opens the page.
      const [localListenedRaw, localWantRaw] = await Promise.all([
        AsyncStorage.getItem('listened'),
        AsyncStorage.getItem('wantToListen'),
      ]);
      const localListened = localListenedRaw ? JSON.parse(localListenedRaw) : [];
      const localWant = localWantRaw ? JSON.parse(localWantRaw) : [];
      const legacyStatuses = [
        ...(localListened.some((item: any) => String(item.id) === String(albumId) && (item.type || 'album') === 'album')
          ? [{ user_id: user.id, album_id: String(albumId), status: 'listened' }]
          : []),
        ...(localWant.some((item: any) => String(item.id) === String(albumId) && (item.type || 'album') === 'album')
          ? [{ user_id: user.id, album_id: String(albumId), status: 'wants_to_listen' }]
          : []),
      ];
      if (legacyStatuses.length) {
        const { error: migrationError } = await supabase
          .from('music_album_status')
          .upsert(legacyStatuses, { onConflict: 'user_id,album_id,status' });
        if (migrationError) throw migrationError;
      }

      const [followingResult, followersResult] = await Promise.all([
        supabase.from('friendships').select('friend_id').eq('user_id', user.id),
        supabase.from('friendships').select('user_id').eq('friend_id', user.id),
      ]);
      if (followingResult.error) throw followingResult.error;
      if (followersResult.error) throw followersResult.error;

      const followingIds = new Set((followingResult.data || []).map((row: any) => String(row.friend_id)));
      const friendIds = [...new Set((followersResult.data || [])
        .map((row: any) => String(row.user_id))
        .filter((friendId: string) => followingIds.has(friendId)))];

      if (!friendIds.length) {
        setListenedByFriends([]);
        setWantToListenFriends([]);
        return;
      }

      const { data: statuses, error: statusesError } = await supabase
        .from('music_album_status')
        .select('user_id,status')
        .eq('album_id', String(albumId))
        .in('user_id', friendIds);
      if (statusesError) throw statusesError;

      const peopleIds = [...new Set((statuses || []).map((row: any) => String(row.user_id)))];
      const { data: people, error: peopleError } = peopleIds.length
        ? await supabase.from('users').select('id,username,avatar_url').in('id', peopleIds)
        : { data: [], error: null };
      if (peopleError) throw peopleError;

      const { data: reviews, error: reviewsError } = peopleIds.length
        ? await supabase.from('music_reviews')
            .select('user_id,rating')
            .eq('item_type', 'album')
            .eq('item_id', String(albumId))
            .in('user_id', peopleIds)
        : { data: [], error: null };
      if (reviewsError) throw reviewsError;

      const ratingByUser: Record<string, number> = {};
      (reviews || []).forEach((review: any) => {
        ratingByUser[String(review.user_id)] = Number(review.rating) || 0;
      });

      const peopleMap: Record<string, Friend> = {};
      (people || []).forEach((person: any) => {
        peopleMap[String(person.id)] = {
          id: String(person.id),
          username: person.username || null,
          avatar_url: person.avatar_url || null,
          rating: ratingByUser[String(person.id)] || null,
        };
      });

      setListenedByFriends((statuses || [])
        .filter((row: any) => row.status === 'listened' && peopleMap[String(row.user_id)])
        .map((row: any) => peopleMap[String(row.user_id)]));
      setWantToListenFriends((statuses || [])
        .filter((row: any) => row.status === 'wants_to_listen' && peopleMap[String(row.user_id)])
        .map((row: any) => peopleMap[String(row.user_id)]));
    } catch (error) {
      console.warn('Could not load friends album statuses:', error);
      setListenedByFriends([]);
      setWantToListenFriends([]);
    }
  }

  // Load album through Supabase instead of the user's Spotify account.
  const loadAlbum = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setAlbum(null);
    setArtist(null);
    setTracks([]);
    setAlbumReviews([]);
    setAlbumReviewPeople({});
    setAlbumReviewCount(0);
    setAlbumRatingAverage(0);
    setAlbumRatingDistribution([]);
    setListenedByFriends([]);
    setWantToListenFriends([]);

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
      await loadFriendAlbumStatuses(String(data.id));
      setArtist(null);
      const primaryArtistId = data.artists?.[0]?.id;
      if (primaryArtistId) {
        try {
          const { data: artistData, error: artistError } = await supabase.functions.invoke(
            'spotify-search',
            { body: { action: 'artist', id: primaryArtistId } }
          );
          if (artistError) throw artistError;
          if (artistData?.error) throw new Error(artistData.error);
          setArtist(artistData);
        } catch (artistLoadError) {
          console.warn('Could not load artist artwork:', artistLoadError);
        }
      }

      try {
        const { data: recentReviews, error: recentReviewsError, count: totalReviews } = await supabase.from('music_reviews')
          .select('id,user_id,rating,review_text,created_at,updated_at', { count: 'exact' })
          .eq('item_type', 'album')
          .eq('item_id', String(data.id))
          .order('updated_at', { ascending: false })
          .limit(3);
        if (recentReviewsError) throw recentReviewsError;
        setAlbumReviewCount(totalReviews || 0);

        const { data: ratingRows, error: ratingRowsError } = await supabase
          .from('music_reviews')
          .select('rating')
          .eq('item_type', 'album')
          .eq('item_id', String(data.id))
          .gt('rating', 0);
        if (ratingRowsError) throw ratingRowsError;

        const ratingValues = (ratingRows || [])
          .map((row: any) => Number(row.rating))
          .filter((value: number) => Number.isFinite(value) && value > 0 && value <= 5);
        const average = ratingValues.length
          ? ratingValues.reduce((sum: number, value: number) => sum + value, 0) / ratingValues.length
          : 0;
        setAlbumRatingAverage(average);
        setAlbumRatingDistribution(
          Array.from({ length: 10 }, (_, index) => {
            const value = 5 - index * 0.5;
            return {
              rating: value,
              count: ratingValues.filter((rating: number) => rating === value).length,
            };
          })
        );

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
        setAlbumReviewCount(0);
        setAlbumRatingAverage(0);
        setAlbumRatingDistribution([]);
      }

      const listenedData = await AsyncStorage.getItem('listened');
      const listenedList = listenedData ? JSON.parse(listenedData) : [];
      const foundListened = listenedList.find(
        (i: any) => String(i.id) === String(data.id) && (i.type || 'album') === 'album'
      );

      setListened(!!foundListened);
      setRating(foundListened?.rating || 0);

      const wantData = await AsyncStorage.getItem('wantToListen');
      const wantList = wantData ? JSON.parse(wantData) : [];
      setWantToListen(
        !!wantList.find((i: any) => String(i.id) === String(data.id) && (i.type || 'album') === 'album')
      );

      const likedData = await AsyncStorage.getItem('liked');
      const likedList = likedData ? JSON.parse(likedData) : [];
      setLiked(
        !!likedList.find((i: any) => String(i.id) === String(data.id) && (i.type || 'album') === 'album')
      );

      const reviewsData = await AsyncStorage.getItem('reviews');
      const reviewsList = reviewsData ? JSON.parse(reviewsData) : [];
      const foundReview = reviewsList.find(
        (i: any) => String(i.albumId) === String(data.id) && (i.itemType || 'album') === 'album'
      );

      if (foundReview?.rating) {
        setRating(foundReview.rating);
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: myAlbumReview, error: myAlbumReviewError } = await supabase
          .from('music_reviews')
          .select('rating')
          .eq('user_id', currentUser.id)
          .eq('item_type', 'album')
          .eq('item_id', String(data.id))
          .maybeSingle();
        if (myAlbumReviewError) throw myAlbumReviewError;
        if (myAlbumReview) setRating(Number(myAlbumReview.rating) || 0);
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
      (i: any) => String(i.id) === String(track.id) && i.type === 'track'
    );

    setTrackListened(!!foundListened);
    setTrackRating(foundListened?.rating || 0);

    const wantData = await AsyncStorage.getItem('wantToListen');
    const wantList = wantData ? JSON.parse(wantData) : [];
    setTrackWantToListen(
      !!wantList.find((i: any) => String(i.id) === String(track.id) && i.type === 'track')
    );

    const likedData = await AsyncStorage.getItem('liked');
    const likedList = likedData ? JSON.parse(likedData) : [];
    setTrackLiked(
      !!likedList.find((i: any) => String(i.id) === String(track.id) && i.type === 'track')
    );

    const reviewsData = await AsyncStorage.getItem('reviews');
    const reviewsList = reviewsData ? JSON.parse(reviewsData) : [];
    const foundReview = reviewsList.find(
      (i: any) => String(i.albumId) === String(track.id) && i.itemType === 'track'
    );

    if (foundReview?.rating) setTrackRating(foundReview.rating);

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { data: myTrackReview, error: myTrackReviewError } = await supabase
        .from('music_reviews')
        .select('rating')
        .eq('user_id', currentUser.id)
        .eq('item_type', 'track')
        .eq('item_id', String(track.id))
        .maybeSingle();
      if (myTrackReviewError) throw myTrackReviewError;
      if (myTrackReview) setTrackRating(Number(myTrackReview.rating) || 0);
    }
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('Please sign in again.');

      const [following, followers] = await Promise.all([
        supabase.from('friendships').select('friend_id').eq('user_id', user.id),
        supabase.from('friendships').select('user_id').eq('friend_id', user.id),
      ]);
      if (following.error) throw following.error;
      if (followers.error) throw followers.error;

      const followingIds = new Set((following.data || []).map((row: any) => String(row.friend_id)));
      const mutualIds = [...new Set((followers.data || [])
        .map((row: any) => String(row.user_id))
        .filter((friendId: string) => followingIds.has(friendId)))];

      if (!mutualIds.length) {
        setShareError('No mutual friends found. Follow each other first.');
        return;
      }

      const { data: people, error: peopleError } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', mutualIds)
        .order('username');
      if (peopleError) throw peopleError;
      setShareFriends(people || []);
      if (!people?.length) setShareError('No mutual friends found.');
    } catch (error: any) {
      console.warn('Load mutual friends error:', error);
      setShareError(error?.message || 'Could not load friends. Please try again.');
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
    router.push({
      pathname: '/track/[id]',
      params: { id: String(track.id) },
    } as any);
  }

  async function openListPicker() {
    setMenuVisible(false);
    setTrackMenuVisible(false);
    try {
      const lists = await loadUserMusicLists();
      setUserLists(lists);
      setShowLists(true);
    } catch (error: any) {
      console.error('Could not load music lists:', error);
      Alert.alert('Could not load lists', error?.message || 'Please try again.');
    }
  }

  async function toggleAlbumCollection(kind: 'liked' | 'listened' | 'wantToListen') {
    if (!album) return;
    const stored = await AsyncStorage.getItem(kind);
    const items = stored ? JSON.parse(stored) : [];
    const exists = items.some((item: any) => String(item.id) === String(album.id) && (item.type || 'album') === 'album');
    const next = !exists;
    const item = {
      id: String(album.id),
      name: album.name,
      artist: album.artists?.map((artist: any) => artist.name).join(', ') || '',
      cover: album.images?.[0]?.url || '',
      type: 'album',
      date: new Date().toISOString(),
    };
    const updated = next
      ? [item, ...items]
      : items.filter((entry: any) => !(String(entry.id) === String(album.id) && (entry.type || 'album') === 'album'));
    await AsyncStorage.setItem(kind, JSON.stringify(updated));

    if (kind === 'liked') setLiked(next);
    if (kind === 'listened') setListened(next);
    if (kind === 'wantToListen') setWantToListen(next);

    if (kind === 'listened' || kind === 'wantToListen') {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (user) {
        const status = kind === 'listened' ? 'listened' : 'wants_to_listen';
        const statusQuery = supabase.from('music_album_status');
        const { error } = next
          ? await statusQuery.upsert(
              { user_id: user.id, album_id: String(album.id), status },
              { onConflict: 'user_id,album_id,status' }
            )
          : await statusQuery.delete()
              .eq('user_id', user.id)
              .eq('album_id', String(album.id))
              .eq('status', status);
        if (error) throw error;
        await loadFriendAlbumStatuses(String(album.id));
      }
    }

    if (next) {
      await recordActivity(kind === 'liked' ? 'liked' : kind === 'listened' ? 'listened' : 'wants_to_listen', String(album.id), item);
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
          <>
            <ImageBackground source={{ uri: artist?.images?.[0]?.url || album.images?.[0]?.url }} style={styles.heroBackground} imageStyle={styles.heroBackgroundImage} resizeMode="cover">
              <View style={styles.heroShade} />
              <Svg pointerEvents="none" style={styles.heroFade} viewBox="0 0 400 190" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="albumHeroFade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={backgroundColor} stopOpacity="0" />
                    <Stop offset="0.42" stopColor={backgroundColor} stopOpacity="0.32" />
                    <Stop offset="0.76" stopColor={backgroundColor} stopOpacity="0.82" />
                    <Stop offset="1" stopColor={backgroundColor} stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="400" height="190" fill="url(#albumHeroFade)" />
              </Svg>
              <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.topBarSide}><Text style={styles.backText}>{BACK}</Text></TouchableOpacity>
                <Text style={styles.topBarTitle}>MUSICBOXD</Text>
                <TouchableOpacity onPress={() => { setSelectedTrack(null); setMenuVisible(true); }} style={styles.topBarSide}><Text style={styles.dots}>{DOTS}</Text></TouchableOpacity>
              </View>
              <View style={styles.hero} onLayout={e => { headerHeight.current = e.nativeEvent.layout.height + 72; }}>
                <View style={styles.heroInfo}>
                  <Text style={styles.albumName}>{album.name}</Text>
                  <Text style={styles.artistName}>{album.artists?.map((artist: any) => artist.name).join(', ')}</Text>
                  <Text style={styles.meta}>{album.release_date?.slice(0, 4)}  ·  {album.total_tracks} tracks  ·  {String(album.album_type || 'album').toUpperCase()}</Text>
                </View>
                {album.images?.[0]?.url ? <Image source={{ uri: album.images[0].url }} style={styles.cover} /> : <View style={[styles.cover, styles.coverPlaceholder]} />}
              </View>
            </ImageBackground>

            <View style={styles.albumDescription}>
              <View style={styles.listenRow}>
                <TouchableOpacity
                  style={styles.listenButton}
                  onPress={() => Linking.openURL(album.external_urls?.spotify || `https://open.spotify.com/album/${album.id}`)}
                  accessibilityRole="link"
                  accessibilityLabel="Listen on Spotify"
                >
                  <Text style={styles.listenButtonText}>▶ LISTEN</Text>
                </TouchableOpacity>
                <Text style={styles.durationText}>
                  {tracks.length
                    ? `${Math.floor(tracks.reduce((total: number, track: any) => total + (Number(track.duration_ms) || 0), 0) / 60000)} min`
                    : ''}
                </Text>
              </View>
            </View>
          </>
        )}

        {album && (
          <View style={styles.tracklistHeader}>
            <Text style={styles.sectionTitle}>Tracklist</Text>
            <View style={styles.ratingBlock}>
              <View style={styles.ratingOverview}>
                <View style={styles.ratingHistogram}>
                  {albumRatingDistribution.slice().reverse().map(item => {
                    const maxCount = Math.max(...albumRatingDistribution.map(row => row.count), 1);
                    const barHeight = item.count > 0 ? Math.max(1, (item.count / maxCount) * 30) : 1;
                    return (
                      <View key={item.rating} style={styles.histogramColumn}>
                        <View style={[styles.histogramBar, { height: barHeight }]} />
                      </View>
                    );
                  })}
                </View>
                <View style={styles.ratingOverviewDetails}>
                  <Text style={styles.ratingAverage}>
                    {albumRatingAverage > 0 ? albumRatingAverage.toFixed(1) : '—'}
                  </Text>
                  <Text style={styles.ratingStars}>★★★★★</Text>
                </View>
              </View>
            </View>
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

        {(listenedByFriends.length > 0 || wantToListenFriends.length > 0) && (
          <View style={styles.friendStatusSection}>
            {listenedByFriends.length > 0 && (
              <View style={styles.friendStatusGroup}>
                <View style={styles.friendStatusHeader}>
                  <Text style={styles.friendStatusTitle}>YOUR FRIENDS</Text>
                  <Text style={styles.friendStatusCount}>{listenedByFriends.length} LISTENED</Text>
                </View>
                <View style={styles.friendStatusRule} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendAvatarRow}>
                  {listenedByFriends.map((person) => (
                    <TouchableOpacity key={person.id} style={styles.friendAvatarItem} onPress={() => router.push(`/user/${person.id}` as any)} accessibilityRole="button" accessibilityLabel={`${person.username || 'Friend'} listened to this album`}>
                      <View style={styles.friendAvatarWrap}>
                        {person.avatar_url
                          ? <Image source={{ uri: person.avatar_url }} style={styles.friendStatusAvatar} />
                          : <View style={styles.friendStatusAvatarFallback}><Text style={styles.friendStatusInitial}>{(person.username || 'U').slice(0, 1).toUpperCase()}</Text></View>}
                        <View style={styles.friendAvatarMenu}><Text style={styles.friendAvatarMenuText}>≡</Text></View>
                      </View>
                      <View style={styles.friendRatingStars}>
                        {Array.from({ length: 5 }, (_, index) => (
                          <Text key={index} style={[styles.friendRatingStar, (person.rating || 0) >= index + 0.5 && styles.friendRatingStarActive]}>★</Text>
                        ))}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {wantToListenFriends.length > 0 && (
              <View style={styles.friendStatusGroup}>
                <View style={styles.friendStatusHeader}>
                  <Text style={styles.friendStatusTitle}>WANTS TO LISTEN</Text>
                  <Text style={styles.friendStatusCount}>{wantToListenFriends.length}</Text>
                </View>
                <View style={styles.friendStatusRule} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendAvatarRow}>
                  {wantToListenFriends.map((person) => (
                    <TouchableOpacity key={person.id} style={styles.friendAvatarItem} onPress={() => router.push(`/user/${person.id}` as any)} accessibilityRole="button" accessibilityLabel={`${person.username || 'Friend'} wants to listen to this album`}>
                      <View style={styles.friendAvatarWrap}>
                        {person.avatar_url
                          ? <Image source={{ uri: person.avatar_url }} style={styles.friendStatusAvatar} />
                          : <View style={styles.friendStatusAvatarFallback}><Text style={styles.friendStatusInitial}>{(person.username || 'U').slice(0, 1).toUpperCase()}</Text></View>}
                        <View style={styles.friendAvatarMenu}><Text style={styles.friendAvatarMenuText}>≡</Text></View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {album && (
          <View style={styles.reviewsSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Reviews</Text>
                <Text style={styles.sectionSub}>{albumReviewCount} reviews</Text>
              </View>
              <TouchableOpacity onPress={() => openReviews('album', album.id, album.name, album.artists?.[0]?.name || '', album.images?.[0]?.url || '', album.id)}>
                <Text style={[styles.seeAll, { color: accentColor }]}>See all ›</Text>
              </TouchableOpacity>
            </View>
            {albumReviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Text style={styles.emptyTitle}>No reviews yet</Text>
                <Text style={styles.emptyText}>Be the first to write about this album.</Text>
                <TouchableOpacity onPress={() => router.push({ pathname: '/review/new', params: {
                  albumId: album.id, albumName: album.name, albumArtist: album.artists?.[0]?.name,
                  albumCover: album.images?.[0]?.url, itemType: 'album', parentAlbumId: album.id,
                } } as any)}>
                  <Text style={[styles.emptyLink, { color: accentColor }]}>Write the first review ›</Text>
                </TouchableOpacity>
              </View>
            ) : albumReviews.map((review: any) => {
              const person = albumReviewPeople[review.user_id];
              return (
                <TouchableOpacity key={review.id} style={styles.reviewCard} onPress={() => openReviews('album', album.id, album.name, album.artists?.[0]?.name || '', album.images?.[0]?.url || '', album.id)}>
                  <View style={styles.reviewerRow}>
                    {person?.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{(person?.username || 'L').slice(0, 1).toUpperCase()}</Text></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.username}>@{person?.username || 'listener'}</Text>
                      <Text style={styles.date}>{new Date(review.updated_at || review.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  {Number(review.rating) > 0 && (
                    <Text style={{ color: '#00E054', fontSize: 14, fontWeight: '700', marginTop: 9 }}>
                      {'★'.repeat(Math.floor(Number(review.rating)))}{Number(review.rating) % 1 ? '½' : ''}
                    </Text>
                  )}
                  {!!review.review_text && <Text style={styles.reviewText} numberOfLines={4}>{review.review_text}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}


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
              onPress={() => toggleAlbumCollection('listened')}
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
              onPress={() => void toggleAlbumCollection('liked')}
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
              onPress={() => toggleAlbumCollection('wantToListen')}
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
                <View key={review.id} style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#333' }}>                  <Text style={{ color: '#ddd', fontSize: 12, fontWeight: '600' }}>@{trackReviewPeople[review.user_id]?.username || 'listener'}</Text>
                  {Number(review.rating) > 0 && <Text style={{ color: '#00E054', fontSize: 11, marginTop: 3 }}>{'★'.repeat(Math.floor(Number(review.rating)))}{Number(review.rating) % 1 ? '½' : ''}</Text>}
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
                  if (!list.some((i: any) => String(i.id) === String(selectedTrack.id) && i.type === 'track')) {
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
                    (i: any) => String(i.id) === String(selectedTrack.id) && i.type === 'track'
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
                  if (!list.some((i: any) => String(i.id) === String(selectedTrack.id) && i.type === 'track')) {
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
                    (i: any) => String(i.id) === String(selectedTrack.id) && i.type === 'track'
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
                  if (!list.some((i: any) => String(i.id) === String(selectedTrack.id) && i.type === 'track')) {
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
                    (i: any) => String(i.id) === String(selectedTrack.id) && i.type === 'track'
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
                  const listItem = selectedTrack
                    ? {
                        id: String(selectedTrack.id),
                        name: selectedTrack.name,
                        artist: selectedTrack.artists?.[0]?.name || '',
                        cover: album.images?.[0]?.url || '',
                        type: 'track' as const,
                        albumId: String(album.id),
                      }
                    : {
                        id: String(album.id),
                        name: album.name,
                        artist: album.artists?.[0]?.name || '',
                        cover: album.images?.[0]?.url || '',
                        type: 'album' as const,
                      };

                  try {
                    await addMusicItemToList(String(list.id), listItem);
                    setShowLists(false);
                  } catch (error: any) {
                    console.error('Could not add music to list:', error);
                    Alert.alert('Could not add to list', error?.message || 'Please try again.');
                  }
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
  topBar: { paddingTop: 56, paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarSide: { width: 34, alignItems: 'flex-start' },
  topBarTitle: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  cover: { width: 156, height: 156, borderRadius: 5, backgroundColor: '#2C3440' },
  coverPlaceholder: { backgroundColor: '#2C3440' },
  heroBackground: { height: 440, justifyContent: 'space-between', backgroundColor: '#17191d' },
  heroBackgroundImage: { opacity: 0.72 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8, 10, 14, 0.48)' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 190 },
  hero: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 16, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 24 },
  heroInfo: { flex: 1, alignItems: 'flex-start' },
  albumName: { color: '#fff', fontSize: 29, lineHeight: 34, fontWeight: '800', marginTop: 7 },
  artistName: { color: '#D5DADF', fontSize: 17, marginTop: 7 },
  meta: { color: '#D5DADF', fontSize: 13, marginTop: 9 },
  albumDescription: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  listenButton: { backgroundColor: '#30343A', borderWidth: 1, borderColor: '#555B63', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
  listenButtonText: { color: '#E1E4E8', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  durationText: { color: '#AEB8C2', fontSize: 13, fontWeight: '600' },
  descriptionText: { color: '#AEB8C2', fontSize: 14, lineHeight: 21 },
  typeLabel: { color: '#9BA7B2', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  backText: { color: '#fff', fontSize: 32, lineHeight: 34 },
  dots: { color: '#fff', fontSize: 22 },
  ratingPanel: { marginHorizontal: 18, padding: 15, backgroundColor: '#2C3440', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 13 },
  ratingNumber: { color: '#fff', fontSize: 29, fontWeight: '800' },
  ratingTitle: { color: '#E5E9EC', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  ratingSub: { color: '#9BA7B2', fontSize: 11, marginTop: 4 },
  reviewCount: { alignItems: 'center', paddingLeft: 13, borderLeftWidth: 1, borderLeftColor: '#48525E' },
  reviewCountNumber: { color: '#fff', fontSize: 18, fontWeight: '700' },
  reviewCountLabel: { color: '#9BA7B2', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 19, gap: 5 },
  primaryAction: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 6 },
  primaryActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 6, backgroundColor: 'transparent' },
  reviewAction: { borderWidth: 1, borderRadius: 22 },
  actionActive: { backgroundColor: '#3A4653' },
  actionIcon: { color: '#D5DADF', fontSize: 21, marginBottom: 5 },
  actionText: { color: '#D5DADF', fontSize: 10, fontWeight: '600' },
  friendStatusSection: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#2C3440' },
  friendStatusGroup: { marginBottom: 17 },
  friendStatusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  friendStatusTitle: { color: '#AAB4BF', fontSize: 12, fontWeight: '500', letterSpacing: 1.4 },
  friendStatusCount: { color: '#9BA7B2', fontSize: 10, fontWeight: '500', letterSpacing: 0.7 },
  friendStatusRule: { height: 1, backgroundColor: '#303943', marginBottom: 13 },
  friendAvatarRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 17, paddingRight: 8 },
  friendAvatarItem: { width: 76, alignItems: 'center' },
  friendAvatarWrap: { width: 76, height: 76, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  friendStatusAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3A4653' },
  friendStatusAvatarFallback: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3A4653', alignItems: 'center', justifyContent: 'center' },
  friendStatusInitial: { color: '#fff', fontSize: 23, fontWeight: '700' },
  friendAvatarMenu: { position: 'absolute', top: 0, right: 0, width: 23, height: 23, borderRadius: 12, backgroundColor: '#34404B', borderWidth: 2, borderColor: '#17191D', alignItems: 'center', justifyContent: 'center' },
  friendAvatarMenuText: { color: '#AAB4BF', fontSize: 15, lineHeight: 17, fontWeight: '700' },
  friendRatingStars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  friendRatingStar: { color: '#53616D', fontSize: 13, lineHeight: 15 },
  friendRatingStarActive: { color: '#53616D' },
  reviewsSection: { marginTop: 6 },
  sectionHeader: { paddingHorizontal: 18, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2C3440' },
  sectionTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  sectionSub: { color: '#9BA7B2', fontSize: 11, marginTop: 4 },
  seeAll: { fontSize: 13, fontWeight: '700' },
  emptyReviews: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  emptyTitle: { color: '#E5E9EC', fontSize: 15, fontWeight: '700' },
  emptyText: { color: '#9BA7B2', fontSize: 12, marginTop: 7, textAlign: 'center' },
  emptyLink: { fontSize: 13, fontWeight: '700', marginTop: 13 },
  reviewCard: { paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#2C3440' },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A4653' },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A4653', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '700' },
  username: { color: '#fff', fontSize: 13, fontWeight: '700' },
  date: { color: '#9BA7B2', fontSize: 10, marginTop: 3 },
  stars: { fontSize: 14, fontWeight: '700' },
  reviewText: { color: '#E5E9EC', fontSize: 14, lineHeight: 21, marginTop: 11 },
  tracklistHeader: { paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2C3440', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingBlock: { width: 148, marginLeft: 12 },
  ratingOverview: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, height: 34 },
  ratingHistogram: { flex: 1, height: 32, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1, paddingBottom: 1, borderBottomWidth: 1, borderBottomColor: '#52616F' },
  histogramColumn: { flex: 1, height: 31, justifyContent: 'flex-end', alignItems: 'stretch' },
  histogramBar: { width: '100%', backgroundColor: '#526575', borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  ratingOverviewDetails: { width: 39, alignItems: 'flex-start', justifyContent: 'flex-end', paddingBottom: 0 },
  ratingAverage: { color: '#AAB4BF', fontSize: 14, lineHeight: 15, fontWeight: '400', fontVariant: ['tabular-nums'] },
  ratingStars: { color: '#00C853', fontSize: 7, letterSpacing: 0, marginTop: 0 },
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
  actionEmoji: { fontSize: 24 },
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








