import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ReviewPage() {
  const { albumName, albumArtist, albumCover } = useLocalSearchParams();
  const router = useRouter();
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

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
        <Text style={styles.albumName}>{albumName}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Date</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Rating</Text>
        <View style={styles.stars}>
          {[1,2,3,4,5].map(s => (
            <View key={s} style={{ flexDirection: 'row' }}>
              <Pressable onPress={() => setRating(s - 0.5)}>
                <Text style={[styles.star, rating >= s - 0.5 && styles.starActive]}>◐</Text>
              </Pressable>
              <Pressable onPress={() => setRating(s)}>
                <Text style={[styles.star, rating >= s && styles.starActive]}>◑</Text>
              </Pressable>
            </View>
          ))}
        </View>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#4a6080' },
  label: { color: '#ccc', fontSize: 16 },
  date: { color: '#fff', fontSize: 15 },
  stars: { flexDirection: 'row' },
  star: { fontSize: 24, color: '#555' },
  starActive: { color: '#ffb6c1' },
  reviewInput: { color: '#fff', fontSize: 15, padding: 16, minHeight: 200, textAlignVertical: 'top' },
});
