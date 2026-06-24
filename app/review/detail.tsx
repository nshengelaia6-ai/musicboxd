import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ReviewDetail() {
  const { id, albumName, albumArtist, albumCover, rating, review, date } = useLocalSearchParams();
  const router = useRouter();
  const r = Number(rating);
  const [likes, setLikes] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    loadLikes();
  }, []);

  async function loadLikes() {
    const data = await AsyncStorage.getItem(`likes_${id}`);
    if (data) setLikes(Number(data));
  }

  async function handleLike() {
    const newLikes = likes + 1;
    setLikes(newLikes);
    await AsyncStorage.setItem(`likes_${id}`, String(newLikes));
  }

  async function handleDelete() {
    Alert.alert('წაშლა', 'დარწმუნებული ხარ?', [
      { text: 'გაუქმება', style: 'cancel' },
      {
        text: 'წაშლა', style: 'destructive', onPress: async () => {
          const data = await AsyncStorage.getItem('reviews');
          const reviews = data ? JSON.parse(data) : [];
          const updated = reviews.filter((r: any) => r.id !== id);
          await AsyncStorage.setItem('reviews', JSON.stringify(updated));
          router.back();
        }
      }
    ]);
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Reviews</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Review</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Text style={styles.dots}>···</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.left}>
            <Text style={styles.albumName}>{albumName}</Text>
            <Text style={styles.artist}>{albumArtist}</Text>
            <Text style={styles.rating}>{'★'.repeat(Math.floor(r))}{r % 1 ? '½' : ''}</Text>
            <Text style={styles.date}>{new Date(date as string).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </View>
          {albumCover
            ? <Image source={{ uri: albumCover as string }} style={styles.cover} />
            : <View style={[styles.cover, { backgroundColor: '#2a2a2a' }]} />}
        </View>

        <Text style={styles.reviewText}>{review}</Text>

        <TouchableOpacity style={styles.likeRow} onPress={handleLike}>
          <Text style={styles.likeIcon}>♡</Text>
          <Text style={styles.likeText}>{likes === 0 ? 'No likes yet' : `${likes} likes`}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={menuVisible} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)} />
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.menuItem} onPress={() => {
            setMenuVisible(false);
            router.push({
              pathname: '/review/new',
              params: { albumId: albumId, albumName, albumArtist, albumCover },

            });
          }}>
            <Text style={styles.menuText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleDelete(); }}>
            <Text style={[styles.menuText, { color: '#ff4444' }]}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneBtn} onPress={() => setMenuVisible(false)}>
            <Text style={styles.doneBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  back: { color: '#aaa', fontSize: 16 },
  title: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  dots: { color: '#fff', fontSize: 24 },
  body: { padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  left: { flex: 1, marginRight: 16 },
  albumName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  artist: { color: '#888', fontSize: 15, marginBottom: 8 },
  rating: { color: '#ffb6c1', fontSize: 18, marginBottom: 8 },
  date: { color: '#555', fontSize: 13 },
  cover: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#2a2a2a' },
  reviewText: { color: '#ccc', fontSize: 15, lineHeight: 24, marginBottom: 24 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  likeIcon: { color: '#ffb6c1', fontSize: 22 },
  likeText: { color: '#888', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#1c1c1e', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  menuItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', alignItems: 'center' },
  menuText: { color: '#fff', fontSize: 16 },
  doneBtn: { backgroundColor: '#2a2a2a', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
