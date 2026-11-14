
import { useAppTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getValidSpotifyToken } from '@/utils/spotify';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

const SUPABASE_URL = 'https://jvxsfjxcydpdlvwrxmor.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_tH6PoxGwVF9JyUvsMw0mUg_cFiFzeCm';

const FALLBACK_BACKGROUNDS = [
  '#40343B',
  '#343D42',
  '#514035',
  '#34364C',
  '#3C453A',
  '#484044',
];

function getBackground(item: any, index: number) {
  const savedColor =
    item.coverColor ||
    item.dominantColor ||
    item.backgroundColor;

  if (typeof savedColor === 'string' && savedColor.trim()) {
    return savedColor;
  }

  return FALLBACK_BACKGROUNDS[index % FALLBACK_BACKGROUNDS.length];
}

function getUsername(item: any) {
  const name =
    item.username ||
    item.fromUsername ||
    item.senderUsername ||
    item.from ||
    'Friend';

  return String(name).startsWith('@') ? String(name) : `@${name}`;
}

function getAvatar(item: any) {
  return (
    item.fromAvatar ||
    item.senderAvatar ||
    item.avatar_url ||
    item.avatar ||
    item.profileImage ||
    ''
  );
}

function getDateLabel(date: string) {
  if (!date) return '';

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';

  const days = Math.floor(
    (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (days <= 0) return 'now';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function Shared() {
  const router = useRouter();
  const { backgroundColor } = useAppTheme();
  const { width, height } = useWindowDimensions();

  const [sharedSongs, setSharedSongs] = useState<any[]>([]);
  const [likedSongs, setLikedSongs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [replyVisible, setReplyVisible] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyItem, setReplyItem] = useState<any>(null);
  const [replyStatus, setReplyStatus] = useState('');

  const storyHeight = Math.max(420, height - 125);
  const storyWidth = Math.min(width, 460);

  const loadShared = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [savedLikes, spotifyToken] = await Promise.all([
        AsyncStorage.getItem('shared_song_likes'),
        getValidSpotifyToken(),
      ]);

      if (!spotifyToken) {
        setSharedSongs([]);
        setError('Your Spotify session expired. Please sign in again.');
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/swift-service`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${spotifyToken}`,
            apikey: SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'inbox' }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : 'Could not load your inbox. Please try again.'
        );
      }

      const inboxItems = Array.isArray(result.items)
        ? result.items
        : [];

      setSharedSongs(inboxItems);

      const parsedLikes = savedLikes ? JSON.parse(savedLikes) : {};
      setLikedSongs(
        parsedLikes && typeof parsedLikes === 'object'
          ? parsedLikes
          : {}
      );
    } catch (e) {
      console.error('Could not load shared songs:', e);
      setError(
        e instanceof Error
          ? e.message
          : 'Could not load your shared songs. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadShared();
    }, [loadShared])
  );

  async function toggleLike(item: any, index: number) {
    const key = String(item.id || `${item.itemId || item.name}-${index}`);
    const next = { ...likedSongs, [key]: !likedSongs[key] };

    setLikedSongs(next);

    try {
      await AsyncStorage.setItem('shared_song_likes', JSON.stringify(next));
    } catch (e) {
      console.log('Could not save like', e);
    }
  }

  function openSharedItem(item: any) {
    if (item.type === 'track' && item.albumId) {
      router.push({
        pathname: '/album/[id]',
        params: {
          id: item.albumId,
          highlightTrackId: item.itemId || item.id,
        },
      } as any);
    } else if (item.type === 'album' && (item.itemId || item.id)) {
      router.push(`/album/${item.itemId || item.id}` as any);
    } else if (item.url) {
      console.log('Shared Spotify URL:', item.url);
    }
  }

  function openReply(item: any) {
    setReplyItem(item);
    setReplyText('');
    setReplyStatus('');
    setReplyVisible(true);
  }

  async function saveReply() {
    if (!replyItem || !replyText.trim()) return;

    try {
      const raw = await AsyncStorage.getItem('shared_song_replies');
      const replies = raw ? JSON.parse(raw) : [];

      replies.push({
        id: `${Date.now()}`,
        sharedSongId: replyItem.id,
        to: getUsername(replyItem),
        message: replyText.trim(),
        date: new Date().toISOString(),
      });

      await AsyncStorage.setItem(
        'shared_song_replies',
        JSON.stringify(replies)
      );

      setReplyVisible(false);
      setReplyText('');
      setReplyStatus('');
    } catch {
      setReplyStatus('Could not save your reply. Please try again.');
    }
  }

  function renderStory({ item, index }: { item: any; index: number }) {
    const bg = getBackground(item, index);
    const username = getUsername(item);
    const avatar = getAvatar(item);
    const key = String(item.id || `${item.itemId || item.name}-${index}`);
    const liked = !!likedSongs[key];

    return (
      <View style={[styles.page, { width }]}>
        <View
          style={[
            styles.story,
            {
              width: storyWidth,
              height: storyHeight,
              backgroundColor: bg,
            },
          ]}
        >
          <View style={styles.progressRow}>
            {sharedSongs.map((song, i) => (
              <View
                key={String(song.id || i)}
                style={[
                  styles.progressTrack,
                  {
                    backgroundColor:
                      i === index ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.topBar}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {username.replace('@', '').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.userInfo}>
              <Text style={styles.username} numberOfLines={1}>
                {username}
              </Text>
              <Text style={styles.time}>{getDateLabel(item.date)}</Text>
            </View>

            <TouchableOpacity
              onPress={() => openSharedItem(item)}
              style={styles.moreButton}
              accessibilityRole="button"
              accessibilityLabel="Open album or song"
            >
              <Text style={styles.moreText}>•••</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.artworkArea}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => openSharedItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name || 'shared music'}`}
              style={styles.artworkButton}
            >
              {item.cover ? (
                <Image
                  source={{ uri: item.cover }}
                  style={styles.artwork}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.artwork, styles.noArtwork]}>
                  <Text style={styles.noArtworkText}>♫</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.songName} numberOfLines={2}>
              {item.name || 'Shared music'}
            </Text>

            {!!item.artist && (
              <Text style={styles.artist} numberOfLines={1}>
                {item.artist}
              </Text>
            )}

            {!!item.message && (
              <Text style={styles.message} numberOfLines={4}>
                “{item.message}”
              </Text>
            )}
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.replyButton}
              onPress={() => openReply(item)}
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${username}`}
            >
              <Text style={styles.replyPlaceholder}>Reply...</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => toggleLike(item, index)}
              style={styles.heartButton}
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Unlike' : 'Like'}
            >
              <Text style={[styles.heart, liked && styles.heartLiked]}>
                {liked ? '♥' : '♡'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor }]}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor }]}>
        <Text style={styles.emptyText}>{error}</Text>
        <TouchableOpacity onPress={loadShared} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle="light-content" />

      {sharedSongs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>♫</Text>
          <Text style={styles.emptyTitle}>Shared Songs</Text>
          <Text style={styles.emptyText}>
            Nothing shared yet. When a friend sends you an album or track, it will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sharedSongs}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) =>
            String(item.id || `${item.itemId || item.name}-${index}`)
          }
          renderItem={renderStory}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          initialNumToRender={2}
          windowSize={3}
        />
      )}

      <Modal
        visible={replyVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReplyVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setReplyVisible(false)}
          />

          <View style={styles.replySheet}>
            <Text style={styles.replyTitle}>
              Reply to {replyItem ? getUsername(replyItem) : 'friend'}
            </Text>

            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Write a reply..."
              placeholderTextColor="#888"
              style={styles.replyInput}
              multiline
              autoFocus
              maxLength={500}
            />

            {!!replyStatus && (
              <Text style={styles.replyError}>{replyStatus}</Text>
            )}

            <View style={styles.replyActions}>
              <TouchableOpacity
                onPress={() => setReplyVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveReply}
                disabled={!replyText.trim()}
                style={[
                  styles.sendButton,
                  !replyText.trim() && styles.sendButtonDisabled,
                ]}
              >
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  story: {
    overflow: 'hidden',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    height: 3,
    marginBottom: 14,
  },
  progressTrack: {
    flex: 1,
    borderRadius: 5,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  time: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  moreButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  moreText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  artworkArea: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 3,
  },
  artworkButton: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 1,
    alignSelf: 'center',
  },
  artwork: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  noArtwork: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noArtworkText: {
    color: '#FFFFFF',
    fontSize: 80,
  },
  songName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 15,
  },
  artist: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    paddingBottom: 3,
  },
  replyButton: {
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 24,
    paddingHorizontal: 15,
  },
  replyPlaceholder: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  heartButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 38,
  },
  heartLiked: {
    color: '#FF4668',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyIcon: {
    color: '#FFFFFF',
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyText: {
    color: '#999999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  retryButton: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: '#333333',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  replySheet: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 32,
  },
  replyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  replyInput: {
    color: '#FFFFFF',
    backgroundColor: '#303033',
    borderRadius: 12,
    padding: 13,
    minHeight: 90,
    maxHeight: 160,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  replyError: {
    color: '#FF8B8B',
    fontSize: 12,
    marginTop: 8,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: '#333333',
  },
  cancelText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sendButton: {
    paddingHorizontal: 23,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendText: {
    color: '#111111',
    fontWeight: '800',
  },
});
