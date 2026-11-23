import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AlbumList = {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  username?: string | null;
  avatar_url?: string | null;
};

export default function AlbumListsPage() {
  const { id, itemName, artistName } = useLocalSearchParams<{ id: string; itemName?: string; artistName?: string }>();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [lists, setLists] = useState<AlbumList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data: matching, error: listsError } = await supabase
          .from('music_lists')
          .select('id,user_id,name,description,privacy,items')
          .in('privacy', ['public', 'friends'])
          .contains('items', [{ id: String(id), type: 'album' }])
          .order('updated_at', { ascending: false });
        if (listsError) throw listsError;
        const userIds = [...new Set((matching || []).map((row: any) => String(row.user_id)))];
        const { data: profiles, error: profilesError } = userIds.length
          ? await supabase.from('users').select('id,username,avatar_url').in('id', userIds)
          : { data: [], error: null };
        if (profilesError) throw profilesError;
        const profileMap: Record<string, any> = {};
        (profiles || []).forEach((person: any) => { profileMap[String(person.id)] = person; });
        if (active) setLists((matching || []).map((row: any) => ({
          id: String(row.id), name: row.name, description: row.description || null,
          user_id: String(row.user_id),
          username: profileMap[String(row.user_id)]?.username || null,
          avatar_url: profileMap[String(row.user_id)]?.avatar_url || null,
        })));
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load lists containing this album.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) void load();
    return () => { active = false; };
  }, [id]);

  return (
    <View style={[styles.screen, { backgroundColor }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <View style={styles.heading}>
          <Text style={styles.title}>LISTS</Text>
          {!!itemName && <Text style={styles.subtitle} numberOfLines={1}>{itemName}{artistName ? ` · ${artistName}` : ''}</Text>}
        </View>
        <View style={{ width: 34 }} />
      </View>
      {loading ? <ActivityIndicator color={accentColor} style={{ marginTop: 60 }} /> : error ? (
        <Text style={styles.message}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.resultCount}>{lists.length.toLocaleString()} {lists.length === 1 ? 'LIST' : 'LISTS'}</Text>
          {lists.length ? lists.map(item => (
            <TouchableOpacity key={item.id} style={styles.listRow} onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.user_id } } as any)}>
              {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{(item.username || 'L').slice(0, 1).toUpperCase()}</Text></View>}
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{item.name}</Text>
                <Text style={styles.listOwner}>by @{item.username || 'listener'}{item.description ? ` · ${item.description}` : ''}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )) : <Text style={styles.empty}>This album hasn&apos;t been added to any visible lists yet.</Text>}
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
  resultCount: { color: '#7F8B96', fontSize: 10, fontWeight: '700', letterSpacing: 1.3, paddingTop: 19, paddingBottom: 8 },
  listRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#252D36', gap: 13 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3A4653' },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3A4653', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 17, fontWeight: '700' },
  listInfo: { flex: 1 },
  listName: { color: '#E5E9EC', fontSize: 13, fontWeight: '700' },
  listOwner: { color: '#89949F', fontSize: 11, marginTop: 4 },
  arrow: { color: '#77828D', fontSize: 23 },
  empty: { color: '#7F8B96', fontSize: 12, paddingVertical: 22, lineHeight: 18 },
  message: { color: '#ff8585', textAlign: 'center', padding: 24, fontSize: 13 },
});
