import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Lists() {
  const router = useRouter();
  const [lists, setLists] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchType, setSearchType] = useState<'album' | 'track'>('album');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadLists();
  }, []);

  async function loadLists() {
    const data = await AsyncStorage.getItem('lists');
    if (data) setLists(JSON.parse(data));
  }

  async function runSearch(query: string, type: 'album' | 'track') {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=15`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const items = type === 'album' ? data.albums?.items : data.tracks?.items;
      setSearchResults(items || []);
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
      return [
        ...prev,
        {
          id: item.id,
          type: searchType,
          name: item.name,
          artist: getItemArtist(item),
          cover: getItemImage(item),
        },
      ];
    });
  }

  function removeSelectedItem(itemId: string) {
    setSelectedItems((prev) => prev.filter((a) => a.id !== itemId));
  }

  function handleCancel() {
    setName('');
    setDescription('');
    setIsPublic(true);
    setSelectedItems([]);
    setShowCreate(false);
  }

  async function createList() {
    if (!name.trim()) return;
    const newList = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description.trim(),
      isPublic,
      albums: selectedItems,
      createdAt: new Date().toISOString(),
    };
    const updated = [newList, ...lists];
    setLists(updated);
    await AsyncStorage.setItem('lists', JSON.stringify(updated));
    handleCancel();
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
                {item.description ? (
                  <Text style={styles.listDesc} numberOfLines={1}>{item.description}</Text>
                ) : null}
                <Text style={styles.listMeta}>
                  {item.albums?.length || 0} items • {item.isPublic ? '🌐 Public' : '🔒 Private'}
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* New List sheet */}
      <Modal visible={showCreate} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={handleCancel} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHandle} />

            {/* Cancel / Title / Save header */}
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
              <TouchableOpacity onPress={() => setShowSearch(true)}>
                <Text style={styles.addAlbumsLink}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {selectedItems.length > 0 && (
              <View style={styles.selectedAlbumsWrap}>
                {selectedItems.map((a) => (
                  <View key={a.id} style={styles.albumChip}>
                    {a.cover ? (
                      <Image source={{ uri: a.cover }} style={styles.albumChipImg} />
                    ) : (
                      <View style={[styles.albumChipImg, { backgroundColor: '#333' }]} />
                    )}
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

            <Text style={styles.label}>Privacy</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, isPublic && styles.toggleActive]}
                onPress={() => setIsPublic(true)}
              >
                <Text style={[styles.toggleText, isPublic && styles.toggleTextActive]}>🌐 Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, !isPublic && styles.toggleActive]}
                onPress={() => setIsPublic(false)}
              >
                <Text style={[styles.toggleText, !isPublic && styles.toggleTextActive]}>🔒 Private</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Search sheet */}
      <Modal visible={showSearch} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowSearch(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
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
              <TouchableOpacity
                style={[styles.toggleBtn, searchType === 'album' && styles.toggleActive]}
                onPress={() => switchSearchType('album')}
              >
                <Text style={[styles.toggleText, searchType === 'album' && styles.toggleTextActive]}>💿 Albums</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, searchType === 'track' && styles.toggleActive]}
                onPress={() => switchSearchType('track')}
              >
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
                    {image ? (
                      <Image source={{ uri: image }} style={styles.resultImg} />
                    ) : (
                      <View style={[styles.resultImg, { backgroundColor: '#333' }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.resultArtist} numberOfLines={1}>{getItemArtist(item)}</Text>
                    </View>
                    <Text style={isSelected ? styles.resultCheckActive : styles.resultCheck}>
                      {isSelected ? '✓' : '+'}
                    </Text>
                  
