import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ReviewPage() {
  const { albumName, albumArtist, albumCover } = useLocalSearchParams();
  const router = useRouter();
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const starsLayout = useRef<any>(null);
  const starWidth = 36;
  const starGap = 6;

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
            <View key={s} style={{ width: starWidth, alignItems: 'center' }}>
              <Text style={[styles.star, (filled || half) && styles.starActive]}>★</Text>
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
        <Text style={styles.title}>I Listened...</Text>
        <TouchableOpacity>
          <Text style={styles.save}>Save</Text>
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
  starsRow: { flexDirection: 'row' },
  star: { fontSize: 32, color: '#444' },
  starActive: { color: '#ffb6c1' },
  reviewInput: { color: '#fff', fontSize: 15, padding: 16, minHeight: 200, textAlignVertical: 'top' },
});
