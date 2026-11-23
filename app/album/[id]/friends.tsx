import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AlbumMember = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  rating: number | null;
  listened: boolean;
  wants_to_listen: boolean;
  has_review: boolean;
};
type Filter = 'everyone' | 'friends';

export default function AlbumMembersPage() {
  const { id, itemName, artistName } = useLocalSearchParams<{ id: string; itemName?: string; artistName?: string }>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [filter, setFilter] = useState<Filter>('everyone');
  const [members, setMembers] = useState<AlbumMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [statusesResult, reviewsResult] = await Promise.all([
          supabase.from('music_album_status').select('user_id,status').eq('album_id', String(id)),
          supabase.from('music_reviews').select('user_id,rating,review_text').eq('item_type', 'album').eq('item_id', String(id)),
        ]);
        if (statusesResult.error) throw statusesResult.error;
        if (reviewsResult.error) throw reviewsResult.error;

        let allowedIds: string[] | null = null;
        if (filter === 'friends') {
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError) throw authError;
          if (!authData.user) {
            setMembers([]);
            return;
          }
          const [following, followers] = await Promise.all([
            supabase.from('friendships').select('friend_id').eq('user_id', authData.user.id),
            supabase.from('friendships').select('user_id').eq('friend_id', authData.user.id),
          ]);
          if (following.error) throw following.error;
          if (followers.error) throw followers.error;
          const followingIds = new Set((following.data || []).map((row: any) => String(row.friend_id)));
          allowedIds = [...new Set((followers.data || []).map((row: any) => String(row.user_id)).filter((friendId: string) => followingIds.has(friendId)))];
        }

        const statusByUser: Record<string, { listened: boolean; wants_to_listen: boolean }> = {};
        (statusesResult.data || []).forEach((row: any) => {
          const uid = String(row.user_id);
          statusByUser[uid] ||= { listened: false, wants_to_listen: false };
          if (row.status === 'listened') statusByUser[uid].listened = true;
          if (row.status === 'wants_to_listen') statusByUser[uid].wants_to_listen = true;
        });
        const reviewByUser: Record<string, any> = {};
        (reviewsResult.data || []).forEach((row: any) => { reviewByUser[String(row.user_id)] = row; });
        let ids = [...new Set([...Object.keys(statusByUser), ...Object.keys(reviewByUser)])];
        if (allowedIds) {
          const allowed = new Set(allowedIds);
          ids = ids.filter(uid => allowed.has(uid));
        }
        const { data: profiles, error: profilesError } = ids.length
          ? await supabase.from('users').select('id,username,avatar_url').in('id', ids)
          : { data: [], error: null };
        if (profilesError) throw profilesError;
        const profileMap: Record<string, any> = {};
        (profiles || []).forEach((person: any) => { profileMap[String(person.id)] = person; });
        const result = ids.flatMap(uid => {
          const person = profileMap[uid];
          if (!person) return [];
          const review = reviewByUser[uid];
          const status = statusByUser[uid] || { listened: false, wants_to_listen: false };
          return [{
            id: uid,
            username: person.username || null,
            avatar_url: person.avatar_url || null,
            rating: review && Number(review.rating) > 0 ? Number(review.rating) : null,
            listened: status.listened,
            wants_to_listen: status.wants_to_listen,
            has_review: Boolean(review && String(review.review_text || '').trim()),
          }];
        });
        result.sort((a, b) => Number(b.listened) - Number(a.listened));
        if (active) setMembers(result);
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load album members.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) void load();
    return () => { active = false; };
  }, [id, filter]);

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <View style={styles.heading}>
          <Text style={styles.title}>MEMBERS</Text>
          {!!itemName && <Text style={styles.subtitle} numberOfLines={1}>{itemName}{artistName ? ` · ${artistName}` : ''}</Text>}
        </View>
        <View style={{ width: 34 }} />
      </View>
      <View style={styles.filters}>
        {(['everyone', 'friends'] as Filter[]).map(value => (
          <TouchableOpacity key={value} onPress={() => setFilter(value)} style={styles.filterButton}>
            <Text style={[styles.filterText, filter === value && styles.filterActive]}>{value.toUpperCase()}</Text>
            {filter === value && <View style={[styles.filterUnderline, { backgroundColor: accentColor }]} />}
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator color={accentColor} style={{ marginTop: 60 }} /> : error ? (
        <Text style={styles.message}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.resultCount}>{members.length.toLocaleString()} {members.length === 1 ? 'MEMBER' : 'MEMBERS'}</Text>
          {members.length ? members.map(person => (
            <TouchableOpacity key={person.id} style={styles.memberRow} onPress={() => router.push(`/user/${person.id}` as any)}>
              {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{(person.username || 'U').slice(0, 1).toUpperCase()}</Text></View>}
              <View style={styles.memberInfo}>
                <Text style={styles.username}>@{person.username || 'listener'}</Text>
                <Text style={styles.statusText}>{[person.listened ? 'LISTENED' : '', person.wants_to_listen ? 'WANTS TO LISTEN' : ''].filter(Boolean).join(' · ') || (person.has_review ? 'REVIEWED' : '')}</Text>
              </View>
              <View style={styles.memberIndicators}>
                {person.rating != null ? <Text style={styles.rating}>{'★'.repeat(Math.floor(person.rating))}{person.rating % 1 ? '½' : ''}</Text> : null}
                {person.has_review ? <Text style={styles.reviewMark}>▤</Text> : null}
              </View>
            </TouchableOpacity>
          )) : <Text style={styles.empty}>{filter === 'friends' ? 'No friends have added or reviewed this album yet.' : 'No members have added or reviewed this album yet.'}</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090909' },
  topBar: { paddingTop: 58, paddingHorizontal: 18, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2C3440' },
  backButton: { width: 34 },
  back: { color: '#fff', fontSize: 32, lineHeight: 34 },
  heading: { flex: 1, alignItems: 'center' },
  title: { color: '#E5E9EC', fontSize: 12, fontWeight: '800', letterSpacing: 1.8 },
  subtitle: { color: '#89949F', fontSize: 11, marginTop: 5, maxWidth: '95%' },
  filters: { flexDirection: 'row', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#252D36', gap: 34 },
  filterButton: { minHeight: 46, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  filterText: { color: '#75808B', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  filterActive: { color: '#E5E9EC' },
  filterUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 48 },
  resultCount: { color: '#7F8B96', fontSize: 10, fontWeight: '700', letterSpacing: 1.3, paddingTop: 19, paddingBottom: 8 },
  memberRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#252D36', gap: 13 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3A4653' },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3A4653', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 17, fontWeight: '700' },
  memberInfo: { flex: 1 },
  username: { color: '#E5E9EC', fontSize: 13, fontWeight: '700' },
  statusText: { color: '#89949F', fontSize: 9, marginTop: 5, letterSpacing: 0.5 },
  memberIndicators: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 9 },
  rating: { color: '#00E054', fontSize: 13, letterSpacing: 0.5 },
  reviewMark: { color: '#AAB4BF', fontSize: 15 },
  empty: { color: '#7F8B96', fontSize: 12, paddingVertical: 22, lineHeight: 18 },
  message: { color: '#ff8585', textAlign: 'center', padding: 24, fontSize: 13 },
});
