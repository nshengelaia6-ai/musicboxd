import { supabase } from '@/utils/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type ActivityItem = {
  id: string;
  activity_type: string;
  item_key: string;
  data: any;
  created_at: string;
};

const labels: Record<string, string> = {
  listened: 'LISTENED TO',
  reviewed: 'REVIEWED',
  liked: 'LIKED',
  wants_to_listen: 'WANTS TO LISTEN',
  created_list: 'CREATED A LIST',
  liked_list: 'LIKED A LIST',
  followed_artist: 'FOLLOWED AN ARTIST',
};

function titleOf(item: any) {
  return (
    item?.name ||
    item?.title ||
    item?.albumName ||
    item?.track_name ||
    item?.item_name ||
    item?.artistName ||
    'Untitled'
  );
}

function subtitleOf(item: any) {
  if (item?.artist || item?.artist_name || item?.artists) {
    return item.artist || item.artist_name || item.artists;
  }

  if (item?.type === 'list' && item?.itemCount != null) {
    return `${item.itemCount} items`;
  }

  return '';
}

function coverOf(item: any): string | null {
  const value =
    item?.cover ||
    item?.cover_url ||
    item?.image ||
    item?.imageUrl ||
    item?.image_url ||
    item?.artwork ||
    item?.albumCover;

  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0]?.url || null;
  return value?.url || null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function UserActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [username, setUsername] = useState('User');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    if (!userId) {
      setError('User not found.');
      setLoading(false);
      return;
    }

    async function loadActivity() {
      try {
        const [itemsResult, userResult] = await Promise.all([
          supabase
            .from('user_activity')
            .select('id, activity_type, item_key, data, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          supabase
            .from('users')
            .select('username')
            .eq('id', userId)
            .maybeSingle(),
        ]);

        if (itemsResult.error) throw itemsResult.error;
        if (userResult.error) throw userResult.error;

        if (active) {
          setItems(itemsResult.data || []);
          setUsername(userResult.data?.username || 'User');
          setError('');
        }
      } catch (err) {
        console.log('Could not load activity:', err);
        if (active) setError('Could not load activity.');
      } finally {
        if (active) setLoading(false);
      }
    }

    const channel = supabase
      .channel(`user-activity-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activity',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!active) return;

          const newItem = payload.new as ActivityItem;

          setItems((current) => {
            if (current.some((item) => item.id === newItem.id)) {
              return current;
            }

            return [newItem, ...current].sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
          });
        }
      )
      .subscribe();

    loadActivity();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>ACTIVITY</Text>
        <View style={{ width: 28 }} />
      </View>

      <Text style={styles.username}>@{username}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : error ? (
        <Text style={styles.empty}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.length === 0 ? (
            <Text style={styles.empty}>No activity yet</Text>
          ) : (
            items.map((entry) => {
              const item = entry.data || {};
              const cover = coverOf(item);
              const comment =
                item.comment ||
                item.review ||
                item.notes ||
                (entry.activity_type === 'created_list' || entry.activity_type === 'liked_list'
                  ? item.description
                  : '');

              return (
                <View key={entry.id} style={styles.card}>
                  <Text style={styles.action}>
                    {labels[entry.activity_type] || 'ACTIVITY'}
                  </Text>

                  <View style={styles.itemRow}>
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.image} />
                    ) : (
                      <View style={styles.image} />
                    )}

                    <View style={styles.details}>
                      <Text style={styles.name}>{titleOf(item)}</Text>

                      {!!subtitleOf(item) && (
                        <Text style={styles.subtitle}>
                          {String(subtitleOf(item))}
                        </Text>
                      )}

                      {item.rating != null && (
                        <Text style={styles.rating}>★ {item.rating}</Text>
                      )}
                    </View>
                  </View>

                  {!!comment && (
                    <Text style={styles.comment}>{String(comment)}</Text>
                  )}

                  <Text style={styles.date}>
                    {formatDate(entry.created_at)}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    height: 54,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: { width: 28 },
  back: { color: '#fff', fontSize: 30 },
  topTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  username: {
    color: '#888',
    fontSize: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  card: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#242424',
  },
  action: {
    color: '#999',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  image: {
    width: 76,
    height: 76,
    borderRadius: 4,
    backgroundColor: '#222',
  },
  details: { flex: 1 },
  name: { color: '#fff', fontSize: 14, fontWeight: '600' },
  subtitle: { color: '#999', fontSize: 12, marginTop: 5 },
  rating: { color: '#ddd', fontSize: 12, marginTop: 7 },
  comment: { color: '#bbb', fontSize: 12, lineHeight: 19, marginTop: 12 },
  date: { color: '#666', fontSize: 10, marginTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#888', textAlign: 'center', padding: 25 },
});
