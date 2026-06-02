import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import { useEffect, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSpotifyAuth } from '../../utils/spotify';

const supabase = createClient(
 'https://jvxsfjxcydpdlvwrxmor.supabase.co',
 'sb_publishable_tH6PoxGwVF9JyUvsMw0mUg_cFiFzeCm'
);

export default function Home() {
 const { request, response, promptAsync } = useSpotifyAuth();
 const [token, setToken] = useState<string | null>(null);
 const [newReleases, setNewReleases] = useState<any[]>([]);
 const [newFromFriends, setNewFromFriends] = useState<any[]>([]);
 const [popularWithFriends, setPopularWithFriends] = useState<any[]>([]);
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);

 useEffect(() => {
   AsyncStorage.getItem('spotify_token').then(t => {
     if (t) setToken(t);
   });
 }, []);

 useEffect(() => {
   if (response?.type === 'success') {
     const { code } = response.params;
     exchangeToken(code, request?.codeVerifier!);
   }
 }, [response]);

 async function exchangeToken(code: string, verifier: string) {
   const res = await fetch('https://accounts.spotify.com/api/token', {
     method: 'POST',
     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
     body: new URLSearchParams({
       grant_type: 'authorization_code',
       code,
       redirect_uri: AuthSession.makeRedirectUri(),
       client_id: '1aa0b67931ea472fb250a8dce0915c04',
       code_verifier: verifier,
     }).toString(),
   });
   const data = await res.json();
   setToken(data.access_token);
   await AsyncStorage.setItem('spotify_token', data.access_token);
   await saveUserToSupabase(data.access_token);
 }

 async function saveUserToSupabase(accessToken: string) {
   const res = await fetch('https://api.spotify.com/v1/me', {
     headers: { Authorization: `Bearer ${accessToken}` },
   });
   const profile = await res.json();
   const { data } = await supabase
     .from('users')
     .upsert({
       spotify_id: profile.id,
       username: profile.display_name,
       avatar_url: profile.images?.[0]?.url,
     }, { onConflict: 'spotify_id' })
     .select()
     .single();
   if (data) setCurrentUserId(data.id);
 }

 async function logout() {
   await AsyncStorage.removeItem('spotify_token');
   setToken(null);
   setNewReleases([]);
   setNewFromFriends([]);
   setPopularWithFriends([]);
   setCurrentUserId(null);
 }

 useEffect(() => {
   if (!token) return;
   fetch('https://api.spotify.com/v1/search?q=year:2026&type=album&limit=10', {
     headers: { Authorization: `Bearer ${token}` },
   }).then(r => r.json()).then(d => {
     if (d.error?.status === 401) { logout(); return; }
     setNewReleases(d.albums?.items || []);
   });
 }, [token]);

 useEffect(() => {
   if (!currentUserId) return;
   loadFriendsActivity(currentUserId);
 }, [currentUserId]);

 async function loadFriendsActivity(userId: string) {
   const { data: friendships } = await supabase
     .from('friendships')
     .select('friend_id')
     .eq('user_id', userId);

   if (!friendships?.length) return;
   const friendIds = friendships.map(f => f.friend_id);

   const { data: recentRatings } = await supabase
     .from('ratings')
     .select('*, users(username, avatar_url)')
     .in('user_id', friendIds)
     .order('created_at', { ascending: false })
     .limit(10);
   setNewFromFriends(recentRatings || []);

   const { data: allRatings } = await supabase
     .from('ratings')
     .select('item_id, item_name, artist_name, cover_url, rating')
     .in('user_id', friendIds);

   if (allRatings) {
     const counts: any = {};
     allRatings.forEach(r => {
       if (!counts[r.item_id]) counts[r.item_id] = { ...r, count: 0 };
       counts[r.item_id].count++;
     });
     const sorted = Object.values(counts)
       .sort((a: any, b: any) => b.count - a.count)
       .slice(0, 10);
     setPopularWithFriends(sorted);
   }
 }

 if (!token) {
   return (
     <View style={styles.loginContainer}>
       <Text style={styles.title}>🎵 MusicBoxd</Text>
       <TouchableOpacity style={styles.loginBtn} onPress={() => promptAsync()}>
         <Text style={styles.loginText}>Spotify-ით შესვლა</Text>
       </TouchableOpacity>
     </View>
   );
 }

 return (
   <ScrollView style={styles.container}>
     <View style={styles.header}>
       <Text style={styles.pageTitle}>For You</Text>
       <TouchableOpacity onPress={logout}>
         <Text style={styles.logoutText}>გამოსვლა</Text>
       </TouchableOpacity>
     </View>

     <Text style={styles.heading}>New Releases</Text>
     <FlatList
       horizontal
       data={newReleases}
       keyExtractor={(i) => i.id}
       showsHorizontalScrollIndicator={false}
       renderItem={({ item }) => (
         <View style={styles.card}>
           <Image source={{ uri: item.images[0]?.url }} style={styles.cover} />
           <Text style={styles.trackName} numberOfLines={1}>{item.name}</Text>
           <Text style={styles.artistName} numberOfLines={1}>{item.artists[0]?.name}</Text>
         </View>
       )}
     />

     <Text style={styles.heading}>New from Friends</Text>
     {newFromFriends.length === 0 ? (
       <View style={styles.emptySection}>
         <Text style={styles.emptyText}>მეგობრების აქტივობა აქ გამოჩნდება</Text>
       </View>
     ) : (
       <FlatList
         horizontal
         data={newFromFriends}
         keyExtractor={(i) => i.id}
         showsHorizontalScrollIndicator={false}
         renderItem={({ item }) => (
           <View style={styles.card}>
             <Image source={{ uri: item.cover_url }} style={styles.cover} />
             <Text style={styles.trackName} numberOfLines={1}>{item.item_name}</Text>
             <Text style={styles.artistName} numberOfLines={1}>{item.artist_name}</Text>
             <Text style={styles.ratingText}>⭐ {item.rating}</Text>
             <Text style={styles.friendName}>{item.users?.username}</Text>
           </View>
         )}
       />
     )}

     <Text style={styles.heading}>Popular with Friends</Text>
     {popularWithFriends.length === 0 ? (
       <View style={styles.emptySection}>
         <Text style={styles.emptyText}>პოპულარული კონტენტი მეგობრებში</Text>
       </View>
     ) : (
       <FlatList
         horizontal
         data={popularWithFriends}
         keyExtractor={(item: any) => item.item_id}
         showsHorizontalScrollIndicator={false}
         renderItem={({ item }: any) => (
           <View style={styles.card}>
             <Image source={{ uri: item.cover_url }} style={styles.cover} />
             <Text style={styles.trackName} numberOfLines={1}>{item.item_name}</Text>
             <Text style={styles.artistName} numberOfLines={1}>{item.artist_name}</Text>
             <Text style={styles.ratingText}>👥 {item.count}</Text>
           </View>
         )}
       />
     )}
   </ScrollView>
 );
}

const styles = StyleSheet.create({
 container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 60 },
 loginContainer: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
 title: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 40 },
 loginBtn: { backgroundColor: '#1DB954', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 30 },
 loginText: { color: 'black', fontSize: 16 },
 header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
 pageTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
 logoutText: { color: '#888', fontSize: 14 },
 heading: { color: 'white', fontSize: 20, fontWeight: 'bold', margin: 16, marginBottom: 8 },
 card: { width: 140, marginLeft: 16, marginBottom: 8 },
 cover: { width: 140, height: 140, borderRadius: 8 },
 trackName: { color: 'white', marginTop: 6, fontSize: 13, fontWeight: '600' },
 artistName: { color: '#888', fontSize: 12 },
 ratingText: { color: '#1DB954', fontSize: 12, marginTop: 2 },
 friendName: { color: '#555', fontSize: 11 },
 emptySection: { marginHorizontal: 16, marginBottom: 16, padding: 20, backgroundColor: '#1a1a1a', borderRadius: 8 },
 emptyText: { color: '#555', fontSize: 14, textAlign: 'center' },
});
