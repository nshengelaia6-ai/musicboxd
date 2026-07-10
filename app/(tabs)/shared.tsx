import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function Shared() {
  const [sharedSongs, setSharedSongs] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadShared();
    }, [])
  );

  async function loadShared() {
    const data = await AsyncStorage.getItem('shared_songs');
    if (data) setSharedSongs(JSON.parse(data));
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Shared Songs</Text>
      {sharedSongs.length === 0 ? (
        <Text style={styles.empty}>Nothing shared yet</Text>
      ) : (
        sharedSongs.map(item => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardInner}>
              <Image source={{ uri: item.cover }} style={styles.cover} />
              <View style={styles.info}>
                <Text style={styles.songName}>{item.name}</Text>
                <Text style={styles.artist}>{item.artist}</Text>
                {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
                <Text style={styles.meta}>from {item.from} • {formatDate(item.date)}</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60 },
  heading: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 20, paddingHorizontal: 16 },
  empty: { color: '#888', fontSize: 14, paddingHorizontal: 16 },
  card: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden' },
  cardInner: { flexDirection: 'row', padding: 16, alignItems: 'flex-start' },
  cover: { width: 80, height: 80, borderRadius: 10, marginRight: 14 },
  info: { flex: 1, justifyContent: 'center' },
  songName: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  artist: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  message: { color: '#ddd', fontSize: 14, marginBottom: 8, lineHeight: 20 },
  meta: { color: '#666', fontSize: 12 },
});
