import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type FriendStatus = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  rating: number | null;
  created_at: string;
};

export default function TrackFriendsPage() {
  const { id, itemName, artistName } = useLocalSearchParams<{
    id: string;
    itemName?: string;
    artistName?: string;
  }>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [listened, setListened] = useState<FriendStatus[]>([]);
  const [wantToListen, setWantToListen] = useState<FriendStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error('Please sign in to see friends’ activity.');

        const [followingResult, followersResult] = await Promise.all([
          supabase.from('friendships').select('friend_id').eq('user_id', user.id),
          supabase.from('friendships').select('user_id').eq('friend_id', user.id),
        ]);
        if (followingResult.error) throw followingResult.error;
        if (followersResult.error) throw followersResult.error;

        const followingIds = new Set((followingResult.data || []).map((row: any) => String(row.friend_id)));
        const friendIds = [...new Set((followersResult.data || [])
          .map((row: any) => String(row.user_id))
          .filter((friendId: string) => followingIds.has(friendId)))];

        if (!friendIds.length) {
          if (active) {
            setListened([]);
            setWantToListen([]);
          }
          return;
        }

        const { data: activityRows, error: activityError } = await supabase
          .from('user_activity')
          .select('user_id,activity_type,created_at')
          .eq('item_key', String(id))
          .in('user_id', friendIds)
          .in('activity_type', ['listened', 'wants_to_listen'])
          .order('created_at', { ascending: false });
        if (activityError) throw activityError;

        const latestByUser: Record<string, any> = {};
        (activityRows || []).forEach((row: any) => {
          const uid = String(row.user_id);
          if (!latestByUser[uid] || new Date(row.created_at).getTime() > new Date(latestByUser[uid].created_at).getTime()) {
            latestByUser[uid] = row;
          }
        });

        const userIds = Object.keys(latestByUser);
        if (!userIds.length) {
          if (active) {
            setListened([]);
            setWantToListen([]);
          }
          return;
        }

        const [{ data: profiles, error: profilesError }, { data: ratings, error: ratingsError }] = await Promise.all([
          supabase.from('users').select('id,username,avatar_url').in('id', userIds),
          supabase.from('music_reviews').select('user_id,rating')
            .eq('item_type', 'track').eq('item_id', String(id)).in('user_id', userIds),
        ]);
        if (profilesError) throw profilesError;
        if (ratingsError) throw ratingsError;

        const ratingByUser: Record<string, number> = {};
        (ratings || []).forEach((row: any) => { ratingByUser[String(row.user_id)] = Number(row.rating) || 0; });
        const profileById: Record<string, FriendStatus> = {};
        (profiles || []).forEach((person: any) => {
          const uid = String(person.id);
          profileById[uid] = {
            id: uid,
            username: person.username || null,
            avatar_url: person.avatar_url || null,
            rating: ratingByUser[uid] || null,
            created_at: latestByUser[uid]?.created_at || '',
          };
        });

        const listenedRows = userIds
          .filter(uid => latestByUser[uid]?.activity_type === 'listened' && profileById[uid])
          .map(uid => profileById[uid])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const wantRows = userIds
          .filter(uid => latestByUser[uid]?.activity_type === 'wants_to_listen' && profileById[uid])
          .map(uid => profileById[uid])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (active) {
          setListened(listenedRows);
          setWantToListen(wantRows);
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load friends’ activity.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  function renderFriend(person: FriendStatus, showRating: boolean) {
    return (
      <TouchableOpacity key={person.id} style={styles.friendRow} onPress={() => router.push(`/user/${person.id}` as any)}>
        {person.avatar_url
          ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
          : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{(person.username || 'U').slice(0, 1).toUpperCase()}</Text></View>}
        <View style={styles.friendInfo}>
          <Text style={styles.username}>@{person.username || 'listener'}</Text>
          <Text style={styles.date}>{person.created_at ? new Date(person.created_at).toLocaleDateString() : ''}</Text>
        </View>
        {showRating && person.rating ? <Text style={styles.rating}>{'★'.repeat(Math.floor(person.rating))}{person.rating % 1 ? '½' : ''}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <View style={styles.heading}>
          <Text style={styles.title}>FRIENDS’ ACTIVITY</Text>
          {!!itemName && <Text style={styles.subtitle} numberOfLines={1}>{itemName}{artistName ? ` · ${artistName}` : ''}</Text>}
        </View>
        <View style={{ width: 34 }} />
      </View>
      {loading ? <ActivityIndicator color={accentColor} style={{ marginTop: 60 }} /> : error ? (
        <Text style={styles.message}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LISTENED BY</Text>
            <View style={styles.rule} />
            {listened.length ? listened.map(person => renderFriend(person, true)) : <Text style={styles.empty}>No friends have listened to this song yet.</Text>}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WANTS TO LISTEN</Text>
            <View style={styles.rule} />
            {wantToListen.length ? wantToListen.map(person => renderFriend(person, false)) : <Text style={styles.empty}>No friends have added this song to their want-to-listen list.</Text>}
          </View>
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
  content: { paddingHorizontal: 18, paddingBottom: 48 },
  section: { paddingTop: 24 },
  sectionTitle: { color: '#AAB4BF', fontSize: 12, fontWeight: '600', letterSpacing: 1.5, marginBottom: 12 },
  rule: { height: 1, backgroundColor: '#303943', marginBottom: 4 },
  friendRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#252D36', gap: 13 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3A4653' },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3A4653', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 17, fontWeight: '700' },
  friendInfo: { flex: 1 },
  username: { color: '#E5E9EC', fontSize: 13, fontWeight: '700' },
  date: { color: '#7F8B96', fontSize: 10, marginTop: 4 },
  rating: { color: '#00E054', fontSize: 13, letterSpacing: 0.5 },
  chevron: { color: '#89949F', fontSize: 22, paddingLeft: 5 },
  empty: { color: '#7F8B96', fontSize: 12, paddingVertical: 15, lineHeight: 18 },
  message: { color: '#ff8585', textAlign: 'center', padding: 24, fontSize: 13 },
});
