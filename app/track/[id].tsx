import { useAppTheme } from '@/context/ThemeContext';
import { recordActivity } from '@/utils/activity';
import { getSpotifyTrack } from '@/utils/spotifyCatalog';
import { sendMusicToFriend, shareMusicItem } from '@/utils/sharing';
import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ActivityIndicator, Image, ImageBackground, Linking, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const HEART = '\u2665';
const EMPTY_HEART = '\u2661';

export default function TrackPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [track, setTrack] = useState<any>(null);
  const [artistData, setArtistData] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [people, setPeople] = useState<Record<string, any>>({});
  const [liked, setLiked] = useState(false);
  const [listened, setListened] = useState(false);
  const [wantToListen, setWantToListen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuRatingSelection, setMenuRatingSelection] = useState(0);
  const menuRatingSelectionRef = useRef(0);
  const menuRatingStartX = useRef(0);
  const updateMenuRating = (value: number) => {
    const next = Math.max(0, Math.min(5, Math.round(value * 2) / 2));
    menuRatingSelectionRef.current = next;
    setMenuRatingSelection(next);
  };
  const [listsVisible, setListsVisible] = useState(false);
  const [userLists, setUserLists] = useState<any[]>([]);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareFriends, setShareFriends] = useState<any[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareError, setShareError] = useState('');
  const [shareLoading, setShareLoading] = useState(false);

  const loadTrack = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [trackData, likedData, listenedData, wantData] = await Promise.all([
        getSpotifyTrack(String(id)),
        AsyncStorage.getItem('liked'),
        AsyncStorage.getItem('listened'),
        AsyncStorage.getItem('wantToListen'),
      ]);
      setTrack(trackData);
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
      setAverageRating(ratedReviews.length
        ? ratedReviews.reduce((sum: number, row: any) => sum + Number(row.rating), 0) / ratedReviews.length
        : 0);
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

  const menuStarWidth = 30;
  const menuStarGap = 13;
  const menuStarsWidth = menuStarWidth * 5 + menuStarGap * 4;
  const menuRatingResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      menuRatingStartX.current = event.nativeEvent.locationX;
      const x = Math.max(0, Math.min(menuRatingStartX.current, menuStarsWidth));
      updateMenuRating(Math.max(0.5, Math.min(5, Math.ceil((x / (menuStarWidth + menuStarGap)) * 2) / 2)));
    },
    onPanResponderMove: (_event, gesture) => {
      const x = Math.max(0, Math.min(menuRatingStartX.current + gesture.dx, menuStarsWidth));
      updateMenuRating(Math.max(0.5, Math.min(5, Math.ceil((x / (menuStarWidth + menuStarGap)) * 2) / 2)));
    },
  })).current;

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
    if (next) {
      await recordActivity(kind === 'liked' ? 'liked' : kind === 'listened' ? 'listened' : 'wants_to_listen', String(track.id), item);
    }
  }


  async function openLists() {
    const raw = await AsyncStorage.getItem('lists');
    setUserLists(raw ? JSON.parse(raw) : []);
    setMenuVisible(false);
    setListsVisible(true);
  }

  async function addTrackToList(listId: string) {
    const raw = await AsyncStorage.getItem('lists');
    const lists = raw ? JSON.parse(raw) : [];
    const index = lists.findIndex((entry: any) => String(entry.id) === listId);
    if (index >= 0) {
      const items = Array.isArray(lists[index].items) ? lists[index].items : [];
      if (!items.some((entry: any) => String(entry.id) === String(track.id) && entry.type === 'track')) {
        items.push({ id: String(track.id), name: track.name, artist, cover: cover || '', albumId: track.album?.id || '', type: 'track' });
        lists[index].items = items;
        await AsyncStorage.setItem('lists', JSON.stringify(lists));
      }
    }
    setListsVisible(false);
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
                {releaseYear}{releaseYear ? '  ·  ' : ''}{track.duration_ms ? `${Math.floor(track.duration_ms / 60000)} min` : ''}  ·  SONG
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

        <View style={styles.ratingPanel}>
          <Text style={styles.ratingNumber}>{averageRating ? averageRating.toFixed(1) : '—'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ratingTitle}>COMMUNITY RATING</Text>
            <Text style={styles.ratingSub}>{reviewCount ? 'Average community rating' : 'No ratings yet'}</Text>
          </View>
          <TouchableOpacity onPress={openReviews} style={styles.reviewCount}>
            <Text style={styles.reviewCountNumber}>{reviewCount}</Text>
            <Text style={styles.reviewCountLabel}>REVIEWS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: accentColor }]} onPress={writeReview}>
            <Text style={styles.primaryActionText}>＋  Review</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.action, listened && styles.actionActive]} onPress={() => void toggleCollection('listened')}>
            <Text style={styles.actionIcon}>◉</Text><Text style={styles.actionText}>{listened ? 'Listened' : 'Log'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.action, liked && styles.actionActive]} onPress={() => void toggleCollection('liked')}>
            <Text style={[styles.actionIcon, liked && { color: accentColor }]}>{liked ? HEART : EMPTY_HEART}</Text><Text style={styles.actionText}>Like</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.action, wantToListen && styles.actionActive]} onPress={() => void toggleCollection('wantToListen')}>
            <Text style={styles.actionIcon}>＋</Text><Text style={styles.actionText}>Watchlist</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>Reviews</Text><Text style={styles.sectionSub}>What people are saying about this song</Text></View>
          <TouchableOpacity onPress={openReviews}><Text style={[styles.seeAll, { color: accentColor }]}>See all ›</Text></TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {reviews.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>No reviews yet</Text><Text style={styles.emptyText}>Be the first to write about this song.</Text><TouchableOpacity onPress={writeReview}><Text style={[styles.emptyLink, { color: accentColor }]}>Write the first review ›</Text></TouchableOpacity></View>
        ) : reviews.map((review: any) => {
          const person = people[review.user_id];
          return (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewerRow}>
                {person?.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarLetter}>{(person?.username || 'L').slice(0, 1).toUpperCase()}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.username}>@{person?.username || 'listener'}</Text>
                  <Text style={styles.date}>{new Date(review.updated_at || review.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.stars, { color: accentColor }]}>{'★'.repeat(Math.floor(Number(review.rating) || 0))}{Number(review.rating) % 1 ? '½' : ''}</Text>
              </View>
              {!!review.review_text && <Text style={styles.reviewText}>{review.review_text}</Text>}
            </View>
          );
        })}

        <TouchableOpacity style={styles.albumRow} onPress={() => router.push(`/album/${track.album?.id}` as any)}>
          {cover ? <Image source={{ uri: cover }} style={styles.albumCover} /> : <View style={styles.albumCover} />}
          <View style={{ flex: 1 }}><Text style={styles.albumEyebrow}>FROM THE ALBUM</Text><Text style={styles.albumName}>{track.album?.name}</Text><Text style={styles.albumArtist}>{artist}</Text></View>
          <Text style={styles.albumArrow}>›</Text>
        </TouchableOpacity>
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
          <View style={styles.menuRatingSection}>
            <View style={styles.menuRatingHeading}>
              <Text style={styles.menuRatingTitle}>YOUR RATING</Text>
              <Text style={styles.menuRatingAverage}>{averageRating > 0 ? averageRating.toFixed(1) : '—'} <Text style={styles.menuRatingCount}>({reviewCount})</Text></Text>
            </View>
            <View
              style={styles.menuRatingStars}
              {...menuRatingResponder.panHandlers}
              accessibilityRole="adjustable"
              accessibilityLabel="Your song rating"
              onAccessibilityAction={(event: any) => {
                const action = event.nativeEvent.actionName;
                if (action === 'increment') setMenuRatingSelection(value => Math.min(5, value + 0.5));
                if (action === 'decrement') setMenuRatingSelection(value => Math.max(0.5, value - 0.5));
              }}
            >
              {[1, 2, 3, 4, 5].map(value => {
                const selectedRating = menuRatingSelection;
                const fill = Math.max(0, Math.min(1, selectedRating - (value - 1)));
                return (
                  <View key={value} style={{ width: menuStarWidth, height: 38 }}>
                    <Text style={styles.menuRatingStar}>★</Text>
                    {fill > 0 && (
                      <View style={{ position: 'absolute', left: 0, top: 0, width: menuStarWidth * fill, height: 38, overflow: 'hidden' }}>
                        <Text style={styles.menuRatingStarActive}>★</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
            <Text style={styles.menuRatingHint}>
              {menuRatingSelection > 0 ? `${menuRatingSelection.toFixed(1)} / 5` : 'Slide to choose a rating · Half-stars supported'}
            </Text>
            {menuRatingSelection > 0 && (
              <TouchableOpacity
                style={styles.menuRateButton}
                onPress={() => {
                  const selected = menuRatingSelectionRef.current;
                  setMenuVisible(false);
                  router.push({ pathname: '/review/new', params: {
                    albumId: String(track.id), albumName: track.name, albumArtist: artist,
                    albumCover: cover || '', itemType: 'track',
                    parentAlbumId: String(track.album?.id || ''), currentRating: String(selected),
                  } } as any);
                }}
              >
                <Text style={styles.menuRateButtonText}>RATE {menuRatingSelection.toFixed(1)}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.menuQuickActions}>
            <TouchableOpacity style={styles.menuQuickAction} onPress={() => void toggleCollection('listened')}><Text style={[styles.menuActionIcon, listened && { color: accentColor }]}>◉</Text><Text style={styles.menuActionLabel}>{listened ? 'Listened' : 'Listen'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuQuickAction} onPress={() => void toggleCollection('liked')}><Text style={[styles.menuActionIcon, liked && { color: accentColor }]}>{liked ? '♥' : '♡'}</Text><Text style={styles.menuActionLabel}>{liked ? 'Liked' : 'Like'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuQuickAction} onPress={() => void toggleCollection('wantToListen')}><Text style={[styles.menuActionIcon, wantToListen && { color: accentColor }]}>◷</Text><Text style={styles.menuActionLabel}>Want to listen</Text></TouchableOpacity>
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
  topBar: { paddingTop: 58, paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#fff', fontSize: 30, width: 28 },
  topTitle: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  heroDots: { color: '#fff', fontSize: 27, lineHeight: 30, fontWeight: '700', width: 28, textAlign: 'right' },
  content: { paddingBottom: 44 },
  heroBackground: { height: 440, justifyContent: 'space-between', backgroundColor: '#17191d' },
  heroBackgroundImage: { opacity: 0.72 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8, 10, 14, 0.28)' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 190 },
  hero: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 16, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 24 },
  heroInfo: { flex: 1, alignItems: 'flex-start' },
  cover: { width: 156, height: 156, borderRadius: 5, backgroundColor: '#252525' },
  coverPlaceholder: { backgroundColor: '#252525' },
  songTitle: { color: '#fff', fontSize: 29, lineHeight: 34, fontWeight: '800', marginTop: 7 },
  artist: { color: '#D5DADF', fontSize: 17, marginTop: 7 },
  albumLink: { color: '#D5DADF', fontSize: 13, marginTop: 9, fontWeight: '600' },
  typeLabel: { color: '#D5DADF', fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginTop: 10 },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  listenButton: { backgroundColor: '#30343A', borderWidth: 1, borderColor: '#555B63', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
  listenButtonText: { color: '#E1E4E8', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  durationText: { color: '#AEB8C2', fontSize: 13, fontWeight: '600' },
  ratingPanel: { marginHorizontal: 18, padding: 16, backgroundColor: '#171717', borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 14 },
  ratingNumber: { color: '#fff', fontSize: 30, fontWeight: '800' },
  ratingTitle: { color: '#ddd', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  ratingSub: { color: '#777', fontSize: 11, marginTop: 4 },
  reviewCount: { alignItems: 'center', paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: '#333' },
  reviewCountNumber: { color: '#fff', fontSize: 18, fontWeight: '700' },
  reviewCountLabel: { color: '#888', fontSize: 9, letterSpacing: 1, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 20, gap: 8 },
  primaryAction: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 7 },
  primaryActionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 7, backgroundColor: '#171717' },
  actionActive: { backgroundColor: '#262626' },
  actionIcon: { color: '#bbb', fontSize: 17, marginBottom: 4 },
  actionText: { color: '#bbb', fontSize: 10, fontWeight: '600' },
  sectionHeader: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#262626' },
  sectionTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  sectionSub: { color: '#777', fontSize: 11, marginTop: 4 },
  seeAll: { fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 20 },
  emptyTitle: { color: '#ddd', fontSize: 15, fontWeight: '700' },
  emptyText: { color: '#888', fontSize: 12, marginTop: 7, textAlign: 'center' },
  emptyLink: { fontSize: 13, fontWeight: '700', marginTop: 14 },
  reviewCard: { paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#242424' },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333' },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
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

  menuRatingSection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#343438', marginBottom: 12 },
  menuRatingHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  menuRatingTitle: { color: '#aaa', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  menuRatingAverage: { color: '#eee', fontSize: 13, fontWeight: '700' },
  menuRatingCount: { color: '#777', fontSize: 11, fontWeight: '400' },
  menuRatingStars: { width: 202, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  menuRatingStar: { color: '#555B63', fontSize: 30, lineHeight: 36 },
  menuRatingStarActive: { color: '#D7DDE3', fontSize: 30, lineHeight: 36 },
  menuRatingHint: { color: '#777', fontSize: 10, textAlign: 'center', marginTop: 5 },
  menuRateButton: { alignSelf: 'center', backgroundColor: '#30343A', borderRadius: 6, paddingHorizontal: 18, paddingVertical: 9, marginTop: 10 },
  menuRateButtonText: { color: '#E1E4E8', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});
