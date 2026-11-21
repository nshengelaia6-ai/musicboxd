import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type MemberStatus = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  rating: number | null;
  created_at: string;
};

type Filter = 'everyone' | 'liked' | 'friends';

export default function TrackFriendsPage() {
  const { id, itemName, artistName, section } = useLocalSearchParams<{
    id: string;
    itemName?: string;
    artistName?: string;
    section?: 'listened' | 'wants_to_listen';
  }>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const isWantList = section === 'wants_to_listen';
  const [filter, setFilter] = useState<Filter>('everyone');
  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('swift-service', {
          body: {
            action: 'track-members',
            item_id: String(id),
            relationship: isWantList ? 'wants_to_listen' : filter === 'liked' ? 'liked' : 'listened',
            scope: filter === 'friends' ? 'friends' : 'everyone',
          },
        });
        if (invokeError) throw invokeError;
        if (!data?.success) throw new Error(data?.error || 'Could not load members.');
        if (active) setMembers(Array.isArray(data.members) ? data.members : []);
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load members.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) void load();
    return () => { active = false; };
  }, [id, filter, isWantList]);

  function renderMember(person: MemberStatus) {
    return (
      <TouchableOpacity key={person.id} style={styles.memberRow} onPress={() => router.push(`/user/${person.id}` as any)}>
        {person.avatar_url
          ? <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
          : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{(person.username || 'U').slice(0, 1).toUpperCase()}</Text></View>}
        <View style={styles.memberInfo}>
          <Text style={styles.username}>@{person.username || 'listener'}</Text>
          <Text style={styles.date}>{person.created_at ? new Date(person.created_at).toLocaleDateString() : ''}</Text>
        </View>
        {person.rating ? <Text style={styles.rating}>{'★'.repeat(Math.floor(person.rating))}{person.rating % 1 ? '½' : ''}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  const heading = isWantList ? 'WANTS TO LISTEN' : 'LISTENED BY';

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <View style={styles.heading}>
          <Text style={styles.title}>{heading}</Text>
          {!!itemName && <Text style={styles.subtitle} numberOfLines={1}>{itemName}{artistName ? ` · ${artistName}` : ''}</Text>}
        </View>
        <View style={{ width: 34 }} />
      </View>
      <View style={styles.filters}>
        <TouchableOpacity onPress={() => setFilter('everyone')} style={styles.filterButton}>
          <Text style={[styles.filterText, filter === 'everyone' && styles.filterActive]}>EVERYONE</Text>
          {filter === 'everyone' && <View style={[styles.filterUnderline, { backgroundColor: accentColor }]} />}
        </TouchableOpacity>
        {!isWantList && (
          <TouchableOpacity onPress={() => setFilter('liked')} style={styles.filterButton}>
            <Text style={[styles.filterText, filter === 'liked' && styles.filterActive]}>LIKED</Text>
            {filter === 'liked' && <View style={[styles.filterUnderline, { backgroundColor: accentColor }]} />}
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setFilter('friends')} style={styles.filterButton}>
          <Text style={[styles.filterText, filter === 'friends' && styles.filterActive]}>FRIENDS</Text>
          {filter === 'friends' && <View style={[styles.filterUnderline, { backgroundColor: accentColor }]} />}
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={accentColor} style={{ marginTop: 60 }} /> : error ? (
        <Text style={styles.message}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.resultCount}>{members.length.toLocaleString()} {members.length === 1 ? 'MEMBER' : 'MEMBERS'}</Text>
          {members.length ? members.map(renderMember) : (
            <Text style={styles.empty}>
              {filter === 'liked' ? 'No members have liked this song yet.' : filter === 'friends' ? 'No friends found in this section yet.' : isWantList ? 'No members have added this song to their want-to-listen list yet.' : 'No members have marked this song as listened yet.'}
            </Text>
          )}
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
  filters: { flexDirection: 'row', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#252D36', gap: 28 },
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
  date: { color: '#7F8B96', fontSize: 10, marginTop: 4 },
  rating: { color: '#00E054', fontSize: 13, letterSpacing: 0.5 },
  chevron: { color: '#89949F', fontSize: 22, paddingLeft: 5 },
  empty: { color: '#7F8B96', fontSize: 12, paddingVertical: 22, lineHeight: 18 },
  message: { color: '#ff8585', textAlign: 'center', padding: 24, fontSize: 13 },
});
