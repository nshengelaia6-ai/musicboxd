import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, ImageBackground, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ArtistPage() {
 const { id } = useLocalSearchParams();
 const router = useRouter();
 const [artist, setArtist] = useState<any>(null);
 const [albums, setAlbums] = useState<any[]>([]);
 const [followed, setFollowed] = useState(false);
 const [menuVisible, setMenuVisible] = useState(false);

 useEffect(() => {
   loadArtist();
 }, []);

 async function getToken() {
   let token = await AsyncStorage.getItem('spotify_token');
   if (!token) return null;
   const test = await fetch('https://api.spotify.com/v1/me', {
     headers: { Authorization: `Bearer ${token}` },
   });
   if (test.status === 401) {
     await AsyncStorage.removeItem('spotify_token');
     router.replace('/');
     return null;
   }
   return token;
 }

 async function loadArtist() {
   const token = await getToken();
   if (!token) return;

   const artistRes = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
     headers: { Authorization: `Bearer ${token}` },
   });
   const artistData = await artistRes.json();
   setArtist(artistData);

   const albumsRes = await fetch(
     `https://api.spotify.com/v1/artists/${id}/albums?limit=50&include_groups=album,single`,
     { headers: { Authorization: `Bearer ${token}` } }
   );
   const albumsData = await albumsRes.json();
   setAlbums(albumsData.items || []);

   const followedData = await AsyncStorage.getItem('followed_artists');
   const followedList = followedData ? JSON.parse(followedData) : [];
   setFollowed(!!followedList.find((a: any) => a.id === id));
 }

 async function toggleFollow() {
   const existing = await AsyncStorage.getItem('followed_artists');
   const list = existing ? JSON.parse(existing) : [];
   if (!followed) {
     if (!list.find((a: any) => a.id === artist.id)) {
       list.unshift({
         id: artist.id,
         name: artist.name,
         image: artist.images?.[0]?.url,
       });
     }
     setFollowed(true);
   } else {
     const idx = list.findIndex((a: any) => a.id === artist.id);
     if (idx !== -1) list.splice(idx, 1);
     setFollowed(false);
   }
   await AsyncStorage.setItem('followed_artists', JSON.stringify(list));
 }

 async function handleShare() {
   setMenuVisible(false);
   await Share.share({
     message: `Check out ${artist?.name} on MusicBoxd!`,
   });
 }

 return (
   <ScrollView style={styles.container}>
     <ImageBackground
       source={{ uri: artist?.images?.[0]?.url }}
       style={styles.heroBackground}
       blurRadius={2}
     >
       <View style={styles.heroOverlay}>
         <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
           <Text style={styles.menuBtnText}>•••</Text>
         </TouchableOpacity>
         <Image source={{ uri: artist?.images?.[0]?.url }} style={styles.artistImage} />
         <Text style={styles.artistName}>{artist?.name}</Text>
         <TouchableOpacity
           style={[styles.followBtn, followed && styles.followBtnActive]}
           onPress={toggleFollow}
         >
           <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
             {followed ? 'Following' : 'Follow'}
           </Text>
         </TouchableOpacity>
       </View>
     </ImageBackground>

     <Text style={styles.heading}>Albums & Singles</Text>

     {albums.length === 0 ? (
       <Text style={styles.empty}>იტვირთება...</Text>
     ) : (
       <FlatList
         data={albums}
         keyExtractor={(item) => item.id}
         scrollEnabled={false}
         renderItem={({ item }) => (
           <TouchableOpacity style={styles.row} onPress={() => router.push(`/album/${item.id}`)}>
             <Image source={{ uri: item.images?.[0]?.url }} style={styles.cover} />
             <View style={styles.info}>
               <Text style={styles.albumName}>{item.name}</Text>
               <Text style={styles.albumMeta}>{item.album_type} • {item.release_date?.slice(0, 4)}</Text>
             </View>
           </TouchableOpacity>
         )}
       />
     )}

     {/* About - სულ ბოლოს */}
{artist && albums.length > 0 && (

       <View style={styles.aboutSection}>
         <Text style={styles.aboutTitle}>About</Text>
         <Image source={{ uri: artist.images?.[0]?.url }} style={styles.aboutImage} />
         <View style={styles.aboutInfo}>
           <Text style={styles.aboutName}>{artist.name}</Text>
           {artist.followers?.total && (
             <Text style={styles.aboutMeta}>
               {(artist.followers.total / 1_000_000).toFixed(1)}M followers
             </Text>
           )}
           {artist.genres?.length > 0 && (
             <Text style={styles.aboutGenres}>{artist.genres.slice(0, 3).join(' • ')}</Text>
           )}
         </View>
       </View>
     )}

     <View style={{ height: 40 }} />

     <Modal visible={menuVisible} transparent animationType="slide">
       <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)} />
       <View style={styles.sheet}>
         <View style={styles.sheetHeader}>
           <Image source={{ uri: artist?.images?.[0]?.url }} style={styles.sheetImage} />
           <Text style={styles.sheetName}>{artist?.name}</Text>
         </View>
         <TouchableOpacity style={styles.sheetItem} onPress={handleShare}>
           <Text style={styles.sheetItemText}>↑  Share</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.sheetItem} onPress={() => setMenuVisible(false)}>
           <Text style={[styles.sheetItemText, { color: '#888' }]}>Cancel</Text>
         </TouchableOpacity>
       </View>
     </Modal>
   </ScrollView>
 );
}

const styles = StyleSheet.create({
 container: { flex: 1, backgroundColor: '#0a0a0a' },
 heroBackground: { width: '100%', height: 320 },
 heroOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24 },
 menuBtn: { position: 'absolute', top: 60, right: 20 },
 menuBtnText: { color: 'white', fontSize: 24 },
 artistImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 12 },
 artistName: { color: 'white', fontSize: 28, fontWeight: 'bold', textShadowColor: 'black', textShadowRadius: 10 },
 followBtn: { marginTop: 12, paddingHorizontal: 32, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'white' },
 followBtnActive: { backgroundColor: 'white' },
 followBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
 followBtnTextActive: { color: '#0a0a0a' },
 heading: { color: 'white', fontSize: 20, fontWeight: 'bold', margin: 16 },
 empty: { color: '#555', paddingHorizontal: 16, paddingVertical: 8 },
 row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
 cover: { width: 60, height: 60, borderRadius: 6 },
 info: { flex: 1 },
 albumName: { color: 'white', fontSize: 15, fontWeight: '600' },
 albumMeta: { color: '#888', fontSize: 13, marginTop: 2 },
 aboutSection: { margin: 16, backgroundColor: '#1a1a1a', borderRadius: 12, overflow: 'hidden' },
 aboutTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', padding: 16 },
 aboutImage: { width: '100%', height: 200 },
 aboutInfo: { padding: 16 },
 aboutName: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
 aboutMeta: { color: '#aaa', fontSize: 14, marginBottom: 4 },
 aboutGenres: { color: '#888', fontSize: 13 },
 overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
 sheet: { backgroundColor: '#1c1c1e', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
 sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
 sheetImage: { width: 44, height: 44, borderRadius: 22 },
 sheetName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
 sheetItem: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
 sheetItemText: { color: 'white', fontSize: 16, textAlign: 'center' },
});
