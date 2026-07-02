import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Lists() {
  const router = useRouter();
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

  useEffect(() => { loadLists(); }, []);

  async function loadLists() {
    const data = await AsyncStorage.getItem('lists');
    if (data) setLists(JSON.parse(data));
  }

  async function runSearch(query: string, type: 'album' | 'track') {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=15`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setSearchResults(type === 'album' ? data.albums?.items || [] : data.tracks?.items || []);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
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
    if (!name.trim()) return;
    const newList = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description.trim(),
      privacy,
      albums: selectedItems,
      createdAt: new Date().toISOString(),
    };
    const updated = [newList, ...lists];
    setLists(updated);
    await AsyncStorage.setItem('lists', JSON.stringify(updated));
    handleCancel();
  }

  function privacyLabel() {
    if (privacy === 'public') return '🌐  Anyone (public list)';
    if (privacy === 'link') return '🔗  Anyone with share link';
    if (privacy === 'friends') return '👥  Friends with share link';
    return '🔒  You (private list)';
  }

  function showPrivacySheet() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'List visible to',
          options: [
            'Anyone (public list)',
            'Anyone with share link',
            'Friends with share link',
            'You (private list)',
            'Cancel',
          ],
          cancelButtonIndex: 4,
        },
        (idx) => {
          if (idx === 0) setPrivacy('public');
          if (idx === 1) setPrivacy('link');
          if (idx === 2) setPrivacy('friends');
          if (idx === 3) setPrivacy('private');
        }
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lists</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Text style={styles.plus}>+</Text>
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
            <TouchableOpacity style={styles.listCard}>
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

      {/* New List sheet */}
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
              <TouchableOpacity onPress={createList} disabled={!name.trim()}>
                <Text style={[styles.saveBtn, !name.trim() && { opacity: 0.4 }]}>Save</Text>
              </TouchableOpacity>
            </View>

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
                onPress={() => setShowSearch(true)}
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

      {/* Search sheet */}
      <Modal visible={showSearch} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowSearch(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <View style={[styles.sheet, { maxHeight: '85%' }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopBar}>
              <View style={{ width: 60 }} />
              <Text style={styles.sheetTitle}>Add to List</Text>
              <TouchableOpacity onPress={() => setShowSearch(false)}>
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

            {searching && <ActivityIndicator color="#1DB954" style={{ marginTop: 16 }} />}

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
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  resultImg: { width: 44, height: 44, borderRadius: 6, marginRight: 12 },
  resultName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resultArtist: { color: '#888', fontSize: 13, marginTop: 2 },
  resultCheck: { color: '#555', fontSize: 22, paddingHorizontal: 8 },
  resultCheckActive: { color: '#1DB954', fontSize: 20, fontWeight: 'bold', paddingHorizontal: 8 },
});
