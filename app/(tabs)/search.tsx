import { useAppTheme } from '@/context/ThemeContext';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId } from '@/utils/currentUser';
import { shareMusicItem } from '@/utils/sharing';
import { getValidSpotifyToken } from '@/utils/spotify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const RECENT_LIMIT = 20;

export default function Search() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const { mode, index } = useLocalSearchParams();
  const isPickMode = mode === 'pickAlbum';

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [tab, setTab] = useState<'music' | 'people'>('music');
  const [peopleResults, setPeopleResults] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [lists, setLists] = useState<any[]>([]);
  const [showListPicker, setShowListPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [feedback, setFeedback] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    loadRecent();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(''), 2400);
    return () => clearTimeout(timer);
  }, [feedback]);

  async function loadRecent() {
    const data = await AsyncStorage.getItem('recent_searches');
    if (data) setRecentSearches(JSON.parse(data));
  }

  async function saveRecent(item: any) {
    const data = await AsyncStorage.getItem('recent_searches');
    let recent = data ? JSON.parse(data) : [];
    recent = recent.filter((r: any) => r.id !== item.id);
    recent.unshift(item);
    recent = recent.slice(0, RECENT_LIMIT);
    await AsyncStorage.setItem('recent_searches', JSON.stringify(recent));
    setRecentSearches(recent);
  }

  async function removeRecent(id: string) {
    const updated = recentSearches.filter((r: any) => r.id !== id);
    setRecentSearches(updated);
    await AsyncStorage.setItem('recent_searches', JSON.stringify(updated));
  }

  async function clearAllRecent() {
    setRecentSearches([]);
    await AsyncStorage.removeItem('recent_searches');
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
    const currentRequest = ++requestId.current;
    if (text.trim().length < 2) {
      setResults([]);
      setSearchError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setSearchError('');
    const token = await getValidSpotifyToken();
    if (currentRequest !== requestId.current) return;
    if (!token) {
      setLoading(false);
      setSearchError('Sign in to search Spotify.');
      return;
    }
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(text)}&type=${isPickMode ? 'album' : 'track,album,artist'}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Spotify search failed (${res.status})`);
      const data = await res.json();
      if (currentRequest === requestId.current) {
        if (isPickMode) {
          setResults((data.albums?.items || []).map((item: any) => ({ ...item, _type: 'album' })));
        } else {
          const artists = (data.artists?.items || []).map((item: any) => ({ ...item, _type: 'artist' }));
          const albums = (data.albums?.items || []).map((item: any) => ({ ...item, _type: 'album' }));
          const tracks = (data.tracks?.items || []).map((item: any) => ({ ...item, _type: 'track' }));
          setResults([...artists, ...albums, ...tracks]);
        }
      }
    } catch {
      if (currentRequest === requestId.current) {
        setResults([]);
        setSearchError('Could not search Spotify. Check your connection and try again.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  async function searchPeople(text: string) {
    setQuery(text);
    const currentRequest = ++requestId.current;
    if (text.trim().length < 2) {
      setPeopleResults([]);
      setSearchError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearchError('');
    try {
      const response = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(text)}`);
      if (!response.ok) throw new Error(`People search failed (${response.status})`);
      const raw = await response.json();
      const users: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.users)
          ? raw.users
          : Array.isArray(raw?.data)
            ? raw.data
            : [];
      if (currentRequest !== requestId.current) return;
      setPeopleResults(users);

      const myId = await getCurrentUserId();
      if (!myId || users.length === 0) {
        setFollowingIds(new Set());
        return;
      }
      const followChecks = await Promise.all(users.map(async (user: any) => {
        try {
          const followResponse = await fetch(`${API_BASE}/follows/${myId}/is-following/${user.id}`);
          if (!followResponse.ok) return false;
          const followData = await followResponse.json();
          return !!followData?.isFollowing;
        } catch {
          return false;
        }
      }));
      if (currentRequest === requestId.current) {
        setFollowingIds(new Set(users.filter((_: any, index: number) => followChecks[index]).map((user: any) => user.id)));
      }
    } catch {
      if (currentRequest === requestId.current) {
        setPeopleResults([]);
        setSearchError('Could not search people. Try again later.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  async function toggleFollow(userId: string) {
    const myId = await getCurrentUserId();
    if (!myId) {
      setSearchError('Your Spotify session has expired. Sign in again to follow people.');
      return;
    }

    const isFollowing = followingIds.has(userId);
    try {
      const response = await fetch(`${API_BASE}/follows`, {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: myId, followingId: userId }),
      });
      if (!response.ok) throw new Error(`Follow request failed (${response.status})`);
      setFollowingIds(previous => {
        const next = new Set(previous);
        if (isFollowing) next.delete(userId);
        else next.add(userId);
        return next;
      });
    } catch {
      setSearchError('Could not update your follow. Please try again.');
    }
  }

  function getItemCover(item: any) {
    return item._type === 'artist'
      ? item.images?.[0]?.url
      : item._type === 'album'
        ? item.images?.[0]?.url
        : item.album?.images?.[0]?.url;
  }

  async function openMusicItem(item: any) {
    await saveRecent({ ...item, _type: item._type });
    if (item._type === 'artist') {
      router.push(`/artist/${item.id}`);
    } else if (item._type === 'album') {
      router.push(`/album/${item.id}` as any);
    } else if (item.album?.id) {
      router.push({ pathname: '/album/[id]', params: { id: item.album.id, highlightTrackId: item.id } } as any);
    }
  }

  async function performTrackAction(action: string) {
    if (!selected) return;
    setMenuVisible(false);

    if (action === 'Go to Album') {
      await openMusicItem(selected.album ? { ...selected.album, _type: 'album' } : selected);
      return;
    }
    if (action === 'Go to Artist') {
      const artist = selected.artists?.[0];
      if (artist) router.push(`/artist/${artist.id}`);
      return;
    }
    if (action === 'Share') {
      await shareMusicItem({
        id: selected.id,
        type: 'track',
        albumId: selected.album?.id,
        name: selected.name,
        artist: selected.artists?.[0]?.name,
        cover: selected.album?.images?.[0]?.url,
      });
      setFeedback('Added to Shared and opened sharing options.');
      return;
    }
    if (action === 'Add to Liked Songs') {
      const data = await AsyncStorage.getItem('liked');
      const liked = data ? JSON.parse(data) : [];
      if (!liked.some((item: any) => item.id === selected.id && item.type === 'track')) {
        liked.unshift({
          id: selected.id,
          name: selected.name,
          artist: selected.artists?.[0]?.name,
          cover: selected.album?.images?.[0]?.url,
          albumId: selected.album?.id,
          type: 'track',
        });
        await AsyncStorage.setItem('liked', JSON.stringify(liked));
      }
      setFeedback('Added to Liked Songs.');
      return;
    }
    if (action === 'Add to List') {
      const data = await AsyncStorage.getItem('lists');
      setLists(data ? JSON.parse(data) : []);
      setShowListPicker(true);
    }
  }

  async function addSelectedTrackToList(listId: string) {
    const stored = await AsyncStorage.getItem('lists');
    const currentLists = stored ? JSON.parse(stored) : [];
    const index = currentLists.findIndex((list: any) => list.id === listId);
    if (index < 0 || !selected) return;

    const items = currentLists[index].albums || [];
    const exists = items.some((item: any) => item.id === selected.id && item.type === 'track');
    if (!exists) {
      currentLists[index].albums = [{
        id: selected.id,
        type: 'track',
        name: selected.name,
        artist: selected.artists?.[0]?.name,
        cover: selected.album?.images?.[0]?.url,
        albumId: selected.album?.id,
      }, ...items];
      await AsyncStorage.setItem('lists', JSON.stringify(currentLists));
    }
    setLists(currentLists);
    setShowListPicker(false);
    setFeedback(`Added to ${currentLists[index].name}.`);
  }

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
      <TouchableOpacity style={styles.row} onPress={() => openMusicItem(item)} accessibilityRole="button">
        <Image
          source={{ uri: getItemCover(item) }}
          style={item._type === 'artist' ? { ...styles.albumArt, borderRadius: 25 } : styles.albumArt}
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.artist} numberOfLines={1}>
            {item._type === 'artist' ? 'Artist' : item._type === 'album' ? 'Album' : item.artists?.[0]?.name}
          </Text>
        </View>
        {item._type === 'track' && (
          <Pressable
            onPress={(event) => { event.stopPropagation(); openMenu(item); }}
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${item.name}`}
            hitSlop={8}
          >
            <Text style={styles.dots}>···</Text>
          </Pressable>
        )}
      </TouchableOpacity>
    );
  }

  function renderRecentItem({ item }: any) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => openMusicItem(item)}
      >
        <Image
          source={{ uri: getItemCover(item) }}
          style={item._type === 'artist' ? { ...styles.albumArt, borderRadius: 25 } : styles.albumArt}
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.artist} numberOfLines={1}>
            {item._type === 'artist' ? 'Artist' : item._type === 'album' ? 'Album' : item.artists?.[0]?.name}
          </Text>
        </View>
        <Pressable onPress={(event) => { event.stopPropagation(); removeRecent(item.id); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from recent searches`}>
          <Text style={styles.dots}>✕</Text>
        </Pressable>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
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
          onChangeText={text => tab === 'people' && !isPickMode ? searchPeople(text) : searchSpotify(text)}
          autoFocus={isPickMode}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setPeopleResults([]); setSearchError(''); }} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear search">
            <Text style={styles.clearX}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator color="#1DB954" style={{ marginBottom: 12 }} />}
      {!!searchError && <Text accessibilityRole="alert" style={styles.searchError}>{searchError}</Text>}
      {!!feedback && <Text accessibilityLiveRegion="polite" style={styles.feedback}>{feedback}</Text>}

      {!isPickMode && (
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'music' && styles.tabActive, tab === 'music' && { borderBottomColor: accentColor }]} onPress={() => { setTab('music'); if (query.trim().length >= 2) searchSpotify(query); }} accessibilityRole="tab" accessibilityState={{ selected: tab === 'music' }}>
            <Text style={[styles.tabText, tab === 'music' && styles.tabTextActive]}>Music</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'people' && styles.tabActive, tab === 'people' && { borderBottomColor: accentColor }]} onPress={() => { setTab('people'); if (query.trim().length >= 2) searchPeople(query); }} accessibilityRole="tab" accessibilityState={{ selected: tab === 'people' }}>
            <Text style={[styles.tabText, tab === 'people' && styles.tabTextActive]}>People</Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'people' && !isPickMode ? (
        <FlatList
          data={peopleResults}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            query.length >= 2
              ? <Text style={styles.emptyText}>No people found.</Text>
              : <Text style={styles.emptyText}>Search for people you know.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.avatar
                ? <Image source={{ uri: item.avatar }} style={styles.personAvatar} />
                : <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{String(item.username || '?')[0].toUpperCase()}</Text></View>}
              <View style={styles.info}>
                <Text style={styles.title}>{item.username}</Text>
                {item.name ? <Text style={styles.artist}>{item.name}</Text> : null}
              </View>
              <TouchableOpacity
                style={[styles.followButton, followingIds.has(item.id) && styles.followingButton]}
                onPress={() => toggleFollow(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${followingIds.has(item.id) ? 'Unfollow' : 'Follow'} ${item.username}`}
              >
                <Text style={[styles.followText, followingIds.has(item.id) && styles.followingText]}>
                  {followingIds.has(item.id) ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : (
        <>
          {query.length < 2 && recentSearches.length > 0 && !isPickMode && (
            <View style={{ flex: 1 }}>
              <View style={styles.recentHeaderRow}>
                <Text style={styles.sectionTitle}>Recent</Text>
              </View>
              <FlatList
                data={recentSearches}
                keyExtractor={(item) => item.id}
                renderItem={renderRecentItem}
                ListFooterComponent={
                  <TouchableOpacity onPress={clearAllRecent} style={styles.clearAllBtn}>
                    <Text style={styles.clearAllText}>Clear recent searches</Text>
                  </TouchableOpacity>
                }
              />
            </View>
          )}
          {query.length >= 2 && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ListEmptyComponent={<Text style={styles.emptyText}>No results found.</Text>}
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
              { label: 'Add to List', icon: '+' },
              { label: 'Go to Album', icon: '💿' },
              { label: 'Go to Artist', icon: '👤' },
            ].map(({ label, icon }) => (
              <Pressable key={label} style={styles.action} onPress={() => performTrackAction(label)} accessibilityRole="button">
                <Text style={styles.actionIcon}>{icon}</Text>
                <Text style={styles.actionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Modal>
      )}

      <Modal visible={showListPicker} transparent animationType="slide" onRequestClose={() => setShowListPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowListPicker(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add to List</Text>
            <TouchableOpacity onPress={() => setShowListPicker(false)} accessibilityRole="button" accessibilityLabel="Close list picker">
              <Text style={styles.dots}>✕</Text>
            </TouchableOpacity>
          </View>
          {lists.length === 0 ? (
            <View style={styles.noLists}>
              <Text style={styles.emptyText}>No lists yet.</Text>
              <TouchableOpacity onPress={() => { setShowListPicker(false); router.push('/lists' as any); }}>
                <Text style={styles.createListLink}>Create a list</Text>
              </TouchableOpacity>
            </View>
          ) : lists.map((list) => (
            <TouchableOpacity key={list.id} style={styles.action} onPress={() => addSelectedTrackToList(list.id)} accessibilityRole="button">
              <Text style={styles.actionText}>{list.name}</Text>
              <Text style={styles.actionIcon}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
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
  recentHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#888', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 12 },
  albumArt: { width: 50, height: 50, borderRadius: 4 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  personAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2a2a2a' },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '600' },
  followButton: { backgroundColor: '#1DB954', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  followingButton: { backgroundColor: '#2a2a2a' },
  followText: { color: '#101010', fontSize: 12, fontWeight: '700' },
  followingText: { color: '#ccc' },
  info: { flex: 1 },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  artist: { color: '#888', fontSize: 13 },
  dots: { color: '#888', fontSize: 16, paddingHorizontal: 8 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
  searchError: { color: '#ff8b8b', fontSize: 13, marginBottom: 10 },
  feedback: { color: '#86d79f', fontSize: 13, marginBottom: 10 },
  noLists: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  createListLink: { color: '#1DB954', fontSize: 15, fontWeight: '600' },
  clearAllBtn: { paddingVertical: 16, alignItems: 'center' },
  clearAllText: { color: '#1DB954', fontSize: 14, fontWeight: '600' },
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
