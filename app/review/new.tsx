import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ReviewPage() {
  const { albumName, albumArtist, albumCover, albumId } = useLocalSearchParams();
  const router = useRouter();
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const starsLayout = useRef<any>(null);
  const starWidth = 36;
  const starGap = 6;

  useEffect(() => {
    async function loadExisting() {
      if (!albumId) {
        setLoaded(true);
        return;
      }
      const existing = await AsyncStorage.getItem('reviews');
      const reviews = existing ? JSON.parse(existing) : [];
      const found = reviews.find((r: any) => r.albumId === albumId);
      if (found) {
        setRating(found.rating);
        setReview(found.review || '');
      }
      setLoaded(true);
    }
    loadExisting();
  }, [albumId]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateRating(e.nativeEvent.pageX),
      onPanResponderMove: (e) => updateRating(e.nativeEvent.pageX),
    })
  ).current;

  function updateRating(pageX: number) {
    if (!starsLayout.current) return;
    const { x } = starsLayout.current;
    const relX = pageX - x;
    const totalWidth = 5 * starWidth + 4 * starGap;
    const clamped = Math.max(0, Math.min(relX, totalWidth));
    const raw = (clamped / totalWidth) * 5;
    const rounded = Math.round(raw * 2) / 2;
    setRating(Math.max(0.5, rounded));
  }

  async function handleSave() {
  if (rating === 0 || !review.trim()) return;


  const userId = await AsyncStorage.getItem('user_id');

  try {
    const existing = await AsyncStorage.getItem('reviews');
    const reviews = existing ? JSON.parse(existing) : [];

    const existingIndex = albumId ? reviews.findIndex((r: any) => r.albumId === albumId) : -1;

    if (existingIndex !== -1) {
      reviews[existingIndex] = {
        ...reviews[existingIndex],
        rating,
        review,
        date: new Date().toISOString(),
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
      });
    }

    await AsyncStorage.setItem('reviews', JSON.stringify(reviews));

    const listenedData = await AsyncStorage.getItem('listened');
    const listenedList = listenedData ? JSON.parse(listenedData) : [];
    if (!listenedList.find((i: any) => i.id === albumId)) {
      listenedList.unshift({
        id: albumId,
        name: albumName,
        cover: albumCover,
        type: 'album',
        rating,
        date: new Date().toISOString(),
      });
      await AsyncStorage.setItem('listened', JSON.stringify(listenedList));
    }

    router.back();
  } catch (e) {
    console.error('შენახვა ვერ მოხერხდა', e);
  }
}


  function renderStars() {
    return (
      <View
        onLayout={(e) => { starsLayout.current = e.nativeEvent.layout; }}
        {...panResponder.panHandlers}
        style={styles.starsRow}
      >
        {[1, 2, 3, 4, 5].map((s) => {
          const filled = rating >= s;
          const half = !filled && rating >= s - 0.5;
          return (
            <View key={s} style={{ width: starWidth, height: starWidth, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.starEmpty}>★</Text>
              {(filled || half) && (
                <View style={[
                  StyleSheet.absoluteFillObject,
                  { overflow: 'hidden', width: filled ? starWidth : starWidth / 2 }
                ]}>
                  <Text style={styles.starFilled}>★</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
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
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.save, rating === 0 && { opacity: 0.4 }]}>Save</Text>
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
  starsRow: { flexDirection: 'row', gap: 6 },
  starEmpty: { fontSize: 32, color: '#555', position: 'absolute' },
  starFilled: { fontSize: 32, color: '#ffb6c1' },
  reviewInput: { color: '#fff', fontSize: 15, padding: 16, minHeight: 200, textAlignVertical: 'top' },
});
