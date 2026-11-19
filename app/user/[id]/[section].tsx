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

type ProfileItem = {
  id: string;
  section: string;
  item_key: string;
  data: any;
  updated_at: string;
};

const sectionTitles: Record<string, string> = {
  songs: 'SONGS',
  diary: 'DIARY',
  lists: 'LISTS',
  wanttolisten: 'WANT TO LISTEN',
  likes: 'LIKES',
  artists: 'ARTISTS',
  activity: 'RECENT ACTIVITY',
};

function itemTitle(item: any): string {
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

function itemSubtitle(item: any): string {
  return (
    item?.artist ||
    item?.artist_name ||
    item?.artists ||
    item?.description ||
    item?.review ||
    ''
  );
}

function itemCover(item: any): string | null {
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

export default function UserCategoryScreen() {
  const { id, section } = useLocalSearchParams<{
    id: string;
    section: string;
  }>();

  const router = useRouter();

  const [items, setItems] = useState<ProfileItem[]>([]);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const title = sectionTitles[section] || 'CATEGORY';

  useEffect(() => {
    let active = true;

    async function loadItems() {
      if (!id || !section || !sectionTitles[section]) {
        setError('Category not found.');
        setLoading(false);
        return;
      }

      try {
        const itemsPromise = section === 'activity'
          ? supabase
              .from('public_profile_items')
              .select('id, section, item_key, data, updated_at')
              .eq('user_id', id)
              .order('updated_at', { ascending: false })
          : supabase
              .from('public_profile_items')
              .select('id, section, item_key, data, updated_at')
              .eq('user_id', id)
              .eq('section', section)
              .order('updated_at', { ascending: false });

        const [itemsResult, profileResult] = await Promise.all([
          itemsPromise,

          supabase
            .from('users')
            .select('username')
            .eq('id', id)
            .maybeSingle(),
        ]);

        if (itemsResult.error) throw itemsResult.error;
        if (profileResult.error) throw profileResult.error;

        if (active) {
          const visibleItems = (itemsResult.data || []).filter(
            (item: ProfileItem) => section !== 'lists' || item.data?.privacy === 'public'
          );
          setItems(visibleItems);
          setUsername(profileResult.data?.username || 'User');
        }
      } catch (err) {
        console.log('Could not load category:', err);

        if (active) {
          setError('Could not load this category.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadItems();

    return () => {
      active = false;
    };
  }, [id, section]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.topTitle}>{title}</Text>

        <View style={{ width: 28 }} />
      </View>

      <Text style={styles.username}>@{username}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : error ? (
        <Text style={styles.emptyText}>{error}</Text>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {items.length > 0 ? (
            <View style={styles.grid}>
              {items.map((entry) => {
              const item = entry.data || {};
              const cover = itemCover(item);
              const subtitle = itemSubtitle(item);

              return (
                <View key={entry.id} style={styles.itemCard}>
                  {cover ? (
                    <Image
                      source={{ uri: cover }}
                      style={styles.itemImage}
                    />
                  ) : (
                    <View style={styles.itemImage} />
                  )}

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {itemTitle(item)}
                    </Text>

                    {!!subtitle && (
                      <Text
                        style={styles.itemSubtitle}
                        numberOfLines={2}
                      >
                        {String(subtitle)}
                      </Text>
                    )}

                    {item.rating != null && (
                      <Text style={styles.itemMeta}>
                        Rating: {item.rating}
                      </Text>
                    )}
                  </View>
                </View>
              );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Nothing here yet
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 12,
    backgroundColor: '#000000',
  },
  backButton: {
    width: 28,
  },
  back: {
    color: '#fff',
    fontSize: 30,
  },
  topTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  username: {
    color: '#888',
    fontSize: 13,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCard: {
    width: '23.5%',
    marginBottom: 22,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 5,
    backgroundColor: '#222',
  },
  itemInfo: {
    flex: 1,
    marginTop: 9,
  },
  itemCategory: {
    color: '#777',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },  itemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  itemSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  itemMeta: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 5,
  },
  emptyText: {
    color: '#777',
    fontSize: 13,
    textAlign: 'center',
    padding: 30,
  },
});