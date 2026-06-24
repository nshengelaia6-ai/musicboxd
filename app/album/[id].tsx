import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import StarRating from './StarRating';
import { useAppTheme } from '@/context/ThemeContext';

export default function AlbumPage() {
  const { id, highlightTrackId } = useLocalSearchParams();
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [album, setAlbum] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [listened, setListened] = useState(false);
  const [liked, setLiked] = useState(false);
  const [wantToListen, setWantToListen] = useState(false);
  const [rating, setRating] = useState(0);

  const [trackMenuVisible, setTrackMenuVisible] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [trackListened, setTrackListened] = useState(false);
  const [trackLiked, setTrackLiked] = useState(false);
  const [trackWantToListen, setTrackWantToListen] = useState(false);
  const [trackRating, setTrackRating] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const trackRowOffsets = useRef<{ [key: string]: number }>({});
  const headerHeight = useRef(0);

  useFocusEffect(
    useCallback(() => {
      loadAlbum();
    }, [id])
  );

  useEffect(() => {
    if (!highlightTrackId || tracks.length === 0) return;
    const timer = setTimeout(() => {
      const y = trackRowOffsets.current[highlightTrackId as string];
      if (typeof y === 'number') {
        scrollViewRef.current?.scrollTo({ y: Math.max(y - 100, 0), animated: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightTrackId, tracks]);

  async function loadAlbum() {
    const token = await AsyncStorage.getItem('spotify_token');
    if (!token) return;
    const res = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setAlbum(data);
    setTracks(data.tracks?.items || []);

    const listenedData = await AsyncStorage.getItem('listened');
    const listenedList = listenedData ? JSON.parse(listenedData) : [];
    setListened(!!listenedList.find((i: any) => i.id === data.id));

    const wantData = await AsyncStorage.getItem('wantToListen');
    const wantList = wantData ? JSON.parse(wantData) : [];
    setWantToListen(!!wantList.find((i: any) => i.id === data.id));

    const likedData = await AsyncStorage.getItem('liked');
    const likedList = likedData ? JSON.parse(likedData) : [];
    setLiked(!!likedList.find((i: any) => i.id === data.id));

    const reviewsData = await AsyncStorage.getItem('reviews');
    const reviewsList = reviewsData ? JSON.parse(reviewsData) : [];
    const foundReview = reviewsList.find((i: any) => i.albumId === data.id);
    setRating(foundReview ? foundReview.rating : 0);
  }

  async function openTrackMenu(track: any) {
    setSelectedTrack(track);
    setTrackMenuVisible(true);

    const listenedData = await AsyncStorage.getItem('listened');
    const listenedList = listenedData ? JSON.parse(listenedData) : [];
    setTrackListened(!!listenedList.find((i: any) => i.id === track.id));

    const wantData = await AsyncStorage.getItem('wantToListen');
    const wantList = wantData ? JSON.parse(wantData) : [];
    setTrackWantToListen(!!wantList.find((i: any) => i.id === track.id));

    const likedData = await AsyncStorage.getItem('liked');
    const likedList = likedData ? JSON.parse(likedData) : [];
    setTrackLiked(!!likedList.find((i: any) => i.id === track.id));

    const reviewsData = await AsyncStorage.getItem('reviews');
    const reviewsList = reviewsData ? JSON.parse(reviewsData) : [];
    const foundReview = reviewsList.find((i: any) => i.albumId === track.id);
    setTrackRating(foundReview ? foundReview.rating : 0);
  }

  async function openTrack(track: any) {
    await WebBrowser.openBrowserAsync(`https://open.spotify.com/track/${track.id}`);
  }

  function updateRating(newRating: number) {
    setRating(newRating);

    AsyncStorage.getItem('listened').then(existing => {
      const list = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((i: any) => i.id === album?.id);
      if (idx !== -1) {
        list[idx].rating = newRating;
      } else {
        setListened(true);
        list.unshift({ id: album?.id, name: album?.name, cover: album?.images?.[0]?.url, type: 'album', rating: newRating, date: new Date().toISOString() });
      }
      AsyncStorage.setItem('listened', JSON.stringify(list));
    });
  }

  function updateTrackRating(newRating: number) {
    setTrackRating(newRating);

    AsyncStorage.getItem('listened').then(existing => {
      const list = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((i: any) => i.id === selectedTrack?.id);
      if (idx !== -1) {
        list[idx].rating = newRating;
        list[idx].albumId = album?.id;
      } else {
        setTrackListened(true);
        list.unshift({ id: selectedTrack?.id, name: selectedTrack?.name, cover: album?.images?.[0]?.url, type: 'track', albumId: album?.id, rating: newRating, date: new Date().toISOString() });
      }
      AsyncStorage.setItem('listened', JSON.stringify(list));
    });
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor }]} ref={scrollViewRef}>
      {album && (
        <View
          style={styles.header}
          onLayout={(e) => { headerHeight.current = e.nativeEvent.layout.height; }}
        >
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
        keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : index.toString()}
        scrollEnabled={false}
        renderItem={({ item, index }) => {
          const isHighlighted = highlightTrackId && item.id === highlightTrackId;
          return (
            <View
              style={[styles.row, isHighlighted && { backgroundColor: accentColor + '26' }]}
              onLayout={(e) => {
                trackRowOffsets.current[item.id] = headerHeight.current + e.nativeEvent.layout.y;
              }}
            >
              <TouchableOpacity style={styles.rowMain} onPress={() => openTrack(item)}>
                <Text style={styles.num}>{index + 1}</Text>
                <View style={styles.info}>
                  <Text style={[styles.trackName, isHighlighted && { color: accentColor, fontWeight: 'bold' }]}>{item.name}</Text>
                  <Text style={styles.artist}>{item.artists?.[0]?.name}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.trackDotsBtn} onPress={() => openTrackMenu(item)}>
                <Text style={styles.trackDots}>···</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

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
            <TouchableOpacity style={styles.actionBtn} onPress={async () => {
              const newVal = !listened;
              setListened(newVal);
              const existing = await AsyncStorage.getItem('listened');
              const list = existing ? JSON.parse(existing) : [];
              if (newVal) {
                if (!list.find((i: any) => i.id === album.id)) {
                  list.unshift({ id: album.id, name: album.name, cover: album.images?.[0]?.url, type: 'album', rating, date: new Date().toISOString() });
                }
              } else {
                const idx = list.findIndex((i: any) => i.id === album.id);
                if (idx !== -1) list.splice(idx, 1);
              }
              await AsyncStorage.setItem('listened', JSON.stringify(list));
            }}>
              <View style={[styles.actionIcon, listened && { backgroundColor: accentColor }]}>
                <Text style={styles.actionEmoji}>👁</Text>
              </View>
              <Text style={styles.actionText}>Listened</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={async () => {
              const newVal = !liked;
              setLiked(newVal);
              const existing = await AsyncStorage.getItem('liked');
              const list = existing ? JSON.parse(existing) : [];
              if (newVal) {
                if (!list.find((i: any) => i.id === album.id)) {
                  list.unshift({ id: album.id, name: album.name, cover: album.images?.[0]?.url, type: 'album' });
                }
              } else {
                const idx = list.findIndex((i: any) => i.id === album.id);
                if (idx !== -1) list.splice(idx, 1);
              }
              await AsyncStorage.setItem('liked', JSON.stringify(list));
            }}>
              <View style={[styles.actionIcon, liked && { backgroundColor: accentColor }]}>
                <Text style={styles.actionEmoji}>{liked ? '♥' : '♡'}</Text>
              </View>
              <Text style={styles.actionText}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={async () => {
              const newVal = !wantToListen;
              setWantToListen(newVal);
              const existing = await AsyncStorage.getItem('wantToListen');
              const list = existing ? JSON.parse(existing) : [];
              if (newVal) {
                if (!list.find((i: any) => i.id === album.id)) {
                  list.unshift({ id: album.id, name: album.name, cover: album.images?.[0]?.url, type: 'album' });
                }
              } else {
                const idx = list.findIndex((i: any) => i.id === album.id);
                if (idx !== -1) list.splice(idx, 1);
              }
              await AsyncStorage.setItem('wantToListen', JSON.stringify(list));
            }}>
              <View style={[styles.actionIcon, wantToListen && { backgroundColor: accentColor }]}>
                <Text style={styles.actionEmoji}>🕐</Text>
              </View>
              <Text style={styles.actionText}>Want to Listen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rateSection}>
            <Text style={styles.rateLabel}>Rate</Text>
            <StarRating rating={rating} onChange={updateRating} />
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => {
            setMenuVisible(false);
            router.push({
              pathname: '/review/new',
              params: {
                albumId: album.id,
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
            <TouchableOpacity style={styles.actionBtn} onPress={async () => {
              const newVal = !trackListened;
              setTrackListened(newVal);
              const existing = await AsyncStorage.getItem('listened');
              const list = existing ? JSON.parse(existing) : [];
              if (newVal) {
                if (!list.find((i: any) => i.id === selectedTrack.id)) {
                  list.unshift({ id: selectedTrack.id, name: selectedTrack.name, cover: album?.images?.[0]?.url, type: 'track', albumId: album?.id, rating: trackRating, date: new Date().toISOString() });
                }
              } else {
                const idx = list.findIndex((i: any) => i.id === selectedTrack.id);
                if (idx !== -1) list.splice(idx, 1);
              }
              await AsyncStorage.setItem('listened', JSON.stringify(list));
            }}>
              <View style={[styles.actionIcon, trackListened && { backgroundColor: accentColor }]}>
                <Text style={styles.actionEmoji}>👁</Text>
              </View>
              <Text style={styles.actionText}>Listened</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={async () => {
              const newVal = !trackLiked;
              setTrackLiked(newVal);
              const existing = await AsyncStorage.getItem('liked');
              const list = existing ? JSON.parse(existing) : [];
              if (newVal) {
                if (!list.find((i: any) => i.id === selectedTrack.id)) {
                  list.unshift({ id: selectedTrack.id, name: selectedTrack.name, cover: album?.images?.[0]?.url, type: 'track', albumId: album?.id });
                }
              } else {
                const idx = list.findIndex((i: any) => i.id === selectedTrack.id);
                if (idx !== -1) list.splice(idx, 1);
              }
              await AsyncStorage.setItem('liked', JSON.stringify(list));
            }}>
              <View style={[styles.actionIcon, trackLiked && { backgroundColor: accentColor }]}>
                <Text style={styles.actionEmoji}>{trackLiked ? '♥' : '♡'}</Text>
              </View>
              <Text style={styles.actionText}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={async () => {
              const newVal = !trackWantToListen;
              setTrackWantToListen(newVal);
              const existing = await AsyncStorage.getItem('wantToListen');
              const list = existing ? JSON.parse(existing) : [];
              if (newVal) {
                if (!list.find((i: any) => i.id === selectedTrack.id)) {
                  list.unshift({ id: selectedTrack.id, name: selectedTrack.name, cover: album?.images?.[0]?.url, type: 'track', albumId: album?.id });
                }
              } else {
                const idx = list.findIndex((i: any) => i.id === selectedTrack.id);
                if (idx !== -1) list.splice(idx, 1);
              }
              await AsyncStorage.setItem('wantToListen', JSON.stringify(list));
            }}>
              <View style={[styles.actionIcon, trackWantToListen && { backgroundColor: accentColor }]}>
                <Text style={styles.actionEmoji}>🕐</Text>
              </View>
              <Text style={styles.actionText}>Want to Listen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rateSection}>
            <Text style={styles.rateLabel}>Rate</Text>
            <StarRating rating={trackRating} onChange={updateTrackRating} />
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => {
            setTrackMenuVisible(false);
            router.push({
              pathname: '/review/new',
              params: {
                albumId: selectedTrack?.id,
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
  container: { flex: 1 },
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
  actionEmoji: { fontSize: 24 },
  actionText: { color: '#aaa', fontSize: 12 },
  rateSection: { alignItems: 'center', marginBottom: 24 },
  rateLabel: { color: '#888', fontSize: 13, marginBottom: 10 },
  menuItem: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#2a2a2a', alignItems: 'center' },
  menuText: { color: 'white', fontSize: 16 },
  doneBtn: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
