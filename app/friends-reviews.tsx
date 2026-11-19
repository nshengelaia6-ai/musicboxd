import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

        const [reviewsResult, usersResult] = await Promise.all([
          supabase.from('user_activity')
            .select('id,user_id,item_key,data,created_at')
            .eq('activity_type', 'reviewed')
            .in('user_id', ids)
            .order('created_at', { ascending: false })
            .limit(100),
          supabase.from('users').select('id,username,avatar_url').in('id', ids),
        ]);
        if (reviewsResult.error) throw reviewsResult.error;
        if (usersResult.error) throw usersResult.error;

        const userMap = new Map((usersResult.data || []).map((user: any) => [user.id, user]));
        const rows = (reviewsResult.data || [])
          .filter((row: any) => row.data?.type === 'track' && (row.data?.review || Number(row.data?.rating) > 0))
          .map((row: any) => ({
            ...row,
            updated_at: row.created_at,
            profile: userMap.get(row.user_id),
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
                <View key={row.id} style={styles.card}>
                  {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : <View style={styles.cover} />}
                  <View style={styles.details}>
                    <Text style={styles.username}>@{row.profile?.username || 'Music lover'}</Text>
                    <Text style={styles.song}>{item.albumName || item.name || 'Untitled song'}</Text>
                    <Text style={styles.artist}>{item.albumArtist || item.artist || ''}</Text>
                    {Number(item.rating) > 0 ? <Text style={styles.rating}>{'★'.repeat(Math.floor(Number(item.rating)))}{Number(item.rating) % 1 ? '½' : ''}</Text> : null}
                    {!!item.review && <Text style={styles.review}>{item.review}</Text>}
                    <Text style={styles.date}>{row.updated_at ? new Date(row.updated_at).toLocaleDateString() : ''}</Text>
                  </View>
                </View>
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
  username: { color: '#aaa', fontSize: 12, marginBottom: 4 },
  song: { color: '#fff', fontSize: 16, fontWeight: '700' },
  artist: { color: '#999', fontSize: 12, marginTop: 2 },
  rating: { color: '#9BA7B2', marginTop: 5 },
  review: { color: '#ddd', fontSize: 14, lineHeight: 20, marginTop: 7 },
  date: { color: '#666', fontSize: 11, marginTop: 7 },
  empty: { color: '#888', textAlign: 'center', padding: 28, marginTop: 20 },
});
