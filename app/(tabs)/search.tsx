
import { useAppTheme } from '@/context/ThemeContext';
import { shareMusicItem } from '@/utils/sharing';
import { recordActivity } from '@/utils/activity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
  const [recentPeople, setRecentPeople] = useState<any[]>([]);
  const [tab, setTab] = useState<'music' | 'people'>('music');
  const [peopleResults, setPeopleResults] = useState<any[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [lists, setLists] = useState<any[]>([]);
  const [showListPicker, setShowListPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [feedback, setFeedback] = useState('');
  const requestId = useRef(0);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRecent();
    loadRecentPeople();
  }, []);

  useEffect(() => {
    if (!feedback) return;

    const timer = setTimeout(() => setFeedback(''), 2400);

    return () => clearTimeout(timer);
  }, [feedback]);

  async function loadRecent() {
    const data = await AsyncStorage.getItem('recent_searches');

    if (data) {
      try {
        setRecentSearches(JSON.parse(data));
      } catch {
        setRecentSearches([]);
      }
    }
  }

  async function saveRecent(item: any) {
    const data = await AsyncStorage.getItem('recent_searches');

    let recent = data ? JSON.parse(data) : [];

    recent = recent.filter((r: any) => r.id !== item.id);
    recent.unshift(item);
    recent = recent.slice(0, RECENT_LIMIT);

    await AsyncStorage.setItem(
      'recent_searches',
      JSON.stringify(recent)
    );

    setRecentSearches(recent);
  }

  async function removeRecent(id: string) {
    const updated = recentSearches.filter(
      (r: any) => r.id !== id
    );

    setRecentSearches(updated);

    await AsyncStorage.setItem(
      'recent_searches',
      JSON.stringify(updated)
    );
  }

  async function clearAllRecent() {
    setRecentSearches([]);
    await AsyncStorage.removeItem('recent_searches');
  }

  async function loadRecentPeople() {
    const data = await AsyncStorage.getItem('recent_people');
    if (data) {
      try {
        setRecentPeople(JSON.parse(data));
      } catch {
        setRecentPeople([]);
      }
    }
  }

  async function saveRecentPerson(person: any) {
    const data = await AsyncStorage.getItem('recent_people');
    let recent = data ? JSON.parse(data) : [];
    recent = recent.filter((item: any) => item.id !== person.id);
    recent.unshift(person);
    recent = recent.slice(0, RECENT_LIMIT);
    await AsyncStorage.setItem('recent_people', JSON.stringify(recent));
    setRecentPeople(recent);
  }

  async function removeRecentPerson(id: string) {
    const updated = recentPeople.filter((person: any) => person.id !== id);
    setRecentPeople(updated);
    await AsyncStorage.setItem('recent_people', JSON.stringify(updated));
  }

  async function clearAllRecentPeople() {
    setRecentPeople([]);
    await AsyncStorage.removeItem('recent_people');
  }

  async function pickAlbum(album: any) {
    const data = await AsyncStorage.getItem('profile');
    const profile = data ? JSON.parse(data) : {};

    const albums = [
      ...(profile.favoriteAlbums || [null, null, null, null]),
    ];

    albums[Number(index)] = {
      id: album.id,
      title: album.name,
      cover: album.images?.[0]?.url,
    };

    await AsyncStorage.setItem(
      'pendingFavoriteAlbums',
      JSON.stringify(albums)
    );

    await AsyncStorage.setItem('returnToSettings', '1');

    router.back();
  }

  // Search Spotify catalog through Supabase Edge Function.
  // No user's Spotify account connection is required.
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

    try {
      const { data, error } = await supabase.functions.invoke(
        'spotify-search',
        {
          body: {
            query: text.trim(),
            type: isPickMode
              ? 'album'
              : 'track,album,artist',
          },
        }
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (currentRequest !== requestId.current) return;

      if (isPickMode) {
        setResults(
          (data.albums?.items || []).map((item: any) => ({
            ...item,
            _type: 'album',
          }))
        );
      } else {
        const artists = (data.artists?.items || []).map(
          (item: any) => ({
            ...item,
            _type: 'artist',
          })
        );

        const albums = (data.albums?.items || []).map(
          (item: any) => ({
            ...item,
            _type: 'album',
          })
        );

        const tracks = (data.tracks?.items || []).map(
          (item: any) => ({
            ...item,
            _type: 'track',
          })
        );

        const normalizedQuery = text.trim().toLocaleLowerCase();

        const getMatchScore = (item: any) => {
          const name = String(item.name || '').toLocaleLowerCase();

          if (item._type === 'track') {
            if (name === normalizedQuery) return 120;
            if (name.startsWith(normalizedQuery)) return 95;
            if (name.includes(normalizedQuery)) return 75;
            return 0;
          }

          if (item._type === 'artist') {
            if (name === normalizedQuery) return 115;
            if (name.startsWith(normalizedQuery)) return 90;
            if (name.includes(normalizedQuery)) return 70;
            return 0;
          }

          if (item._type === 'album') {
            if (name === normalizedQuery) return 110;
            if (name.startsWith(normalizedQuery)) return 85;
            if (name.includes(normalizedQuery)) return 65;
            return 0;
          }

          return 0;
        };

        const combinedResults = [...tracks, ...albums, ...artists];
        combinedResults.sort(
          (a, b) => getMatchScore(b) - getMatchScore(a)
        );
        setResults(combinedResults);
      }
    } catch (error) {
      console.log('Spotify search error:', error);

      if (currentRequest === requestId.current) {
        setResults([]);
        setSearchError(
          'Could not search music. Please try again.'
        );
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  };

  // Search users in Supabase
  async function searchPeople(text: string) {
    setQuery(text);

    const currentRequest = ++requestId.current;

    if (text.trim().length < 2) {
      setPeopleResults([]);
      setFollowingIds(new Set());
      setSearchError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setSearchError('');

    try {
      const myId = await AsyncStorage.getItem('supabase_user_id');

      if (!myId) {
        throw new Error(
          'User account not found. Please sign in again.'
        );
      }

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .ilike('username', `%${text.trim()}%`)
        .neq('id', myId)
        .limit(30);

      if (usersError) throw usersError;

      if (currentRequest !== requestId.current) return;

      const people = (users || []).map((user) => ({
        id: user.id,
        username: user.username || 'User',
        avatar: user.avatar_url || null,
      }));

      setPeopleResults(people);

      if (people.length === 0) {
        setFollowingIds(new Set());
        return;
      }

      const { data: friendships, error: friendshipsError } =
        await supabase
          .from('friendships')
          .select('friend_id')
          .eq('user_id', myId);

      if (friendshipsError) throw friendshipsError;

      if (currentRequest !== requestId.current) return;

      setFollowingIds(
        new Set(
          (friendships || []).map(
            (friendship) => friendship.friend_id
          )
        )
      );
    } catch (error) {
      console.log('People search error:', error);

      if (currentRequest === requestId.current) {
        setPeopleResults([]);

        setSearchError(
          error instanceof Error
            ? error.message
            : 'Could not search people. Try again later.'
        );
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }

  // Debounce input and clear stale results as soon as the query changes.
  function handleSearchInput(text: string) {
    setQuery(text);
    ++requestId.current;

    if (searchDebounce.current) {
      clearTimeout(searchDebounce.current);
      searchDebounce.current = null;
    }

    if (text.trim().length < 2) {
      setResults([]);
      setPeopleResults([]);
      setSearchError('');
      setLoading(false);
      return;
    }

    if (tab === 'people' && !isPickMode) {
      setPeopleResults([]);
    } else {
      setResults([]);
    }

    setSearchError('');
    setLoading(true);

    searchDebounce.current = setTimeout(() => {
      searchDebounce.current = null;
      if (tab === 'people' && !isPickMode) {
        searchPeople(text);
      } else {
        searchSpotify(text);
      }
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
      ++requestId.current;
    };
  }, []);

  // Follow or unfollow a user in Supabase
  async function toggleFollow(userId: string) {
    const myId = await AsyncStorage.getItem('supabase_user_id');

    if (!myId) {
      setSearchError(
        'Please sign in again to add friends.'
      );
      return;
    }

    if (myId === userId) {
      setSearchError("You can't add yourself.");
      return;
    }

    const isFollowing = followingIds.has(userId);

    try {
      setSearchError('');

      if (isFollowing) {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('user_id', myId)
          .eq('friend_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('friendships')
          .insert({
            user_id: myId,
            friend_id: userId,
          });

        if (error) throw error;
      }

      setFollowingIds((previous) => {
        const next = new Set(previous);

        if (isFollowing) {
          next.delete(userId);
        } else {
          next.add(userId);
        }

        return next;
      });
    } catch (error) {
      console.log('Friendship update error:', error);

      setSearchError(
        error instanceof Error
          ? error.message
          : 'Could not update friendship. Please try again.'
      );
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
    await saveRecent({
      ...item,
      _type: item._type,
    });

    if (item._type === 'artist') {
      router.push(`/artist/${item.id}`);
    } else if (item._type === 'album') {
      router.push(`/album/${item.id}` as any);
    } else if (item.album?.id) {
      router.push({
        pathname: '/album/[id]',
        params: {
          id: item.album.id,
          highlightTrackId: item.id,
        },
      } as any);
    }
  }

  async function performTrackAction(action: string) {
    if (!selected) return;

    setMenuVisible(false);

    if (action === 'Go to Album') {
      await openMusicItem(
        selected.album
          ? { ...selected.album, _type: 'album' }
          : selected
      );
      return;
    }

    if (action === 'Go to Artist') {
      const artist = selected.artists?.[0];

      if (artist) {
        router.push(`/artist/${artist.id}`);
      }

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

      setFeedback(
        'Added to Shared and opened sharing options.'
      );

      return;
    }

    if (action === 'Add to Liked Songs') {
      const data = await AsyncStorage.getItem('liked');
      const liked = data ? JSON.parse(data) : [];

      if (
        !liked.some(
          (item: any) =>
            item.id === selected.id &&
            item.type === 'track'
        )
      ) {
        liked.unshift({
          id: selected.id,
          name: selected.name,
          artist: selected.artists?.[0]?.name,
          cover: selected.album?.images?.[0]?.url,
          albumId: selected.album?.id,
          type: 'track',
        });

        await AsyncStorage.setItem(
          'liked',
          JSON.stringify(liked)
        );

        await recordActivity('liked', String(selected.id), {
          id: String(selected.id),
          name: selected.name,
          artist: selected.artists?.map((artist: any) => artist.name).join(', ') || '',
          cover: selected.album?.images?.[0]?.url,
          albumId: selected.album?.id || null,
          type: 'track',
        });
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

    const listIndex = currentLists.findIndex(
      (list: any) => list.id === listId
    );

    if (listIndex < 0 || !selected) return;

    const items = currentLists[listIndex].albums || [];

    const exists = items.some(
      (item: any) =>
        item.id === selected.id &&
        item.type === 'track'
    );

    if (!exists) {
      currentLists[listIndex] = {
        ...currentLists[listIndex],
        albums: [
          {
            id: selected.id,
            type: 'track',
            name: selected.name,
            artist: selected.artists?.[0]?.name,
            cover: selected.album?.images?.[0]?.url,
            albumId: selected.album?.id,
          },
          ...items,
        ],
      };

      await AsyncStorage.setItem(
        'lists',
        JSON.stringify(currentLists)
      );
    }

    // Always retry cloud sync, even if this track was already in the local list.
    const updatedList = currentLists[listIndex];
    let cloudSyncFailed = false;

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (!user) {
        cloudSyncFailed = updatedList.privacy === 'public';
      } else {
        const itemKey = String(updatedList.id);

        if (updatedList.privacy === 'public') {
          const { error } = await supabase
            .from('public_profile_items')
            .upsert({
              user_id: user.id,
              section: 'lists',
              item_key: itemKey,
              data: {
                id: itemKey,
                name: updatedList.name,
                description: updatedList.description || '',
                privacy: updatedList.privacy,
                itemCount: updatedList.albums.length,
                albums: updatedList.albums,
                type: 'list',
                createdAt: updatedList.createdAt,
              },
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,section,item_key' });

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('public_profile_items')
            .delete()
            .eq('user_id', user.id)
            .eq('section', 'lists')
            .eq('item_key', itemKey);

          if (error) throw error;
        }
      }
    } catch (error) {
      cloudSyncFailed = true;
      console.error('Search list cloud sync failed:', error);
    }

    setLists(currentLists);
    setShowListPicker(false);

    if (cloudSyncFailed) {
      setFeedback('Added on this device, but cloud sync failed. Please try again.');
    } else {
      setFeedback(
        `Added to ${currentLists[listIndex].name}.`
      );
    }
  }

  const openMenu = (item: any) => {
    setSelected(item);
    setMenuVisible(true);
  };

  function renderItem({ item }: any) {
    if (isPickMode) {
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => pickAlbum(item)}
        >
          <Image
            source={{ uri: item.images?.[0]?.url }}
            style={styles.albumArt}
          />

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {item.name}
            </Text>

            <Text style={styles.artist} numberOfLines={1}>
              {item.artists?.[0]?.name}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => openMusicItem(item)}
        accessibilityRole="button"
      >
        <Image
          source={{ uri: getItemCover(item) }}
          style={
            item._type === 'artist'
              ? { ...styles.albumArt, borderRadius: 25 }
              : styles.albumArt
          }
        />

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.name}
          </Text>

          <Text style={styles.artist} numberOfLines={1}>
            {item._type === 'artist'
              ? 'Artist'
              : item._type === 'album'
                ? 'Album'
                : item.artists?.[0]?.name}
          </Text>
        </View>

        {item._type === 'track' && (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              openMenu(item);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${item.name}`}
            hitSlop={8}
          >
            <Text style={styles.dots}>...</Text>
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
          style={
            item._type === 'artist'
              ? { ...styles.albumArt, borderRadius: 25 }
              : styles.albumArt
          }
        />

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.name}
          </Text>

          <Text style={styles.artist} numberOfLines={1}>
            {item._type === 'artist'
              ? 'Artist'
              : item._type === 'album'
                ? 'Album'
                : item.artists?.[0]?.name}
          </Text>
        </View>

        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            removeRecent(item.id);
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name} from recent searches`}
        >
          <Text style={styles.dots}>x</Text>
        </Pressable>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {isPickMode ? (
        <View style={styles.pickHeader}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.backBtn}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.header}>Choose Album</Text>
        </View>
      ) : (
        <Text style={styles.header}>Search</Text>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={
            isPickMode
              ? 'Search albums...'
              : tab === 'people'
                ? 'Search people...'
                : 'Search songs, albums, artists...'
          }
          placeholderTextColor="#555"
          value={query}
          onChangeText={handleSearchInput}
          autoFocus={isPickMode}
        />

        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              ++requestId.current;
              if (searchDebounce.current) {
                clearTimeout(searchDebounce.current);
                searchDebounce.current = null;
              }
              setQuery('');
              setResults([]);
              setPeopleResults([]);
              setSearchError('');
              setLoading(false);
            }}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearX}>x</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <ActivityIndicator
          color="#1DB954"
          style={{ marginBottom: 12 }}
        />
      )}

      {!!searchError && (
        <Text
          accessibilityRole="alert"
          style={styles.searchError}
        >
          {searchError}
        </Text>
      )}

      {!!feedback && (
        <Text
          accessibilityLiveRegion="polite"
          style={styles.feedback}
        >
          {feedback}
        </Text>
      )}

      {!isPickMode && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tab,
              tab === 'music' && styles.tabActive,
              tab === 'music' && {
                borderBottomColor: accentColor,
              },
            ]}
            onPress={() => {
              if (searchDebounce.current) {
                clearTimeout(searchDebounce.current);
                searchDebounce.current = null;
              }
              ++requestId.current;
              setTab('music');

              if (query.trim().length >= 2) {
                searchSpotify(query);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{
              selected: tab === 'music',
            }}
          >
            <Text
              style={[
                styles.tabText,
                tab === 'music' && styles.tabTextActive,
              ]}
            >
              Music
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              tab === 'people' && styles.tabActive,
              tab === 'people' && {
                borderBottomColor: accentColor,
              },
            ]}
            onPress={() => {
              if (searchDebounce.current) {
                clearTimeout(searchDebounce.current);
                searchDebounce.current = null;
              }
              ++requestId.current;
              setTab('people');

              if (query.trim().length >= 2) {
                searchPeople(query);
              } else {
                setPeopleResults([]);
                setSearchError('');
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{
              selected: tab === 'people',
            }}
          >
            <Text
              style={[
                styles.tabText,
                tab === 'people' && styles.tabTextActive,
              ]}
            >
              People
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {tab === 'people' && !isPickMode ? (
        <FlatList
          data={query.trim().length < 2 ? recentPeople : peopleResults}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim().length >= 2 && !loading
                ? 'No people found.'
                : recentPeople.length > 0
                  ? 'Your recent people will appear here.'
                  : 'Search for people you know.'}
            </Text>
          }
          ListFooterComponent={
            query.trim().length < 2 && recentPeople.length > 0 ? (
              <TouchableOpacity
                onPress={clearAllRecentPeople}
                style={styles.clearAllBtn}
              >
                <Text style={styles.clearAllText}>Clear recent people</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                onPress={async () => {
                  await saveRecentPerson(item);
                  router.push({
                    pathname: "/user/[id]",
                    params: { id: item.id },
                  });
                }}
              >
              {item.avatar ? (
                <Image
                  source={{ uri: item.avatar }}
                  style={styles.personAvatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {String(
                      item.username || '?'
                    )[0].toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.info}>
                <Text style={styles.title}>
                  {item.username}
                </Text>

                {item.name ? (
                  <Text style={styles.artist}>
                    {item.name}
                  </Text>
                ) : null}
              </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.followButton,
                  followingIds.has(item.id) &&
                    styles.followingButton,
                ]}
                onPress={() => toggleFollow(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${
                  followingIds.has(item.id)
                    ? 'Unfollow'
                    : 'Follow'
                } ${item.username}`}
              >
                <Text
                  style={[
                    styles.followText,
                    followingIds.has(item.id) &&
                      styles.followingText,
                  ]}
                >
                  {followingIds.has(item.id)
                    ? 'Following'
                    : 'Follow'}
                </Text>
              </TouchableOpacity>
              {query.trim().length < 2 && (
                <TouchableOpacity
                  onPress={() => removeRecentPerson(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.username} from recent people`}
                  style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  <Text style={styles.dots}>x</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      ) : (
        <>
          {query.length < 2 &&
            recentSearches.length > 0 &&
            !isPickMode && (
              <View style={{ flex: 1 }}>
                <View style={styles.recentHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    Recent
                  </Text>
                </View>

                <FlatList
                  data={recentSearches}
                  keyExtractor={(item) => item.id}
                  renderItem={renderRecentItem}
                  ListFooterComponent={
                    <TouchableOpacity
                      onPress={clearAllRecent}
                      style={styles.clearAllBtn}
                    >
                      <Text style={styles.clearAllText}>
                        Clear recent searches
                      </Text>
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
              ListEmptyComponent={
                !loading ? (
                  <Text style={styles.emptyText}>
                    No results found.
                  </Text>
                ) : null
              }
            />
          )}
        </>
      )}

      {!isPickMode && (
        <Modal
          visible={menuVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable
            style={styles.overlay}
            onPress={() => setMenuVisible(false)}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Image
                source={{
                  uri: selected?.album?.images?.[0]?.url,
                }}
                style={styles.sheetImage}
              />

              <View style={{ flex: 1 }}>
                <Text
                  style={styles.sheetTitle}
                  numberOfLines={1}
                >
                  {selected?.name}
                </Text>

                <Text
                  style={styles.sheetArtist}
                  numberOfLines={1}
                >
                  {selected?.artists?.[0]?.name}
                </Text>
              </View>
            </View>

            {[
              { label: 'Share' },
              { label: 'Add to Liked Songs' },
              { label: 'Add to List' },
              { label: 'Go to Album' },
              { label: 'Go to Artist' },
            ].map(({ label }) => (
              <Pressable
                key={label}
                style={styles.action}
                onPress={() => performTrackAction(label)}
                accessibilityRole="button"
              >

                <Text style={styles.actionText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Modal>
      )}

      <Modal
        visible={showListPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowListPicker(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowListPicker(false)}
        />

        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add to List</Text>

            <TouchableOpacity
              onPress={() => setShowListPicker(false)}
              accessibilityRole="button"
              accessibilityLabel="Close list picker"
            >
              <Text style={styles.dots}>x</Text>
            </TouchableOpacity>
          </View>

          {lists.length === 0 ? (
            <View style={styles.noLists}>
              <Text style={styles.emptyText}>
                No lists yet.
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setShowListPicker(false);
                  router.push('/lists' as any);
                }}
              >
                <Text style={styles.createListLink}>
                  Create a list
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            lists.map((list) => (
              <TouchableOpacity
                key={list.id}
                style={styles.action}
                onPress={() =>
                  addSelectedTrackToList(list.id)
                }
                accessibilityRole="button"
              >
                <Text style={styles.actionText}>
                  {list.name}
                </Text>

                <Text style={styles.actionIcon}>&gt;</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
    padding: 20,
    paddingTop: 60,
  },
  pickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backBtn: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 36,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
  },
  clearBtn: {
    backgroundColor: '#444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearX: {
    color: '#fff',
    fontSize: 12,
  },
  cancelBtn: {
    color: '#fff',
    fontSize: 15,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#1DB954',
  },
  tabText: {
    color: '#888',
    fontSize: 15,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 12,
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2a2a2a',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  followButton: {
    backgroundColor: '#1DB954',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  followingButton: {
    backgroundColor: '#2a2a2a',
  },
  followText: {
    color: '#101010',
    fontSize: 12,
    fontWeight: '700',
  },
  followingText: {
    color: '#ccc',
  },
  info: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  artist: {
    color: '#888',
    fontSize: 13,
  },
  dots: {
    color: '#888',
    fontSize: 16,
    paddingHorizontal: 8,
  },
  emptyText: {
    color: '#555',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  searchError: {
    color: '#ff8b8b',
    fontSize: 13,
    marginBottom: 10,
  },
  feedback: {
    color: '#86d79f',
    fontSize: 13,
    marginBottom: 10,
  },
  noLists: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  createListLink: {
    color: '#1DB954',
    fontSize: 15,
    fontWeight: '600',
  },
  clearAllBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  clearAllText: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sheetImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sheetArtist: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 16,
  },
  actionIcon: {
    color: '#fff',
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
  },
});

