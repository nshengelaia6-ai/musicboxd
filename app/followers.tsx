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
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Follower = {
  id: string;
  username: string;
  avatar: string | null;
};

export default function Followers() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [followingBack, setFollowingBack] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [menuUser, setMenuUser] = useState<Follower | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        setError('');

        try {
          const myId = await AsyncStorage.getItem('supabase_user_id');
          if (!myId) throw new Error('Sign in to view your followers.');

          const { data: relations, error: relationError } = await supabase
            .from('friendships')
            .select('user_id')
            .eq('friend_id', myId);

          if (relationError) throw relationError;

          const ids = [...new Set((relations || []).map((item: any) => item.user_id).filter(Boolean))];

          if (ids.length === 0) {
            if (active) {
              setFollowers([]);
              setFollowingBack(new Set());
            }
            return;
          }

          const [{ data: users, error: usersError }, { data: myRelations, error: myRelationsError }] =
            await Promise.all([
              supabase.from('users').select('id, username, avatar_url').in('id', ids),
              supabase.from('friendships').select('friend_id').eq('user_id', myId).in('friend_id', ids),
            ]);

          if (usersError) throw usersError;
          if (myRelationsError) throw myRelationsError;

          const orderedUsers = ids
            .map((id: string) => (users || []).find((user: any) => user.id === id))
            .filter(Boolean)
            .map((user: any) => ({
              id: user.id,
              username: user.username || 'User',
              avatar: user.avatar_url || null,
            }));

          if (active) {
            setFollowers(orderedUsers);
            setFollowingBack(new Set((myRelations || []).map((item: any) => item.friend_id)));
          }
        } catch (err: any) {
          if (active) {
            setFollowers([]);
            setError(err?.message || 'Could not load followers. Try again later.');
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      load();
      return () => { active = false; };
    }, [])
  );

  async function toggleFollowBack(targetId: string) {
    const myId = await AsyncStorage.getItem('supabase_user_id');
    if (!myId) {
      setError('Please sign in again.');
      return;
    }

    const isFollowing = followingBack.has(targetId);
    setPendingIds(previous => new Set(previous).add(targetId));

    try {
      if (isFollowing) {
        const { error: deleteError } = await supabase
          .from('friendships')
          .delete()
          .eq('user_id', myId)
          .eq('friend_id', targetId);

        if (deleteError) throw deleteError;
        setFollowingBack(previous => {
          const next = new Set(previous);
          next.delete(targetId);
          return next;
        });
      } else {
        const { error: insertError } = await supabase
          .from('friendships')
          .insert({ user_id: myId, friend_id: targetId });

        if (insertError) throw insertError;
        setFollowingBack(previous => new Set(previous).add(targetId));
      }

      setError('');
    } catch (err: any) {
      setError(err?.message || 'Could not update this follow. Please try again.');
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
        .eq('user_id', target.id)
        .eq('friend_id', myId);

      if (deleteError) throw deleteError;

      setFollowers(previous => previous.filter(user => user.id !== target.id));
      setMenuUser(null);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Could not remove this follower.');
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
        .upsert(
          { blocker_id: myId, blocked_id: target.id },
          { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
        );

      if (blockError) throw blockError;

      const { error: removeIncomingError } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', target.id)
        .eq('friend_id', myId);

      if (removeIncomingError) throw removeIncomingError;

      const { error: removeOutgoingError } = await supabase
        .from('friendships')
        .delete()
        .eq('user_id', myId)
        .eq('friend_id', target.id);

      if (removeOutgoingError) throw removeOutgoingError;

      setFollowers(previous => previous.filter(user => user.id !== target.id));
      setFollowingBack(previous => {
        const next = new Set(previous);
        next.delete(target.id);
        return next;
      });
      setMenuUser(null);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Could not block this user.');
    }
  }

  function confirmRemoveFollower() {
    if (!menuUser) return;
    Alert.alert(
      'Remove follower',
      `Remove ${menuUser.username} from your followers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => { void removeFollower(); } },
      ]
    );
  }

  function confirmBlockUser() {
    if (!menuUser) return;
    Alert.alert(
      'Block user',
      `Are you sure you want to block ${menuUser.username}? This will remove the follow in both directions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => { void blockUser(); } },
      ]
    );
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
          <Text style={styles.title}>Followers</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <ActivityIndicator color="#1DB954" style={{ marginTop: 32 }} />
        ) : error ? (
          <Text accessibilityRole="alert" style={styles.empty}>{error}</Text>
        ) : followers.length === 0 ? (
          <Text style={styles.empty}>No followers yet.</Text>
        ) : (
          followers.map(user => (
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
                style={[styles.followBtn, { backgroundColor: followingBack.has(user.id) ? '#2a2a2a' : accentColor }]}
                onPress={() => toggleFollowBack(user.id)}
                disabled={pendingIds.has(user.id)}
                accessibilityRole="button"
                accessibilityLabel={`${followingBack.has(user.id) ? 'Unfollow' : 'Follow back'} ${user.username}`}
              >
                <Text style={[styles.followBtnText, followingBack.has(user.id) ? { color: '#aaa' } : { color: '#000' }]}>
                  {followingBack.has(user.id) ? 'Following' : 'Follow Back'}
                </Text>
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
              <Text style={styles.menuItemText}>Remove Follower</Text>
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
  empty: { color: '#888', padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: { marginRight: 12 },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#333' },
  username: { color: 'white', fontSize: 15 },
  followBtn: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  followBtnText: { fontSize: 12, fontWeight: '600' },
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