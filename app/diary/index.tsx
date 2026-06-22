import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function Stars({ count }: { count: number }) {
  const full = Math.floor(count);
  const half = count % 1 >= 0.5;
  return (
    <Text style={styles.stars}>
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
    </Text>
  );
}

function groupByMonth(entries: any[]) {
  const grouped: { [key: string]: any[] } = {};
  entries.forEach(e => {
    const month = new Date(e.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(e);
  });
  return grouped;
}

export default function DiaryScreen() {
  const router = useRouter();
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('reviews').then(data => {
      if (data) setReviews(JSON.parse(data));
    });
  }, []);

  const grouped = groupByMonth(reviews);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Diary</Text>
      </View>

      <ScrollView>
        {reviews.length === 0 ? (
          <Text style={styles.empty}>ჯერ არ გაქვს reviews</Text>
        ) : (
          Object.entries(grouped).map(([month, entries]) => (
            <View key={month}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthText}>{month}</Text>
              </View>
              {entries.map((entry, index) => (
               <View key={entry.id ?? `${entry.albumId}-${entry.date}-${index}`} style={styles.diaryR...

                  <Text style={styles.diaryDay}>
                    {new Date(entry.date).getDate()}
                  </Text>
                  {entry.albumCover
                    ? <Image source={{ uri: entry.albumCover }} style={styles.diaryCover} />
                    : <View style={[styles.diaryCover, { backgroundColor: '#2a2a2a' }]} />}
                  <View style={styles.diaryInfo}>
                    <Text style={styles.diaryTitle} numberOfLines={1}>
                      {entry.albumName}{' '}
                      <Text style={styles.diaryYear}>{new Date(entry.date).getFullYear()}</Text>
                    </Text>
                    <Text style={styles.diaryArtist}>{entry.albumArtist}</Text>
                    <Stars count={entry.rating} />
                    {entry.review
                      ? <Text style={styles.diaryReview} numberOfLines={2}>{entry.review}</Text>
                      : null}
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  backBtn: { marginRight: 12 },
  backText: { color: '#fff', fontSize: 32, lineHeight: 36 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  empty: { color: '#555', paddingHorizontal: 20, paddingVertical: 20 },
  monthHeader: { backgroundColor: '#1e1e1e', paddingHorizontal: 20, paddingVertical: 8 },
  monthText: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  diaryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  diaryDay: { color: '#555', fontSize: 16, fontWeight: 'bold', width: 28, textAlign: 'center' },
  diaryCover: { width: 48, height: 48, borderRadius: 4 },
  diaryInfo: { flex: 1, marginLeft: 12 },
  diaryTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  diaryYear: { color: '#666', fontSize: 12, fontWeight: 'normal' },
  diaryArtist: { color: '#888', fontSize: 12, marginTop: 1 },
  diaryReview: { color: '#666', fontSize: 11, marginTop: 3, fontStyle: 'italic' },
  stars: { color: '#1DB954', fontSize: 12, marginTop: 2 },
});
