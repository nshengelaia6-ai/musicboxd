
import { useAppTheme } from '@/context/ThemeContext';
import { clearSpotifySession } from '@/utils/spotify';
import { supabase } from '@/utils/supabase';
import { flushPendingActivities } from '@/utils/activity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const EMPTY_ALBUMS = [null, null, null, null];

export default function Profile() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [reviews, setReviews] = useState<any[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');

  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');

  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<{ base64: string; mimeType: string } | null>(null);

  const [favoriteAlbums, setFavoriteAlbums] =
    useState<(any | null)[]>([...EMPTY_ALBUMS]);

  const [draftFavoriteAlbums, setDraftFavoriteAlbums] =
    useState<(any | null)[]>([...EMPTY_ALBUMS]);

  const [pendingSlotIndex, setPendingSlotIndex] =
    useState<number | null>(null);

  const profileEditSnapshot = useRef<{
    username: string;
    bio: string;
    avatar: string | null;
    favoriteAlbums: (any | null)[];
  } | null>(null);

  // Load profile data when opening the screen.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Restore selected albums when returning from the album picker.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function checkReturn() {
        try {
          const flag = await AsyncStorage.getItem('returnToSettings');

          if (flag !== '1' || !active) {
            return;
          }

          const pendingData = await AsyncStorage.getItem(
            'pendingFavoriteAlbums'
          );

          if (pendingData && active) {
            const parsed = JSON.parse(pendingData);
            const albums = Array.isArray(parsed) ? [...parsed] : [];

            while (albums.length < 4) {
              albums.push(null);
            }

            setDraftFavoriteAlbums(albums.slice(0, 4));
          }

          if (active) {
            setShowSettings(true);
            await AsyncStorage.removeItem('returnToSettings');
          }
        } catch (error) {
          console.error('Could not reopen Settings:', error);
        }
      }

      checkReturn();

      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    if (showSettings || pendingSlotIndex === null) {
      return;
    }

    const idx = pendingSlotIndex;

    const timer = setTimeout(() => {
      router.push({
        pathname: '/pick-album',
        params: { index: String(idx) },
      } as any);

      setPendingSlotIndex(null);
    }, 350);

    return () => clearTimeout(timer);
  }, [pendingSlotIndex, router, showSettings]);

  async function loadData() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const authUsername =
        user?.user_metadata?.username?.trim() ||
        user?.email?.split('@')[0] ||
        '';

      // Reset the screen before loading the current account.
      setUsername(authUsername);
      setBio('');
      setEditUsername(authUsername);
      setEditBio('');
      setAvatar(null);
      setEditAvatar(null);
      setFavoriteAlbums([...EMPTY_ALBUMS]);
      setDraftFavoriteAlbums([...EMPTY_ALBUMS]);

      const reviewsData = await AsyncStorage.getItem('reviews');
      let localReviews: any[] = [];
      try {
        const parsedReviews = reviewsData ? JSON.parse(reviewsData) : [];
        localReviews = Array.isArray(parsedReviews) ? parsedReviews : [];
      } catch {
        localReviews = [];
      }

      const profileData = await AsyncStorage.getItem('profile');
      let p: any = {};
      try {
        p = profileData ? JSON.parse(profileData) : {};
      } catch {
        p = {};
      }

      // Read the cloud profile so username, avatar, bio and favorite albums
      // stay consistent across devices.
      let cloudProfile: { username?: string | null; bio?: string | null; avatar_url?: string | null; favorite_albums?: any[] | null } | null = null;
      if (user) {
        const { data, error } = await supabase
          .from('users')
          .select('username, bio, avatar_url, favorite_albums')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          console.warn('Could not load cloud profile:', error);
        } else {
          cloudProfile = data;
        }
      }

      // Retry queued activity events whenever the profile opens, so the profile
      // does not depend on visiting the Activity tab to finish synchronization.
      if (user) {
        await flushPendingActivities();
      }

      // Load the full cloud activity feed for this profile, with legacy local reviews as fallback.
      let recentItems: any[] = [...localReviews];
      if (user) {
        const { data: activityRows, error: activityError } = await supabase
          .from('user_activity')
          .select('id, activity_type, item_key, data, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (activityError) {
          console.warn('Could not load cloud profile activity:', activityError);
        } else if (activityRows) {
          const cloudItems = activityRows.map((entry: any) => {
            const data = entry.data || {};
            const artists = Array.isArray(data.artists)
              ? data.artists.map((artist: any) => artist?.name || artist).filter(Boolean).join(', ')
              : data.artists;
            return {
              id: entry.id,
              albumId: String(data.id || entry.item_key),
              albumName:
                data.name || data.title || data.albumName || data.track_name ||
                data.item_name || data.artistName || String(entry.item_key),
              albumArtist: data.artist || data.artist_name || data.artistName || artists || '',
              albumCover:
                data.cover || data.cover_url || data.image || data.imageUrl ||
                data.image_url || data.artwork || data.albumCover ||
                data.album?.images?.[0]?.url || '',
              rating: Number(data.rating) || 0,
              review: data.review || data.comment || data.notes || data.description || '',
              activityType: entry.activity_type,
              date: entry.created_at,
              itemType: data.type || (entry.activity_type === 'followed_artist' ? 'artist' : entry.activity_type === 'created_list' ? 'list' : 'album'),
            };
          });
          const cloudReviewKeys = new Set(
            cloudItems
              .filter((item: any) => item.activityType === 'reviewed')
              .map((item: any) => String(item.albumId))
          );
          const legacyItems = localReviews.filter(
            (item: any) => !cloudReviewKeys.has(String(item.albumId))
          );
          recentItems = [...cloudItems, ...legacyItems]
            .sort((a: any, b: any) =>
              new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
            )
            .slice(0, 10);
        }
      }
      setReviews(recentItems);

      // Supabase profile data takes priority over device-local cached values.
      const finalUsername = cloudProfile?.username?.trim() || authUsername || p.username || '';
      const finalBio = cloudProfile?.bio ?? p.bio ?? '';
      const finalAvatar = cloudProfile?.avatar_url ?? p.avatar ?? null;

      setUsername(finalUsername);
      setBio(finalBio);

      setEditUsername(finalUsername);
      setEditBio(finalBio);

      setAvatar(finalAvatar);
      setEditAvatar(finalAvatar);

      const pendingAlbumsData = await AsyncStorage.getItem(
  'pendingFavoriteAlbums'
);

let pendingAlbums: any = null;
try {
  pendingAlbums = pendingAlbumsData ? JSON.parse(pendingAlbumsData) : null;
} catch {
  pendingAlbums = null;
}
const sourceAlbums = Array.isArray(pendingAlbums)
  ? pendingAlbums
  : cloudProfile?.favorite_albums ?? p.favoriteAlbums;

if (Array.isArray(sourceAlbums)) {
  const albums = [...sourceAlbums];

  while (albums.length < 4) {
    albums.push(null);
  }

  setFavoriteAlbums(albums.slice(0, 4));
  setDraftFavoriteAlbums(albums.slice(0, 4));
}

      // Public profile items are synced by the individual feature flows.
      // Do not rebuild them from device-local caches when opening Profile.
    } catch (error) {
      console.error('Could not load profile data:', error);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Could not select photo', 'Please choose another image.');
        return;
      }
      setEditAvatar(asset.uri);
      setPendingAvatar({
        base64: asset.base64,
        mimeType: asset.mimeType || 'image/jpeg',
      });
    }
  }

  async function shareProfile() {
    setShowShare(false);

    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) throw new Error('Please sign in to share your profile.');

      const profileUrl = `myapp://user/${user.id}`;

      await Share.share({
        title: `${username} on Musicboxd`,
        message: [`@${username}`, bio, profileUrl]
          .filter(Boolean)
          .join('\n'),
        url: profileUrl,
      });
    } catch (error) {
      console.log('Could not share profile', error);
    }
  }

  async function saveProfile() {
    const cleanUsername = editUsername.trim();

    if (!cleanUsername) {
      Alert.alert('Username required', 'Please enter a username.');
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('User not found');

      const savedAlbums = [...draftFavoriteAlbums];
      let avatarUrl = editAvatar;

      // Upload a newly selected photo to the shared Supabase Storage bucket.
      if (pendingAvatar) {
        const binary = globalThis.atob(pendingAvatar.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const extension = pendingAvatar.mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        const filePath = `${user.id}/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, bytes.buffer as ArrayBuffer, {
            contentType: pendingAvatar.mimeType,
            cacheControl: '3600',
            upsert: false,
          });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        avatarUrl = publicUrlData.publicUrl;
      }

      // Upsert guarantees a profile row exists even for older accounts that
      // were created before the public.users row was provisioned.
      const previousAvatarUrl = avatar;
      const { data: savedProfile, error: profileError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          username: cleanUsername,
          bio: editBio,
          avatar_url: avatarUrl,
          favorite_albums: savedAlbums,
        }, { onConflict: 'id' })
        .select('id')
        .single();

      if (profileError) throw profileError;
      if (!savedProfile?.id) {
        throw new Error('Profile could not be saved. Please try again.');
      }

      // Remove the previous object only after the new profile URL is safely saved.
      if (pendingAvatar && previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
        try {
          const marker = '/avatars/';
          const markerIndex = previousAvatarUrl.indexOf(marker);
          if (markerIndex >= 0) {
            const oldPath = decodeURIComponent(previousAvatarUrl.slice(markerIndex + marker.length).split('?')[0]);
            if (oldPath.startsWith(`${user.id}/`)) {
              const { error: removeOldAvatarError } = await supabase.storage
                .from('avatars')
                .remove([oldPath]);
              if (removeOldAvatarError) console.warn('Could not remove previous avatar:', removeOldAvatarError);
            }
          }
        } catch (cleanupError) {
          console.warn('Could not remove previous avatar:', cleanupError);
        }
      }

      // The database profile is the source of truth. A failure to mirror the
      // username into Auth metadata must not report a failed profile save after
      // the users row has already been saved successfully.
      try {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          data: { username: cleanUsername },
        });
        if (authUpdateError) {
          console.warn('Could not sync username to Auth metadata:', authUpdateError);
        }
      } catch (metadataError) {
        console.warn('Could not sync username to Auth metadata:', metadataError);
      }

      await AsyncStorage.setItem(
        'profile',
        JSON.stringify({
          username: cleanUsername,
          bio: editBio,
          avatar: avatarUrl,
          favoriteAlbums: savedAlbums,
        })
      );

      await AsyncStorage.removeItem('pendingFavoriteAlbums');
      await AsyncStorage.removeItem('returnToSettings');

      setUsername(cleanUsername);
      setBio(editBio);
      setAvatar(avatarUrl);
      setEditAvatar(avatarUrl);
      setPendingAvatar(null);
      setFavoriteAlbums(savedAlbums);
      setShowSettings(false);

    } catch (error) {
      console.error('Could not save profile:', error);
      Alert.alert(
        'Could not save profile',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  }

  async function cancelProfileEdit() {
    const snapshot = profileEditSnapshot.current;

    setShowSettings(false);

    await AsyncStorage.removeItem('pendingFavoriteAlbums');
    await AsyncStorage.removeItem('returnToSettings');

    setDraftFavoriteAlbums([...favoriteAlbums]);

    if (!snapshot) {
      setEditUsername(username);
      setEditBio(bio);
      setEditAvatar(avatar);
      setPendingAvatar(null);
      return;
    }

    setUsername(snapshot.username);
    setBio(snapshot.bio);
    setEditUsername(snapshot.username);
    setEditBio(snapshot.bio);
    setAvatar(snapshot.avatar);
    setEditAvatar(snapshot.avatar);
    setPendingAvatar(null);
    setFavoriteAlbums([...snapshot.favoriteAlbums]);
    setDraftFavoriteAlbums([...snapshot.favoriteAlbums]);
  }

  function openProfileSettings() {
    profileEditSnapshot.current = {
      username,
      bio,
      avatar,
      favoriteAlbums: [...favoriteAlbums],
    };

    setEditUsername(username);
    setEditBio(bio);
    setEditAvatar(avatar);
    setPendingAvatar(null);
    setDraftFavoriteAlbums([...favoriteAlbums]);
    setShowSettings(true);
  }

  async function logOut() {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      await clearSpotifySession();
      await AsyncStorage.removeItem('musicboxd_test_mode');

      setShowSettings(false);
      setShowShare(false);

      router.replace('/auth' as any);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={[styles.container, { backgroundColor }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtnLeft}
            onPress={openProfileSettings}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                stroke="#FFFFFF"
                strokeWidth={1.7}
              />
              <Path
                d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"
                stroke="#FFFFFF"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerBtnRight}
            onPress={() => setShowShare(true)}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFFFFF">
              <Circle cx={5} cy={12} r={1.7} />
              <Circle cx={12} cy={12} r={1.7} />
              <Circle cx={19} cy={12} r={1.7} />
            </Svg>
          </TouchableOpacity>

          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar} />
          )}

          <Text style={styles.username}>{username}</Text>
          <Text style={styles.bio}>{bio}</Text>


        </View>

        {favoriteAlbums.some((album) => album != null) && (
          <>
            <Text style={styles.sectionTitle}>TOP 4 ALBUMS</Text>

            <View style={styles.slotsRow}>
              {favoriteAlbums.map((album, i) => (
                <View key={i} style={styles.slot}>
                  {album?.cover ? (
                    <Image
                      source={{ uri: album.cover }}
                      style={styles.slotImage}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </>
        )}
        {reviews.length > 0 && (
          <>
            <View style={styles.activityHeadingRow}>
              <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
              <TouchableOpacity
                style={styles.activitySeeAll}
                onPress={() => router.push({ pathname: '/(tabs)/activity', params: { tab: 'You' } } as any)}
                accessibilityRole="button"
                accessibilityLabel="See all recent activity"
              >
                <Text style={styles.activitySeeAllArrow}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 20,
                gap: 12,
              }}
            >
              {reviews.slice(0, 10).map((item, index) => (
                <View key={item.id ?? index} style={styles.activityCard}>
                  {item.albumCover ? (
                    <Image
                      source={{ uri: item.albumCover }}
                      style={styles.activityCover}
                    />
                  ) : (
                    <View
                      style={[
                        styles.activityCover,
                        { backgroundColor: '#2a2a2a' },
                      ]}
                    />
                  )}

                  <View style={styles.activityMeta}>
                    <Text
                      style={[styles.activityRating, { color: '#9BA7B2' }]}
                    >
                      {'\u2605'.repeat(Math.floor(item.rating || 0))}
                    </Text>
                    <Text style={[styles.activityBadgeText, { color: accentColor }]}>
                      {item.activityType === 'reviewed'
                        ? '\u270E'
                        : item.activityType === 'liked'
                          ? '\u2665'
                          : item.activityType === 'wants_to_listen'
                            ? '\u2661'
                            : item.activityType === 'created_list'
                              ? '\u2261'
                              : item.activityType === 'followed_artist'
                                ? '+'
                                : '\u266B'}
                    </Text>
                  </View>

                  <Text style={styles.activityAlbum} numberOfLines={1}>
                    {item.albumName}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <View style={styles.menu}>
          {[
            { label: 'Songs', route: '/songs' },
            { label: 'Diary', route: '/diary' },
            { label: 'Reviews', route: '/reviews' },
            { label: 'Lists', route: '/lists' },
            { label: 'Want to Listen', route: '/wanttolisten' },
            { label: 'Likes', route: '/likes' },
            { label: 'Artists', route: '/artists' },
            { label: 'Following', route: '/following' },
            { label: 'Followers', route: '/followers' },
          ].map((item) => (
            <Pressable
              key={item.label}
              style={styles.menuRow}
              onPress={() => router.push(item.route as any)}
            >
              <Text style={styles.menuText}>{item.label}</Text>
              <Text style={styles.arrow}>{'\u203A'}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={showShare} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowShare(false)}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Share Profile</Text>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={shareProfile}
            >
              <Text style={styles.sheetOptionText}>Share Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetOption, { marginTop: 8 }]}
              onPress={() => setShowShare(false)}
            >
              <Text style={[styles.sheetOptionText, { color: '#888' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={cancelProfileEdit}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={{ flex: 1 }}
            onPress={cancelProfileEdit}
          />

          <ScrollView
            style={[styles.bottomSheet, { maxHeight: '85%', paddingBottom: 0 }]}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Settings</Text>

            <View style={styles.settingsAvatarContainer}>
              {editAvatar ? (
                <Image
                  source={{ uri: editAvatar }}
                  style={styles.settingsAvatar}
                />
              ) : (
                <View style={styles.settingsAvatar} />
              )}

              <TouchableOpacity onPress={pickImage}>
                <Text
                  style={[
                    styles.changePhotoText,
                    { color: accentColor },
                  ]}
                >
                  Change
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.settingsLabel}>Username</Text>

            <TextInput
              style={styles.settingsInput}
              value={editUsername}
              onChangeText={setEditUsername}
              placeholderTextColor="#555"
              placeholder="username"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <Text style={styles.settingsLabel}>Bio</Text>

            <TextInput
              style={styles.settingsInput}
              value={editBio}
              onChangeText={setEditBio}
              placeholderTextColor="#555"
              placeholder="bio"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <Text style={styles.settingsLabel}>Top 4 Albums</Text>

            <View style={styles.settingsSlotsRow}>
              {draftFavoriteAlbums.map((album, i) => (
                <View
                  key={i}
                  style={{
                    position: 'relative',
                    flex: 1,
                    aspectRatio: 1,
                  }}
                >
                  <TouchableOpacity
                    style={styles.settingsSlot}
                    onPress={async () => {
                      if (!album) {
                        await AsyncStorage.setItem(
                          'pendingFavoriteAlbums',
                          JSON.stringify(draftFavoriteAlbums)
                        );

                        setPendingSlotIndex(i);
                        setShowSettings(false);
                      }
                    }}
                  >
                    {album?.cover ? (
                      <Image
                        source={{ uri: album.cover }}
                        style={styles.settingsSlotImage}
                      />
                    ) : (
                      <Text style={styles.settingsSlotPlus}>+</Text>
                    )}
                  </TouchableOpacity>

                  {album && (
                    <TouchableOpacity
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        borderRadius: 8,
                        width: 16,
                        height: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={async () => {
                        const updated = [...draftFavoriteAlbums];
                        updated[i] = null;

                        setDraftFavoriteAlbums(updated);

                        await AsyncStorage.setItem(
                          'pendingFavoriteAlbums',
                          JSON.stringify(updated)
                        );
                      }}
                    >
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.9)',
                          fontSize: 9,
                          fontWeight: '700',
                          lineHeight: 11,
                        }}
                      >
                        {'\u00D7'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setShowSettings(false);
                router.push('/privacy-settings' as any);
              }}
            >
              <Text style={styles.sheetOptionText}>Privacy & Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setShowSettings(false);
                router.push('/customize' as any);
              }}
            >
              <Text style={styles.sheetOptionText}>Customize</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: accentColor },
              ]}
              onPress={saveProfile}
            >
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={logOut}
            >
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={cancelProfileEdit}
            >
              <Text style={styles.sheetOptionText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerBtnLeft: {
    position: 'absolute',
    top: 60,
    left: 20,
  },
  headerBtnRight: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  headerBtnText: { color: '#fff', fontSize: 20 },
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
  },
  stats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 40,
  },
  stat: { alignItems: 'center' },
  statNum: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: { color: '#888', fontSize: 12 },
  activityHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 20 },
  activitySeeAll: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  activitySeeAllArrow: { color: '#aaa', fontSize: 25, lineHeight: 28, fontWeight: '400' },
  sectionTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  slotsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  slot: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 6,
  },
  slotImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  settingsSlotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  settingsSlot: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSlotImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  settingsSlotPlus: { color: '#666', fontSize: 20 },
  activityCard: {
    width: 110,
    alignItems: 'center',
  },
  activityCover: {
    width: 110,
    height: 110,
    borderRadius: 8,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 16,
    marginTop: 4,
  },
  activityBadgeText: { fontSize: 12, fontWeight: '600' },
  activityRating: { fontSize: 11 },
  activityAlbum: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  menu: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  menuText: { color: '#fff', fontSize: 16 },
  arrow: { color: '#555', fontSize: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#1c1c1c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  sheetOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  sheetOptionText: { color: '#fff', fontSize: 16 },
  settingsAvatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  settingsAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    marginBottom: 8,
  },
  changePhotoText: { fontSize: 14 },
  settingsLabel: {
    color: '#888',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 4,
  },
  settingsInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 4,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutBtnText: {
    color: '#ff4444',
    fontSize: 16,
  },
  stars: { fontSize: 12, marginTop: 2 },
});


