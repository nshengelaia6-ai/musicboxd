import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { recordActivity } from '@/utils/activity';
import { getValidSpotifyToken } from '@/utils/spotify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Lists() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [isOtherProfile, setIsOtherProfile] = useState(false);
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
  const [showListMenu, setShowListMenu] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listCarousel, setListCarousel] = useState(false);
  const searchRequestId = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadLists() {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const remote = Boolean(userId && userId !== authData.user?.id);
          if (active) setIsOtherProfile(remote);

          if (remote) {
            const { data, error } = await supabase
              .from('music_lists')
              .select('id, name, description, privacy, items, created_at, share_token')
              .eq('user_id', userId)
              .order('updated_at', { ascending: false });
            if (error) throw error;
            if (active) setLists((data || []).map((row: any) => ({
              id: row.id, name: row.name, description: row.description, privacy: row.privacy,
              albums: Array.isArray(row.items) ? row.items : [], createdAt: row.created_at,
              shareToken: row.share_token,
            })));
          } else {
            const localRaw = await AsyncStorage.getItem('lists');
            const localLists = localRaw ? JSON.parse(localRaw) : [];
            if (!authData.user) {
              if (active) setLists(Array.isArray(localLists) ? localLists : []);
              return;
            }
            const { data: cloudRows, error: cloudError } = await supabase
              .from('music_lists').select('id').order('updated_at', { ascending: false });
            if (cloudError) throw cloudError;
            const cloudIds = new Set((cloudRows || []).map((row: any) => String(row.id)));
            const legacyLists = Array.isArray(localLists) ? localLists : [];
            const toMigrate = legacyLists.filter((item: any) => !cloudIds.has(String(item.id)));
            if (toMigrate.length) {
              const { error: migrateError } = await supabase.from('music_lists').upsert(
                toMigrate.map((item: any) => ({
                  id: String(item.id), user_id: authData.user?.id,
                  name: String(item.name || 'Untitled list').slice(0, 100),
                  description: String(item.description || '').slice(0, 1000),
                  privacy: ['public', 'friends', 'link', 'private'].includes(item.privacy) ? item.privacy : 'public',
                  items: Array.isArray(item.albums) ? item.albums : [],
                  created_at: item.createdAt || new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })),
                { onConflict: 'id', ignoreDuplicates: true }
              );
              if (migrateError) throw migrateError;
            }
            const { data, error } = await supabase
              .from('music_lists')
              .select('id, name, description, privacy, items, created_at, share_token')
              .order('updated_at', { ascending: false });
            if (error) throw error;
            const mapped = (data || []).map((row: any) => ({
              id: row.id, name: row.name, description: row.description, privacy: row.privacy,
              albums: Array.isArray(row.items) ? row.items : [], createdAt: row.created_at,
              shareToken: row.share_token,
            }));
            await AsyncStorage.setItem('lists', JSON.stringify(mapped));
            if (active) setLists(mapped);
          }
        } catch (error) {
          console.log('Could not load lists:', error);
          if (active) setLists([]);
        }
      }
      loadLists();
      return () => { active = false; };
    }, [userId])
  );

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
    setEditingListId(null);
  }

  async function createList() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setSaveError('');

    try {
      const existingList = editingListId
        ? lists.find((item) => item.id === editingListId)
        : null;

      const updatedList = {
        id: existingList?.id || Date.now().toString(),
        name: name.trim(),
        description: description.trim(),
        privacy,
        albums: selectedItems,
        createdAt: existingList?.createdAt || new Date().toISOString(),
      };

      const updated = existingList
        ? lists.map((item) =>
            item.id === editingListId ? updatedList : item
          )
        : [updatedList, ...lists];

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (user) {
        const listData = {
          id: String(updatedList.id),
          name: updatedList.name,
          description: updatedList.description,
          privacy: updatedList.privacy,
          itemCount: updatedList.albums.length,
          albums: updatedList.albums,
          type: 'list',
          createdAt: updatedList.createdAt,
        };

        const { data: cloudList, error: cloudListError } = await supabase
          .from('music_lists')
          .upsert({
            id: String(updatedList.id), user_id: user.id,
            name: updatedList.name, description: updatedList.description,
            privacy: updatedList.privacy, items: updatedList.albums,
            created_at: updatedList.createdAt, updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })
          .select('share_token')
          .single();
        if (cloudListError) throw cloudListError;
        (updatedList as any).shareToken = cloudList?.share_token;

        if (updatedList.privacy === 'public') {
          const { error: profileSyncError } = await supabase
            .from('public_profile_items')
            .upsert({
              user_id: user.id,
              section: 'lists',
              item_key: String(updatedList.id),
              data: listData,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,section,item_key' });
          if (profileSyncError) throw profileSyncError;

          const { data: existingActivity, error: activityLookupError } = await supabase
            .from('user_activity')
            .select('id')
            .eq('user_id', user.id)
            .eq('activity_type', 'created_list')
            .eq('item_key', String(updatedList.id))
            .order('created_at', { ascending: false })
            .limit(1);
          if (activityLookupError) throw activityLookupError;

          if (existingActivity?.[0]?.id) {
            const { error: activityUpdateError } = await supabase
              .from('user_activity')
              .update({ data: listData, created_at: new Date().toISOString() })
              .eq('id', existingActivity[0].id);
            if (activityUpdateError) throw activityUpdateError;
          } else {
            await recordActivity('created_list', String(updatedList.id), listData);
          }
        } else {
          const [{ error: profileDeleteError }, { error: activityDeleteError }] = await Promise.all([
            supabase.from('public_profile_items').delete()
              .eq('user_id', user.id).eq('section', 'lists').eq('item_key', String(updatedList.id)),
            supabase.from('user_activity').delete()
              .eq('user_id', user.id).eq('activity_type', 'created_list').eq('item_key', String(updatedList.id)),
          ]);
          if (profileDeleteError) throw profileDeleteError;
          if (activityDeleteError) throw activityDeleteError;
        }
      }

      // Commit the local list only after the cloud privacy/publication changes succeed.
      await AsyncStorage.setItem('lists', JSON.stringify(updated));
      setLists(updated);

      if (existingList) setSelectedList(updatedList);
      handleCancel();
    } catch (error) {
      console.error('List save failed:', error);
      setSaveError('Could not save this list. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  function editSelectedList() {
    if (!selectedList) return;
    setEditingListId(selectedList.id);
    setName(selectedList.name || '');
    setDescription(selectedList.description || '');
    setPrivacy(selectedList.privacy || 'public');
    setSelectedItems(selectedList.albums || []);
    setShowListMenu(false);
    setShowListDetail(false);
    setTimeout(() => setShowCreate(true), 300);
  }

  function deleteSelectedList() {
    if (!selectedList) return;
    Alert.alert('Delete List', `Delete "${selectedList.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = lists.filter((item) => item.id !== selectedList.id);

          try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (user) {
              const [{ error: cloudDeleteError }, { error: profileDeleteError }, { error: activityDeleteError }] = await Promise.all([
                supabase.from('music_lists').delete().eq('user_id', user.id).eq('id', String(selectedList.id)),
                supabase.from('public_profile_items').delete()
                  .eq('user_id', user.id).eq('section', 'lists').eq('item_key', String(selectedList.id)),
                supabase.from('user_activity').delete()
                  .eq('user_id', user.id).eq('activity_type', 'created_list').eq('item_key', String(selectedList.id)),
              ]);
              if (cloudDeleteError) throw cloudDeleteError;
              if (profileDeleteError) throw profileDeleteError;
              if (activityDeleteError) throw activityDeleteError;
            }

            await AsyncStorage.setItem('lists', JSON.stringify(updated));
            setLists(updated);
            setShowListMenu(false);
            setShowListDetail(false);
            setSelectedList(null);
          } catch (syncError) {
            console.error('List deletion failed:', syncError);
            Alert.alert('Could not delete list', 'The list was kept on this device because its cloud copy could not be removed. Please try again.');
          }
        },
      },
    ]);
  }

  async function shareSelectedList() {
    if (!selectedList) return;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Please sign in again.');

      let deepLink = `myapp://list/${encodeURIComponent(String(selectedList.id))}`;
      if (selectedList.privacy === 'link') {
        const { data, error } = await supabase
          .from('music_lists').select('share_token')
          .eq('id', String(selectedList.id)).eq('user_id', authData.user.id).single();
        if (error) throw error;
        deepLink += `?token=${encodeURIComponent(data.share_token)}`;
      }

      if (selectedList.privacy === 'private') {
        Alert.alert('Private list', 'This list is private and cannot be shared.');
      } else {
        await Share.share({
          title: selectedList.name,
          message: `${selectedList.name}\\n${selectedList.description || ''}\\n${deepLink}`,
        });
      }
    } catch (error) {
      console.error('Could not share list:', error);
      Alert.alert('Could not share list', 'Please try again.');
    } finally {
      setShowListMenu(false);
    }
  }
  function privacyLabel() {
    if (privacy === 'public') return 'Anyone (public list)';
    if (privacy === 'link') return 'Anyone with share link';
    if (privacy === 'friends') return 'Friends (mutual follows)';
    return 'You (private list)';
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
          <Text style={styles.back}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lists</Text>
        {!isOtherProfile && <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Text style={[styles.plus, { color: accentColor }]}>+</Text>
        </TouchableOpacity>}
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
              <Text style={styles.arrow}>{'\u203A'}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showCreate && !isOtherProfile} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={handleCancel} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTopBar}>
              <TouchableOpacity onPress={handleCancel}>
                <Text style={styles.cancelBtn}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>{editingListId ? 'Edit List' : 'New List'}</Text>
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
                      <Text style={styles.albumChipType}>{a.type === 'track' ? 'ðŸŽµ Track' : 'ðŸ’¿ Album'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeSelectedItem(a.id)}>
                      <Text style={styles.albumChipRemove}>âœ•</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.label}>Visible to</Text>
            <TouchableOpacity style={styles.privacyRow} onPress={showPrivacySheet}>
              <Text style={styles.privacyLabel}>{privacyLabel()}</Text>
              <Text style={styles.privacyChevron}>{'\u203A'}</Text>
            </TouchableOpacity>
            <Text style={styles.privacyHint}>Public lists are visible to everyone. Friends lists are visible to mutual follows; link lists require their private link.</Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showSearch && !isOtherProfile} transparent animationType="slide">
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
                <Text style={[styles.toggleText, searchType === 'album' && styles.toggleTextActive]}>ðŸ’¿ Albums</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleBtn, searchType === 'track' && styles.toggleActive]} onPress={() => switchSearchType('track')}>
                <Text style={[styles.toggleText, searchType === 'track' && styles.toggleTextActive]}>ðŸŽµ Tracks</Text>
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
                    <Text style={isSelected ? styles.resultCheckActive : styles.resultCheck}>{isSelected ? 'âœ“' : '+'}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPrivacyOptions && !isOtherProfile} transparent animationType="fade" onRequestClose={() => setShowPrivacyOptions(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowPrivacyOptions(false)} />
        <View style={styles.privacySheet}>
          <Text style={styles.sheetTitle}>List visible to</Text>
          {([
            ['public', 'Anyone (public list)'],
            ['link', 'Anyone with share link'],
            ['friends', 'Friends (mutual follows)'],
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

      <Modal visible={showListDetail} animationType="slide" onRequestClose={() => setShowListDetail(false)}>
        <SafeAreaView style={styles.listPage}>
          <View style={styles.listPageHeader}>
            <TouchableOpacity onPress={() => setShowListDetail(false)}>
              <Text style={styles.listPageBack}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.listPageTitle} numberOfLines={1}>{selectedList?.name}</Text>
            {!isOtherProfile && <TouchableOpacity onPress={() => setShowListMenu(true)} style={styles.menuTrigger}>
              <Text style={styles.menuDots}>...</Text>
            </TouchableOpacity>}
          </View>
          {!!selectedList?.description && <Text style={styles.listPageDescription}>{selectedList.description}</Text>}
          {(selectedList?.albums || []).length === 0 ? (
            <Text style={styles.emptySearch}>This list is empty.</Text>
          ) : (
            <FlatList
              data={selectedList.albums}
              numColumns={3}
              keyExtractor={(item, index) => `${item.type || 'album'}-${item.id}-${index}`}
              contentContainerStyle={styles.listPageGrid}
              columnWrapperStyle={styles.listPageRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listPageItem}
                  onPress={() => openListItem(item)}
                >
                  {item.cover ? <Image source={{ uri: item.cover }} style={styles.listPageCover} /> : <View style={[styles.listPageCover, { backgroundColor: '#333' }]} />}
                  <Text style={styles.listPageItemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.listPageItemArtist} numberOfLines={1}>{item.artist || (item.type === 'track' ? 'Track' : 'Album')}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>      <Modal visible={listCarousel} transparent animationType="slide" onRequestClose={() => setListCarousel(false)}>
        <View style={styles.carouselOverlay}>
          <View style={styles.carouselHeader}>
            <Text style={styles.sheetTitle}>{selectedList?.name}</Text>
            <TouchableOpacity onPress={() => setListCarousel(false)}>
              <Text style={styles.cancelBtn}>Done</Text>
            </TouchableOpacity>
          </View>
          {(selectedList?.albums || []).length === 0 ? (
            <Text style={styles.emptySearch}>This list is empty.</Text>
          ) : (
            <FlatList
              horizontal
              data={selectedList.albums}
              keyExtractor={(item, index) => `${item.type || 'album'}-${item.id}-${index}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.carouselCard} onPress={() => { setListCarousel(false); openListItem(item); }}>
                  {item.cover ? <Image source={{ uri: item.cover }} style={styles.carouselCover} /> : <View style={[styles.carouselCover, { backgroundColor: '#333' }]} />}
                  <Text style={styles.carouselName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.carouselArtist} numberOfLines={1}>{item.artist || (item.type === 'track' ? 'Track' : 'Album')}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
      <Modal visible={showListMenu && !isOtherProfile} transparent animationType="fade" onRequestClose={() => setShowListMenu(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowListMenu(false)} />
        <View style={styles.listMenuSheet}>
          <TouchableOpacity style={styles.listMenuOption} onPress={deleteSelectedList}>
            <Text style={styles.listMenuDanger}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listMenuOption} onPress={editSelectedList}>
            <Text style={styles.listMenuOptionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listMenuOption} onPress={() => { setShowListMenu(false); setListCarousel(true); }}>
            <Text style={styles.listMenuOptionText}>View in Carousel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listMenuOption} onPress={shareSelectedList}>
            <Text style={styles.listMenuOptionText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.listMenuDone} onPress={() => setShowListMenu(false)}>
            <Text style={styles.listMenuOptionText}>Done</Text>
          </TouchableOpacity>
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
  menuTrigger: { width: 44, alignItems: 'flex-end', justifyContent: 'center' },
  menuDots: { color: '#fff', fontSize: 22, letterSpacing: 2 },
  listMenuSheet: { position: 'absolute', top: 105, right: 20, width: 220, backgroundColor: '#242424', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 6 },
  listMenuOption: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#383838' },
  listMenuOptionText: { color: '#fff', fontSize: 15 },
  listMenuDanger: { color: '#ff6b6b', fontSize: 15 },
  listMenuDone: { paddingVertical: 15, alignItems: 'center' },
  carouselOverlay: { flex: 1, backgroundColor: '#141414', paddingTop: 60 },
  carouselHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  carouselContent: { alignItems: 'center', paddingHorizontal: 24, gap: 18 },
  carouselCard: { width: 260, justifyContent: 'center' },
  carouselCover: { width: 260, height: 260, borderRadius: 12, marginBottom: 18 },
  carouselName: { color: '#fff', fontSize: 19, fontWeight: '700' },
  carouselArtist: { color: '#888', fontSize: 15, marginTop: 8 },
  listPage: { flex: 1, backgroundColor: '#0a0a0a' },
  listPageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  listPageBack: { color: '#fff', fontSize: 15, width: 44 },
  listPageTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  listPageDescription: { color: '#888', fontSize: 13, paddingHorizontal: 20, marginBottom: 6 },
  listPageMeta: { color: '#666', fontSize: 12, paddingHorizontal: 20, marginBottom: 12 },
  listPageGrid: { padding: 12, gap: 12 },
  listPageRow: { justifyContent: 'flex-start', gap: 8 },
  listPageItem: { width: '31.5%', marginBottom: 8 },
  listPageCover: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  listPageItemName: { color: '#fff', fontSize: 12, marginTop: 4 },
  listPageItemArtist: { color: '#888', fontSize: 11, marginTop: 2 },
  detailSheet: { maxHeight: '85%' },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  resultImg: { width: 44, height: 44, borderRadius: 6, marginRight: 12 },
  resultName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resultArtist: { color: '#888', fontSize: 13, marginTop: 2 },
  resultCheck: { color: '#555', fontSize: 22, paddingHorizontal: 8 },
  resultCheckActive: { color: '#1DB954', fontSize: 20, fontWeight: 'bold', paddingHorizontal: 8 },
});













