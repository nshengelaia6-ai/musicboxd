import { useAppTheme } from '@/context/ThemeContext';
import { API_BASE } from '@/utils/api';
import { getCurrentUserId } from '@/utils/currentUser';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(value);
  const hasHalf = value - full >= 0.5;

  return (
    <View style={{ flexDirection: 'row', marginTop: 4 }}>
      {Array.from({ length: full }).map((_, i) => (
        <Ionicons key={i} name="star" size={size} color="#ffc2d4" style={{ marginRight: 2 }} />
      ))}
      {hasHalf && (
        <Ionicons name="star-half" size={size} color="#ffc2d4" style={{ marginRight: 2 }} />
      )}
    </View>
  );
}

export default function Activity() {
  const { backgroundColor, accentColor } = useAppTheme();
  const [activeTab, setActiveTab] = useState('Friends');
  const [youItems, setYouItems] = useState<any[]>([]);
  const [friendItems, setFriendItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<{ [id: string]: any }>({});
  const [loadingYou, setLoadingYou] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [friendsError, setFriendsError] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadYou();
      loadFriends();
    }, [])
  );

  async function loadYou() {
    setLoadingYou(true);
    try {
      const data = await AsyncStorage.getItem('reviews');
      const reviews = data ? JSON.parse(data) : [];
      setYouItems(reviews.slice(0, 20));
    } catch {
      setYouItems([]);
    } finally {
      setLoadingYou(false);
    }
  }

  async function loadFriends() {
    setLoadingFriends(true);
    setFriendsError('');
    const myId = await getCurrentUserId();
    if (!myId) {
      setFriendItems([]);
      setLoadingFriends(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/follows/${myId}/following`);
      if (!res.ok) throw new Error(`Following request failed (${res.status})`);
      const raw = await res.json();
      const following: any[] = Array.isArray(raw) ? raw : raw?.following || raw?.data || [];
      if (!following.length) {
        setProfiles({});
        setFriendItems([]);
        return;
      }

      const profileMap: { [id: string]: any } = {};
      following.forEach(u => { profileMap[u.id] = u; });
      setProfiles(profileMap);

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

      allReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setFriendItems(allReviews.slice(0, 30));
    } catch (error) {
      console.log('loadFriends failed', error);
      setFriendItems([]);
      setFriendsError('Could not load friends activity. Try again later.');
    } finally {
      setLoadingFriends(false);
    }
  }

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
          </Text>
          {item.rating ? <Stars rating={item.rating} /> : null}
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
          </Text>
          {item.rating ? <Stars rating={item.rating} /> : null}
          <Text style={styles.time}>{timeAgo(item.date)}</Text>
        </View>
      </View>
    );
  }

  const currentItems = activeTab === 'You' ? youItems : friendItems;
  const loadingItems = activeTab === 'You' ? loadingYou : loadingFriends;
  const isEmpty = currentItems.length === 0;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={styles.header}>Activity</Text>
      <View style={styles.tabs}>
        {tabs.map(tab => (
          <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={styles.tabBtn}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTab]}>{tab}</Text>
            {activeTab === tab && <View style={[styles.underline, { backgroundColor: accentColor }]} />}
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView>
        {loadingItems ? (
          <ActivityIndicator color="#00b4d8" style={{ marginTop: 32 }} />
        ) : activeTab === 'Friends' && friendsError ? (
          <Text accessibilityRole="alert" style={styles.empty}>{friendsError}</Text>
        ) : isEmpty ? (
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
  time: { color: '#555', fontSize: 12, marginTop: 4 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
});