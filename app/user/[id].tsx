
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

type Album = {
  id?: string;
  name?: string;
  artist?: string;
  cover?: string;
};

type Profile = {
  id: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  favorite_albums: Album[] | null;
};

type ProfileItem = {
  id: string;
  section: string;
  item_key: string;
  data: any;
  updated_at: string;
};

const sections = [
  { key: 'songs', title: 'SONGS' },
  { key: 'diary', title: 'DIARY' },
  { key: 'lists', title: 'LISTS' },
  { key: 'wanttolisten', title: 'WANT TO LISTEN' },
  { key: 'likes', title: 'LIKES' },
  { key: 'artists', title: 'ARTISTS' },
];

function itemTitle(item: any): string {
  return (
    item?.name ||
    item?.title ||
    item?.albumName ||
    item?.track_name ||
    item?.item_name ||
    item?.artistName ||
    item?.username ||
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

function sectionLabel(section: string): string {
  const found = sections.find((s) => s.key === section);

  if (found) return found.title;
  if (section === 'reviews') return 'REVIEW';

  return section.replace(/([A-Z])/g, ' $1').toUpperCase();
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myId, setMyId] = useState('');
  const [following, setFollowing] = useState(false);
  const [profileItems, setProfileItems] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState('');

  // áƒ’áƒáƒ®áƒ¡áƒœáƒ˜áƒšáƒ˜ áƒ™áƒáƒ¢áƒ”áƒ’áƒáƒ áƒ˜áƒ”áƒ‘áƒ˜
useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!id) return;

      setLoading(true);
      setError('');

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;

        const currentId = authData.user?.id || '';

        if (active) setMyId(currentId);

        const { data, error: profileError } = await supabase
          .from('users')
          .select('id, username, bio, avatar_url, favorite_albums')
          .eq('id', id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!data) throw new Error('Profile not found');

        if (active) setProfile(data as Profile);

        const myFollowResult = currentId
          ? await supabase
              .from('friendships')
              .select('friend_id')
              .eq('user_id', currentId)
              .eq('friend_id', id)
              .maybeSingle()
          : { data: null, error: null };

        if (myFollowResult.error) throw myFollowResult.error;

        const { data: items, error: itemsError } = await supabase
          .from('public_profile_items')
          .select('id, section, item_key, data, updated_at')
          .eq('user_id', id)
          .order('updated_at', { ascending: false });

        if (itemsError) throw itemsError;

        if (active) {
          setProfileItems(items || []);
          setFollowing(Boolean(myFollowResult.data));
        }
      } catch (err) {
        console.log('Could not load user profile:', err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load profile.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [id]);

  async function toggleFollow() {
    if (!myId || !id || myId === id || followLoading) return;

    setFollowLoading(true);

    try {
      if (following) {
        const { error: deleteError } = await supabase
          .from('friendships')
          .delete()
          .eq('user_id', myId)
          .eq('friend_id', id);

        if (deleteError) throw deleteError;

        setFollowing(false);
      } else {
        const { error: insertError } = await supabase
          .from('friendships')
          .insert({
            user_id: myId,
            friend_id: id,
          });

        if (insertError) throw insertError;

        setFollowing(true);
      }
    } catch (err) {
      console.log('Could not update follow:', err);
      setError('Could not update follow. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (error && !profile) {
    return (
      <View style={styles.center}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!profile) return null;

  const albums = Array.isArray(profile.favorite_albums)
    ? profile.favorite_albums.filter(
        (album) =>
          album &&
          (album.id || album.cover || album.name)
      )
    : [];

  // áƒ§áƒ•áƒ”áƒšáƒ áƒ¢áƒ˜áƒžáƒ˜áƒ¡ áƒ‘áƒáƒšáƒ áƒáƒ¥áƒ¢áƒ˜áƒ•áƒáƒ‘áƒ
  const recentActivity = profileItems.slice(0, 4);

  function renderItem(entry: ProfileItem, showCategory = false) {
    const item = entry.data || {};
    const cover = itemCover(item);
    const subtitle = itemSubtitle(item);

    return (
      <View key={entry.id} style={styles.itemRow}>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={styles.itemImage}
          />
        ) : (
          <View style={styles.itemImage} />
        )}

        <View style={styles.itemInfo}>
          {showCategory && (
            <Text style={styles.itemCategory}>
              {sectionLabel(entry.section)}
            </Text>
          )}

          <Text style={styles.itemName} numberOfLines={2}>
            {itemTitle(item)}
          </Text>

          {!!subtitle && (
            <Text style={styles.itemSubtitle} numberOfLines={2}>
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
  }
return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* TOP BAR */}

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.topTitle}>PROFILE</Text>

        <View style={{ width: 28 }} />
      </View>

      {/* PROFILE HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtnLeft}
          onPress={() => router.back()}
        >
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>

        {profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatar} />
        )}

        <Text style={styles.username}>
          @{profile.username || 'User'}
        </Text>

        {!!profile.bio && (
          <Text style={styles.bio}>
            {profile.bio}
          </Text>
        )}

        {myId !== id && !!myId && (
          <TouchableOpacity
            style={[
              styles.followButton,
              following && styles.followingButton,
            ]}
            onPress={toggleFollow}
            disabled={followLoading}
          >
            <Text
              style={[
                styles.followText,
                following && styles.followingText,
              ]}
            >
              {followLoading
                ? 'Please wait...'
                : following
                  ? 'Following'
                  : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {/* FAVORITE ALBUMS */}

      {albums.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>
            FAVORITE ALBUMS
          </Text>

          <View style={styles.slotsRow}>
            {albums.slice(0, 4).map((album, index) => (
              <View
                key={album.id || `${album.name || 'album'}-${index}`}
                style={styles.slot}
              >
                {album.cover ? (
                  <Image
                    source={{ uri: album.cover }}
                    style={styles.slotImage}
                  />
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* RECENT ACTIVITY */}

      <View style={styles.activitySection}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle}>RECENT ACTIVITY</Text>

          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/user/[id]/activity',
                params: { id: String(id) },
              } as any)
            }
          >
            <Text style={styles.seeAll}>MORE ACTIVITY ›</Text>
          </TouchableOpacity>
        </View>

        {recentActivity.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activityRow}
          >
            {recentActivity.map((entry) => renderItem(entry, true))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>No recent activity yet</Text>
        )}
      </View>
      {/* PROFILE CATEGORIES */}

      <View style={styles.categoriesGrid}>
        {sections.map((section) => (
          <TouchableOpacity
            key={section.key}
            style={styles.categoryCard}
            activeOpacity={0.7}
            onPress={() =>
              router.push({
                pathname: '/user/[id]/[section]',
                params: {
                  id: String(id),
                  section: section.key,
                },
              } as any)
            }
          >
            <Text style={styles.categoryText}>{section.title}</Text>
            <Text style={styles.categoryArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  content: {
    flexGrow: 1,
    backgroundColor: '#000000',
    paddingBottom: 30,
  },

  center: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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

  back: {
    color: '#fff',
    fontSize: 30,
  },

  topTitle: {
    color: '#888',
    fontSize: 11,
    letterSpacing: 2,
  },

  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#000000',
  },

  headerBtnLeft: {
    position: 'absolute',
    top: 60,
    left: 20,
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    marginBottom: 12,
  },

  username: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  bio: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },

  followButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 28,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 16,
  },

  followingButton: {
    backgroundColor: '#292929',
  },

  followText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },

  followingText: {
    color: '#fff',
  },

  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: '#000000',
  },

  categoryCard: {
    width: '100%',
    minHeight: 76,
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 5,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
  },

  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingLeft: 8,
    flexShrink: 1,
  },

  categoryArrow: {
    color: '#888',
    fontSize: 23,
    paddingHorizontal: 8,
  },

  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 14,
  },

  activityTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  seeAll: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  activityRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 12,
  },

  activityCard: {
    width: 76,
    backgroundColor: '#000000',
  },

  activityImage: {
    width: 76,
    height: 76,
    borderRadius: 4,
    backgroundColor: '#222',
  },

  activityCategory: {
    color: '#777',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 7,
    letterSpacing: 0.7,
  },

  activityName: {
    color: '#fff',
    fontSize: 10,
    marginTop: 4,
  },
  section: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1c',
  },

  activitySection: {
    backgroundColor: '#000000',
  },

  sectionHeader: {
    minHeight: 58,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
  },

  sectionTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },

  chevron: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '300',
    paddingHorizontal: 20,
  },

  slotsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    backgroundColor: '#000000',
  },

  slot: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 6,
    overflow: 'hidden',
  },

  slotImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },

  sectionContent: {
    paddingBottom: 12,
    backgroundColor: '#000000',
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: '#000000',
  },

  itemImage: {
    width: 58,
    height: 58,
    borderRadius: 5,
    backgroundColor: '#222',
  },

  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },

  itemCategory: {
    color: '#777',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },

  itemName: {
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
    marginTop: 4,
  },

  emptyText: {
    color: '#555',
    fontSize: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },

  error: {
    color: '#d66',
    textAlign: 'center',
    marginTop: 16,
    padding: 12,
  },
});

