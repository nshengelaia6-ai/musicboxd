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
  const [showLists, setShowLists] = useState(false);
  const [userLists, setUserLists] = useState<any[]>([]);

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

    if (!res.ok) {
      console.log('Spotify API error:', res.status);
      return;
    }

    const data = await res.json();
    setAlbum(data);
    setTracks(data.tracks?.items || []);

    const listenedData = await AsyncStorage.getItem('listened');
    const listenedList = listenedData ? JSON.parse(listenedData) : [];
    const foundListened = listenedList.find((i: any) => i.id === data.id);
    setListened(!!foundListened);
    if (foundListened?.rating) setRating(foundListened.rating);

    const wantData = await AsyncStorage.getItem('wantToListen');
    const wantList = wantData ? JSON.parse(wantData) : [];
    setWantToListen(!!wantList.find((i: any) => i.id === data.id));

    const likedData = await AsyncStorage.getItem('liked');
    const likedList = likedData ? JSON.parse(likedData) : [];
    setLiked(!!likedList.find((i: any) => i.id === data.id));

    const reviewsData = await AsyncStorage.getItem('reviews');
    const reviewsList = reviewsData ? JSON.parse(reviewsData) : [];
    const foundReview = reviewsList.find((i: any) => i.albumId === data.id);
    if (foundReview?.rating) setRating(foundReview.rating);
  }

  async function openTrackMenu(track: any) {
    setSelectedTrack(track);
    setTrackMenuVisible(true);

    const listenedData = await AsyncStorage.getItem('listened');
    const listenedList = listenedData ? JSON.parse(listenedData) : [];
    const foundListened = listenedList.find((i: any) => i.id === track.id);
    setTrackListened(!!foundListened);
    setTrackRating(foundListened?.rating || 0);

    const wantData = await AsyncStorage.getItem('wantToListen');
    const wantList = wantData ? JSON.parse(wantData) : [];
    setTrackWantToListen(!!wantList.find((i: any) => i.id === track.id));

    const likedData = await AsyncStorage.getItem('liked');
    const likedList = likedData ? JSON.parse(likedData) : [];
    setTrackLiked(!!likedList.find((i: any) => i.id === track.id));

    const reviewsData = await AsyncStorage.getItem('reviews');
    const reviewsList = reviewsData ? JSON.parse(reviewsData) : [];
    const foundReview = reviewsList.find((i: any) => i.albumId === track.id);
    if (foundReview?.rating) setTrackRating(foundReview.rating);
  }

  async function openTrack(track: any) {
    await WebBrowser.openBrowserAsync(`https://open.spotify.com/track/${track.id}`);
  }

  function updateRating(newRating: number) {
    setRating(newRating);
    setListened(true);
    AsyncStorage.getItem('listened').then(existing => {
      const list = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((i: any) => i.id === album?.id);
      if (idx !== -1) {
        list[idx].rating = newRating;
      } else {
        list.unshift({ id: album?.id, name: album?.name, cover: album?.images?.[0]?.url, type: 'album', rating: newRating, date: new Date().toISOString() });
      }
      AsyncStorage.setItem('listened', JSON.stringify(list));
    });
  }

  function updateTrackRating(newRating: number) {
    setTrackRating(newRating);
    setTrackListened(true);
    AsyncStorage.getItem('listened').then(existing => {
      const list = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((i: any) => i.id === selectedTrack?.id);
      if (idx !== -1) {
        list[idx].rating = newRating;
        list[idx].albumId = album?.id;
      } else {
        list.unshift({ id: selectedTrack?.id, name: selectedTrack?.name, cover: album?.images?.[0]?.url, type: 'track', albumId: album?.id, rating: newRating, date: new Date().toISOString() });
      }
      AsyncStorage.setItem('listened', JSON.stringify(list));
    });
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor }]} ref={scrollViewRef}>
      {album && (
        <View style={styles.header} onLayout={(e) => { headerHeight.current = e.nativeEvent.layout.height; }}>
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
              onLayout={(e) => { trackRowOffsets.current[item.id] = headerHeight.current + e.nativeEvent.layout.y; }}
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
            
