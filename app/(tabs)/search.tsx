import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Search() {
  const router = useRouter();
  const { mode, index } = useLocalSearchParams();
  const isPickMode = mode === 'pickAlbum';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [tab, setTab] = useState<'music' | 'people'>('music');

  useEffect(() => {
    loadRecent();
  }, []);

  async function loadRecent() {
    const data = await AsyncStorage.getItem('recent_searches');
    if (data) setRecentSearches(JSON.parse(data));
  }

  async function saveRecent(item: any) {
    const data = await AsyncStorage.getItem('recent_searches');
    let recent = data ? JSON.parse(data) : [];
    recent = recent.filter((r: any) => r.id !== item.id);
    recent.unshift(item);
    recent = recent.slice(0, 10);
    await AsyncStorage.setItem('recent_searches', JSON.stringify(recent));
    setRecentSearches(recent);
  }

  async function pickAlbum(album: any) {
    const data = await AsyncStorage.getItem('profile');
    const profile = data ? JSON.parse(data) : {};
    const albums = profile.favoriteAlbums || [null, null, null, null];
    albums[Number(index)] = {
      id: album.id,
      title: album.name,
      cover: album.images?.[0]?.url,
    };
    profile.favoriteAlbums = albums;
    await AsyncStorage.setItem('profile', JSON.stringify(profile));
    router.push('/(tabs)/profile');
  }

  const searchSpotify = async (text: string) => {
    setQuery(text);
    if (text.length < 2) { setResults([]); return; }
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) return;
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(text)}&type=${isPickMode ? 'album' : 'track,album,artist'}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (isPickMode) {
      setResults((data.albums?.items || []).map((a: any) => ({ ...a, _type: 'album' })));
    } else {
      const artists = (data.artists?.items || []).map((a: any) => ({ ...a, _type: 'artist' }));
      const tracks = (data.tracks?.items || []).map((t: any) => ({ ...t, _type: 'track' }));
      setResults([...artists, ...tracks]);
    }
  };

  const openMenu = (item: any) => {
    setSelected(item);
    setMenuVisible(true);
  };

  function renderItem({ item }: any) {
    if (isPickMode) {
      return (
        <TouchableOpacity style={styles.row} onPress={() => pickAlbum(item)}>
          <Image source={{ uri: item.images?.[0]?.url }} style={styles.albumArt} />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.artist} numberOfLines={1}>{item.artists?.[0]?.name}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={styles.row} onPress={() => {
        if (item._type === 'artist') {
          saveRecent({ ...item, _type: 'artist' });
          router.push(`/artist/${item.id}`);
        }
      }}>
        <Image
          source={{ uri: item._type === 'artist' ? item.images?.[0]?.url : item.album?.images?.[0]?.url }}
          style={item._type === 'artist' ? { ...styles.albumArt, borderRadius: 25 } : styles.albumArt}
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.artist} numberOfLines={1}>
            {item._type === 'artist' ? 'Artist' : item.artists?.[0]?.name}
          </Text>
        </View>
        {item._type === 'track' && (
          <Pressable onPress={() => openMenu(item)}>
            <Text style={styles.dots}>···</Text>
          </Pressable>
        )}
      </TouchableOpacity>
    );
  }

  const allUsers = [
    { id: '1', username: 'giorgi99', name: 'გიორგი', avatar: null },
    { id: '2', username: 'mariami_m', name: 'მარიამი', avatar: null },
    { id: '3', username: 'nino.geo', name: 'ნინო', avatar: null },
  ];

  const filteredUsers = query.length >= 2
    ? allUsers.filter(u => u.username.toLowerCase().includes(query.toLowerCase()) || u.name.includes(query))
    : [];

  return (
    <View style={styles.container}>
      {isPickMode ? (
        <View style={styles.pickHeader}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            <Text style={styles.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.header}>Choose Album</Text>
        </View>
      ) : (
        <Text style={styles.header}>Search</Text>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={isPickMode ? 'Search albums...' : tab === 'people' ? 'მოძებნე მომხმარებელი...' : 'სიმღერა, ალბომი, არტისტი...'}
          placeholderTextColor="#555"
          value={query}
          onChangeText={searchSpotify}
          autoFocus={isPickMode}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }} style={styles.clearBtn}>
            <Text style={styles.clearX}>✕</Text>
          </TouchableOpacity>
        )}
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isPickMode && (
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'music' && styles.tabActive]} onPress={() => setTab('music')}>
            <Text style={[styles.tabText, tab === 'music' && styles.tabTextActive]}>Music</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'people' && styles.tabActive]} onPress={() => setTab('people')}>
            <Text style={[styles.tabText, tab === 'people' && styles.tabTextActive]}>People</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'people' && !isPickMode ? (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            query.length >= 2
              ? <Text style={styles.emptyText}>მომხმარებელი ვერ მოიძებნა</Text>
              : <Text style={styles.emptyText}>მოძებნე მომხმარებელი</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row}>
              <View style={styles.avatarPlaceholder}>
                <Text style={{ color: '#fff', fontSize: 18 }}>{item.name[0]}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.artist}>@{item.username}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <>
          {query.length < 2 && recentSearches.length > 0 && !isPickMode && (
            <View>
              <Text style={styles.sectionTitle}>Recent</Text>
              <FlatList
                data={recentSearches}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
              />
            </View>
          )}
          {query.length >= 2 && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
            />
          )}
        </>
      )}

      {!isPickMode && (
        <Modal visible={menuVisible} transparent animationType="slide">
          <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Image source={{ uri: selected?.album?.images?.[0]?.url }} style={styles.sheetImage} />
              <View>
                <Text style={styles.sheetTitle} numberOfLines={1}>{selected?.name}</Text>
                <Text style={styles.sheetArtist} numberOfLines={1}>{selected?.artists?.[0]?.name}</Text>
              </View>
            </View>
            {[
              { label: 'Share', icon: '↑' },
              { label: 'Add to Liked Songs', icon: '🤍' },
              { label: 'Add to Playlist', icon: '+' },
              { label: 'Go to Album', icon: '💿' },
              { label: 'Go to Artist', icon: '👤' },
            ].map(({ label, icon }) => (
              <Pressable key={label} style={styles.action} onPress={() => {
                setMenuVisible(false);
                if (label === 'Go to Artist') router.push(`/artist/${selected?.artists?.[0]?.id}`);
                else if (label === 'Go to Album') router.push(`/album/${selected?.album?.id}`);
              }}>
                <Text style={styles.actionIcon}>{icon}</Text>
                <Text style={styles.actionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', padding: 20, paddingTop: 60 },
  pickHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backBtn: { color: '#fff', fontSize: 32, lineHeight: 36 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  input: { flex: 1, backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, padding: 12 },
  clearBtn: { backgroundColor: '#444', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  clearX: { color: '#fff', fontSize: 12 },
  cancelBtn: { color: '#fff', fontSize: 15 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1DB954' },
  tabText: { color: '#888', fontSize: 15 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { color: '#888', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 12 },
  albumArt: { width: 50, height: 50, borderRadius: 4 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  artist: { color: '#888', fontSize: 13 },
  dots: { color: '#fff', fontSize: 22, paddingHorizontal: 8 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#1a1a1a', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sheetImage: { width: 50, height: 50, borderRadius: 4 },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sheetArtist: { color: '#888', fontSize: 13, marginBottom: 8 },
  action: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 16 },
  actionIcon: { color: '#fff', fontSize: 20, width: 24, textAlign: 'center' },
  actionText: { color: '#fff', fontSize: 16 },
});
