import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { getValidSpotifyToken } from '@/utils/spotify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Lists() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [lists, setLists] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'link' | 'friends' | 'private'>('public');

  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchType, setSearchType] = useState<'album' | 'track'>('album');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPrivacyOptions, setShowPrivacyOptions] = useState(false);
  const [selectedList, setSelectedList] = useState<any | null>(null);
  const [showListDetail, setShowListDetail] = useState(false);
  const searchRequestId = useRef(0);

  useEffect(() => { loadLists(); }, []);

  async function loadLists() {
    const data = await AsyncStorage.getItem('lists');
    if (data) setLists(JSON.parse(data));
  }

  async function runSearch(query: string, type: 'album' | 'track') {
    setSearchQuery(query);
    const requestId = ++searchRequestId.current;

    if (!query.trim()) {
      setSearchResults([]);
      setSearchError('');
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError('');

    try {
      const { data, error } = await supabase.functions.invoke(
        'spotify-search',
        {
          body: {
            query: query.trim(),
            type,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (requestId !== searchRequestId.current) return;

      setSearchResults(
        type === 'album'
          ? data.albums?.items || []
          : data.tracks?.items || []
      );
    } catch (error) {
      console.log('Lists Spotify search error:', error);

      if (requestId === searchRequestId.current) {
        setSearchResults([]);
        setSearchError('Could not search music. Please try again.');
      }
    } finally {
      if (requestId === searchRequestId.current) {
        setSearching(false);
      }
    }
  }

  function switchSearchType(type: 'album' | 'track') {
    setSearchType(type);
    setSearchResults([]);
    if (searchQuery.trim()) runSearch(searchQuery, type);
  }

  function getItemImage(item: any) {
    return item.images?.[0]?.url || item.album?.images?.[0]?.url;
  }

  function getItemArtist(item: any) {
    return item.artists?.[0]?.name;
  }

  function toggleItemSelection(item: any) {
    setSelectedItems((prev) => {
      const exists = prev.find((a) => a.id === item.id);
      if (exists) return prev.filter((a) => a.id !== item.id);
      return [...prev, {
        id: item.id,
        type: searchType,
        name: item.name,
        artist: getItemArtist(item),
        cover: getItemImage(item),
      }];
    });
  }

  function removeSelectedItem(itemId: string) {
    setSelectedItems((prev) => prev.filter((a) => a.id !== itemId));
  }

  function handleCancel() {
    setName('');
    setDescription('');
    setPrivacy('public');
    setSelectedItems([]);
    setShowCreate(false);
  }

  async function createList() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const newList = {
        id: Date.now().toString(),
        name: name.trim(),
        description: description.trim(),
        privacy,
        albums: selectedItems,
        createdAt: new Date().toISOString(),
      };
      const updated = [newList, ...lists];
      await AsyncStorage.setItem('lists', JSON.stringify(updated));
      setLists(updated);
      handleCancel();
    } catch {
      setSaveError('Could not save this list. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function privacyLabel() {
    if (privacy === 'public') return '🌐  Anyone (public list)';
    if (privacy === 'link') return '🔗  Anyone with share link';
    if (privacy === 'friends') return '👥  Friends with share link';
    return '🔒  You (private list)';
  }

  function privacyLabelFor(value?: string) {
    if (value === 'public') return 'Public';
    if (value === 'link') return 'Link access';
    if (value === 'friends') return 'Friends';
    return 'Private';
  }

  function showPrivacySheet() {
    setShowPrivacyOptions(true);
  }

  async function openListItem(item: any) {
    if (item.type !== 'track') {
      router.push(`/album/${item.id}` as any);
      return;
    }

    let albumId = item.albumId;
    if (!albumId) {
      const token = await getValidSpotifyToken();
      if (!token) return;
      try {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${item.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Track lookup failed (${response.status})`);
        const data = await response.json();
        albumId = data.album?.id;
      } catch {
        setSearchError('Could not open this track. Please try again.');
        return;
      }
    }

    if (albumId) {
      router.push({ pathname: '/album/[id]', params: { id: albumId, highlightTrackId: item.id } } as any);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lists</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Text style={[styles.plus, { color: accentColor }]}>+</Text>
        </TouchableOpacity>
      </View>

      {lists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No lists yet</Text>
          <Text style={styles.emptySubtext}>Create your first list</Text>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listCard}
              onPress={() => { setSelectedList(item); setShowListDetail(true); }}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
            >
              <View style={styles.listInfo}>
                <Text style={styles.listName}>{item.name}</Text>
                {item.description ? <Text style={styles.listDesc} numberOfLines={1}>{item.description}</Text> : null}
                <Text style={styles.listMeta}>{item.albums?.length || 0} items</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showCreate} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={handleCancel} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopBar}>
              <TouchableOpacity onPress={handleCancel}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>New List</Text>
              <TouchableOpacity onPress={createList} disabled={!name.trim() || saving}>
                {saving
                  ? <ActivityIndicator color={accentColor} />
                  : <Text style={[styles.saveBtn, { color: accentColor }, !name.trim() && { opacity: 0.4 }]}>Save</Text>}
              </TouchableOpacity>
            </View>

            {!!saveError && <Text accessibilityRole="alert" style={styles.errorText}>{saveError}</Text>}

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="List name..."
              placeholderTextColor="#555"
              value={name}
              onChangeText={setName}
              autoFocus
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="What's this list about?"
              placeholderTextColor="#555"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={styles.albumsHeaderRow}>
              <Text style={styles.label}>Items ({selectedItems.length})</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreate(false);
                  setTimeout(() => setShowSearch(true), 300);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 6 }}
              >
                <Text style={styles.addAlbumsLink}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {selectedItems.length > 0 && (
              <View style={styles.selectedAlbumsWrap}>
                {selectedItems.map((a) => (
                  <View key={a.id} style={styles.albumChip}>
                    {a.cover ? <Image source={{ uri: a.cover }} style={styles.albumChipImg} /> : <View style={[styles.albumChipImg, { backgroundColor: '#333' }]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.albumChipText} numberOfLines={1}>{a.name}</Text>
                      <Text style={styles.albumChipType}>{a.type === 'track' ? '🎵 Track' : '💿 Album'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeSelectedItem(a.id)}>
                      <Text style={styles.albumChipRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.label}>Visible to</Text>
            <TouchableOpacity style={styles.privacyRow} onPress={showPrivacySheet}>
              <Text style={styles.privacyLabel}>{privacyLabel()}</Text>
              <Text style={styles.privacyChevron}>›</Text>
            </TouchableOpacity>
            <Text style={styles.privacyHint}>Only public lists appear on your profile for others.</Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showSearch} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => {
          setShowSearch(false);
          setTimeout(() => setShowCreate(true), 300);
        }} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <View style={[styles.sheet, { maxHeight: '85%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopBar}>
              <View style={{ width: 60 }} />
              <Text style={styles.sheetTitle}>Add to List</Text>
              <TouchableOpacity onPress={() => {
                setShowSearch(false);
                setTimeout(() => setShowCreate(true), 300);
              }}>
                <Text style={styles.saveBtn}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <TouchableOpacity style={[styles.toggleBtn, searchType === 'album' && styles.toggleActive]} onPress={() => switchSearchType('album')}>
                <Text style={[styles.toggleText, searchType === 'album' && styles.toggleTextActive]}>💿 Albums</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, searchType === 'track' && styles.toggleActive]} onPress={() => switchSearchType('track')}>
                <Text style={[styles.toggleText, searchType === 'track' && styles.toggleTextActive]}>🎵 Tracks</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { marginTop: 16 }]}
              placeholder={searchType === 'album' ? 'Search albums...' : 'Search tracks...'}
              placeholderTextColor="#555"
              value={searchQuery}
              onChangeText={(q) => runSearch(q, searchType)}
              autoFocus
            />

            {searching && <ActivityIndicator color={accentColor} style={{ marginTop: 16 }} />}
            {!!searchError && <Text accessibilityRole="alert" style={styles.errorText}>{searchError}</Text>}
            {!searching && !searchError && searchQuery.trim().length > 0 && searchResults.length === 0 && (
              <Text style={styles.emptySearch}>No results found.</Text>
            )}

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              style={{ marginTop: 12 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selectedItems.some((a) => a.id === item.id);
                const image = getItemImage(item);
                return (
                  <TouchableOpacity style={styles.resultRow} onPress={() => toggleItemSelection(item)}>
                    {image ? <Image source={{ uri: image }} style={styles.resultImg} /> : <View style={[styles.resultImg, { backgroundColor: '#333' }]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.resultArtist} numberOfLines={1}>{getItemArtist(item)}</Text>
                    </View>
                    <Text style={isSelected ? styles.resultCheckActive : styles.resultCheck}>{isSelected ? '✓' : '+'}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPrivacyOptions} transparent animationType="fade" onRequestClose={() => setShowPrivacyOptions(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowPrivacyOptions(false)} />
        <View style={styles.privacySheet}>
          <Text style={styles.sheetTitle}>List visible to</Text>
          {([
            ['public', 'Anyone (public list)'],
            ['link', 'Anyone with share link'],
            ['friends', 'Friends with share link'],
            ['private', 'You (private list)'],
          ] as const).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={styles.privacyOption}
              onPress={() => { setPrivacy(value); setShowPrivacyOptions(false); }}
              accessibilityRole="radio"
              accessibilityState={{ checked: privacy === value }}
            >
              <Text style={styles.privacyOptionText}>{label}</Text>
              <Text style={styles.privacyChevron}>{privacy === value ? '✓' : ''}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setShowPrivacyOptions(false)} style={styles.privacyCancel}>
            <Text style={styles.cancelBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showListDetail} transparent animationType="slide" onRequestClose={() => setShowListDetail(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowListDetail(false)} />
        <View style={[styles.sheet, styles.detailSheet]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTopBar}>
            <View style={{ width: 44 }} />
            <Text style={styles.sheetTitle} numberOfLines={1}>{selectedList?.name}</Text>
            <TouchableOpacity onPress={() => setShowListDetail(false)} accessibilityRole="button" accessibilityLabel="Close list">
              <Text style={styles.cancelBtn}>Done</Text>
            </TouchableOpacity>
          </View>
          {!!selectedList?.description && <Text style={styles.listDesc}>{selectedList.description}</Text>}
          <Text style={styles.listMeta}>
            {privacyLabelFor(selectedList?.privacy)} · {selectedList?.albums?.length || 0} items
          </Text>
          {(selectedList?.albums || []).length === 0 ? (
            <Text style={styles.emptySearch}>This list is empty.</Text>
          ) : (
            <FlatList
              data={selectedList.albums}
              keyExtractor={(item, index) => `${item.type || 'album'}-${item.id}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => openListItem(item)} accessibilityRole="link">
                  {item.cover ? <Image source={{ uri: item.cover }} style={styles.resultImg} /> : <View style={[styles.resultImg, { backgroundColor: '#333' }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.resultArtist} numberOfLines={1}>{item.artist || (item.type === 'track' ? 'Track' : 'Album')}</Text>
                  </View>
                  <Text style={styles.arrow}>›</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  back: { color: '#fff', fontSize: 32, lineHeight: 36 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  plus: { color: '#1DB954', fontSize: 32, lineHeight: 36 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptySubtext: { color: '#666', fontSize: 14, marginTop: 8 },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', borderRadius: 12, padding: 16, marginBottom: 12 },
  listInfo: { flex: 1 },
  listName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listDesc: { color: '#888', fontSize: 13, marginTop: 4 },
  listMeta: { color: '#555', fontSize: 12, marginTop: 6 },
  arrow: { color: '#555', fontSize: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#1c1c1c', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 44 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cancelBtn: { color: '#888', fontSize: 16 },
  saveBtn: { color: '#1DB954', fontSize: 16, fontWeight: '600' },
  label: { color: '#888', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10, padding: 12, fontSize: 15 },
  toggleRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2a2a2a', alignItems: 'center' },
  toggleActive: { backgroundColor: '#1DB954' },
  toggleText: { color: '#888', fontSize: 14, fontWeight: '600' },
  toggleTextActive: { color: '#000' },
  albumsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  addAlbumsLink: { color: '#1DB954', fontSize: 14, fontWeight: '600' },
  selectedAlbumsWrap: { marginTop: 8 },
  albumChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 10, padding: 8, marginBottom: 8 },
  albumChipImg: { width: 36, height: 36, borderRadius: 6, marginRight: 10 },
  albumChipText: { color: '#fff', fontSize: 14 },
  albumChipType: { color: '#777', fontSize: 11, marginTop: 2 },
  albumChipRemove: { color: '#888', fontSize: 16, paddingHorizontal: 8 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#2a2a2a', borderRadius: 10, padding: 14, marginTop: 4 },
  privacyLabel: { color: '#fff', fontSize: 15 },
  privacyChevron: { color: '#555', fontSize: 20 },
  privacyHint: { color: '#555', fontSize: 12, marginTop: 8 },
  errorText: { color: '#ff8b8b', fontSize: 13, marginTop: 10 },
  emptySearch: { color: '#888', textAlign: 'center', paddingVertical: 20 },
  privacySheet: { backgroundColor: '#1c1c1c', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 36, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  privacyOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  privacyOptionText: { color: '#fff', fontSize: 15 },
  privacyCancel: { alignItems: 'center', paddingTop: 18 },
  detailSheet: { maxHeight: '85%' },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  resultImg: { width: 44, height: 44, borderRadius: 6, marginRight: 12 },
  resultName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resultArtist: { color: '#888', fontSize: 13, marginTop: 2 },
  resultCheck: { color: '#555', fontSize: 22, paddingHorizontal: 8 },
  resultCheckActive: { color: '#1DB954', fontSize: 20, fontWeight: 'bold', paddingHorizontal: 8 },
});
