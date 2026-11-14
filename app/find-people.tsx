
import { useAppTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';


type Person = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

export default function FindPeople() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadFollowing() {
        try {
          const id = await AsyncStorage.getItem('supabase_user_id');
          if (!active) return;

          setMyId(id);

          if (!id) {
            setError('Please sign in again to find people.');
            return;
          }

          const { data, error: followError } = await supabase
            .from('friendships')
            .select('friend_id')
            .eq('user_id', id);

          if (followError) throw followError;

          if (active) {
            setFollowingIds(
              new Set((data || []).map(row => row.friend_id).filter(Boolean))
            );
            setError('');
          }
        } catch (e) {
          console.log('Could not load friendships:', e);
          if (active) setError('Could not load your follows.');
        }
      }

      loadFollowing();

      return () => {
        active = false;
      };
    }, [])
  );

  async function search(text: string) {
    setQuery(text);
    const currentRequest = ++requestId.current;

    if (text.trim().length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: searchError } = await supabase
        .from('users')
        .select('id, username, avatar_url')
        .ilike('username', `%${text.trim()}%`)
        .neq('id', myId || '')
        .order('username')
        .limit(30);

      if (searchError) throw searchError;

      if (currentRequest === requestId.current) {
        setResults(data || []);
      }
    } catch (e) {
      console.log('People search error:', e);
      if (currentRequest === requestId.current) {
        setResults([]);
        setError('Could not search people. Check your Supabase users table.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  async function toggleFollow(targetId: string) {
    if (!myId) {
      setError('Please sign in again.');
      return;
    }

    const isFollowing = followingIds.has(targetId);

    setPendingIds(previous => new Set(previous).add(targetId));
    setError('');

    try {
      if (isFollowing) {
        const { error: deleteError } = await supabase
          .from('friendships')
          .delete()
          .eq('user_id', myId)
          .eq('friend_id', targetId);

        if (deleteError) throw deleteError;

        setFollowingIds(previous => {
          const next = new Set(previous);
          next.delete(targetId);
          return next;
        });
      } else {
        const { error: insertError } = await supabase
          .from('friendships')
          .insert({ user_id: myId, friend_id: targetId });

        if (insertError) throw insertError;

        setFollowingIds(previous => new Set(previous).add(targetId));
      }
    } catch (e) {
      console.log('Follow update error:', e);
      setError(
        'Could not update follow. Check the friendships table permissions.'
      );
    } finally {
      setPendingIds(previous => {
        const next = new Set(previous);
        next.delete(targetId);
        return next;
      });
    }
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Find People</Text>
        <View style={{ width: 24 }} />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Search username..."
        placeholderTextColor="#888"
        value={query}
        onChangeText={search}
        autoCapitalize="none"
        accessibilityLabel="Search usernames"
      />

      {loading && (
        <ActivityIndicator color={accentColor} style={{ marginTop: 20 }} />
      )}

      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.empty}>
              {query.trim().length >= 2
                ? 'No people found.'
                : 'Search for listeners by username.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}

            <Text style={styles.username}>
              {item.username || 'Spotify listener'}
            </Text>

            <TouchableOpacity
              style={[
                styles.followBtn,
                followingIds.has(item.id) && styles.followingBtn,
              ]}
              onPress={() => toggleFollow(item.id)}
              disabled={pendingIds.has(item.id)}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.followBtnText,
                  followingIds.has(item.id) && styles.followingText,
                ]}
              >
                {pendingIds.has(item.id)
                  ? '...'
                  : followingIds.has(item.id)
                    ? 'Following'
                    : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
  },
  back: { color: 'white', fontSize: 32 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    marginRight: 12,
  },
  username: { flex: 1, color: '#fff', fontSize: 15 },
  followBtn: {
    backgroundColor: '#1DB954',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  followingBtn: { backgroundColor: '#2a2a2a' },
  followBtnText: { fontSize: 13, fontWeight: '600', color: '#000' },
  followingText: { color: '#aaa' },
  error: {
    color: '#ff8b8b',
    fontSize: 13,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
});

