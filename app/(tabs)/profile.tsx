
import { useAppTheme } from '@/context/ThemeContext';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId, getCurrentSpotifyProfile } from '@/utils/currentUser';
import { clearSpotifySession, useSpotifyAuth, exchangeSpotifyCode } from '@/utils/spotify';
import { supabase } from '@/utils/supabase';
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
  const {
    request: spotifyRequest,
    response: spotifyResponse,
    promptAsync: promptSpotify,
    redirectUri: spotifyRedirectUri,
  } = useSpotifyAuth();

  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyConnecting, setSpotifyConnecting] = useState(false);
  const [spotifyAuthError, setSpotifyAuthError] = useState('');

  useEffect(() => {
    getCurrentUserId().then(id => setSpotifyConnected(!!id));
  }, []);

  useEffect(() => {
    if (spotifyResponse?.type !== 'success') return;

    const code = spotifyResponse.params.code;
    const verifier = spotifyRequest?.codeVerifier;

    if (!code || !verifier) {
      setSpotifyAuthError('Spotify authorization could not be completed.');
      setSpotifyConnecting(false);
      return;
    }

    let active = true;

    async function finishSpotifyLogin() {
      try {
        const token = await exchangeSpotifyCode(
          code,
          verifier!,
          spotifyRedirectUri
        );

        const profile = await getCurrentSpotifyProfile(token);

        if (!profile) {
          throw new Error('Could not load Spotify profile.');
        }

        if (active) {
          setSpotifyConnected(true);
          setSpotifyAuthError('');
          setSpotifyConnecting(false);
        }
      } catch (error) {
        console.error('Spotify login failed:', error);
        if (active) {
          setSpotifyAuthError(
            error instanceof Error ? error.message : 'Spotify login failed.'
          );
          setSpotifyConnecting(false);
        }
      }
    }

    finishSpotifyLogin();

    return () => {
      active = false;
    };
  }, [spotifyResponse, spotifyRequest, spotifyRedirectUri]);

  const [reviews, setReviews] = useState<any[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');

  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');

  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  const [favoriteAlbums, setFavoriteAlbums] =
    useState<(any | null)[]>([...EMPTY_ALBUMS]);

  const [draftFavoriteAlbums, setDraftFavoriteAlbums] =
    useState<(any | null)[]>([...EMPTY_ALBUMS]);

  const [pendingSlotIndex, setPendingSlotIndex] =
    useState<number | null>(null);

  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  const profileEditSnapshot = useRef<{
    username: string;
    bio: string;
    avatar: string | null;
    favoriteAlbums: (any | null)[];
  } | null>(null);

  const writtenReviewsCount = reviews.filter(
    (r: any) => r.review && String(r.review).trim().length > 0
  ).length;

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

          const profileData = await AsyncStorage.getItem('profile');
          const p = profileData ? JSON.parse(profileData) : {};

          const {
            data: { user },
          } = await supabase.auth.getUser();

          const authUsername =
            user?.user_metadata?.username?.trim() ||
            user?.email?.split('@')[0] ||
            '';

          if (active) {
            // Supabase username takes priority over old local username.
            setEditUsername(authUsername || p.username || '');
            setEditBio(p.bio || '');
            setEditAvatar(p.avatar || null);
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
      setReviews(reviewsData ? JSON.parse(reviewsData) : []);

      const profileData = await AsyncStorage.getItem('profile');
      const p = profileData ? JSON.parse(profileData) : {};

      // Supabase username takes priority over old local username.
      const finalUsername = authUsername || p.username || '';
      const finalBio = p.bio || '';

      setUsername(finalUsername);
      setBio(finalBio);

      setEditUsername(finalUsername);
      setEditBio(finalBio);

      setAvatar(p.avatar || null);
      setEditAvatar(p.avatar || null);

      const pendingAlbumsData = await AsyncStorage.getItem(
  'pendingFavoriteAlbums'
);

const sourceAlbums = pendingAlbumsData
  ? JSON.parse(pendingAlbumsData)
  : p.favoriteAlbums;

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
      if (user) {
        try {
          // Keep the legacy backend profile keyed by Spotify ID.
          const spotifyId = await getCurrentUserId();
          if (spotifyId) {
            await fetch(`${API_BASE}/users`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: spotifyId,
                username: finalUsername,
                avatar: p.avatar || null,
                bio: finalBio,
              }),
            });
          }

          // Friendships are keyed by Supabase Auth UUID, never Spotify ID.
          const [followingResult, followersResult] = await Promise.all([
            supabase
              .from('friendships')
              .select('friend_id', { count: 'exact', head: true })
              .eq('user_id', user.id),
            supabase
              .from('friendships')
              .select('user_id', { count: 'exact', head: true })
              .eq('friend_id', user.id),
          ]);

          if (followingResult.error) throw followingResult.error;
          if (followersResult.error) throw followersResult.error;

          setFollowingCount(followingResult.count ?? 0);
          setFollowersCount(followersResult.count ?? 0);
        } catch (error) {
          console.error('Could not load follow counts:', error);
        }
      }
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
    });

    if (!result.canceled) {
      setEditAvatar(result.assets[0].uri);
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

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: { username: cleanUsername },
      });
      if (authUpdateError) throw authUpdateError;

      const { error: profileError } = await supabase
        .from('users')
        .update({
          username: cleanUsername,
          bio: editBio,
          avatar_url: editAvatar,
          favorite_albums: savedAlbums,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      await AsyncStorage.setItem(
        'profile',
        JSON.stringify({
          username: cleanUsername,
          bio: editBio,
          avatar: editAvatar,
          favoriteAlbums: savedAlbums,
        })
      );

      await AsyncStorage.removeItem('pendingFavoriteAlbums');
      await AsyncStorage.removeItem('returnToSettings');

      setUsername(cleanUsername);
      setBio(editBio);
      setAvatar(editAvatar);
      setFavoriteAlbums(savedAlbums);
      setShowSettings(false);

      // The legacy backend user record is keyed by Spotify ID, not Supabase Auth ID.
      try {
        const spotifyId = await getCurrentUserId();
        if (spotifyId) {
          const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: spotifyId,
              username: cleanUsername,
              avatar: editAvatar,
              bio: editBio,
            }),
          });
          if (!response.ok) {
            console.warn('Legacy backend profile sync failed:', response.status);
          }
        }
      } catch (backendError) {
        console.warn('Legacy backend profile sync failed:', backendError);
      }
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
      return;
    }

    setUsername(snapshot.username);
    setBio(snapshot.bio);
    setEditUsername(snapshot.username);
    setEditBio(snapshot.bio);
    setAvatar(snapshot.avatar);
    setEditAvatar(snapshot.avatar);
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
            <Text style={styles.sectionTitle}>FAVORITE ALBUMS</Text>

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
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>

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

                  <View
                    style={[
                      styles.activityBadge,
                      { backgroundColor: accentColor },
                    ]}
                  >
                    <Text style={styles.activityBadgeText}>
                      {item.review ? '\u270E' : '\u2605'}
                    </Text>
                  </View>

                  <Text
                    style={[styles.activityRating, { color: '#9BA7B2' }]}
                  >
                    {'\u2605'.repeat(Math.floor(item.rating || 0))}
                  </Text>

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
            { label: 'Following', route: '/following' },
            { label: 'Followers', route: '/followers' },
            { label: 'Artists', route: '/artists' },
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

          <View style={[styles.bottomSheet, { paddingBottom: 40 }]}>
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

            <Text style={styles.settingsLabel}>Favorite Albums</Text>

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
                        Ã—
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
              style={styles.sheetOption}
              disabled={!spotifyRequest || spotifyConnecting}
              onPress={async () => {
                setSpotifyAuthError('');
                setSpotifyConnecting(true);

                try {
                  await promptSpotify();
                } catch (error) {
                  setSpotifyAuthError(
                    error instanceof Error ? error.message : 'Spotify login failed.'
                  );
                } finally {
                  setSpotifyConnecting(false);
                }
              }}
            >
              <Text style={styles.sheetOptionText}>
                {spotifyConnecting
                  ? 'Connecting to Spotify...'
                  : spotifyConnected
                    ? 'Spotify Connected ✓'
                    : 'Connect Spotify'}
              </Text>
            </TouchableOpacity>

            {spotifyAuthError ? (
              <Text style={{ color: '#E06B6B', fontSize: 12, marginTop: 6 }}>
                {spotifyAuthError}
              </Text>
            ) : null}

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
          </View>
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
  activityBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadgeText: { fontSize: 11, color: '#000' },
  activityRating: { fontSize: 11, marginTop: 4 },
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


