import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

async function loadFriendReviewRows(friendIds: string[]) {
  const rows: any[] = [];
  const pageSize = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('user_activity')
      .select('id,user_id,item_key,data,created_at')
      .eq('activity_type', 'reviewed')
      .in('user_id', friendIds)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export default function FriendsReviews() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error('Please sign in to see friends’ reviews.');

        const { data: relations, error: relationError } = await supabase
          .from('friendships').select('friend_id').eq('user_id', auth.user.id);
        if (relationError) throw relationError;

        const ids = [...new Set((relations || []).map((row: any) => row.friend_id).filter(Boolean))];
        if (!ids.length) {
          if (active) setItems([]);
          return;
        }

        const [reviewRows, usersResult, musicReviewsResult] = await Promise.all([
          loadFriendReviewRows(ids),
          supabase.from('users').select('id,username,avatar_url').in('id', ids),
          supabase.from('music_reviews').select('id,user_id,item_id').eq('item_type', 'track').in('user_id', ids),
        ]);
        if (usersResult.error) throw usersResult.error;
        if (musicReviewsResult.error) throw musicReviewsResult.error;

        const userMap = new Map((usersResult.data || []).map((user: any) => [user.id, user]));
        const reviewMap = new Map((musicReviewsResult.data || []).map((review: any) => [String(review.user_id) + ':' + String(review.item_id), review.id]));
        const seenReviews = new Set<string>();
        const rows = reviewRows
          .filter((row: any) => row.data?.type === 'track' && (row.data?.review || Number(row.data?.rating) > 0))
          .filter((row: any) => {
            const key = String(row.user_id) + ':' + String(row.item_key);
            if (seenReviews.has(key)) return false;
            seenReviews.add(key);
            return true;
          })
          .map((row: any) => ({
            ...row,
            updated_at: row.created_at,
            profile: userMap.get(row.user_id),
            reviewId: reviewMap.get(String(row.user_id) + ':' + String(row.item_key)),
          }));
        if (active) setItems(rows);
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load friends’ reviews.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []));

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.brandHeader}>
        <Text style={styles.brand}>Musicboxd</Text>
      </View>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navTab} onPress={() => router.replace('/(tabs)' as any)}><Text style={styles.navText}>Songs</Text></TouchableOpacity>
        <View style={[styles.navTab, styles.navTabActive, { borderBottomColor: accentColor }]}><Text style={[styles.navText, styles.activeText, { color: accentColor }]}>Reviews</Text></View>
        <TouchableOpacity style={styles.navTab} onPress={() => router.replace('/friends-lists' as any)}><Text style={styles.navText}>Lists</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={accentColor} style={{ marginTop: 36 }} /> :
        error ? <Text style={styles.empty}>{error}</Text> :
        <ScrollView contentContainerStyle={styles.content}>
          {items.length === 0 ? <Text style={styles.empty}>Your friends’ song reviews will appear here.</Text> :
            items.map((row) => {
              const item = row.data || {};
              const cover = item.albumCover || item.cover || item.cover_url;
              return (
                <TouchableOpacity
                  key={row.id}
                  activeOpacity={0.85}
                  style={styles.card}
                  disabled={!row.reviewId}
                  onPress={() => router.push({ pathname: '/review/[id]', params: { id: String(row.reviewId) } } as any)}
                >
                  {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : <View style={styles.cover} />}
                  <View style={styles.details}>
                    <View style={styles.authorRow}>
                      <Text style={styles.username}>{String(row.profile?.username || 'Music lover').replace(/^@+/, '')}</Text>
                      {row.profile?.avatar_url ? <Image source={{ uri: row.profile.avatar_url }} style={styles.avatar} /> : <View style={styles.avatar} />}
                    </View>
                    <Text style={styles.song}>{item.albumName || item.name || 'Untitled song'}</Text>
                    <Text style={styles.artist}>{item.albumArtist || item.artist || ''}</Text>
                    {Number(item.rating) > 0 ? <Text style={styles.rating}>{'★'.repeat(Math.floor(Number(item.rating)))}{Number(item.rating) % 1 ? '½' : ''}</Text> : null}
                    {!!item.review && <Text style={styles.review}>{item.review}</Text>}
                    <Text style={styles.date}>{row.updated_at ? new Date(row.updated_at).toLocaleDateString() : ''}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
        </ScrollView>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  brandHeader: { paddingTop: 58, paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#fff', fontSize: 25, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  nav: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: '#292929' },
  navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  navTabActive: { borderBottomWidth: 2 },
  navText: { color: '#888', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  activeText: { color: '#fff' },
  content: { padding: 16, paddingBottom: 32 },
  card: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#252525' },
  cover: { width: 76, height: 76, borderRadius: 6, backgroundColor: '#252525' },
  details: { flex: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#333' },
  username: { color: '#aaa', fontSize: 12 },
  song: { color: '#fff', fontSize: 16, fontWeight: '700' },
  artist: { color: '#999', fontSize: 12, marginTop: 2 },
  rating: { color: '#9BA7B2', marginTop: 5 },
  review: { color: '#ddd', fontSize: 14, lineHeight: 20, marginTop: 7 },
  date: { color: '#666', fontSize: 11, marginTop: 7 },
  empty: { color: '#888', textAlign: 'center', padding: 28, marginTop: 20 },
});
