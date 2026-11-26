import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { recordActivity } from '@/utils/activity';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const STAR_SIZE = 36;
const STAR_GAP = 6;
const STAR_SLOT = STAR_SIZE + STAR_GAP;
const STARS_WIDTH = STAR_SIZE * 5 + STAR_GAP * 4;

// Converts a finger position (px from the left edge of the stars) into a rating in 0.5 steps.
function ratingFromX(x: number) {
  const clamped = Math.max(0, Math.min(x, STARS_WIDTH));
  const starIndex = Math.min(4, Math.floor(clamped / STAR_SLOT));
  const withinStar = Math.min(STAR_SIZE, clamped - starIndex * STAR_SLOT);
  return starIndex + (withinStar >= STAR_SIZE / 2 ? 1 : 0.5);
}

export default function ReviewPage() {
  const { albumName, albumArtist, albumCover, albumId, currentRating, itemType, parentAlbumId } = useLocalSearchParams();
  const router = useRouter();
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const resolvedType = (itemType as string) || 'album';
  const resolvedParentAlbumId = (parentAlbumId as string) || (albumId as string);

  // A review can be saved with a rating, with text, or with both.
  const hasReviewText = review.trim().length > 0;
  const canSave = rating > 0 || hasReviewText;

  // Touch + drag across the stars changes the rating.
  const startX = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        startX.current = evt.nativeEvent.locationX;
        setRating(ratingFromX(startX.current));
      },
      onPanResponderMove: (_evt, gesture) => {
        setRating(ratingFromX(startX.current + gesture.dx));
      },
    })
  ).current;

  useEffect(() => {
    let active = true;
    async function loadExisting() {
      const incomingRating = currentRating ? Number.parseFloat(String(currentRating)) : 0;
      try {
        if (albumId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: remoteReview, error: remoteError } = await supabase
              .from('music_reviews')
              .select('rating,review_text')
              .eq('user_id', user.id)
              .eq('item_type', resolvedType)
              .eq('item_id', String(albumId))
              .maybeSingle();
            if (!remoteError && remoteReview) {
              if (active) {
                // A rating passed from the star swipe is an intentional new selection.
                // Keep the saved review text, but don't overwrite that incoming rating.
                setRating(
                  Number.isFinite(incomingRating) && incomingRating > 0
                    ? incomingRating
                    : Number(remoteReview.rating) || 0
                );
                setReview(remoteReview.review_text || '');
              }
              return;
            }
          }
          const existing = await AsyncStorage.getItem('reviews');
          const reviews = existing ? JSON.parse(existing) : [];
          const found = reviews.find((r: any) => String(r.albumId) === String(albumId) && (r.itemType || 'album') === resolvedType);
          if (found && active) {
            setRating(Number.isFinite(incomingRating) && incomingRating > 0 ? incomingRating : (found.rating || 0));
            setReview(found.review || '');
          } else if (active && Number.isFinite(incomingRating) && incomingRating > 0) {
            setRating(incomingRating);
          }
        } else if (active && Number.isFinite(incomingRating) && incomingRating > 0) {
          setRating(incomingRating);
        }
      } catch (error) {
        console.warn('Could not load existing review:', error);
        if (active && Number.isFinite(incomingRating) && incomingRating > 0) setRating(incomingRating);
      } finally {
        if (active) setLoaded(true);
      }
    }
    void loadExisting();
    return () => { active = false; };
  }, [albumId, currentRating, resolvedType]);
  function renderStars() {
    return (
      <View style={{ width: STARS_WIDTH, height: STAR_SIZE }}>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((s) => {
            const filled = rating >= s;
            const half = !filled && rating >= s - 0.5;
            return (
              <View key={s} style={{ width: STAR_SIZE, height: STAR_SIZE }}>
                <Text style={styles.starEmpty}>{'\u2605'}</Text>
                {(filled || half) && (
                  <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', width: filled ? STAR_SIZE : STAR_SIZE / 2 }]}>
                    <Text style={styles.starFilled}>{'\u2605'}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        {/* Invisible layer on top that catches taps and finger swipes */}
        <View style={StyleSheet.absoluteFillObject} {...panResponder.panHandlers} />
      </View>
    );
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || await AsyncStorage.getItem('user_id');

      const existing = await AsyncStorage.getItem('reviews');
      const reviews = existing ? JSON.parse(existing) : [];
      const existingIndex = reviews.findIndex((r: any) =>
        String(r.albumId) === String(albumId) && (r.itemType || 'album') === resolvedType
      );

      let remoteReviewExists = false;
      if (user) {
        const { data: remoteReview, error: remoteLookupError } = await supabase
          .from('music_reviews')
          .select('id')
          .eq('user_id', user.id)
          .eq('item_type', resolvedType)
          .eq('item_id', String(albumId))
          .maybeSingle();
        if (remoteLookupError) throw remoteLookupError;
        remoteReviewExists = !!remoteReview;
      }
      const isNewReview = existingIndex === -1 && !remoteReviewExists;

      const savedAt = new Date().toISOString();
      if (existingIndex !== -1) {
        reviews[existingIndex] = {
          ...reviews[existingIndex],
          rating,
          review,
          date: savedAt,
          itemType: resolvedType,
          parentAlbumId: resolvedParentAlbumId,
        };
      } else {
        reviews.unshift({
          id: Date.now().toString(),
          userId,
          albumId: String(albumId),
          albumName: albumName as string,
          albumArtist: albumArtist as string,
          albumCover: albumCover as string,
          rating,
          review,
          date: savedAt,
          itemType: resolvedType,
          parentAlbumId: resolvedParentAlbumId,
        });
      }
      await AsyncStorage.setItem('reviews', JSON.stringify(reviews));

      const listenedData = await AsyncStorage.getItem('listened');
      const listenedList = listenedData ? JSON.parse(listenedData) : [];
      const listenedIndex = listenedList.findIndex((item: any) =>
        String(item.id) === String(albumId) && (item.type || 'album') === resolvedType
      );

      if (listenedIndex !== -1) {
        if (rating > 0) listenedList[listenedIndex].rating = rating;
        listenedList[listenedIndex].type = resolvedType;
        if (resolvedType === 'track') listenedList[listenedIndex].albumId = resolvedParentAlbumId;
      } else {
        listenedList.unshift({
          id: String(albumId),
          name: albumName,
          cover: albumCover,
          type: resolvedType,
          albumId: resolvedType === 'track' ? resolvedParentAlbumId : undefined,
          rating,
          date: savedAt,
        });
      }
      await AsyncStorage.setItem('listened', JSON.stringify(listenedList));

      // Keep the Diary (listening log) separate from written Reviews.
      const diaryEntry = {
        id: `listen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        itemId: String(albumId),
        name: String(albumName ?? ''),
        artist: String(albumArtist ?? ''),
        cover: String(albumCover ?? ''),
        type: resolvedType,
        albumId: resolvedType === 'track' ? resolvedParentAlbumId : String(albumId),
        rating: Number(rating) || 0,
        date: savedAt,
        review: String(review || '').trim(),
      };
      const diaryData = await AsyncStorage.getItem('diary_entries');
      const diaryEntries = diaryData ? JSON.parse(diaryData) : [];
      diaryEntries.unshift(diaryEntry);
      await AsyncStorage.setItem('diary_entries', JSON.stringify(diaryEntries));

      const savedReview = reviews.find((item: any) =>
        String(item.albumId) === String(albumId) && (item.itemType || 'album') === resolvedType
      );

      if (user && savedReview) {
        const reviewData = {
          id: String(albumId),
          name: String(albumName ?? savedReview.albumName ?? ''),
          artist: String(albumArtist ?? savedReview.albumArtist ?? ''),
          cover: String(albumCover ?? savedReview.albumCover ?? ''),
          albumName: String(savedReview.albumName ?? albumName ?? ''),
          albumArtist: String(savedReview.albumArtist ?? albumArtist ?? ''),
          albumCover: String(savedReview.albumCover ?? albumCover ?? ''),
          type: resolvedType,
          albumId: resolvedType === 'track' ? resolvedParentAlbumId : undefined,
          rating,
          review,
          date: savedAt,
        };

        const { error: publicReviewError } = await supabase
          .from('music_reviews')
          .upsert({
            user_id: user.id,
            item_type: resolvedType,
            item_id: String(albumId),
            parent_album_id: resolvedType === 'track' ? resolvedParentAlbumId : null,
            item_name: String(albumName ?? savedReview.albumName ?? ''),
            artist_name: String(albumArtist ?? savedReview.albumArtist ?? ''),
            cover_url: String(albumCover ?? savedReview.albumCover ?? ''),
            rating: Number(rating) || 0,
            review_text: String(review || '').trim(),
            updated_at: savedAt,
          }, { onConflict: 'user_id,item_type,item_id' });
        if (publicReviewError) throw publicReviewError;

        const { error: diarySyncError } = await supabase
          .from('public_profile_items')
          .upsert({
            user_id: user.id,
            section: 'diary',
            item_key: diaryEntry.id,
            data: diaryEntry,
            updated_at: savedAt,
          }, { onConflict: 'user_id,section,item_key' });
        if (diarySyncError) console.error('Diary profile sync failed:', diarySyncError);

        if (hasReviewText) {
          const { error: profileSyncError } = await supabase
            .from('public_profile_items')
            .upsert({
              user_id: user.id,
              section: 'reviews',
              item_key: String(albumId),
              data: savedReview,
              updated_at: savedAt,
            }, { onConflict: 'user_id,section,item_key' });
          if (profileSyncError) console.error('Review profile sync failed:', profileSyncError);
        } else {
          const { error: removeReviewProfileError } = await supabase
            .from('public_profile_items')
            .delete()
            .eq('user_id', user.id)
            .eq('section', 'reviews')
            .eq('item_key', String(albumId));
          if (removeReviewProfileError) console.error('Could not remove empty review from profile:', removeReviewProfileError);
        }

        if (hasReviewText) {
          if (isNewReview) {
            await recordActivity('reviewed', String(albumId), reviewData);
          } else {
            const { data: activityRows, error: activityLookupError } = await supabase
              .from('user_activity')
              .select('id')
              .eq('user_id', user.id)
              .eq('activity_type', 'reviewed')
              .eq('item_key', String(albumId))
              .order('created_at', { ascending: false })
              .limit(100);
            if (activityLookupError) throw activityLookupError;

            if (activityRows?.length) {
              const { error: activityUpdateError } = await supabase
                .from('user_activity')
                .update({ data: reviewData, created_at: savedAt })
                .eq('user_id', user.id)
                .eq('activity_type', 'reviewed')
                .eq('item_key', String(albumId));
              if (activityUpdateError) throw activityUpdateError;
            } else {
              await recordActivity('reviewed', String(albumId), reviewData);
            }
          }
        } else {
          const { error: removeReviewActivityError } = await supabase
            .from('user_activity')
            .delete()
            .eq('user_id', user.id)
            .eq('activity_type', 'reviewed')
            .eq('item_key', String(albumId));
          if (removeReviewActivityError) throw removeReviewActivityError;
        }
      }

      // Every explicit save of a listen/log creates a separate Diary event.
      // Ratings and reviews remain one-per-item; listening history is append-only.
      const listenedEntry = listenedIndex >= 0 ? listenedList[listenedIndex] : listenedList[0];
      await recordActivity('listened', String(albumId), {
        ...listenedEntry,
        id: String(albumId),
        name: String(albumName ?? ''),
        artist: String(albumArtist ?? ''),
        cover: String(albumCover ?? ''),
        type: resolvedType,
        albumId: resolvedType === 'track' ? resolvedParentAlbumId : String(albumId),
        rating: Number(rating) || 0,
        date: savedAt,
        review: String(review || '').trim(),
      });

      await AsyncStorage.setItem('review_saved_notification', JSON.stringify({ time: Date.now() }));
      router.back();
    } catch (error: any) {
      console.error('Could not save review:', error);
      Alert.alert(
        'Could not sync review',
        error?.message || 'Your review may be saved on this device. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {loaded && review.trim().length > 0 ? 'Edit Review' : loaded && rating > 0 ? 'Edit Log' : 'I Listened...'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={!canSave || saving}>
          <Text style={[styles.save, (!canSave || saving) && { opacity: 0.4 }]}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.albumRow}>
        {albumCover
          ? <Image source={{ uri: albumCover as string }} style={styles.cover} />
          : <View style={styles.cover} />}
        <View>
          <Text style={styles.albumName}>{albumName}</Text>
          <Text style={styles.albumArtist}>{albumArtist}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Date</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Rating</Text>
        {renderStars()}
      </View>

      <TextInput
        style={styles.reviewInput}
        placeholder="Add review..."
        placeholderTextColor="#888"
        multiline
        value={review}
        onChangeText={setReview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#3d5068' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#4a6080' },
  cancel: { color: '#aaa', fontSize: 16 },
  title: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  save: { color: '#2ecc71', fontSize: 16, fontWeight: '600' },
  albumRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#4a6080' },
  cover: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#555', marginRight: 12 },
  albumName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  albumArtist: { color: '#aaa', fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#4a6080' },
  label: { color: '#ccc', fontSize: 16 },
  date: { color: '#fff', fontSize: 15 },
  starsRow: { flexDirection: 'row', gap: STAR_GAP },
  starEmpty: { fontSize: 32, color: '#9BA7B2' },
  starFilled: { fontSize: 32, color: '#00E054' },
  reviewInput: { color: '#fff', fontSize: 15, padding: 16, minHeight: 200, textAlignVertical: 'top' },
});
