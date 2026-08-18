import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId } from '@/utils/currentUser';

const tabs = ['Friends', 'You'];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Activity() {
  const [activeTab, setActiveTab] = useState('Friends');
  const [youItems, setYouItems] = useState<any[]>([]);
  const [friendItems, setFriendItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ [id: string]: any }>({});

  useFocusEffect(
    useCallback(() => {
      loadYou();
      loadFriends();
    }, [])
  );

  async function loadYou() {
    const data = await AsyncStorage.getItem('reviews');
    const reviews = data ? JSON.parse(data) : [];
    setYouItems(reviews.slice(0, 20));
  }

  async function loadFriends() {
    const myId = await getCurrentUserId();
    if (!myId) return;

    try {
      // ვიღებთ following სიას
      const res = await fetch(`${API_BASE}/follows/${myId}/following`);
      const following: any[] = await res.json();
      if (!following.length) return;

      // პროფილები შევინახოთ
      const profileMap: { [id: string]: any } = {};
      following.forEach(u => { profileMap[u.id] = u; });
      setProfiles(profileMap);

      // თითო user-ის reviews backend-დან
      const allReviews: any[] = [];
      await Promise.all(
        following.map(async (user) => {
          try {
            const r = await fetch(`${API_BASE}/reviews/${user.id}`);
            if (r.ok) {
              const userReviews = await r.json();
              userReviews.forEach((rv: any) => {
                allReviews.push({ ...rv, _userId: user.id });
              });
            }
          } catch {}
        })
      );

      // თარიღის მიხედვით დავალაგოთ
      allReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setFriendItems(allReviews.slice(0, 30));
    } catch (e) {
      console.log('loadFriends failed', e);
    }
  }

  const myProfile = useCallback(async () => {
    const data = await AsyncStorage.getItem('profile');
    return data ? JSON.parse(data) : {};
  }, []);

  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState('you');

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('profile').then(data => {
        if (data) {
          const p = JSON.parse(data);
          setMyAvatar(p.avatar || null);
          setMyUsername(p.username || 'you');
        }
      });
    }, [])
  );

  function renderFriendItem(item: any) {
    const user = profiles[item._userId];
    const username = user?.username || 'user';
    const avatar = user?.avatar || null;
    const action = item.review ? 'reviewed' : 'rated';

    return (
      <View key={`${item._userId}-${item.albumId}`} style={styles.row}>
        {avatar
          ? <Image source={{ uri: avatar }} style={styles.avatar} />
          : <View style={styles.avatar} />}
        <View style={styles.info}>
          <Text style={styles.text}>
            <Text style={styles.username}>{username}</Text>
            {' '}{action}{' '}
            <Text style={styles.song}>{item.albumName}</Text>
            {item.rating
              ? <Text style={styles.rating}> ⭐{item.rating}</Text>
              : null}
          </Text>
          <Text style={styles.time}>{timeAgo(item.date)}</Text>
        </View>
      </View>
    );
  }

  function renderYouItem(item: any) {
    const action = item.review ? 'reviewed' : 'rated';
    return (
      <View key={item.id} style={styles.row}>
        {myAvatar
          ? <Image source={{ uri: myAvatar }} style={styles.avatar} />
          : <View style={styles.avatar} />}
        <View style={styles.info}>
          <Text style={styles.text}>
            <Text style={styles.username}>{myUsername}</Text>
            {' '}{action}{' '}
            <Text style={styles.song}>{item.albumName}</Text>
            {item.rating
              ? <Text style={styles.rating}> ⭐{item.rating}</Text>
              : null}
          </Text>
          <Text style={styles.time}>{timeAgo(item.date)}</Text>
        </View>
      </View>
    );
  }

  const currentItems = activeTab === 'You' ? youItems : friendItems;
  const isEmpty = currentItems.length === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Activity</Text>
      <View style={styles.tabs}>
        {tabs.map(tab => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTab]}>{tab}</Text>
            {activeTab === tab && <View style={styles.underline} />}
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView>
        {isEmpty ? (
          <Text style={styles.empty}>
            {activeTab === 'Friends'
              ? 'შენი მეგობრების აქტივობა ჯერ არ არის'
              : 'ჯერ არ გაქვს აქტივობა'}
          </Text>
        ) : activeTab === 'You'
          ? youItems.map(renderYouItem)
          : friendItems.map(renderFriendItem)
        }
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#141414', paddingTop: 60 },
  header: { fontSize: 28, fontWeight: 'bold', color: '#fff', paddingHorizontal: 20, marginBottom: 16 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  tabBtn: { marginRight: 24, alignItems: 'center' },
  tabText: { color: '#555', fontSize: 16, fontWeight: '600', paddingBottom: 4 },
  activeTab: { color: '#fff' },
  underline: { height: 2, backgroundColor: '#00b4d8', width: '100%' },
  row: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', marginRight: 12 },
  info: { flex: 1 },
  text: { color: '#ccc', fontSize: 14 },
  username: { color: '#fff', fontWeight: 'bold' },
  song: { color: '#00b4d8' },
  rating: { color: '#f4c430' },
  time: { color: '#555', fontSize: 12, marginTop: 4 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
});
