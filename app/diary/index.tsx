import { useAppTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SectionList, Image, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from '@/utils/supabase';

type DiaryEntry = {
  id: string;
  itemId?: string;
  name: string;
  artist?: string;
  cover?: string;
  type: 'album' | 'track';
  albumId?: string;
  rating?: number;
  date: string;
  review?: string;
};

export default function DiaryScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { backgroundColor, accentColor } = useAppTheme();
  const [sections, setSections] = useState<{ title: string; data: DiaryEntry[] }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDiary = useCallback(async () => {
    setLoading(true);
    try {
      let entries: DiaryEntry[] = [];
      let reviews: any[] = [];

      const { data: authData } = await supabase.auth.getUser();
      const isOtherProfile = Boolean(userId && userId !== authData.user?.id);

      if (isOtherProfile) {
        const [diaryResult, reviewsResult] = await Promise.all([
          supabase.from('public_profile_items').select('data').eq('user_id', userId).eq('section', 'diary'),
          supabase.from('public_profile_items').select('data').eq('user_id', userId).eq('section', 'reviews'),
        ]);

        if (diaryResult.error) throw diaryResult.error;
        if (reviewsResult.error) throw reviewsResult.error;

        entries = (diaryResult.data || []).map((row: any) => row.data as DiaryEntry);
        reviews = (reviewsResult.data || []).map((row: any) => row.data);
      } else {
        const diaryData = await AsyncStorage.getItem('diary_entries');

        if (diaryData === null) {
          const listenedData = await AsyncStorage.getItem('listened');
          const listened = listenedData ? JSON.parse(listenedData) : [];

          entries = listened.map((item: any, index: number) => ({
            ...item,
            id: `legacy-${item.id}-${item.date || index}`,
            itemId: item.id,
          }));

          await AsyncStorage.setItem('diary_entries', JSON.stringify(entries));
        } else {
          entries = JSON.parse(diaryData);
        }

        const reviewsData = await AsyncStorage.getItem('reviews');
        reviews = reviewsData ? JSON.parse(reviewsData) : [];
      }

      const enriched = entries.map(entry => {
        const review = reviews.find((r: any) => r.albumId === (entry.itemId || entry.id));
        return {
          ...entry,
          artist: entry.artist || review?.albumArtist,
          rating: entry.rating || review?.rating,
          review: entry.review || review?.review || '',
        };
      });

      enriched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const grouped = new Map<string, DiaryEntry[]>();
      enriched.forEach(entry => {
        const date = new Date(entry.date);
        const title = date.toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        });
        if (!grouped.has(title)) grouped.set(title, []);
        grouped.get(title)!.push(entry);
      });

      setSections(Array.from(grouped, ([title, data]) => ({ title, data })));
    } catch (error) {
      console.error('Could not load diary:', error);
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    loadDiary();
  }, [loadDiary]));

  function openEntry(item: DiaryEntry) {
    if (item.type === 'album') {
      router.push(`/album/${item.itemId || item.id}` as any);
    } else if (item.albumId) {
      router.push({
        pathname: '/album/[id]',
        params: { id: item.albumId, highlightTrackId: item.itemId || item.id },
      } as any);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Diary</Text>
        <View style={{ width: 30 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={accentColor} style={{ marginTop: 40 }} />
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your diary starts here.</Text>
          <Text style={styles.emptyText}>Mark an album or track as listened to see it here.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>{section.title}</Text>
              <View style={styles.dateLine} />
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.entry} onPress={() => openEntry(item)}>
              {item.cover ? (
                <Image source={{ uri: item.cover }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]} />
              )}
              <View style={styles.info}>
                <Text style={styles.itemType}>{item.type === 'album' ? 'ALBUM' : 'TRACK'}</Text>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                {item.artist ? <Text style={styles.artist}>{item.artist}</Text> : null}
                {item.rating ? (
                  <Text style={[styles.rating, { color: '#9BA7B2' }]}>
                    {'\u2605'.repeat(Math.floor(item.rating))}{item.rating % 1 ? '\u00BD' : ''}
                  </Text>
                ) : null}
                {item.review ? <Text style={styles.review} numberOfLines={3}>{item.review}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  back: { color: '#fff', fontSize: 36, lineHeight: 40 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  list: { padding: 18, paddingBottom: 40 },
  dateHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 16 },
  dateText: { color: '#888', fontSize: 15, fontWeight: 'bold' },
  dateLine: { flex: 1, height: 1, backgroundColor: '#333', marginLeft: 12 },
  entry: { flexDirection: 'row', gap: 14, marginBottom: 22 },
  cover: { width: 76, height: 76, borderRadius: 5 },
  coverPlaceholder: { backgroundColor: '#292929' },
  info: { flex: 1, justifyContent: 'center' },
  itemType: { color: '#777', fontSize: 9, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 3 },
  name: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  artist: { color: '#999', fontSize: 12, marginTop: 3 },
  rating: { fontSize: 14, marginTop: 4 },
  review: { color: '#bbb', fontSize: 12, lineHeight: 17, marginTop: 5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptyText: { color: '#888', fontSize: 13, textAlign: 'center', marginTop: 8 },
});

