import { supabase } from '@/utils/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type SharedList = {
  id: string;
  name: string;
  description: string;
  items: any[];
};

export default function SharedListScreen() {
  const { id, token } = useLocalSearchParams<{ id: string; token?: string }>();
  const router = useRouter();
  const [list, setList] = useState<SharedList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) {
        setError('This list link is invalid.');
        setLoading(false);
        return;
      }
      try {
        let data: any = null;
        if (token) {
          const { data: linkData, error: linkError } = await supabase.rpc('get_link_shared_list', {
            p_list_id: String(id),
            p_share_token: String(token),
          });
          if (linkError) throw linkError;
          data = linkData;
        } else {
          const { data: friendData, error: friendError } = await supabase
            .from('music_lists')
            .select('id, name, description, items')
            .eq('id', String(id))
            .single();
          if (friendError) throw friendError;
          data = friendData;
        }
        if (!data) throw new Error('This list is private, unavailable, or the link has expired.');
        if (active) setList({
          id: data.id,
          name: data.name,
          description: data.description || '',
          items: Array.isArray(data.items) ? data.items : [],
        });
      } catch (loadError) {
        console.error('Could not load shared list:', loadError);
        if (active) setError('This list is private, unavailable, or the link has expired.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [id, token]);

  function openItem(item: any) {
    if (!item?.id) return;
    if (item.type === 'track') router.push(`/track/${encodeURIComponent(String(item.id))}` as any);
    else router.push(`/album/${encodeURIComponent(String(item.id))}` as any);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>‹</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>MUSICBOXD LIST</Text>
        <View style={{ width: 28 }} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#fff" /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.error}>{error}</Text></View>
      ) : list ? (
        <>
          <Text style={styles.title}>{list.name}</Text>
          {!!list.description && <Text style={styles.description}>{list.description}</Text>}
          <FlatList
            data={list.items}
            keyExtractor={(item, index) => `${item.type || 'album'}-${item.id || index}-${index}`}
            numColumns={3}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.item} onPress={() => openItem(item)}>
                {item.cover ? <Image source={{ uri: item.cover }} style={styles.cover} /> : <View style={styles.cover} />}
                <Text style={styles.itemName} numberOfLines={2}>{item.name || 'Untitled'}</Text>
                <Text style={styles.artist} numberOfLines={1}>{item.artist || (item.type === 'track' ? 'Track' : 'Album')}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.empty}>This list is empty.</Text>}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingTop: 58, paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#fff', fontSize: 30, width: 28 },
  headerTitle: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', paddingHorizontal: 20, marginTop: 12 },
  description: { color: '#999', fontSize: 14, paddingHorizontal: 20, marginTop: 8 },
  grid: { padding: 16, gap: 12 },
  item: { width: '31.5%', marginBottom: 10, marginRight: '1.5%' },
  cover: { width: '100%', aspectRatio: 1, borderRadius: 6, backgroundColor: '#222' },
  itemName: { color: '#fff', fontSize: 12, marginTop: 6 },
  artist: { color: '#888', fontSize: 11, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#aaa', fontSize: 14, textAlign: 'center' },
  empty: { color: '#888', textAlign: 'center', padding: 24 },
});
