import { useAppTheme } from '@/context/ThemeContext';
import { recordActivity } from '@/utils/activity';
import { getSpotifyTrack } from '@/utils/spotifyCatalog';
import { addMusicItemToList, loadUserMusicLists } from '@/utils/musicLists';
import { sendMusicToFriend, shareMusicItem } from '@/utils/sharing';
import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ActivityIndicator, Alert, Image, ImageBackground, Linking, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type TrackFriend = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  rating?: number | null;
};

export default function TrackPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [track, setTrack] = useState<any>(null);
  const [artistData, setArtistData] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<{ rating: number; count: number }[]>([]);
  const [listenedByFriends, setListenedByFriends] = useState<TrackFriend[]>([]);
  const [wantToListenFriends, setWantToListenFriends] = useState<TrackFriend[]>([]);
  const [people, setPeople] = useState<Record<string, any>>({});
  const [liked, setLiked] = useState(false);
  const [listened, setListened] = useState(false);
  const [wantToListen, setWantToListen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [activityRatingSelection, setActivityRatingSelection] = useState(0);
  const activityRatingSelectionRef = useRef(0);
  const activityRatingStartX = useRef(0);
  const [myActivity, setMyActivity] = useState<any[]>([]);
  const trackRef = useRef<any>(null);
  const updateActivityRating = (value: number) => {
    const next = Math.max(0, Math.min(5, Math.round(value * 2) / 2));
    activityRatingSelectionRef.current = next;
    setActivityRatingSelection(next);
  };
  const [listsVisible, setListsVisible] = useState(false);
  const [userLists, setUserLists] = useState<any[]>([]);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareFriends, setShareFriends] = useState<any[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareError, setShareError] = useState('');
  const [shareLoading, setShareLoading] = useState(false);


  async function loadFriendTrackStatuses(trackId: string) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setListenedByFriends([]);
        setWantToListenFriends([]);
        return;
      }
      const [followingResult, followersResult] = await Promise.all([
        supabase.from('friendships').select('friend_id').eq('user_id', user.id),
        supabase.from('friendships').select('user_id').eq('friend_id', user.id),
      ]);
      if (followingResult.error) throw followingResult.error;
      if (followersResult.error) throw followersResult.error;
      const followingIds = new Set((followingResult.data || []).map((row: any) => String(row.friend_id)));
      const friendIds = [...new Set((followersResult.data || []).map((row: any) => String(row.user_id)).filter((friendId: string) => followingIds.has(friendId)))];
      if (!friendIds.length) {
        setListenedByFriends([]);
        setWantToListenFriends([]);
        return;
      }
      const { data: activityRows, error: activityError } = await supabase
        .from('user_activity')
        .select('user_id,activity_type,created_at')
        .eq('item_key', String(trackId))
        .in('user_id', friendIds)
        .in('activity_type', ['listened', 'wants_to_listen']);
      if (activityError) throw activityError;
      const latestByUser: Record<string, any> = {};
      (activityRows || []).forEach((row: any) => {
        const uid = String(row.user_id);
        if (!latestByUser[uid] || new Date(row.created_at).getTime() > new Date(latestByUser[uid].created_at).getTime()) latestByUser[uid] = row;
      });
      const peopleIds = Object.keys(latestByUser);
      const [{ data: profiles, error: profilesError }, { data: ratings, error: ratingsError }] = await Promise.all([
        peopleIds.length ? supabase.from('users').select('id,username,avatar_url').in('id', peopleIds) : Promise.resolve({ data: [], error: null } as any),
        peopleIds.length ? supabase.from('music_reviews').select('user_id,rating').eq('item_type', 'track').eq('item_id', String(trackId)).in('user_id', peopleIds) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (profilesError) throw profilesError;
      if (ratingsError) throw ratingsError;
      const ratingByUser: Record<string, number> = {};
      (ratings || []).forEach((row: any) => { ratingByUser[String(row.user_id)] = Number(row.rating) || 0; });
      const profileMap: Record<string, TrackFriend> = {};
      (profiles || []).forEach((person: any) => {
        profileMap[String(person.id)] = { id: String(person.id), username: person.username || null, avatar_url: person.avatar_url || null, rating: ratingByUser[String(person.id)] || null };
      });
      setListenedByFriends(peopleIds.filter(uid => latestByUser[uid]?.activity_type === 'listened' && profileMap[uid]).map(uid => profileMap[uid]));
      setWantToListenFriends(peopleIds.filter(uid => latestByUser[uid]?.activity_type === 'wants_to_listen' && profileMap[uid]).map(uid => profileMap[uid]));
    } catch (statusError) {
      console.warn('Could not load friends song statuses:', statusError);
      setListenedByFriends([]);
      setWantToListenFriends([]);
    }
  }

  const loadTrack = useCallback(async () => {
    setLoading(true);
    setError('');
    setTrack(null);
    trackRef.current = null;
    setArtistData(null);
    setReviews([]);
    setPeople({});
    setReviewCount(0);
    setRatingCount(0);
    setAverageRating(0);
    setRatingDistribution([]);
    setMyActivity([]);
    setListenedByFriends([]);
    setWantToListenFriends([]);
    if (!id) {
      setError('Song ID is missing.');
      setLoading(false);
      return;
    }
    try {
      const [trackData, likedData, listenedData, wantData] = await Promise.all([
        getSpotifyTrack(String(id)),
        AsyncStorage.getItem('liked'),
        AsyncStorage.getItem('listened'),
        AsyncStorage.getItem('wantToListen'),
      ]);
      setTrack(trackData);
      trackRef.current = trackData;
      await loadFriendTrackStatuses(String(id));
      setArtistData(null);
      const primaryArtistId = trackData?.artists?.[0]?.id;
      if (primaryArtistId) {
        try {
          const { data: artistResult, error: artistError } = await supabase.functions.invoke(
            'spotify-search',
            { body: { action: 'artist', id: primaryArtistId } }
          );
          if (artistError) throw artistError;
          if (artistResult?.error) throw new Error(artistResult.error);
          setArtistData(artistResult);
        } catch (artistLoadError) {
          console.warn('Could not load artist artwork:', artistLoadError);
        }
      }
      const likedItems = likedData ? JSON.parse(likedData) : [];
      const listenedItems = listenedData ? JSON.parse(listenedData) : [];
      const wantItems = wantData ? JSON.parse(wantData) : [];
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: myReview, error: myReviewError } = await supabase
          .from('music_reviews')
          .select('rating')
          .eq('user_id', currentUser.id)
          .eq('item_type', 'track')
          .eq('item_id', String(id))
          .maybeSingle();
        if (myReviewError) throw myReviewError;
        updateActivityRating(Number(myReview?.rating) || 0);
        const { data: activityRows, error: activityError } = await supabase
          .from('user_activity')
          .select('id,activity_type,item_key,created_at')
          .eq('user_id', currentUser.id)
          .eq('item_key', String(id))
          .order('created_at', { ascending: false })
          .limit(20);
        if (activityError) throw activityError;
        setMyActivity(activityRows || []);
      } else {
        setMyActivity([]);
        updateActivityRating(0);
      }
      setLiked(likedItems.some((item: any) => String(item.id) === String(id) && item.type === 'track'));
      setListened(listenedItems.some((item: any) => String(item.id) === String(id) && item.type === 'track'));
      setWantToListen(wantItems.some((item: any) => String(item.id) === String(id) && item.type === 'track'));

      const [{ data: reviewRows, error: reviewError, count }, { data: ratingRows, error: ratingError }] = await Promise.all([
        supabase.from('music_reviews')
          .select('id,user_id,rating,review_text,created_at,updated_at', { count: 'exact' })
          .eq('item_type', 'track')
          .eq('item_id', String(id))
          .order('updated_at', { ascending: false })
          .limit(3),
        supabase.from('music_reviews')
          .select('rating')
          .eq('item_type', 'track')
          .eq('item_id', String(id)),
      ]);
      if (reviewError) throw reviewError;
      if (ratingError) throw ratingError;
      const ratings = ratingRows || [];
      setReviewCount(count || 0);
      const ratedReviews = ratings.filter((row: any) => Number(row.rating) > 0);
      setRatingCount(ratedReviews.length);
      setAverageRating(ratedReviews.length
        ? ratedReviews.reduce((sum: number, row: any) => sum + Number(row.rating), 0) / ratedReviews.length
        : 0);
      setRatingDistribution(Array.from({ length: 10 }, (_, index) => {
        const value = 5 - index * 0.5;
        return { rating: value, count: ratedReviews.filter((row: any) => Number(row.rating) === value).length };
      }));
      const userIds = [...new Set((reviewRows || []).map((row: any) => row.user_id))];
      const { data: profiles, error: profilesError } = userIds.length
        ? await supabase.from('users').select('id,username,avatar_url').in('id', userIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((person: any) => { profileMap[person.id] = person; });
      setReviews(reviewRows || []);
      setPeople(profileMap);
    } catch (e: any) {
      console.error('Track page load failed:', e);
      setError(e?.message || 'Could not load this song.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void loadTrack(); }, [loadTrack]));

  const cover = track?.album?.images?.[0]?.url;
  const artist = (track?.artists || []).map((person: any) => person.name).join(', ');
  const releaseDate = track?.album?.release_date || '';
  const releaseYear = releaseDate ? releaseDate.slice(0, 4) : '';

  const activityStarWidth = 30;
  const activityStarGap = 13;
  const activityStarsWidth = activityStarWidth * 5 + activityStarGap * 4;
  const ratingFromActivityX = (position: number) => {
    const x = Math.max(0, Math.min(position, activityStarsWidth));
    const starIndex = Math.min(4, Math.floor(x / (activityStarWidth + activityStarGap)));
    const withinStar = Math.min(activityStarWidth, x - starIndex * (activityStarWidth + activityStarGap));
    return starIndex + (withinStar >= activityStarWidth / 2 ? 1 : 0.5);
  };
  const activityRatingResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      activityRatingStartX.current = event.nativeEvent.locationX;
      const x = Math.max(0, Math.min(activityRatingStartX.current, activityStarsWidth));
      updateActivityRating(ratingFromActivityX(x));
    },
    onPanResponderMove: (_event, gesture) => {
      const x = Math.max(0, Math.min(activityRatingStartX.current + gesture.dx, activityStarsWidth));
      updateActivityRating(ratingFromActivityX(x));
    },
    onPanResponderRelease: () => {
      const selected = activityRatingSelectionRef.current;
      const currentTrack = trackRef.current;
      if (selected <= 0 || !currentTrack) return;
      router.push({ pathname: '/review/new', params: {
        albumId: String(currentTrack.id), albumName: currentTrack.name, albumArtist: (currentTrack.artists || []).map((person: any) => person.name).join(', '),
        albumCover: currentTrack.album?.images?.[0]?.url || '', itemType: 'track',
        parentAlbumId: String(currentTrack.album?.id || ''), currentRating: String(selected),
      } } as any);
    },
  })).current;

  function openFriendStatuses(section: 'listened' | 'wants_to_listen' = 'listened') {
    if (!track) return;
    router.push({
      pathname: '/track/[id]/friends',
      params: { id: String(track.id), itemName: track.name, artistName: artist, section },
    } as any);
  }

  function openReviews() {
    if (!track) return;
    router.push({
      pathname: '/reviews',
      params: {
        itemType: 'track',
        itemId: String(track.id),
        itemName: track.name,
        artistName: artist,
        coverUrl: cover || '',
        parentAlbumId: track.album?.id || '',
      },
    } as any);
  }

  function writeReview() {
    if (!track) return;
    router.push({
      pathname: '/review/new',
      params: {
        albumId: String(track.id),
        albumName: track.name,
        albumArtist: artist,
        albumCover: cover || '',
        itemType: 'track',
        parentAlbumId: track.album?.id || '',
      },
    } as any);
  }

  async function toggleCollection(kind: 'liked' | 'listened' | 'wantToListen') {
    if (!track) return;
    const key = kind;
    const stored = await AsyncStorage.getItem(key);
    const items = stored ? JSON.parse(stored) : [];
    const exists = items.some((item: any) => String(item.id) === String(track.id) && item.type === 'track');
    const next = !exists;
    const item = {
      id: String(track.id),
      name: track.name,
      artist,
      cover: cover || '',
      albumId: track.album?.id || '',
      type: 'track',
      date: new Date().toISOString(),
    };
    const updated = next
      ? [item, ...items]
      : items.filter((entry: any) => !(String(entry.id) === String(track.id) && entry.type === 'track'));
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    if (kind === 'liked') setLiked(next);
    if (kind === 'listened') setListened(next);
    if (kind === 'wantToListen') setWantToListen(next);
    const activityType = kind === 'liked' ? 'liked' : kind === 'listened' ? 'listened' : 'wants_to_listen';
    if (next) {
      await recordActivity(activityType, String(track.id), item);
      setMyActivity(current => [
        { id: `local-${Date.now()}`, activity_type: activityType, item_key: String(track.id), created_at: item.date },
        ...current,
      ].slice(0, 20));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: removeActivityError } = await supabase.from('user_activity')
          .delete().eq('user_id', user.id).eq('item_key', String(track.id)).eq('activity_type', activityType);
        if (removeActivityError) console.warn('Could not remove track activity:', removeActivityError);
      }
      setMyActivity(current => current.filter((entry: any) => entry.activity_type !== activityType));
    }
  }


  async function openLists() {
    setMenuVisible(false);
    try {
      const lists = await loadUserMusicLists();
      setUserLists(lists);
      setListsVisible(true);
    } catch (error: any) {
      console.error('Could not load music lists:', error);
      Alert.alert('Could not load lists', error?.message || 'Please try again.');
    }
  }

  async function addTrackToList(listId: string) {
    try {
      await addMusicItemToList(listId, {
        id: String(track.id),
        name: track.name,
        artist,
        cover: cover || '',
        albumId: String(track.album?.id || ''),
        type: 'track',
      });
      setListsVisible(false);
    } catch (error: any) {
      console.error('Could not add track to list:', error);
      Alert.alert('Could not add to list', error?.message || 'Please try again.');
    }
  }

  async function openFriendShare() {
    setMenuVisible(false);
    setShareVisible(true);
    setShareLoading(true);
    setShareError('');
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
      const ids = (followers.data || []).map((row: any) => String(row.user_id)).filter((value: string) => followingIds.has(value));
      const { data: profiles, error: profilesError } = ids.length
        ? await supabase.from('users').select('id,username').in('id', ids).order('username')
        : { data: [], error: null };
      if (profilesError) throw profilesError;
      setShareFriends(profiles || []);
    } catch (e: any) {
      setShareError(e?.message || 'Could not load friends.');
    } finally {
      setShareLoading(false);
    }
  }

  async function sendToFriend() {
    if (!track || !selectedFriendId) return;
    setShareLoading(true);
    setShareError('');
    try {
      await sendMusicToFriend({ id: String(track.id), type: 'track', albumId: String(track.album?.id || ''), name: track.name, artist, cover: cover || '' }, selectedFriendId, shareMessage);
      setShareVisible(false);
      setSelectedFriendId('');
      setShareMessage('');
    } catch (e: any) {
      setShareError(e?.message || 'Could not send song.');
    } finally {
      setShareLoading(false);
    }
  }

  if (loading) {
    return <View style={[styles.screen, { backgroundColor }]}><ActivityIndicator color={accentColor} style={{ marginTop: 100 }} /></View>;
  }

  if (!track) {
    return (
      <View style={[styles.screen, { backgroundColor }]}>
        <View style={styles.topBar}><TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.topTitle}>SONG</Text><View style={{ width: 28 }} /></View>
        <Text style={styles.error}>{error || 'Song not found.'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ImageBackground
          source={{ uri: artistData?.images?.[0]?.url || cover }}
          style={styles.heroBackground}
          imageStyle={styles.heroBackgroundImage}
          resizeMode="cover"
        >
          <View style={styles.heroShade} />
          <Svg pointerEvents="none" style={styles.heroFade} viewBox="0 0 400 190" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="trackHeroFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={backgroundColor} stopOpacity="0" />
                <Stop offset="0.42" stopColor={backgroundColor} stopOpacity="0.32" />
                <Stop offset="0.76" stopColor={backgroundColor} stopOpacity="0.82" />
                <Stop offset="1" stopColor={backgroundColor} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="400" height="190" fill="url(#trackHeroFade)" />
          </Svg>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity>
            <Text style={styles.topTitle}>MUSICBOXD</Text>
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.heroMenuButton} accessibilityRole="button" accessibilityLabel="More song actions"><Text style={styles.heroDots}>•••</Text></TouchableOpacity>
          </View>
          <View style={styles.hero}>
            <View style={styles.heroInfo}>
              <Text style={styles.songTitle}>{track.name}</Text>
              <Text style={styles.artist}>{artist}</Text>
              <TouchableOpacity onPress={() => router.push(`/album/${track.album?.id}` as any)}>
                <Text style={styles.albumLink}>{track.album?.name || 'Album'}</Text>
              </TouchableOpacity>
              <Text style={styles.typeLabel}>
                {releaseYear}{releaseYear ? '  ·  ' : ''}SONG
              </Text>
            </View>
            {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : <View style={[styles.cover, styles.coverPlaceholder]} />}
          </View>
        </ImageBackground>

        <View style={styles.listenRow}>
          <TouchableOpacity
            style={styles.listenButton}
            onPress={() => Linking.openURL(track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`)}
            accessibilityRole="link"
            accessibilityLabel="Listen on Spotify"
          >
            <Text style={styles.listenButtonText}>▶ LISTEN</Text>
          </TouchableOpacity>
          <Text style={styles.durationText}>
            {track.duration_ms ? `${Math.floor(track.duration_ms / 60000)} min` : ''}
          </Text>
        </View>


        <View style={styles.ratingsSection}>
          <View style={styles.ratingsHeadingRow}>
            <Text style={styles.ratingsTitle}>RATINGS</Text>
            <Text style={styles.ratingsCount}>{ratingCount.toLocaleString()} ratings</Text>
          </View>
          <View style={styles.ratingOverview}>
            <View style={styles.ratingHistogram}>
              {ratingDistribution.slice().reverse().map(item => {
                const maxCount = Math.max(...ratingDistribution.map(row => row.count), 1);
                const barHeight = item.count > 0 ? Math.max(2, (item.count / maxCount) * 48) : 1;
                return <View key={item.rating} style={styles.histogramColumn}><View style={[styles.histogramBar, { height: barHeight }]} /></View>;
              })}
            </View>
            <View style={styles.ratingOverviewDetails}>
              <Text style={styles.ratingAverage}>{averageRating > 0 ? averageRating.toFixed(1) : '—'}</Text>
              <Text style={styles.ratingStars}>★★★★★</Text>
            </View>
          </View>
        </View>

        <View style={styles.friendStatusSection}>
          <View style={styles.friendStatusGroup}>
            <TouchableOpacity style={styles.friendStatusHeader} onPress={() => openFriendStatuses('listened')} accessibilityRole="button" accessibilityLabel="See everyone who listened">
              <Text style={styles.friendStatusTitle}>LISTENED BY</Text>
              <Text style={styles.friendStatusArrow}>›</Text>
            </TouchableOpacity>
            {listenedByFriends.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendAvatarRow}>
                {listenedByFriends.map(person => (
                  <TouchableOpacity key={person.id} style={styles.friendAvatarItem} onPress={() => router.push(`/user/${person.id}` as any)}>
                    <View style={styles.friendAvatarWrap}>
                      {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.friendStatusAvatar} /> : <View style={styles.friendStatusAvatarFallback}><Text style={styles.friendStatusInitial}>{(person.username || 'U').slice(0, 1).toUpperCase()}</Text></View>}
                      <View style={styles.friendAvatarMenu}><Text style={styles.friendAvatarMenuText}>≡</Text></View>
                    </View>
                    <View style={styles.friendRatingStars}>{Array.from({ length: 5 }, (_, index) => <Text key={index} style={[styles.friendRatingStar, (person.rating || 0) >= index + 0.5 && styles.friendRatingStarActive]}>★</Text>)}</View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.friendStatusEmpty}>No friends have listened to this song yet.</Text>
            )}
          </View>
          <View style={[styles.friendStatusGroup, { marginBottom: 13 }]}>
            <View style={styles.friendStatusTopRule} />
            <TouchableOpacity style={styles.friendStatusHeader} onPress={() => openFriendStatuses('wants_to_listen')} accessibilityRole="button" accessibilityLabel="See everyone who wants to listen">
              <Text style={styles.friendStatusTitle}>WANTS TO LISTEN</Text>
              <Text style={styles.friendStatusArrow}>›</Text>
            </TouchableOpacity>
            {wantToListenFriends.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendAvatarRow}>
                {wantToListenFriends.map(person => (
                  <TouchableOpacity key={person.id} style={styles.friendAvatarItem} onPress={() => router.push(`/user/${person.id}` as any)}>
                    <View style={styles.friendAvatarWrap}>
                      {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.friendStatusAvatar} /> : <View style={styles.friendStatusAvatarFallback}><Text style={styles.friendStatusInitial}>{(person.username || 'U').slice(0, 1).toUpperCase()}</Text></View>}
                      <View style={styles.friendAvatarMenu}><Text style={styles.friendAvatarMenuText}>≡</Text></View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.friendStatusEmpty}>No friends have added this song yet.</Text>
            )}
          </View>
        </View>

        <View style={styles.reviewsSection}>
          <View style={styles.trackTopNav}>
            <TouchableOpacity style={styles.trackTopNavItem} onPress={() => openFriendStatuses('listened')}>
              <Text style={styles.trackTopNavText}>MEMBERS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.trackTopNavItem, styles.trackTopNavActive]} onPress={openReviews}>
              <Text style={[styles.trackTopNavText, styles.trackTopNavActiveText]}>REVIEWS</Text>
              <Text style={styles.trackTopNavCount}>{reviewCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.trackTopNavItem} onPress={() => router.push('/lists' as any)}>
              <Text style={styles.trackTopNavText}>LISTS</Text>
            </TouchableOpacity>
          </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {reviews.length === 0 ? (
          <View style={styles.emptyReviews}>
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>Be the first to write about this song.</Text>
            <TouchableOpacity onPress={writeReview}>
              <Text style={[styles.emptyLink, { color: accentColor }]}>Write the first review ›</Text>
            </TouchableOpacity>
          </View>
        ) : reviews.map((review: any) => {
          const person = people[review.user_id];
          return (
            <TouchableOpacity key={review.id} style={styles.reviewCard} onPress={openReviews}>
              <View style={styles.reviewerRow}>
                {person?.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{(person?.username || 'L').slice(0, 1).toUpperCase()}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.username}>@{person?.username || 'listener'}</Text>
                  <Text style={styles.date}>{new Date(review.updated_at || review.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
              {Number(review.rating) > 0 && <Text style={styles.reviewRating}>{'★'.repeat(Math.floor(Number(review.rating)))}{Number(review.rating) % 1 ? '½' : ''}</Text>}
              {!!review.review_text && <Text style={styles.reviewText} numberOfLines={4}>{review.review_text}</Text>}
            </TouchableOpacity>
          );
        })}
        </View>

      </ScrollView>

      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)} />
        <View style={styles.menuSheet}>
          <View style={styles.menuHandle} />
          <View style={styles.menuItemHeader}>
            {cover ? <Image source={{ uri: cover }} style={styles.menuCover} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.menuSongTitle} numberOfLines={1}>{track.name}</Text>
              <Text style={styles.menuSongArtist} numberOfLines={1}>{artist}</Text>
            </View>
          </View>
          <View style={styles.menuQuickActions}>
            <TouchableOpacity style={styles.menuQuickAction} onPress={() => void toggleCollection('listened')}><Text style={[styles.menuActionIcon, listened && { color: accentColor }]}>◉</Text><Text style={styles.menuActionLabel}>{listened ? 'Listened' : 'Listen'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuQuickAction} onPress={() => void toggleCollection('liked')}><Text style={[styles.menuActionIcon, liked && { color: accentColor }]}>{liked ? '♥' : '♡'}</Text><Text style={styles.menuActionLabel}>{liked ? 'Liked' : 'Like'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuQuickAction} onPress={() => void toggleCollection('wantToListen')}><Text style={[styles.menuActionIcon, wantToListen && { color: accentColor }]}>◷</Text><Text style={styles.menuActionLabel}>Want to listen</Text></TouchableOpacity>
          </View>
          <View style={styles.menuRatingSection}>
            <Text style={styles.menuRatingTitle}>YOUR RATING</Text>
            <View style={styles.menuRatingStars} {...activityRatingResponder.panHandlers} accessibilityRole="adjustable" accessibilityLabel="Your song rating">
              {[1, 2, 3, 4, 5].map(value => {
                const fill = Math.max(0, Math.min(1, activityRatingSelection - (value - 1)));
                return (
                  <View key={value} style={{ width: activityStarWidth, height: 38 }}>
                    <Text style={styles.menuRatingStar}>★</Text>
                    {fill > 0 && <View style={{ position: 'absolute', left: 0, top: 0, width: activityStarWidth * fill, height: 38, overflow: 'hidden' }}><Text style={styles.menuRatingStarActive}>★</Text></View>}
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.menuActivitySection}>
            <Text style={styles.menuActivityTitle}>SHOW YOUR ACTIVITY</Text>
            {myActivity.length === 0 ? (
              <Text style={styles.menuActivityEmpty}>Your activity with this song will appear here.</Text>
            ) : myActivity.map((entry: any) => (
              <View key={entry.id} style={styles.menuActivityRow}>
                <Text style={styles.menuActivityText}>{entry.activity_type === 'listened' ? 'Listened' : entry.activity_type === 'liked' ? 'Liked' : entry.activity_type === 'wants_to_listen' ? 'Want to listen' : entry.activity_type === 'reviewed' ? 'Reviewed' : entry.activity_type}</Text>
                <Text style={styles.menuActivityDate}>{new Date(entry.created_at).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.menuRow} onPress={() => { setMenuVisible(false); writeReview(); }}><Text style={styles.menuRowText}>Review or log / Rate</Text><Text style={styles.menuChevron}>›</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => void openLists()}><Text style={styles.menuRowText}>Add to lists</Text><Text style={styles.menuChevron}>›</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => void openFriendShare()}><Text style={styles.menuRowText}>Share with friends</Text><Text style={styles.menuChevron}>›</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuRow} onPress={() => { setMenuVisible(false); void shareMusicItem({ id: String(track.id), type: 'track', name: track.name, artist, cover: cover || '' }); }}><Text style={styles.menuRowText}>Share</Text><Text style={styles.menuChevron}>›</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuDone} onPress={() => setMenuVisible(false)}><Text style={styles.menuDoneText}>Done</Text></TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={listsVisible} transparent animationType="slide" onRequestClose={() => setListsVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setListsVisible(false)} />
        <View style={styles.menuSheet}><View style={styles.menuHandle} /><Text style={styles.menuSheetTitle}>Add to List</Text>
          {userLists.length === 0 ? <Text style={styles.menuEmpty}>No lists yet</Text> : userLists.map((list: any) => <TouchableOpacity key={list.id} style={styles.menuRow} onPress={() => void addTrackToList(String(list.id))}><Text style={styles.menuRowText}>{list.name || 'Untitled list'}</Text><Text style={styles.menuChevron}>›</Text></TouchableOpacity>)}
          <TouchableOpacity style={styles.menuDone} onPress={() => setListsVisible(false)}><Text style={styles.menuDoneText}>Done</Text></TouchableOpacity>
        </View>
      </Modal>
      <Modal visible={shareVisible} transparent animationType="slide" onRequestClose={() => setShareVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setShareVisible(false)} />
        <View style={styles.menuSheet}><View style={styles.menuHandle} /><Text style={styles.menuSheetTitle}>Share with friends</Text>
          {shareLoading ? <ActivityIndicator color={accentColor} /> : shareFriends.length === 0 ? <Text style={styles.menuEmpty}>No mutual friends found.</Text> : shareFriends.map((person: any) => <TouchableOpacity key={person.id} style={styles.menuRow} onPress={() => setSelectedFriendId(String(person.id))}><Text style={[styles.menuRowText, selectedFriendId === String(person.id) && { color: accentColor }]}>@{person.username || 'listener'}</Text><Text style={styles.menuChevron}>{selectedFriendId === String(person.id) ? '✓' : '○'}</Text></TouchableOpacity>)}
          <TextInput value={shareMessage} onChangeText={setShareMessage} placeholder="Add a message (optional)" placeholderTextColor="#777" style={styles.shareInput} />
          {!!shareError && <Text style={styles.shareError}>{shareError}</Text>}
          <TouchableOpacity style={[styles.menuDone, { backgroundColor: accentColor }]} disabled={!selectedFriendId || shareLoading} onPress={() => void sendToFriend()}><Text style={styles.menuDoneText}>{shareLoading ? 'Sending…' : 'Send'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.menuCancel} onPress={() => setShareVisible(false)}><Text style={styles.menuCancelText}>Cancel</Text></TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090909' },
  topBar: { paddingTop: 56, paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#fff', fontSize: 32, lineHeight: 34, width: 34 },
  topTitle: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  content: { paddingBottom: 60 },
  heroBackground: { height: 440, justifyContent: 'space-between', backgroundColor: '#17191d' },
  heroBackgroundImage: { opacity: 0.72 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8, 10, 14, 0.48)' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 190 },
  hero: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 16, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 24 },
  heroInfo: { flex: 1, alignItems: 'flex-start' },
  cover: { width: 156, height: 156, borderRadius: 5, backgroundColor: '#252525' },
  coverPlaceholder: { backgroundColor: '#252525' },
  songTitle: { color: '#fff', fontSize: 29, lineHeight: 34, fontWeight: '800', marginTop: 7 },
  artist: { color: '#D5DADF', fontSize: 17, marginTop: 7 },
  albumLink: { color: '#D5DADF', fontSize: 13, marginTop: 9, fontWeight: '600' },
  typeLabel: { color: '#D5DADF', fontSize: 13, marginTop: 9 },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  listenButton: { backgroundColor: '#30343A', borderWidth: 1, borderColor: '#555B63', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
  listenButtonText: { color: '#E1E4E8', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  durationText: { color: '#AEB8C2', fontSize: 13, fontWeight: '600' },
  ratingsSection: { paddingHorizontal: 18, paddingTop: 17, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#2C3440' },
  ratingsHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  ratingsTitle: { color: '#AAB4BF', fontSize: 12, fontWeight: '500', letterSpacing: 1.4 },
  ratingsCount: { color: '#9BA7B2', fontSize: 10, fontWeight: '500' },
  ratingOverview: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 52 },
  ratingHistogram: { flex: 1, height: 50, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, paddingBottom: 1, borderBottomWidth: 1, borderBottomColor: '#52616F' },
  histogramColumn: { flex: 1, height: 49, justifyContent: 'flex-end', alignItems: 'stretch' },
  histogramBar: { width: '100%', backgroundColor: '#526575', borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  ratingOverviewDetails: { width: 48, alignItems: 'flex-start', justifyContent: 'flex-end', paddingBottom: 0 },
  ratingAverage: { color: '#AAB4BF', fontSize: 14, lineHeight: 15, fontWeight: '400', fontVariant: ['tabular-nums'] },
  ratingStars: { color: '#00C853', fontSize: 7, letterSpacing: 0, marginTop: 0 },
  trackTopNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#30343A', marginBottom: 18, paddingHorizontal: 4 },
  trackTopNavItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  trackTopNavActive: { borderBottomWidth: 2, borderBottomColor: '#FFFFFF' },
  trackTopNavText: { color: '#858B92', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  trackTopNavActiveText: { color: '#FFFFFF' },
  trackTopNavCount: { color: '#9299A1', fontSize: 11, fontWeight: '600' },
  reviewsHeaderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#292D32', borderRadius: 7, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12 },
  reviewsSection: { marginTop: 6 },
  sectionHeader: { paddingHorizontal: 18, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#2C3440' },
  sectionTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  sectionSub: { color: '#9BA7B2', fontSize: 11, marginTop: 4 },
  seeAll: { fontSize: 13, fontWeight: '700' },
  reviewRating: { color: '#00E054', fontSize: 14, fontWeight: '700', marginTop: 9 },
  emptyReviews: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  emptyTitle: { color: '#E5E9EC', fontSize: 15, fontWeight: '700' },
  emptyText: { color: '#9BA7B2', fontSize: 12, marginTop: 7, textAlign: 'center' },
  emptyLink: { fontSize: 13, fontWeight: '700', marginTop: 13 },
  reviewCard: { paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#2C3440' },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A4653' },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3A4653', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '700' },
  username: { color: '#eee', fontSize: 13, fontWeight: '700' },
  date: { color: '#777', fontSize: 10, marginTop: 3 },
  stars: { fontSize: 14, fontWeight: '700' },
  reviewText: { color: '#ddd', fontSize: 14, lineHeight: 21, marginTop: 12 },
  albumRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 18, marginTop: 24, padding: 12, backgroundColor: '#171717', borderRadius: 9 },
  albumCover: { width: 54, height: 54, borderRadius: 4, backgroundColor: '#333' },
  albumEyebrow: { color: '#777', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  albumName: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  albumArtist: { color: '#888', fontSize: 11, marginTop: 3 },
  albumArrow: { color: '#888', fontSize: 25 },
  error: { color: '#ff8585', textAlign: 'center', padding: 18, fontSize: 12 },

  heroMenuButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(8, 10, 12, 0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroDots: { color: '#E2E5E8', fontSize: 12, lineHeight: 16, letterSpacing: 1, fontWeight: '900' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  menuSheet: { backgroundColor: '#1C1C1E', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  menuHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#555', alignSelf: 'center', marginBottom: 18 },
  menuItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  menuCover: { width: 48, height: 48, borderRadius: 5 },
  menuSongTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  menuSongArtist: { color: '#999', fontSize: 12, marginTop: 3 },
  menuQuickActions: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#343438', marginBottom: 4 },
  menuQuickAction: { alignItems: 'center', minWidth: 82, paddingVertical: 4 },
  menuActionIcon: { color: '#ddd', fontSize: 25, marginBottom: 5 },
  menuActionLabel: { color: '#ccc', fontSize: 11 },
  menuRow: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#303034', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuRowText: { color: '#eee', fontSize: 14 },
  menuChevron: { color: '#888', fontSize: 22 },
  menuDone: { backgroundColor: '#30343A', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  menuDoneText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  menuSheetTitle: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  menuEmpty: { color: '#999', textAlign: 'center', paddingVertical: 18 },
  shareInput: { color: '#fff', backgroundColor: '#29292d', borderRadius: 8, padding: 12, marginTop: 14, minHeight: 44 },
  shareError: { color: '#ff8585', fontSize: 12, marginTop: 10 },
  menuCancel: { alignItems: 'center', paddingVertical: 12 },
  menuCancelText: { color: '#aaa', fontSize: 14 },


  friendStatusSection: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#2C3440' },
  friendStatusGroup: { marginBottom: 17 },
  friendStatusTopRule: { height: 1, backgroundColor: '#303943', marginBottom: 13 },
  friendStatusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  friendStatusTitle: { color: '#AAB4BF', fontSize: 12, fontWeight: '500', letterSpacing: 1.4 },
  friendStatusArrow: { color: '#AAB4BF', fontSize: 25, lineHeight: 25, fontWeight: '300', paddingHorizontal: 4 },
  friendStatusEmpty: { color: '#7F8B96', fontSize: 12, paddingVertical: 7 },
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
  menuRatingStar: { color: '#456052', fontSize: 30, lineHeight: 36, width: 30, textAlign: 'left' },
  menuRatingStarActive: { color: '#00E054', fontSize: 30, lineHeight: 36, width: 30, textAlign: 'left' },
  menuRatingSection: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#343438' },
  menuRatingTitle: { color: '#aaa', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center', marginBottom: 8 },
  menuRatingStars: { width: 202, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  menuActivitySection: { paddingTop: 13, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#343438' },
  menuActivityTitle: { color: '#ddd', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8 },
  menuActivityEmpty: { color: '#777', fontSize: 12, paddingVertical: 6 },
  menuActivityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  menuActivityText: { color: '#ddd', fontSize: 12 },
  menuActivityDate: { color: '#777', fontSize: 10 },
});
