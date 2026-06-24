cat > app/review/detail.tsx << 'EOF'
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ReviewDetail() {
  const { albumName, albumArtist, albumCover, rating, review, date } = useLocalSearchParams();
  const router = useRouter();
  const r = Number(rating);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹ Reviews</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Review</Text>
        <View style={{ width: 80 }} />
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  back: { color: '#aaa', fontSize: 16 },
  title: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  body: { padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  left: { flex: 1, marginRight: 16 },
  albumName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  artist: { color: '#888', fontSize: 15, marginBottom: 8 },
  rating: { color: '#ffb6c1', fontSize: 18, marginBottom: 8 },
  date: { color: '#555', fontSize: 13 },
  cover: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#2a2a2a' },
  reviewText: { color: '#ccc', fontSize: 15, lineHeight: 24 },
});
EOF
