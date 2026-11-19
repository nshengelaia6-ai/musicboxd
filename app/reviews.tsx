import { useAppTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Reviews() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [reviews, setReviews] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem('reviews')
        .then(data => {
          const allReviews = data ? JSON.parse(data) : [];
          if (active) setReviews(allReviews.filter((review: any) => review.review && review.review.trim() !== ''));
        })
        .catch(() => {
          if (active) setReviews([]);
        });
      return () => { active = false; };
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>{'\u2039'}</Text>
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
          keyExtractor={(item, index) => item.id ?? index.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/review/${item.id}` as any)}
            >
              {item.albumCover
                ? <Image source={{ uri: item.albumCover }} style={styles.cover} />
                : <View style={[styles.cover, { backgroundColor: '#2a2a2a' }]} />}
              <View style={styles.info}>
                <Text style={styles.albumName}>{item.albumName}</Text>
                <Text style={styles.artist}>{item.albumArtist}</Text>
                <Text style={[styles.rating, { color: '#9BA7B2' }]}>{'\u2605'.repeat(Math.floor(item.rating))}{item.rating % 1 ? '\u00BD' : ''}</Text>
                {item.review ? <Text style={styles.review}>{item.review}</Text> : null}
                <Text style={styles.date}>{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
              </View>
            </TouchableOpacity>
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
