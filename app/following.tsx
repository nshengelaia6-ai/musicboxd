import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type FollowingUser = {
  id: string;
  username: string;
  avatar: string | null;
};

export default function Following() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [menuUser, setMenuUser] = useState<FollowingUser | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setError('');

        try {
          const myId = await AsyncStorage.getItem('supabase_user_id');
          if (!myId) throw new Error('Sign in to view the people you follow.');

          const { data: relations, error: relationError } = await supabase
            .from('friendships')
            .select('friend_id')
            .eq('user_id', myId);

          if (relationError) throw relationError;

          const ids = [...new Set((relations || []).map((item: any) => item.friend_id).filter(Boolean))];

          if (ids.length === 0) {
            if (active) setFollowing([]);
            return;
          }

          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, username, avatar_url')
            .in('id', ids);

          if (usersError) throw usersError;

          const orderedUsers = ids
            .map((id: string) => (users || []).find((user: any) => user.id === id))
            .filter(Boolean)
            .map((user: any) => ({
              id: user.id,
              username: user.username || 'User',
              avatar: user.avatar_url || null,
            }));

          if (active) setFollowing(orderedUsers);
        } catch (err: any) {
          if (active) {
            setFollowing([]);
            setError(err?.message || 'Could not load following. Try again later.');
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      load();
      return () => { active = false; };
    }, [])
  );

  async function unfollow(targetId: string) {
    const myId = await AsyncStorage.getItem('supabase_user_id');
    if (!myId) {
      setError('Please sign in again.');
      return;
    }

    setPendingIds(previous => new Set(previous).add(targetId));

    try {
      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', myId)
        .eq('friend_id', targetId);

      if (deleteError) throw deleteError;
      setFollowing(previous => previous.filter(user => user.id !== targetId));
    } catch (err: any) {
      setError(err?.message || 'Could not unfollow this person.');
    } finally {
      setPendingIds(previous => {
        const next = new Set(previous);
        next.delete(targetId);
        return next;
      });
    }
  }

  async function removeFollower() {
    if (!menuUser) return;
    const target = menuUser;

    try {
      const myId = await AsyncStorage.getItem('supabase_user_id');
      if (!myId) throw new Error('Please sign in again.');

      const { error: deleteError } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', myId)
        .eq('friend_id', target.id);

      if (deleteError) throw deleteError;

      setFollowing(previous => previous.filter(user => user.id !== target.id));
      setMenuUser(null);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Could not unfollow this person.');
    }
  }

  async function blockUser() {
    if (!menuUser) return;
    const target = menuUser;

    try {
      const myId = await AsyncStorage.getItem('supabase_user_id');
      if (!myId) throw new Error('Please sign in again.');

      const { error: blockError } = await supabase
        .from('blocked_users')
        .insert({ blocker_id: myId, blocked_id: target.id });

      if (blockError) throw blockError;

      const { error: outgoingError } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', myId)
        .eq('friend_id', target.id);

      if (outgoingError) throw outgoingError;

      const { error: incomingError } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', target.id)
        .eq('friend_id', myId);

      if (incomingError) throw incomingError;

      setFollowing(previous => previous.filter(user => user.id !== target.id));
      setMenuUser(null);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Could not block this user.');
    }
  }

  function confirmRemoveFollower() {
    if (!menuUser) return;
    const message = `Remove ${menuUser.username} from your followers?`;

    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) void removeFollower();
      return;
    }

    Alert.alert('Unfollow', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { void removeFollower(); } },
    ]);
  }

  function confirmBlockUser() {
    if (!menuUser) return;
    const message = `Are you sure you want to block ${menuUser.username}? This will remove the follow in both directions.`;

    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) void blockUser();
      return;
    }

    Alert.alert('Block user', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => { void blockUser(); } },
    ]);
  }

  async function shareUser() {
    if (!menuUser) return;
    try {
      await Share.share({ message: `Check out ${menuUser.username} on Musicboxd!` });
    } catch (err: any) {
      setError(err?.message || 'Could not share this user.');
    }
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Following</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <ActivityIndicator color="#1DB954" style={{ marginTop: 32 }} />
        ) : error ? (
          <Text accessibilityRole="alert" style={styles.empty}>{error}</Text>
        ) : following.length === 0 ? (
          <Text style={styles.empty}>You are not following anyone yet.</Text>
        ) : (
          following.map(user => (
            <View key={user.id} style={styles.row}>
              <TouchableOpacity
                style={styles.userInfo}
                onPress={() => router.push(`/user/${user.id}`)}
              >
                <View style={styles.avatar}>
                  {user.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarPlaceholder} />
                  )}
                </View>
                <Text style={styles.username}>{user.username}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.checkBtn, { backgroundColor: accentColor }]}
                onPress={() => unfollow(user.id)}
                disabled={pendingIds.has(user.id)}
                accessibilityRole="button"
                accessibilityLabel={`Unfollow ${user.username}`}
              >
                <Text style={styles.checkIcon}>✓</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => setMenuUser(user)}
                accessibilityRole="button"
                accessibilityLabel={`More options for ${user.username}`}
              >
                <Text style={styles.moreText}>⋯</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        transparent
        visible={!!menuUser}
        animationType="fade"
        onRequestClose={() => setMenuUser(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuUser(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.menuCard}
            onPress={() => {}}
          >
            <Text style={styles.menuTitle}>{menuUser?.username}</Text>

            <TouchableOpacity style={styles.menuItem} onPress={confirmRemoveFollower}>
              <Text style={styles.menuItemText}>Unfollow</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={confirmBlockUser}>
              <Text style={[styles.menuItemText, styles.destructiveText]}>Block User</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={shareUser}>
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuUser(null)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60 },
  back: { color: 'white', fontSize: 32 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  empty: { color: '#555', padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: { marginRight: 12 },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' },
  username: { color: 'white', fontSize: 15 },
  checkBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  moreButton: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  moreText: { color: '#ddd', fontSize: 25, lineHeight: 28 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  menuCard: { width: '100%', maxWidth: 360, backgroundColor: '#202020', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12 },
  menuTitle: { color: '#fff', fontSize: 16, fontWeight: '700', paddingVertical: 12, textAlign: 'center' },
  menuItem: { paddingVertical: 15 },
  menuItemText: { color: '#f2f2f2', fontSize: 15, textAlign: 'center' },
  destructiveText: { color: '#ff6464' },
  doneText: { color: '#1DB954', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  menuDivider: { height: 1, backgroundColor: '#383838' },
});