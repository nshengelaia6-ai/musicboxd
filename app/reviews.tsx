import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Reviews() {
  const router = useRouter();
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    const data = await AsyncStorage.getItem('reviews');
    if (data) setReviews(JSON.parse(data));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reviews</Text>
        <View style={{ width: 30 }} />
      </View>
      {reviews.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>რევიუები არ არის</Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.albumCover
                ? <Image source={{ uri: item.albumCover }} style={styles.cover} />
                : <View style={[styles.cover, { backgroundColor: '#2a2a2a' }]} />}
              <View style={styles.info}>
                <Text style={styles.albumName}>{item.albumName}</Text>
                <Text style={styles.artist}>{item.albumArtist}</Text>
                <Text style={styles.rating}>{'★'.repeat(Math.floor(item.rating))}{item.rating % 1 ? '½' : ''}</Text>
                {item.review ? <Text style={styles.review}>{item.review}</Text> : null}
                <Text style={styles.date}>{new Date(item.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  back: { color: '#fff', fontSize: 36, lineHeight: 40 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#888', fontSize: 16 },
  card: { flexDirection: 'row', marginBottom: 20, gap: 12 },
  cover: { width: 80, height: 80, borderRadius: 8 },
  info: { flex: 1 },
  albumName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  artist: { color: '#888', fontSize: 13, marginTop: 2 },
  rating: { color: '#ffb6c1', fontSize: 14, marginTop: 4 },
  review: { color: '#ccc', fontSize: 13, marginTop: 6, lineHeight: 18 },
  date: { color: '#555', fontSize: 11, marginTop: 6 },
});
