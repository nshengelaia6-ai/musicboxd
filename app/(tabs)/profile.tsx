import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
 const [editAvatar, setEditAvatar] = useState<string | null>(null);
 const [avatar, setAvatar] = useState<string | null>(null);
 const [favoriteAlbums, setFavoriteAlbums] = useState<(any | null)[]>([null, null, null, null]);

 useEffect(() => {
   loadReviews();
   AsyncStorage.getItem('profile').then(data => {
     if (data) {
       const p = JSON.parse(data);
       setUsername(p.username || 'nia');
       setBio(p.bio || 'music is life 🎵');
       setEditUsername(p.username || 'nia');
       setEditBio(p.bio || 'music is life 🎵');
       if (p.avatar) { setEditAvatar(p.avatar); setAvatar(p.avatar); }
       if (p.favoriteAlbums) setFavoriteAlbums(p.favoriteAlbums);
     }
   });
 }, []);

 async function pickImage() {
   const result = await ImagePicker.launchImageLibraryAsync({
     mediaTypes: ImagePicker.MediaTypeOptions.Images,
     allowsEditing: true,
     aspect: [1, 1],
     quality: 0.8,
   });
   if (!result.canceled) setEditAvatar(result.assets[0].uri);
 }

 async function loadReviews() {
   const data = await AsyncStorage.getItem('reviews');
   if (data) setReviews(JSON.parse(data));
 }

 async function saveProfile() {
   setUsername(editUsername);
   setBio(editBio);
   if (editAvatar) setAvatar(editAvatar);
   await AsyncStorage.setItem('profile', JSON.stringify({
     username: editUsername,
     bio: editBio,
     avatar: editAvatar,
     favoriteAlbums,
   }));
   setShowSettings(false);
 }

 return (
   <View style={{ flex: 1 }}>
     <ScrollView style={styles.container}>

       <View style={styles.header}>
         <TouchableOpacity style={styles.headerBtnLeft} onPress={() => { setEditUsername(username); setEditBio(bio); setShowSettings(true); }}>
           <Text style={styles.headerBtnText}>🎛️</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.headerBtnRight} onPress={() => setShowShare(true)}>
           <Text style={styles.headerBtnText}>•••</Text>
         </TouchableOpacity>
         {avatar
           ? <Image source={{ uri: avatar }} style={styles.avatar} />
           : <View style={styles.avatar} />}
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
       <Text style={styles.sectionTitle}>FAVORITE ALBUMS</Text>
       <View style={styles.slotsRow}>
         {favoriteAlbums.map((album, i) => (
           <TouchableOpacity
             key={i}
             style={styles.slot}
             onPress={() => router.push({ pathname: '/search', params: { mode: 'pickAlbum', index: i } } as any)}
           >
             {album && <Image source={{ uri: album.cover }} style={styles.slotImage} />}
           </TouchableOpacity>
         ))}
       </View>

       {/* Recent Activity */}
       {reviews.length > 0 && (
         <>
           <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
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

     <Modal visible={showSettings} transparent animationType="slide">
       <View style={styles.modalOverlay}>
         <Pressable style={{ flex: 1 }} onPress={() => setShowSettings(false)} />
         <View style={[styles.bottomSheet, { paddingBottom: 40 }]}>
           <View style={styles.sheetHandle} />
           <Text style={styles.sheetTitle}>Settings</Text>
           <View style={styles.settingsAvatarContainer}>
             {editAvatar
               ? <Image source={{ uri: editAvatar }} style={styles.settingsAvatar} />
               : <View style={styles.settingsAvatar} />}
             <TouchableOpacity onPress={pickImage}>
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
             blurOnSubmit={true}
             onSubmitEditing={() => Keyboard.dismiss()}
           />
           <Text style={styles.settingsLabel}>Bio</Text>
           <TextInput
             style={styles.settingsInput}
             value={editBio}
             onChangeText={setEditBio}
             placeholderTextColor="#555"
             placeholder="bio"
             blurOnSubmit={true}
             onSubmitEditing={() => Keyboard.dismiss()}
           />

           {/* Favorite Albums in Settings */}
           <Text style={styles.settingsLabel}>Favorite Albums</Text>
           <View style={styles.settingsSlotsRow}>
             {favoriteAlbums.map((album, i) => (
               <TouchableOpacity
                 key={i}
                 style={styles.settingsSlot}
                 onPress={() => router.push({ pathname: '/search', params: { mode: 'pickAlbum', index: i } } as any)}
               >
                 {album
                   ? <Image source={{ uri: album.cover }} style={styles.settingsSlotImage} />
                   : <Text style={styles.settingsSlotPlus}>+</Text>}
               </TouchableOpacity>
             ))}
           </View>

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
       </View>
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
 sectionTitle: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
 slotsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
 slot: { flex: 1, aspectRatio: 1, backgroundColor: '#1e1e1e', borderRadius: 6 },
 slotImage: { width: '100%', height: '100%', borderRadius: 6 },
 settingsSlotsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
 settingsSlot: { flex: 1, aspectRatio: 1, backgroundColor: '#2a2a2a', borderRadius: 6, borderWidth: 1, borderColor: '#444', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
 settingsSlotImage: { width: '100%', height: '100%', borderRadius: 6 },
 settingsSlotPlus: { color: '#666', fontSize: 20 },
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
