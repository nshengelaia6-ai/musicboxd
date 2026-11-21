import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Member = { id: string; username: string | null; avatar_url: string | null; bio?: string | null; reviews: number; lists: number; likes: number };

export default function Members() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [myId, setMyId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const uid = authData.user?.id || '';
      setMyId(uid);
      const { data: profiles, error: profilesError } = await supabase
        .from('users').select('id, username, avatar_url, bio').neq('id', uid).order('username').limit(200);
      if (profilesError) throw profilesError;
      const ids = (profiles || []).map((p: any) => p.id);
      const [reviewResult, listResult, likeResult, followResult] = await Promise.all([
        ids.length ? supabase.from('music_reviews').select('user_id').in('user_id', ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from('music_lists').select('user_id').in('user_id', ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? supabase.from('music_review_likes').select('user_id').in('user_id', ids) : Promise.resolve({ data: [], error: null }),
        uid ? supabase.from('friendships').select('friend_id').eq('user_id', uid) : Promise.resolve({ data: [], error: null }),
      ]);
      const countBy = (rows: any[] | null) => {
        const counts: Record<string, number> = {};
        (rows || []).forEach(row => { counts[row.user_id] = (counts[row.user_id] || 0) + 1; });
        return counts;
      };
      const reviewCounts = countBy(reviewResult.data as any[]), listCounts = countBy(listResult.data as any[]), likeCounts = countBy(likeResult.data as any[]);
      setFollowing(new Set((followResult.data || []).map((row: any) => row.friend_id)));
      setMembers((profiles || []).map((p: any) => ({
        ...p, reviews: reviewCounts[p.id] || 0, lists: listCounts[p.id] || 0, likes: likeCounts[p.id] || 0,
      })).sort((a: Member, b: Member) => (b.reviews + b.lists + b.likes) - (a.reviews + a.lists + a.likes)));
    } catch (e: any) {
      setError(e?.message || 'Could not load members.');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter(m => (m.username || '').toLowerCase().includes(q)) : members;
  }, [members, query]);

  async function toggleFollow(id: string) {
    if (!myId) return;
    const isFollowing = following.has(id);
    setFollowing(prev => { const next = new Set(prev); isFollowing ? next.delete(id) : next.add(id); return next; });
    const result = isFollowing
      ? await supabase.from('friendships').delete().eq('user_id', myId).eq('friend_id', id)
      : await supabase.from('friendships').insert({ user_id: myId, friend_id: id });
    if (result.error) {
      setFollowing(prev => { const next = new Set(prev); isFollowing ? next.add(id) : next.delete(id); return next; });
      setError(result.error.message);
    }
  }

  return <View style={[styles.screen, { backgroundColor }]}>
    <View style={styles.nav}>
      <TouchableOpacity onPress={() => router.replace('/members' as any)}><Text style={[styles.navText, styles.navActive]}>MEMBERS</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/reviews' as any)}><Text style={styles.navText}>REVIEWS</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/lists' as any)}><Text style={styles.navText}>LISTS</Text></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>MEMBERS</Text>
      <Text style={styles.subheading}>Discover listeners and find people to follow.</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search members..." placeholderTextColor="#777" autoCapitalize="none" style={styles.search} />
      <Text style={styles.sectionTitle}>POPULAR MEMBERS</Text>
      {loading ? <ActivityIndicator color={accentColor} style={{ marginTop: 35 }} /> : <>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {filtered.map(member => <View key={member.id} style={styles.memberRow}>
          <TouchableOpacity style={styles.memberMain} onPress={() => router.push({ pathname: '/user/[id]', params: { id: member.id } } as any)}>
            {member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder} />}
            <View style={styles.memberInfo}>
              <Text style={styles.username}>{member.username || 'Listener'}</Text>
              {!!member.bio && <Text numberOfLines={1} style={styles.bio}>{member.bio}</Text>}
              <Text style={styles.stats}>{member.reviews} reviews　{member.lists} lists　{member.likes} likes</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void toggleFollow(member.id)} style={[styles.followButton, following.has(member.id) && styles.followingButton]}>
            <Text style={[styles.followText, following.has(member.id) && styles.followingText]}>{following.has(member.id) ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
        </View>)}
        {!filtered.length && <Text style={styles.empty}>{query ? 'No members found.' : 'No members yet.'}</Text>}
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { paddingTop: 58, paddingHorizontal: 22, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#292929', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navText: { color: '#777', fontSize: 12, fontWeight: '700', letterSpacing: 1.1 },
  navActive: { color: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 50 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 1.2 },
  subheading: { color: '#888', fontSize: 13, marginTop: 6, marginBottom: 20 },
  search: { backgroundColor: '#25292e', borderRadius: 5, color: '#fff', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 24 },
  sectionTitle: { color: '#aaa', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#292929' },
  memberMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 13, backgroundColor: '#303030' },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, marginRight: 13, backgroundColor: '#303030' },
  memberInfo: { flex: 1, minWidth: 0 },
  username: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bio: { color: '#999', fontSize: 12, marginTop: 3 },
  stats: { color: '#777', fontSize: 11, marginTop: 5 },
  followButton: { borderRadius: 4, borderWidth: 1, borderColor: '#00a94f', paddingHorizontal: 13, paddingVertical: 7, marginLeft: 10 },
  followingButton: { borderColor: '#454545', backgroundColor: '#292929' },
  followText: { color: '#00e054', fontSize: 12, fontWeight: '700' },
  followingText: { color: '#aaa' },
  error: { color: '#ff8888', marginVertical: 12 },
  empty: { color: '#888', textAlign: 'center', marginTop: 40 },
});
