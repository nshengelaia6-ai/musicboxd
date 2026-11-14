import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const STAR_SIZE = 36;
const STAR_GAP = 6;
const STAR_SLOT = STAR_SIZE + STAR_GAP;
const STARS_WIDTH = STAR_SIZE * 5 + STAR_GAP * 4;

// Converts a finger position (px from the left edge of the stars) into a rating in 0.5 steps.
function ratingFromX(x: number) {
  const clamped = Math.max(0, Math.min(x, STARS_WIDTH));
  const value = Math.ceil((clamped / STAR_SLOT) * 2) / 2;
  return Math.max(0.5, Math.min(5, value));
}

export default function ReviewPage() {
  const { albumName, albumArtist, albumCover, albumId, currentRating, itemType, parentAlbumId } = useLocalSearchParams();
  const router = useRouter();
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);
  const [loaded, setLoaded] = useState(false);
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
    async function loadExisting() {
      if (!albumId) { setLoaded(true); return; }
      const existing = await AsyncStorage.getItem('reviews');
      const reviews = existing ? JSON.parse(existing) : [];
      const found = reviews.find((r: any) => r.albumId === albumId);
      if (found) {
        setRating(found.rating || 0);
        setReview(found.review || '');
      } else if (currentRating && parseFloat(currentRating as string) > 0) {
        setRating(parseFloat(currentRating as string));
      }
      setLoaded(true);
    }
    loadExisting();
  }, [albumId]);

  function renderStars() {
    return (
      <View style={{ width: STARS_WIDTH, height: STAR_SIZE }}>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((s) => {
            const filled = rating >= s;
            const half = !filled && rating >= s - 0.5;
            return (
              <View key={s} style={{ width: STAR_SIZE, height: STAR_SIZE }}>
                <Text style={styles.starEmpty}>★</Text>
                {(filled || half) && (
                  <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', width: filled ? STAR_SIZE : STAR_SIZE / 2 }]}>
                    <Text style={styles.starFilled}>★</Text>
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
    if (!canSave) return;

    const userId = await AsyncStorage.getItem('user_id');

    try {
      const existing = await AsyncStorage.getItem('reviews');
      const reviews = existing ? JSON.parse(existing) : [];
      const existingIndex = reviews.findIndex((r: any) => r.albumId === albumId);

      if (existingIndex !== -1) {
        reviews[existingIndex] = {
          ...reviews[existingIndex],
          rating,
          review,
          itemType: resolvedType,
          parentAlbumId: resolvedParentAlbumId,
        };
      } else {
        reviews.unshift({
          id: Date.now().toString(),
          userId,
          albumId: albumId as string,
          albumName: albumName as string,
          albumArtist: albumArtist as string,
          albumCover: albumCover as string,
          rating,
          review,
          date: new Date().toISOString(),
          itemType: resolvedType,
          parentAlbumId: resolvedParentAlbumId,
        });
      }
      await AsyncStorage.setItem('reviews', JSON.stringify(reviews));

      const listenedData = await AsyncStorage.getItem('listened');
      const listenedList = listenedData ? JSON.parse(listenedData) : [];
      const listenedIndex = listenedList.findIndex((i: any) => i.id === albumId);

      if (listenedIndex !== -1) {
        // Do not wipe an existing rating when saving a text-only review.
        if (rating > 0) listenedList[listenedIndex].rating = rating;
        listenedList[listenedIndex].type = resolvedType;
        if (resolvedType === 'track') {
          listenedList[listenedIndex].albumId = resolvedParentAlbumId;
        }
      } else {
        listenedList.unshift({
          id: albumId,
          name: albumName,
          cover: albumCover,
          type: resolvedType,
          albumId: resolvedType === 'track' ? resolvedParentAlbumId : undefined,
          rating,
          date: new Date().toISOString(),
        });
      }
      await AsyncStorage.setItem('listened', JSON.stringify(listenedList));

      // The album page reads this to show the "Review saved" toast.
      await AsyncStorage.setItem('review_saved_notification', JSON.stringify({ time: Date.now() }));

      router.back();
    } catch (e) {
      console.error('შენახვა ვერ მოხერხდა', e);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {loaded && rating > 0 ? 'Edit Review' : 'I Listened...'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={!canSave}>
          <Text style={[styles.save, !canSave && { opacity: 0.4 }]}>Save</Text>
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
  starEmpty: { fontSize: 32, color: '#555' },
  starFilled: { fontSize: 32, color: '#ffb6c1' },
  reviewInput: { color: '#fff', fontSize: 15, padding: 16, minHeight: 200, textAlignVertical: 'top' },
});