import { useAppTheme } from '@/context/ThemeContext';
import { recordActivity } from '@/utils/activity';
import { getSpotifyTrack } from '@/utils/spotifyCatalog';
import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const HEART = '\u2665';
const EMPTY_HEART = '\u2661';

export default function TrackPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [track, setTrack] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);\n  const [averageRating, setAverageRating] = useState(0);
  const [people, setPeople] = useState<Record<string, any>>({});
  const [liked, setLiked] = useState(false);
  const [listened, setListened] = useState(false);
  const [wantToListen, setWantToListen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setAverageRating(ratings.length
        ? ratings.reduce((sum: number, row: any) => sum + Number(row.rating || 0), 0) / ratings.length
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
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <Text style={styles.topTitle}>MUSICBOXD</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : <View style={styles.cover} />}
          <Text style={styles.songTitle}>{track.name}</Text>
          <Text style={styles.artist}>{artist}</Text>
          <TouchableOpacity onPress={() => router.push(`/album/${track.album?.id}` as any)}>
            <Text style={[styles.albumLink, { color: accentColor }]}>{track.album?.name || 'Album'}{releaseYear ? `  ·  ${releaseYear}` : ''}</Text>
          </TouchableOpacity>
          <Text style={styles.typeLabel}>SONG</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090909' },
  topBar: { paddingTop: 58, paddingHorizontal: 18, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#242424' },
  back: { color: '#fff', fontSize: 30, width: 28 },
  topTitle: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  content: { paddingBottom: 44 },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 },
  cover: { width: 218, height: 218, borderRadius: 5, backgroundColor: '#252525', marginBottom: 22 },
  songTitle: { color: '#fff', fontSize: 27, fontWeight: '800', textAlign: 'center' },
  artist: { color: '#c5c5c5', fontSize: 16, marginTop: 7, textAlign: 'center' },
  albumLink: { fontSize: 13, marginTop: 7, fontWeight: '600', textAlign: 'center' },
  typeLabel: { color: '#777', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 14 },
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
});
