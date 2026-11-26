
import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { recordActivity } from '@/utils/activity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ArtistPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();

  const [artist, setArtist] = useState<any>(null);
  const [albums, setAlbums] = useState<any[]>([]);
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setArtist(null);
    setAlbums([]);
    setFollowed(false);

    try {
      const artistId = Array.isArray(id) ? id[0] : id;

      if (!artistId) {
        throw new Error('Artist ID is missing.');
      }

      const [artistResult, albumsResult] = await Promise.all([
        supabase.functions.invoke('spotify-search', {
          body: {
            action: 'artist',
            id: artistId,
          },
        }),
        supabase.functions.invoke('spotify-search', {
          body: {
            action: 'artist-albums',
            id: artistId,
          },
        }),
      ]);

      if (artistResult.error) {
        throw artistResult.error;
      }

      if (albumsResult.error) {
        throw albumsResult.error;
      }

      if (artistResult.data?.error) {
        throw new Error(artistResult.data.error);
      }

      if (albumsResult.data?.error) {
        throw new Error(albumsResult.data.error);
      }

      const artistData = artistResult.data;
      const albumsData = albumsResult.data;

      if (!artistData?.id) {
        throw new Error('Artist not found.');
      }

      setArtist(artistData);
      setAlbums(albumsData?.items || []);

      const { data: { user } } = await supabase.auth.getUser();
      let isFollowed = false;
      if (user) {
        const { data: cloudFollow, error: followError } = await supabase
          .from('artist_follows')
          .select('artist_id')
          .eq('user_id', user.id)
          .eq('artist_id', String(artistData.id))
          .maybeSingle();
        if (followError) throw followError;
        isFollowed = !!cloudFollow;
        if (!isFollowed) {
          const followedData = await AsyncStorage.getItem('followed_artists');
          const followedArtists = followedData ? JSON.parse(followedData) : [];
          const legacyFollow = followedArtists.find((item: any) => String(item.id) === String(artistData.id));
          if (legacyFollow) {
            const { error: migrateError } = await supabase.from('artist_follows').upsert({
              user_id: user.id,
              artist_id: String(artistData.id),
              artist_name: String(legacyFollow.name || artistData.name || ''),
              artist_image: String(legacyFollow.image || artistData.images?.[0]?.url || ''),
            }, { onConflict: 'user_id,artist_id' });
            if (migrateError) throw migrateError;
            isFollowed = true;
          }
        }
      } else {
        const followedData = await AsyncStorage.getItem('followed_artists');
        const followedArtists = followedData ? JSON.parse(followedData) : [];
        isFollowed = followedArtists.some((item: any) => String(item.id) === String(artistData.id));
      }
      setFollowed(isFollowed);
    } catch (loadError) {
      console.log('Artist loading error:', loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load this artist.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggleFollow() {
    if (!artist) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const data = await AsyncStorage.getItem('followed_artists');
      const followedArtists = data ? JSON.parse(data) : [];
      const alreadyFollowed = followedArtists.some((item: any) => String(item.id) === String(artist.id));
      const next = !followed;
      const updated = next
        ? [{ id: String(artist.id), name: artist.name, image: artist.images?.[0]?.url }, ...followedArtists.filter((item: any) => String(item.id) !== String(artist.id))]
        : followedArtists.filter((item: any) => String(item.id) !== String(artist.id));

      if (user) {
        if (next) {
          const { error: followError } = await supabase.from('artist_follows').upsert({
            user_id: user.id,
            artist_id: String(artist.id),
            artist_name: String(artist.name || ''),
            artist_image: String(artist.images?.[0]?.url || ''),
          }, { onConflict: 'user_id,artist_id' });
          if (followError) throw followError;
        } else {
          const { error: unfollowError } = await supabase.from('artist_follows').delete().eq('user_id', user.id).eq('artist_id', String(artist.id));
          if (unfollowError) throw unfollowError;
        }
      }
      await AsyncStorage.setItem('followed_artists', JSON.stringify(updated));

      if (next) {
        await recordActivity('followed_artist', String(artist.id), {
          id: String(artist.id),
          name: artist.name,
          image: artist.images?.[0]?.url,
          type: 'artist',
        });
      }

      setFollowed(next);
    } catch (error) {
      console.error('Follow update failed:', error);
      setError(
        'Could not update your artist library. Please try again.'
      );
    }
  }
  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
      >
        <Text style={styles.backText}>{'‹'}</Text>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator
          color="#1DB954"
          style={{ marginTop: 90 }}
        />
      )}

      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}

      {!loading && !error && !artist && (
        <Text style={styles.empty}>Artist not found.</Text>
      )}

      {!loading && artist && (
        <View style={styles.heroSection}>
          {artist.images?.[0]?.url ? (
            <Image
              source={{ uri: artist.images[0].url }}
              style={styles.heroImage}
            />
          ) : (
            <View
              style={[
                styles.heroImage,
                { backgroundColor: '#2a2a2a' },
              ]}
            />
          )}

          <Text style={styles.artistName}>
            {artist.name}
          </Text>

          <Text style={styles.followers}>
            {artist.followers?.total?.toLocaleString() ?? '—'} followers
          </Text>

          <TouchableOpacity
            style={[
              styles.followButton,
              {
                backgroundColor: followed
                  ? '#2a2a2a'
                  : accentColor,
              },
            ]}
            onPress={toggleFollow}
            accessibilityRole="button"
            accessibilityLabel={`${
              followed ? 'Unfollow' : 'Follow'
            } ${artist.name}`}
          >
            <Text
              style={[
                styles.followButtonText,
                followed && styles.followingButtonText,
              ]}
            >
              {followed ? 'Following' : 'Follow Artist'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && albums.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Discography
          </Text>

          <FlatList
            data={albums}
            keyExtractor={(item) => item.id}
            horizontal
            scrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              gap: 12,
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.albumCard}
                onPress={() =>
                  router.push(`/album/${item.id}` as any)
                }
                accessibilityRole="button"
                accessibilityLabel={`Open album ${item.name}`}
              >
                {item.images?.[0]?.url ? (
                  <Image
                    source={{ uri: item.images[0].url }}
                    style={styles.albumCover}
                  />
                ) : (
                  <View
                    style={[
                      styles.albumCover,
                      { backgroundColor: '#2a2a2a' },
                    ]}
                  />
                )}

                <Text
                  style={styles.albumName}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>

                <Text style={styles.albumYear}>
                  {item.release_date
                    ? new Date(item.release_date).getFullYear()
                    : '—'}{' '}
                  • {item.album_type || 'Release'}
                </Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {!loading &&
        !error &&
        artist &&
        albums.length === 0 && (
          <Text style={styles.empty}>
            No releases found.
          </Text>
        )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  backBtn: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  backText: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 36,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 40,
  },
  heroImage: {
    width: '100%',
    height: 300,
  },
  artistName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  followers: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  followButton: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 24,
  },
  followButtonText: {
    color: '#101010',
    fontSize: 14,
    fontWeight: '700',
  },
  followingButtonText: {
    color: '#fff',
  },
  error: {
    color: '#ff8b8b',
    textAlign: 'center',
    padding: 20,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  albumCard: {
    width: 130,
  },
  albumCover: {
    width: 130,
    height: 130,
    borderRadius: 6,
    marginBottom: 6,
  },
  albumName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  albumYear: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
});


