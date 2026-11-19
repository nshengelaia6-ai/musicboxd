import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function FriendsLists() {
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
        if (!auth.user) throw new Error('Please sign in to see friends’ lists.');

        const { data: relations, error: relationError } = await supabase
          .from('friendships').select('friend_id').eq('user_id', auth.user.id);
        if (relationError) throw relationError;

        const ids = [...new Set((relations || []).map((row: any) => row.friend_id).filter(Boolean))];
        if (!ids.length) {
          if (active) setItems([]);
          return;
        }

        const [listsResult, usersResult] = await Promise.all([
          supabase.from('user_activity')
            .select('id,user_id,item_key,data,created_at')
            .eq('activity_type', 'created_list').in('user_id', ids)
            .order('created_at', { ascending: false }).limit(100),
          supabase.from('users').select('id,username,avatar_url').in('id', ids),
        ]);
        if (listsResult.error) throw listsResult.error;
        if (usersResult.error) throw usersResult.error;

        const userMap = new Map((usersResult.data || []).map((user: any) => [user.id, user]));
        const rows = (listsResult.data || [])
          .filter((row: any) => row.data?.privacy === 'public')
          .map((row: any) => ({ ...row, profile: userMap.get(row.user_id) }));
        if (active) setItems(rows);
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load friends’ lists.');
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
        <TouchableOpacity onPress={() => router.replace('/(tabs)' as any)}><Text style={styles.navText}>Songs</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/friends-reviews' as any)}><Text style={styles.navText}>Reviews</Text></TouchableOpacity>
        <Text style={[styles.navText, styles.activeText]}>Lists</Text>
        <View style={[styles.activeLine, { backgroundColor: accentColor }]} />
      </View>
      {loading ? <ActivityIndicator color={accentColor} style={{ marginTop: 36 }} /> :
        error ? <Text style={styles.empty}>{error}</Text> :
        <ScrollView contentContainerStyle={styles.content}>
          {items.length === 0 ? <Text style={styles.empty}>Your friends’ public lists will appear here.</Text> :
            items.map((row) => {
              const list = row.data || {};
              const tracks = Array.isArray(list.albums) ? list.albums : [];
              const firstCover = tracks.find((track: any) => track.cover)?.cover;
              return (
                <TouchableOpacity key={row.id} style={styles.card} activeOpacity={0.8}>
                  {firstCover ? <Image source={{ uri: firstCover }} style={styles.cover} /> : <View style={styles.cover} />}
                  <View style={styles.details}>
                    <Text style={styles.username}>@{row.profile?.username || 'Music lover'}</Text>
                    <Text style={styles.listName}>{list.name || 'Untitled list'}</Text>
                    {!!list.description && <Text style={styles.description} numberOfLines={2}>{list.description}</Text>}
                    <Text style={styles.meta}>{tracks.length} {tracks.length === 1 ? 'item' : 'items'}</Text>
                  </View>
                  <Text style={styles.arrow}>›</Text>
                </TouchableOpacity>
              );
            })}
        </ScrollView>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  brandHeader: { paddingTop: 58, paddingHorizontal: 20, paddingBottom: 14 },
  brand: { color: '#fff', fontSize: 27, fontWeight: '800', letterSpacing: -0.7 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#292929' },
  navText: { color: '#888', fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  activeText: { color: '#fff' },
  activeLine: { position: 'absolute', bottom: 0, left: '72%', width: '18%', height: 2 },
  content: { padding: 16, paddingBottom: 32 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#252525' },
  cover: { width: 76, height: 76, borderRadius: 6, backgroundColor: '#252525' },
  details: { flex: 1 },
  username: { color: '#aaa', fontSize: 12, marginBottom: 4 },
  listName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  description: { color: '#999', fontSize: 12, marginTop: 4 },
  meta: { color: '#777', fontSize: 11, marginTop: 6 },
  arrow: { color: '#888', fontSize: 24 },
  empty: { color: '#888', textAlign: 'center', padding: 28, marginTop: 20 },
});
