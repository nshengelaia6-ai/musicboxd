import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { recordActivity } from '@/utils/activity';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ListItem = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  items: any[];
  created_at: string;
  updated_at: string;
  profile?: any;
  likeCount: number;
  friendLikeCount: number;
  weekLikeCount: number;
  likedByMe: boolean;
  isMine: boolean;
};

export default function FriendsLists() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [newFromFriends, setNewFromFriends] = useState<ListItem[]>([]);
  const [popularWithFriends, setPopularWithFriends] = useState<ListItem[]>([]);
  const [popularThisWeek, setPopularThisWeek] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likingIds, setLikingIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error('Please sign in to see lists.');

      const { data: relations, error: relationError } = await supabase
        .from('friendships').select('friend_id').eq('user_id', auth.user.id);
      if (relationError) throw relationError;
      const friendIds = [...new Set((relations || []).map((row: any) => row.friend_id).filter(Boolean))];

      const [friendListsResult, publicListsResult] = await Promise.all([
        friendIds.length
          ? supabase.from('music_lists')
              .select('id,user_id,name,description,items,created_at,updated_at')
              .eq('privacy', 'public').in('user_id', friendIds)
              .order('created_at', { ascending: false }).limit(150)
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from('music_lists')
          .select('id,user_id,name,description,items,created_at,updated_at')
          .eq('privacy', 'public')
          .order('created_at', { ascending: false }).limit(1000),
      ]);
      if (friendListsResult.error) throw friendListsResult.error;
      if (publicListsResult.error) throw publicListsResult.error;

      const friendRows = friendListsResult.data || [];
      const publicRows = publicListsResult.data || [];
      const allRows = [...new Map([...friendRows, ...publicRows].map((row: any) => [String(row.id), row])).values()];
      const listIds = allRows.map((row: any) => String(row.id));
      const ownerIds = [...new Set(allRows.map((row: any) => row.user_id).filter(Boolean))];

      const [likesResult, usersResult] = await Promise.all([
        listIds.length
          ? supabase.from('music_list_likes').select('list_id,user_id,created_at').in('list_id', listIds)
          : Promise.resolve({ data: [], error: null } as any),
        ownerIds.length
          ? supabase.from('users').select('id,username,avatar_url').in('id', ownerIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (likesResult.error) throw likesResult.error;
      if (usersResult.error) throw usersResult.error;

      const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const likesByList = new Map<string, any[]>();
      (likesResult.data || []).forEach((like: any) => {
        const key = String(like.list_id);
        likesByList.set(key, [...(likesByList.get(key) || []), like]);
      });
      const userMap = new Map((usersResult.data || []).map((user: any) => [user.id, user]));
      const decorate = (row: any): ListItem => {
        const likes = likesByList.get(String(row.id)) || [];
        return {
          ...row,
          items: Array.isArray(row.items) ? row.items : [],
          profile: userMap.get(row.user_id),
          likeCount: likes.length,
          friendLikeCount: likes.filter((like: any) => friendIds.includes(like.user_id)).length,
          weekLikeCount: likes.filter((like: any) => new Date(like.created_at).getTime() >= weekStart).length,
          likedByMe: likes.some((like: any) => like.user_id === auth.user.id),
          isMine: row.user_id === auth.user.id,
        };
      };

      const friendItems = friendRows.map(decorate);
      const publicItems = publicRows.map(decorate);
      setNewFromFriends(friendItems);
      setPopularWithFriends(publicItems
        .filter((item) => item.friendLikeCount > 0)
        .sort((a, b) => b.friendLikeCount - a.friendLikeCount || b.likeCount - a.likeCount)
        .slice(0, 20));
      setPopularThisWeek(publicItems
        .filter((item) => item.weekLikeCount > 0)
        .sort((a, b) => b.weekLikeCount - a.weekLikeCount || b.likeCount - a.likeCount)
        .slice(0, 20));
    } catch (e: any) {
      setError(e?.message || 'Could not load lists.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function toggleLike(item: ListItem) {
    if (likingIds.includes(item.id)) return;
    setLikingIds((current) => [...current, item.id]);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error('Please sign in to like lists.');

      if (item.likedByMe) {
        const { error: deleteError } = await supabase.from('music_list_likes')
          .delete().eq('list_id', item.id).eq('user_id', auth.user.id);
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase.from('music_list_likes')
          .insert({ list_id: item.id, user_id: auth.user.id });
        if (insertError) throw insertError;
        await recordActivity('liked_list', item.id, {
          id: item.id,
          name: item.name,
          description: item.description || '',
          cover: item.items.find((entry: any) => entry?.cover)?.cover || '',
          type: 'list',
          itemCount: item.items.length,
        });
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not update list like.');
    } finally {
      setLikingIds((current) => current.filter((id) => id !== item.id));
    }
  }

  function renderList(item: ListItem) {
    const firstCover = item.items.find((entry: any) => entry?.cover)?.cover;
    return (
      <View key={item.id} style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/lists', params: { userId: item.user_id } } as any)}
          accessibilityRole="button"
          accessibilityLabel={'Open ' + (item.name || 'friend list')}
        >
          {firstCover ? <Image source={{ uri: firstCover }} style={styles.cover} /> : <View style={styles.cover} />}
          <View style={styles.details}>
            <Text style={styles.username}>@{item.profile?.username || 'Music lover'}</Text>
            <Text style={styles.listName}>{item.name || 'Untitled list'}</Text>
            {!!item.description && <Text style={styles.description} numberOfLines={2}>{item.description}</Text>}
            <Text style={styles.meta}>{item.items.length} {item.items.length === 1 ? 'item' : 'items'}</Text>
          </View>
        </TouchableOpacity>
        {item.isMine ? (
          <View style={styles.likeButton}>
            <Text style={styles.likeCount}>{item.likeCount} ♥</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.likeButton}
            onPress={() => void toggleLike(item)}
            disabled={likingIds.includes(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.likedByMe ? 'Unlike list' : 'Like list'}
          >
            <Text style={[styles.heart, item.likedByMe && { color: accentColor }]}>
              {item.likedByMe ? '♥' : '♡'}
            </Text>
            <Text style={styles.likeCount}>{item.likeCount}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderSection(title: string, items: ListItem[], emptyText: string) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.length ? items.map(renderList) : <Text style={styles.sectionEmpty}>{emptyText}</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.brandHeader}>
        <Text style={styles.brand}>Musicboxd</Text>
      </View>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navTab} onPress={() => router.replace('/(tabs)' as any)}><Text style={styles.navText}>Songs</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navTab} onPress={() => router.replace('/friends-reviews' as any)}><Text style={styles.navText}>Reviews</Text></TouchableOpacity>
        <View style={[styles.navTab, styles.navTabActive, { borderBottomColor: accentColor }]}><Text style={[styles.navText, styles.activeText, { color: accentColor }]}>Lists</Text></View>
      </View>
      {loading ? <ActivityIndicator color={accentColor} style={{ marginTop: 36 }} /> :
        error ? <Text style={styles.empty}>{error}</Text> :
        <ScrollView contentContainerStyle={styles.content}>
          {renderSection('New from Friends', newFromFriends, 'Your friends’ new public lists will appear here.')}
          {renderSection('Popular with Friends', popularWithFriends, 'Lists liked by your friends will appear here.')}
          {renderSection('Popular This Week', popularThisWeek, 'Popular public lists from this week will appear here.')}
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
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 36 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sectionEmpty: { color: '#777', fontSize: 13, paddingVertical: 10 },
  card: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#252525', paddingVertical: 12 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 68, height: 68, borderRadius: 6, backgroundColor: '#252525' },
  details: { flex: 1 },
  username: { color: '#aaa', fontSize: 12, marginBottom: 4 },
  listName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  description: { color: '#999', fontSize: 12, marginTop: 4 },
  meta: { color: '#777', fontSize: 11, marginTop: 5 },
  likeButton: { minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingLeft: 8 },
  heart: { color: '#999', fontSize: 23, lineHeight: 26 },
  likeCount: { color: '#888', fontSize: 11, marginTop: 1 },
  empty: { color: '#888', textAlign: 'center', padding: 28, marginTop: 20 },
});
