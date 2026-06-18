import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AlbumPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [listened, setListened] = useState(false);
  const [liked, setLiked] = useState(false);
  const [wantToListen, setWantToListen] = useState(false);
  const [rating, setRating] = useState(0);
  const starsRef = useRef<View>(null);
  const starsLayout = useRef<any>(null);

  // ტრექის მენიუსთვის
  const [trackMenuVisible, setTrackMenuVisible] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [trackListened, setTrackListened] = useState(false);
  const [trackLiked, setTrackLiked] = useState(false);
  const [trackWantToListen, setTrackWantToListen] = useState(false);
  const [trackRating, setTrackRating] = useState(0);
  const trackStarsLayout = useRef<any>(null);

  useEffect(() => { loadAlbum(); }, []);

  async function loadAlbum() {
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) return;
    const res = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setAlbum(data);
    setTracks(data.tracks?.items || []);
  }

  async function openTrack(track: any) {
    await WebBrowser.openBrowserAsync(`https://open.spotify.com/track/${track.id}`);
  }

  function openTrackMenu(track: any) {
    setSelectedTrack(track);
    setTrackListened(false);
    setTrackLiked(false);
    setTrackWantToListen(false);
    setTrackRating(0);
    setTrackMenuVisible(true);
  }

  const starWidth = 40;
  const starGap = 8;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateRating(e.nativeEvent.pageX),
      onPanResponderMove: (e) => updateRating(e.nativeEvent.pageX),
    })
  ).current;

  function updateRating(pageX: number) {
    if (!starsLayout.current) return;
    const { x } = starsLayout.current;
    const relX = pageX - x;
    const totalWidth = 5 * starWidth + 4 * starGap;
    const clamped = Math.max(0, Math.min(relX, totalWidth));
    const raw = (clamped / totalWidth) * 5;
    const rounded = Math.round(raw * 2) / 2;
    setRating(Math.max(0.5, rounded));
  }

  // ცალკე PanResponder ტრექის ვარსკვლავებისთვის
  const trackPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateTrackRating(e.nativeEvent.pageX),
      onPanResponderMove: (e) => updateTrackRating(e.nativeEvent.pageX),
    })
  ).current;

  function updateTrackRating(pageX: number) {
    if (!trackStarsLayout.current) return;
    const { x } = trackStarsLayout.current;
    const relX = pageX - x;
    const totalWidth = 5 * starWidth + 4 * starGap;
    const clamped = Math.max(0, Math.min(relX, totalWidth));
    const raw = (clamped / totalWidth) * 5;
    const rounded = Math.round(raw * 2) / 2;
    setTrackRating(Math.max(0.5, rounded));
  }

  function renderStars() {
    return (
      <View
        ref={starsRef}
        onLayout={(e) => { starsLayout.current = e.nativeEvent.layout; }}
        {...panResponder.panHandlers}
        style={styles.stars}
      >
        {[1, 2, 3, 4, 5].map((s) => {
          const filled = rating >= s;
          const half = !filled && rating >= s - 0.5;
          return (
            <View key={s} style={{ width: starWidth, alignItems: 'center' }}>
              <Text style={[styles.star, (filled || half) && styles.starActive]}>
                ★
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  function renderTrackStars() {
    return (
      <View
        onLayout={(e) => { trackStarsLayout.current = e.nativeEvent.layout; }}
        {...trackPanResponder.panHandlers}
        style={styles.stars}
      >
        {[1, 2, 3, 4, 5].map((s) => {
          const filled = trackRating >= s;
          const half = !filled && trackRating >= s - 0.5;
          return (
            <View key={s} style={{ width: starWidth, alignItems: 'center' }}>
              <Text style={[styles.star, (filled || half) && styles.starActive]}>
                ★
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {album && (
        <View style={styles.header}>
          <Image source={{ uri: album.images?.[0]?.url }} style={styles.cover} />
          <Text style={styles.albumName}>{album.name}</Text>
          <Text style={styles.meta}>{album.artists?.[0]?.name}</Text>
          <Text style={styles.meta}>{album.album_type} • {album.release_date} • {album.total_tracks} tracks</Text>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.dotsBtn}>
            <Text style={styles.dots}>···</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <TouchableOpacity style={styles.rowMain} onPress={() => openTrack(item)}>
              <Text style={styles.num}>{index + 1}</Text>
              <View style={styles.info}>
                <Text style={styles.trackName}>{item.name}</Text>
                <Text style={styles.artist}>{item.artists?.[0]?.name}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.trackDotsBtn} onPress={() => openTrackMenu(item)}>
              <Text style={styles.trackDots}>···</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Album Menu */}
      <Modal visible={menuVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)} />
        <View style={styles.sheet}>
          {album && (
            <View style={styles.sheetHeader}>
              <Image source={{ uri: album.images?.[0]?.url }} style={styles.sheetCover} />
              <View>
                <Text style={styles.sheetTitle} numberOfLines={1}>{album.name}</Text>
                <Text style={styles.sheetArtist}>{album.artists?.[0]?.name}</Text>
              </View>
            </View>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setListened(!listened)}>
              <View style={[styles.actionIcon, listened && styles.actionActive]}>
                <Text style={styles.actionEmoji}>👁</Text>
              </View>
              <Text style={styles.actionText}>Listened</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setLiked(!liked)}>
              <View style={[styles.actionIcon, liked && styles.actionActive]}>
                <Text style={styles.actionEmoji}>{liked ? '♥' : '♡'}</Text>
              </View>
              <Text style={styles.actionText}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setWantToListen(!wantToListen)}>
              <View style={[styles.actionIcon, wantToListen && styles.actionActive]}>
                <Text style={styles.actionEmoji}>🕐</Text>
              </View>
              <Text style={styles.actionText}>Want to Listen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rateSection}>
            <Text style={styles.rateLabel}>Rate</Text>
            {renderStars()}
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => {
            setMenuVisible(false);
            router.push({
              pathname: '/review/new',
              params: {
                albumName: album.name,
                albumArtist: album.artists?.[0]?.name,
                albumCover: album.images?.[0]?.url,
              }
            });
          }}>
            <Text style={styles.menuText}>Review or log</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText}>Add to lists</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneBtn} onPress={() => setMenuVisible(false)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Track Menu */}
      <Modal visible={trackMenuVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setTrackMenuVisible(false)} />
        <View style={styles.sheet}>
          {selectedTrack && (
            <View style={styles.sheetHeader}>
              <Image source={{ uri: album?.images?.[0]?.url }} style={styles.sheetCover} />
              <View>
                <Text style={styles.sheetTitle} numberOfLines={1}>{selectedTrack.name}</Text>
                <Text style={styles.sheetArtist}>{selectedTrack.artists?.[0]?.name}</Text>
              </View>
            </View>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setTrackListened(!trackListened)}>
              <View style={[styles.actionIcon, trackListened && styles.actionActive]}>
                <Text style={styles.actionEmoji}>👁</Text>
              </View>
              <Text style={styles.actionText}>Listened</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setTrackLiked(!trackLiked)}>
              <View style={[styles.actionIcon, trackLiked && styles.actionActive]}>
                <Text style={styles.actionEmoji}>{trackLiked ? '♥' : '♡'}</Text>
              </View>
              <Text style={styles.actionText}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setTrackWantToListen(!trackWantToListen)}>
              <View style={[styles.actionIcon, trackWantToListen && styles.actionActive]}>
                <Text style={styles.actionEmoji}>🕐</Text>
              </View>
              <Text style={styles.actionText}>Want to Listen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rateSection}>
            <Text style={styles.rateLabel}>Rate</Text>
            {renderTrackStars()}
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => {
            setTrackMenuVisible(false);
            router.push({
              pathname: '/review/new',
              params: {
                albumName: selectedTrack?.name,
                albumArtist: selectedTrack?.artists?.[0]?.name,
                albumCover: album?.images?.[0]?.url,
              }
            });
          }}>
            <Text style={styles.menuText}>Review or log</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText}>Add to lists</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneBtn} onPress={() => setTrackMenuVisible(false)}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { alignItems: 'center', padding: 24, paddingTop: 60 },
  cover: { width: 200, height: 200, borderRadius: 8, marginBottom: 16 },
  albumName: { color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  meta: { color: '#888', fontSize: 14, marginTop: 4, textAlign: 'center' },
  dotsBtn: { position: 'absolute', top: 60, right: 20, padding: 8 },
  dots: { color: 'white', fontSize: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  num: { color: '#555', fontSize: 14, width: 28 },
  info: { flex: 1 },
  trackName: { color: 'white', fontSize: 15 },
  artist: { color: '#888', fontSize: 13, marginTop: 2 },
  trackDotsBtn: { padding: 8, paddingLeft: 12 },
  trackDots: { color: '#888', fontSize: 20 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#1c1c1e', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sheetCover: { width: 48, height: 48, borderRadius: 6, marginRight: 12 },
  sheetTitle: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  sheetArtist: { color: '#888', fontSize: 13, marginTop: 2 },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  actionBtn: { alignItems: 'center' },
  actionIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionActive: { backgroundColor: '#ffb6c1' },
  actionEmoji: { fontSize: 24 },
  actionText: { color: '#aaa', fontSize: 12 },
  rateSection: { alignItems: 'center', marginBottom: 24 },
  rateLabel: { color: '#888', fontSize: 13, marginBottom: 10 },
  stars: { flexDirection: 'row' },
  star: { fontSize: 36, color: '#333' },
  starActive: { color: '#ffb6c1' },
  menuItem: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#2a2a2a', alignItems: 'center' },
  menuText: { color: 'white', fontSize: 16 },
  doneBtn: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
