import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const initialAlbums = [
 { id: '1', title: 'After Hours', cover: 'https://i.scdn.co/image/ab67616d0000b273ef017e899c05477da4c9a7dc' },
 { id: '2', title: 'Dawn FM', cover: 'https://i.scdn.co/image/ab67616d0000b2732e8ed79e177ff6011079e4a7' },
 { id: '3', title: 'Future Nostalgia', cover: 'https://i.scdn.co/image/ab67616d0000b2732734b308c531dc41b29a0621' },
 { id: '4', title: 'Happier Than Ever', cover: 'https://i.scdn.co/image/ab67616d0000b273c2f6bdf01bd6fc069f0c12ae' },
];

const initialArtists = [
 { id: '1', name: 'The Weeknd' },
 { id: '2', name: 'Dua Lipa' },
 { id: '3', name: 'Billie Eilish' },
 { id: '4', name: 'Olivia Rodrigo' },
];

function Stars({ count }: { count: number }) {
 const full = Math.floor(count);
 const half = count % 1 >= 0.5;
 return (
   <Text style={styles.stars}>
     {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
   </Text>
 );
}

function groupByMonth(entries: any[]) {
 const grouped: { [key: string]: any[] } = {};
 entries.forEach(e => {
   const month = new Date(e.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
   if (!grouped[month]) grouped[month] = [];
   grouped[month].push(e);
 });
 return grouped;
}

export default function Profile() {
 const router = useRouter();
 const [reviews, setReviews] = useState<any[]>([]);
 const [showShare, setShowShare] = useState(false);
 const [showSettings, setShowSettings] = useState(false);
 const [username, setUsername] = useState('nia');
 const [bio, setBio] = useState('music is life 🎵');
 const [editUsername, setEditUsername] = useState('nia');
 const [editBio, setEditBio] = useState('music is life 🎵');
 const [favoriteAlbums] = useState(initialAlbums);
 const [favoriteArtists] = useState(initialArtists);

 useEffect(() => {
   loadReviews();
 }, []);

 async function loadReviews() {
   const data = await AsyncStorage.getItem('reviews');
   if (data) setReviews(JSON.parse(data));
 }

 function saveProfile() {
   setUsername(editUsername);
   setBio(editBio);
   setShowSettings(false);
 }

 return (
   <View style={{ flex: 1 }}>
     <ScrollView style={styles.container}>

       {/* Header */}
       <View style={styles.header}>
         <TouchableOpacity style={styles.headerBtnLeft} onPress={() => { setEditUsername(username); setEditBio(bio); setShowSettings(true); }}>
           <Text style={styles.headerBtnText}>🎛️</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.headerBtnRight} onPress={() => setShowShare(true)}>
           <Text style={styles.headerBtnText}>•••</Text>
         </TouchableOpacity>
         <View style={styles.avatar} />
         <Text style={styles.username}>@{username}</Text>
         <Text style={styles.bio}>{bio}</Text>
         <View style={styles.stats}>
           <View style={styles.stat}>
             <Text style={styles.statNum}>{reviews.length}</Text>
             <Text style={styles.statLabel}>Reviews</Text>
           </View>
           <View style={styles.stat}>
             <Text style={styles.statNum}>38</Text>
             <Text style={styles.statLabel}>Following</Text>
           </View>
           <View style={styles.stat}>
             <Text style={styles.statNum}>52</Text>
             <Text style={styles.statLabel}>Followers</Text>
           </View>
         </View>
       </View>

       {/* Favorite Albums */}
       <Text style={styles.sectionTitle}>Favorite Albums</Text>
       <View style={styles.grid}>
         {favoriteAlbums.map(album => (
           <View key={album.id} style={styles.gridItem}>
             <Image source={{ uri: album.cover }} style={styles.albumArt} />
             <Text style={styles.gridLabel} numberOfLines={1}>{album.title}</Text>
           </View>
         ))}
         <View style={styles.gridItem}>
           <TouchableOpacity style={styles.addBox}>
             <Text style={styles.addPlus}>+</Text>
           </TouchableOpacity>
         </View>
       </View>

       {/* Favorite Artists */}
       <Text style={styles.sectionTitle}>Favorite Artists</Text>
       <View style={styles.grid}>
         {favoriteArtists.map(artist => (
           <View key={artist.id} style={styles.gridItem}>
             <View style={styles.artistCircle} />
             <Text style={styles.gridLabel} numberOfLines={1}>{artist.name}</Text>
           </View>
         ))}
         <View style={styles.gridItem}>
           <TouchableOpacity style={styles.addCircle}>
             <Text style={styles.addPlus}>+</Text>
           </TouchableOpacity>
         </View>
       </View>

       {/* Recent Activity */}
       {reviews.length > 0 && (
         <>
           <Text style={styles.sectionTitle}>Recent Activity</Text>
           <FlatList
             horizontal
             data={reviews.slice(0, 10)}
             keyExtractor={item => item.id}
             showsHorizontalScrollIndicator={false}
             contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
             renderItem={({ item }) => (
               <View style={styles.activityCard}>
                 {item.albumCover
                   ? <Image source={{ uri: item.albumCover }} style={styles.activityCover} />
                   : <View style={[styles.activityCover, { backgroundColor: '#2a2a2a' }]} />}
                 <View style={styles.activityBadge}>
                   <Text style={styles.activityBadgeText}>{item.review ? '✎' : '★'}</Text>
                 </View>
                 <Text style={styles.activityRating}>{'★'.repeat(Math.floor(item.rating))}</Text>
                 <Text style={styles.activityAlbum} numberOfLines={1}>{item.albumName}</Text>
               </View>
             )}
           />
         </>
       )}

       {/* Menu */}
<View style={styles.menu}>
  {[
    { label: 'Songs', route: '/songs' },
    { label: 'Diary', route: '/diary' },
    { label: 'Reviews', route: '/reviews' },
    { label: 'Lists', route: '/lists' },
    { label: 'Want to Listen', route: '/wanttolisten' },
    { label: 'Likes', route: '/likes' },
    { label: 'Following', route: '/following' },
    { label: 'Followers', route: '/followers' },
  ].map(item => (
    <Pressable
      key={item.label}
      style={styles.menuRow}
      onPress={() => router.push(item.route as any)}
    >
      <Text style={styles.menuText}>{item.label}</Text>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  ))}
</View>


     </ScrollView>

     {/* Share Modal */}
     <Modal visible={showShare} transparent animationType="slide">
       <Pressable style={styles.modalOverlay} onPress={() => setShowShare(false)}>
         <View style={styles.bottomSheet}>
           <View style={styles.sheetHandle} />
           <Text style={styles.sheetTitle}>Share Profile</Text>
           <TouchableOpacity style={styles.sheetOption}>
             <Text style={styles.sheetOptionText}>🔗  Copy Profile Link</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.sheetOption, { marginTop: 8 }]} onPress={() => setShowShare(false)}>
             <Text style={[styles.sheetOptionText, { color: '#888' }]}>Cancel</Text>
           </TouchableOpacity>
         </View>
       </Pressable>
     </Modal>

     {/* Settings Modal */}
     <Modal visible={showSettings} transparent animationType="slide">
       <Pressable style={styles.modalOverlay} onPress={() => setShowSettings(false)}>
         <View style={[styles.bottomSheet, { paddingBottom: 40 }]}>
           <View style={styles.sheetHandle} />
           <Text style={styles.sheetTitle}>Settings</Text>
           <View style={styles.settingsAvatarContainer}>
             <View style={styles.settingsAvatar} />
             <TouchableOpacity>
               <Text style={styles.changePhotoText}>Change</Text>
             </TouchableOpacity>
           </View>
           <Text style={styles.settingsLabel}>Username</Text>
           <TextInput
             style={styles.settingsInput}
             value={editUsername}
             onChangeText={setEditUsername}
             placeholderTextColor="#555"
             placeholder="username"
           />
           <Text style={styles.settingsLabel}>Bio</Text>
           <TextInput
             style={[styles.settingsInput, { height: 70 }]}
             value={editBio}
             onChangeText={setEditBio}
             placeholderTextColor="#555"
             placeholder="bio"
             multiline
           />
           <TouchableOpacity style={styles.sheetOption}>
             <Text style={styles.sheetOptionText}>💿  Edit Favorite Albums</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.sheetOption}>
             <Text style={styles.sheetOptionText}>🎤  Edit Favorite Artists</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.sheetOption}>
             <Text style={styles.sheetOptionText}>🔒  Privacy Settings</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
             <Text style={styles.saveBtnText}>Save Changes</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.logoutBtn}>
             <Text style={styles.logoutBtnText}>Log Out</Text>
           </TouchableOpacity>
         </View>
       </Pressable>
     </Modal>

   </View>
 );
}

const styles = StyleSheet.create({
 container: { flex: 1, backgroundColor: '#141414' },
 header: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#222' },
 headerBtnLeft: { position: 'absolute', top: 60, left: 20 },
 headerBtnRight: { position: 'absolute', top: 60, right: 20 },
 headerBtnText: { color: '#fff', fontSize: 20 },
 avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#333', marginBottom: 12 },
 username: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
 bio: { color: '#888', fontSize: 14, marginTop: 4 },
 stats: { flexDirection: 'row', marginTop: 16, gap: 32 },
 stat: { alignItems: 'center' },
 statNum: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
 statLabel: { color: '#888', fontSize: 12 },
 sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
 grid: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, flexWrap: 'wrap' },
 gridItem: { alignItems: 'center', width: 75 },
 albumArt: { width: 75, height: 75, backgroundColor: '#2a2a2a', borderRadius: 6, marginBottom: 4 },
 artistCircle: { width: 75, height: 75, backgroundColor: '#2a2a2a', borderRadius: 40, marginBottom: 4 },
 gridLabel: { color: '#ccc', fontSize: 11, textAlign: 'center' },
 addBox: { width: 75, height: 75, backgroundColor: '#1e1e1e', borderRadius: 6, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
 addCircle: { width: 75, height: 75, backgroundColor: '#1e1e1e', borderRadius: 40, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
 addPlus: { color: '#555', fontSize: 28 },
 activityCard: { width: 110, alignItems: 'center' },
 activityCover: { width: 110, height: 110, borderRadius: 8 },
 activityBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: '#1DB954', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
 activityBadgeText: { fontSize: 11, color: '#000' },
 activityRating: { color: '#1DB954', fontSize: 11, marginTop: 4 },
 activityAlbum: { color: '#fff', fontSize: 11, marginTop: 2, fontWeight: '600' },
 menu: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#222' },
 menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
 menuText: { color: '#fff', fontSize: 16 },
 arrow: { color: '#555', fontSize: 20 },
 modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
 bottomSheet: { backgroundColor: '#1c1c1c', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30 },
 sheetHandle: { width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
 sheetTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
 sheetOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
 sheetOptionText: { color: '#fff', fontSize: 16 },
 settingsAvatarContainer: { alignItems: 'center', marginBottom: 16 },
 settingsAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#333', marginBottom: 8 },
 changePhotoText: { color: '#1DB954', fontSize: 14 },
 settingsLabel: { color: '#888', fontSize: 13, marginTop: 12, marginBottom: 4 },
 settingsInput: { backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 4 },
 saveBtn: { backgroundColor: '#1DB954', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
 saveBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
 logoutBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
 logoutBtnText: { color: '#ff4444', fontSize: 16 },
 stars: { color: '#1DB954', fontSize: 12, marginTop: 2 },
});
