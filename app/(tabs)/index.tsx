import { useAppTheme } from '@/context/ThemeContext';
import { activateSpotifyAccount, getActiveSpotifyAccountId } from '@/utils/accountStorage';
import { getCurrentSpotifyProfile, type SpotifyProfile } from '@/utils/currentUser';
import {
    clearSpotifySession,
    getValidSpotifyToken,
    notifySpotifySessionChanged,
    persistSpotifyTokenResponse,
    refreshSpotifyToken,
    SPOTIFY_CLIENT_ID,
    useSpotifyAuth
} from '@/utils/spotify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const supabase = createClient(
 'https://jvxsfjxcydpdlvwrxmor.supabase.co',
 'sb_publishable_tH6PoxGwVF9JyUvsMw0mUg_cFiFzeCm'
);

async function saveUserToSupabase(profile: SpotifyProfile): Promise<string | null> {
  if (!('display_name' in profile) && !('images' in profile)) {
    return AsyncStorage.getItem('supabase_user_id');
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        spotify_id: profile.id,
        username: profile.display_name,
        avatar_url: profile.images?.[0]?.url,
      }, { onConflict: 'spotify_id' })
      .select('id')
      .single();
    if (error) throw error;
    if (data?.id) {
      await AsyncStorage.setItem('supabase_user_id', data.id);
      return data.id;
    }
  } catch (error) {
    console.log('Failed to restore Supabase user', error);
  }

  return AsyncStorage.getItem('supabase_user_id');
}

export default function Home() {
 const router = useRouter();
 const { backgroundColor, accentColor } = useAppTheme();
 const { request, response, promptAsync, redirectUri } = useSpotifyAuth();
 const [token, setToken] = useState<string | null>(null);
 const [restoringSession, setRestoringSession] = useState(true);
 const [authError, setAuthError] = useState('');
 const [newReleases, setNewReleases] = useState<any[]>([]);
 const [releasesLoading, setReleasesLoading] = useState(true);
 const [releaseError, setReleaseError] = useState('');
 const [newFromFriends, setNewFromFriends] = useState<any[]>([]);
 const [popularWithFriends, setPopularWithFriends] = useState<any[]>([]);
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);
 const [friendFeedLoading, setFriendFeedLoading] = useState(true);
 const [friendFeedError, setFriendFeedError] = useState('');
 const currentYear = new Date().getFullYear();

 useFocusEffect(
   useCallback(() => {
     let active = true;

     async function restoreSession() {
       setRestoringSession(true);
       let lastValidToken: string | null = null;
       try {
         const storedToken = await AsyncStorage.getItem('spotify_token');
         if (!storedToken) {
           if (active) {
             setToken(null);
             setCurrentUserId(null);
           }
           return;
         }

         const validToken = await getValidSpotifyToken();
         lastValidToken = validToken;
         if (!validToken) {
           if (active) {
             setToken(null);
             setCurrentUserId(null);
           }
           return;
         }

         const profile = await getCurrentSpotifyProfile();
         if (!profile) {
           if (active) setToken(validToken);
           return;
         }

         await activateSpotifyAccount(profile.id, profile.id);
         await AsyncStorage.setItem('spotify_user_id', profile.id);
         const userId = await saveUserToSupabase(profile);
         const refreshedToken = await getValidSpotifyToken();

         if (active) {
           setToken(refreshedToken || validToken);
           setCurrentUserId(userId);
         }
       } catch (error) {
         console.log('Failed to restore Spotify session', error);
         if (active && lastValidToken) setToken(lastValidToken);
       } finally {
         if (active) setRestoringSession(false);
       }
     }

     restoreSession();
     return () => {
       active = false;
     };
   }, [])
 );

 const exchangeToken = useCallback(async (code: string, verifier: string) => {
   setAuthError('');
   try {
     const previousUserId = await getActiveSpotifyAccountId()
       || await AsyncStorage.getItem('spotify_user_id');
     const res = await fetch('https://accounts.spotify.com/api/token', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: new URLSearchParams({
         grant_type: 'authorization_code',
         code,
         redirect_uri: redirectUri,
         client_id: SPOTIFY_CLIENT_ID,
         code_verifier: verifier,
       }).toString(),
     });
     if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`);

     const data = await res.json();
     const profile = await getCurrentSpotifyProfile(data.access_token);
     if (!profile) throw new Error('Unable to verify Spotify account');

     await clearSpotifySession();
     await activateSpotifyAccount(profile.id, previousUserId || undefined);
     await persistSpotifyTokenResponse(data);
     await AsyncStorage.setItem('spotify_user_id', profile.id);
     await AsyncStorage.setItem('spotify_token_owner_id', profile.id);

     const userId = await saveUserToSupabase(profile);
     setToken(data.access_token);
     setCurrentUserId(userId);
     setRestoringSession(false);
     notifySpotifySessionChanged();
   } catch (error) {
     console.log('Spotify sign-in failed', error);
     setAuthError('Spotify sign-in failed. Please try again.');
     setRestoringSession(false);
   }
 }, [redirectUri]);

 useEffect(() => {
   if (response?.type === 'success') {
     setRestoringSession(true);
     setAuthError('');
     const { code } = response.params;
     const verifier = request?.codeVerifier;
     if (verifier) exchangeToken(code, verifier);
   } else if (response?.type === 'error') {
     setAuthError(response.error?.message || 'Spotify sign-in was not completed.');
   }
 }, [exchangeToken, request, response]);

 const logout = useCallback(async () => {
   await clearSpotifySession();
   setToken(null);
   setNewReleases([]);
   setNewFromFriends([]);
   setPopularWithFriends([]);
   setCurrentUserId(null);
 }, []);

 useEffect(() => {
   let active = true;
   async function loadReleases() {
     if (!token) {
       setReleasesLoading(false);
       return;
     }
     setReleasesLoading(true);
     setReleaseError('');
     try {
       let accessToken = await getValidSpotifyToken();
       if (!accessToken) {
         if (!(await AsyncStorage.getItem('spotify_token'))) await logout();
         throw new Error('Spotify session could not be refreshed.');
       }
       let response = await fetch(`https://api.spotify.com/v1/search?q=year:${currentYear}&type=album&limit=10`, {
         headers: { Authorization: `Bearer ${accessToken}` },
       });
       if (response.status === 401) {
         accessToken = await refreshSpotifyToken() || '';
         if (!accessToken) {
           if (!(await AsyncStorage.getItem('spotify_token'))) await logout();
           throw new Error('Spotify session expired.');
         }
         response = await fetch(`https://api.spotify.com/v1/search?q=year:${currentYear}&type=album&limit=10`, {
           headers: { Authorization: `Bearer ${accessToken}` },
         });
       }
       if (!response.ok) throw new Error(`Spotify releases failed (${response.status})`);
       const data = await response.json();
       if (active) setNewReleases(data.albums?.items || []);
     } catch {
       if (active) setReleaseError('Could not load new releases. Check your connection and try again.');
     } finally {
       if (active) setReleasesLoading(false);
     }
   }
   loadReleases();
   return () => { active = false; };
 }, [currentYear, logout, token]);

 const loadFriendsActivity = useCallback(async (userId: string) => {
   setFriendFeedLoading(true);
   setFriendFeedError('');
   try {
     const { data: friendships, error: friendshipsError } = await supabase
       .from('friendships')
       .select('friend_id')
       .eq('user_id', userId);
     if (friendshipsError) throw friendshipsError;

     if (!friendships?.length) {
       setNewFromFriends([]);
       setPopularWithFriends([]);
       return;
     }
     const friendIds = friendships.map(f => f.friend_id);

     const { data: recentRatings, error: recentError } = await supabase
       .from('ratings')
       .select('*, users(username, avatar_url)')
       .in('user_id', friendIds)
       .order('created_at', { ascending: false })
       .limit(10);
     if (recentError) throw recentError;
     setNewFromFriends(recentRatings || []);

     const { data: allRatings, error: ratingsError } = await supabase
       .from('ratings')
       .select('item_id, item_name, artist_name, cover_url, rating')
       .in('user_id', friendIds);
     if (ratingsError) throw ratingsError;

     const counts: Record<string, any> = {};
     (allRatings || []).forEach(rating => {
       if (!counts[rating.item_id]) counts[rating.item_id] = { ...rating, count: 0 };
       counts[rating.item_id].count++;
     });
     setPopularWithFriends(Object.values(counts).sort((a: any, b: any) => b.count - a.count).slice(0, 10));
   } catch (error) {
     console.log('Friends feed failed', error);
     setNewFromFriends([]);
     setPopularWithFriends([]);
     setFriendFeedError('Friends activity is temporarily unavailable.');
   } finally {
     setFriendFeedLoading(false);
   }
 }, []);

 useEffect(() => {
   if (currentUserId) {
     loadFriendsActivity(currentUserId);
   } else {
     setFriendFeedLoading(false);
   }
 }, [currentUserId, loadFriendsActivity]);

 if (restoringSession) {
   return (
     <View style={[styles.loginContainer, { backgroundColor }]}>
       <ActivityIndicator color={accentColor} />
     </View>
   );
 }

 if (!token) {
   return (
     <View style={[styles.loginContainer, { backgroundColor }]}>
       <Text style={styles.title}>🎵 MusicBoxd</Text>
       {!!authError && <Text accessibilityRole="alert" style={styles.authError}>{authError}</Text>}
       <TouchableOpacity style={[styles.loginBtn, { backgroundColor: accentColor }]} onPress={() => { setAuthError(''); promptAsync(); }} accessibilityRole="button" accessibilityLabel="Sign in with Spotify">
         <Text style={styles.loginText}>Spotify-ით შესვლა</Text>
       </TouchableOpacity>
     </View>
   );
 }

 return (
  <ScrollView style={[styles.container, { backgroundColor }]} contentContainerStyle={styles.content}>
     <View style={styles.header}>
       <Text style={styles.pageTitle}>For You</Text>
       
     </View>

     <Text style={styles.heading}>New Releases</Text>
     {releasesLoading ? (
       <ActivityIndicator color={accentColor} style={styles.sectionLoading} />
     ) : releaseError ? (
       <Text accessibilityRole="alert" style={styles.sectionError}>{releaseError}</Text>
     ) : newReleases.length === 0 ? (
       <Text style={styles.sectionEmpty}>No new releases found right now.</Text>
     ) : <FlatList
       horizontal
       data={newReleases}
       keyExtractor={(i) => i.id}
       showsHorizontalScrollIndicator={false}
       renderItem={({ item }) => (
         <TouchableOpacity style={styles.card} onPress={() => router.push(`/album/${item.id}` as any)}>
           <Image source={{ uri: item.images?.[0]?.url }} style={styles.cover} />
           <Text style={styles.trackName} numberOfLines={1}>{item.name}</Text>
           <Text style={styles.artistName} numberOfLines={1}>{item.artists?.[0]?.name}</Text>
         </TouchableOpacity>
       )}
     />}

     <Text style={styles.heading}>New from Friends</Text>
     {friendFeedLoading ? (
       <ActivityIndicator color={accentColor} style={styles.sectionLoading} />
     ) : friendFeedError ? (
       <Text accessibilityRole="alert" style={styles.sectionError}>{friendFeedError}</Text>
     ) : newFromFriends.length === 0 ? (
       <View style={styles.emptySection}>
         <Text style={styles.emptyText}>Your friends’ music activity will appear here.</Text>
         <TouchableOpacity onPress={() => router.push('/find-people' as any)} accessibilityRole="button">
           <Text style={[styles.discoverLink, { color: accentColor }]}>Find people</Text>
         </TouchableOpacity>
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
     {friendFeedLoading ? (
       <ActivityIndicator color={accentColor} style={styles.sectionLoading} />
     ) : friendFeedError ? (
       <Text accessibilityRole="alert" style={styles.sectionError}>{friendFeedError}</Text>
     ) : popularWithFriends.length === 0 ? (
       <View style={styles.emptySection}>
         <Text style={styles.emptyText}>Popular picks from friends will appear here.</Text>
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
 container: { flex: 1, paddingTop: 60, width: '100%', maxWidth: 1000, alignSelf: 'center' },
 content: { paddingBottom: 32 },
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
 authError: { color: '#ff8b8b', fontSize: 14, marginBottom: 18, paddingHorizontal: 24, textAlign: 'center' },
 sectionLoading: { marginVertical: 18 },
 sectionError: { color: '#ff8b8b', marginHorizontal: 16, marginVertical: 12 },
 sectionEmpty: { color: '#888', marginHorizontal: 16, marginBottom: 18 },
 discoverLink: { marginTop: 12, textAlign: 'center', fontWeight: '700' },
});
