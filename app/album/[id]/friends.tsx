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
        const { data, error: invokeError } = await supabase.functions.invoke('swift-service', {
          body: { action: 'album-members', item_id: String(id), scope: filter },
        });
        if (invokeError) throw invokeError;
        if (!data?.success) throw new Error(data?.error || 'Could not load album members.');
        if (active) setMembers(Array.isArray(data.members) ? data.members : []);

      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load album members.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) {
      void load();
    } else {
      setError('Album not found.');
      setLoading(false);
    }
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
                <Text style={styles.statusText}>{[person.listened ? 'LISTENED' : '', person.wants_to_listen ? 'WANTS TO LISTEN' : '', person.has_review ? 'REVIEWED' : (!person.listened && !person.wants_to_listen && person.rating != null ? 'RATED' : '')].filter(Boolean).join(' · ')}</Text>
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
