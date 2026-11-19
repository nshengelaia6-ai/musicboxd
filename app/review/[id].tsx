import { useAppTheme } from '@/context/ThemeContext';
import { getValidSpotifyToken } from '@/utils/spotify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function Stars({ count, color }: { count: number; color: string }) {
  const starWidth = 22;
  return (
    <View style={{ flexDirection: 'row', marginTop: 10 }}>
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = count >= s;
        const half = !filled && count >= s - 0.5;
        return (
          <View key={s} style={{ width: starWidth, height: starWidth }}>
            <Text style={{ fontSize: starWidth, color: '#333', position: 'absolute' }}>{'\u2605'}</Text>
            {(filled || half) && (
              <View style={{ overflow: 'hidden', width: filled ? starWidth : starWidth / 2, position: 'absolute' }}>
                <Text style={{ fontSize: starWidth, color }}>{'\u2605'}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function ReviewDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [entry, setEntry] = useState<any>(null);
  const [username, setUsername] = useState('nia');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError('');

      async function load() {
        try {
          const [reviewsData, profileData, likesData, likedData] = await Promise.all([
            AsyncStorage.getItem('reviews'),
            AsyncStorage.getItem('profile'),
            AsyncStorage.getItem(`likes_${id}`),
            AsyncStorage.getItem(`review_liked_${id}`),
          ]);
          const reviews = reviewsData ? JSON.parse(reviewsData) : [];
          const found = reviews.find((review: any) => String(review.id) === String(id));
          const profile = profileData ? JSON.parse(profileData) : {};
          if (active) {
            setEntry(found || null);
            setUsername(profile.username || 'nia');
            setAvatar(profile.avatar || null);
            setLikes(Number(likesData) || 0);
            setIsLiked(likedData === 'true');
          }
        } catch {
          if (active) setError('Could not load this review.');
        } finally {
          if (active) setLoading(false);
        }
      }

      load();
      return () => { active = false; };
    }, [id])
  );

  async function goToAlbum() {
    if (!entry) return;

    const isTrack = entry.itemType === 'track' || entry.type === 'track';
    if (!isTrack) {
      router.push(`/album/${entry.albumId}` as any);
      return;
    }

    let parentAlbumId = entry.parentAlbumId;
    if (!parentAlbumId) {
      const listenedData = await AsyncStorage.getItem('listened');
      const listened = listenedData ? JSON.parse(listenedData) : [];
      parentAlbumId = listened.find((item: any) => item.id === entry.albumId)?.albumId;
    }
    if (parentAlbumId) {
      router.push({
        pathname: '/album/[id]',
        params: { id: parentAlbumId, highlightTrackId: entry.albumId },
      } as any);
      return;
    }

    const token = await getValidSpotifyToken();
    if (!token) {
      router.push(`/album/${entry.albumId}` as any);
      return;
    }
    try {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${entry.albumId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const realAlbumId = data.album?.id;
      if (realAlbumId) {
        router.push({
          pathname: '/album/[id]',
          params: { id: realAlbumId, highlightTrackId: entry.albumId },
        } as any);
      } else {
        router.push(`/album/${entry.albumId}` as any);
      }
    } catch {
      router.push(`/album/${entry.albumId}` as any);
    }
  }

  async function handleLike() {
    const nextLiked = !isLiked;
    const nextLikes = Math.max(0, likes + (nextLiked ? 1 : -1));
    setLikes(nextLikes);
    setIsLiked(nextLiked);
    try {
      await AsyncStorage.setItem(`likes_${id}`, String(nextLikes));
      await AsyncStorage.setItem(`review_liked_${id}`, String(nextLiked));
    } catch {
      setError('Could not update this like. Please try again.');
    }
  }

  function editReview() {
    setMenuVisible(false);
    router.push({
      pathname: '/review/new',
      params: {
        albumId: entry.albumId,
        albumName: entry.albumName,
        albumArtist: entry.albumArtist,
        albumCover: entry.albumCover,
        currentRating: String(entry.rating || 0),
        itemType: entry.itemType || entry.type || 'album',
        parentAlbumId: entry.parentAlbumId || entry.albumId,
      },
    } as any);
  }

  async function shareReview() {
    setMenuVisible(false);
    const itemType = entry.itemType === 'track' || entry.type === 'track' ? 'track' : 'album';
    const itemId = entry.albumId;
    const url = `https://open.spotify.com/${itemType}/${itemId}`;
    const reviewText = entry.review ? `\n\n${entry.review}` : '';
    try {
      await Share.share({
        title: entry.albumName,
        message: `${username} rated ${entry.albumName} ${entry.rating}/5${reviewText}\n${url}`,
        url,
      });
    } catch {
      setError('Could not open sharing options.');
    }
  }

  async function deleteReview() {
    try {
      const data = await AsyncStorage.getItem('reviews');
      const reviews = data ? JSON.parse(data) : [];
      const reviewToDelete = reviews.find((review: any) => String(review.id) === String(id));
      const albumId = reviewToDelete?.albumId || entry?.albumId;

      // Remove cloud copies first. Keep the local review if either cloud
      // deletion fails so the user can retry instead of leaving stale public data.
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (user && albumId) {
        const [{ error: profileDeleteError }, { error: activityDeleteError }] = await Promise.all([
          supabase.from('public_profile_items').delete()
            .eq('user_id', user.id).eq('section', 'reviews').eq('item_key', String(albumId)),
          supabase.from('user_activity').delete()
            .eq('user_id', user.id).eq('activity_type', 'reviewed').eq('item_key', String(albumId)),
        ]);
        if (profileDeleteError) throw profileDeleteError;
        if (activityDeleteError) throw activityDeleteError;
      }

      await AsyncStorage.setItem(
        'reviews',
        JSON.stringify(reviews.filter((review: any) => String(review.id) !== String(id)))
      );

      setShowDeleteConfirm(false);
      router.back();
    } catch {
      setShowDeleteConfirm(false);
      setError('Could not delete this review. Please try again.');
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ActivityIndicator color={accentColor} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backText}>{'\u2039'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.empty}>{error || 'Review not found.'}</Text>
      </View>
    );
  }

  const formattedDate = new Date(entry.date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const year = new Date(entry.date).getFullYear();

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backText}>{'\u2039'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} accessibilityRole="button" accessibilityLabel="Review actions">
          <Text style={styles.dots}>{'\u2022'}{'\u2022'}{'\u2022'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.userRow}>
          {avatar
            ? <Image source={{ uri: avatar }} style={styles.avatar} />
            : <View style={styles.avatar} />}
          <Text style={styles.username}>{username}</Text>
        </View>

        <View style={styles.mainRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.title}>{entry.albumName}</Text>
            <Text style={styles.year}>{year}</Text>
            <Stars count={entry.rating} color={'#9BA7B2'} />
            <Text style={styles.listenedText}>Listened {formattedDate}</Text>
          </View>
          <Pressable onPress={goToAlbum}>
            {entry.albumCover
              ? <Image source={{ uri: entry.albumCover }} style={styles.cover} />
              : <View style={[styles.cover, { backgroundColor: '#2a2a2a' }]} />}
          </Pressable>
        </View>

        {entry.review ? (
          <Text style={styles.reviewText}>{entry.review}</Text>
        ) : null}

        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.likeRow} onPress={handleLike} accessibilityRole="button" accessibilityLabel={isLiked ? 'Unlike review' : 'Like review'}>
          <Text style={[styles.heartIcon, isLiked && { color: accentColor }]}>{isLiked ? 'â™¥' : 'â™¡'}</Text>
          <Text style={styles.likeText}>{likes === 0 ? 'Be the first to like' : `${likes} ${likes === 1 ? 'like' : 'likes'}`}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.pillBtn} onPress={editReview} accessibilityRole="button">
          <Text style={styles.pillText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pillBtn} onPress={goToAlbum}>
          <Text style={styles.pillText}>Album  {'\u203A'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)} />
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.menuItem} onPress={editReview} accessibilityRole="button">
            <Text style={styles.menuText}>Edit review</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={shareReview} accessibilityRole="button">
            <Text style={styles.menuText}>Share review</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setShowDeleteConfirm(true); }} accessibilityRole="button">
            <Text style={styles.deleteText}>Delete review</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={() => setMenuVisible(false)}>
            <Text style={styles.doneBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Delete this review?</Text>
            <Text style={styles.confirmBody}>This removes it from your diary and activity.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.menuText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDelete} onPress={deleteReview}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#aaa', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  dots: { color: '#aaa', fontSize: 16 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40 },
  content: { padding: 20, paddingBottom: 40 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333' },
  username: { color: '#fff', fontSize: 15, fontWeight: '600' },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  year: { color: '#888', fontSize: 15, marginTop: 2 },
  listenedText: { color: '#888', fontSize: 13, marginTop: 12 },
  cover: { width: 100, height: 140, borderRadius: 6 },
  reviewText: { color: '#eee', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#1e1e1e' },
  heartIcon: { color: '#888', fontSize: 18 },
  heartActive: { color: '#ffb6c1' },
  likeText: { color: '#888', fontSize: 14 },
  error: { color: '#ff8b8b', fontSize: 13, marginBottom: 12 },
  bottomBar: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: '#1e1e1e' },
  pillBtn: { backgroundColor: '#1c1c1c', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  pillText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#1c1c1e', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  menuItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', alignItems: 'center' },
  menuText: { color: '#fff', fontSize: 16 },
  deleteText: { color: '#ff6b6b', fontSize: 16 },
  doneBtn: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  confirmOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.65)' },
  confirmDialog: { backgroundColor: '#1c1c1e', padding: 24, borderRadius: 14 },
  confirmTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  confirmBody: { color: '#aaa', fontSize: 14, marginTop: 8 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  confirmCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  confirmDelete: { backgroundColor: '#b83232', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  confirmDeleteText: { color: '#fff', fontWeight: '700' },
});
