import { useAppTheme } from '@/context/ThemeContext';
import { supabase } from '@/utils/supabase';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type NotificationRow = {
  id: string;
  notification_type: string;
  actor_id: string | null;
  entity_id: string | null;
  data: Record<string, any>;
  created_at: string;
  read_at: string | null;
  actor?: { username?: string; avatar_url?: string | null } | null;
};

const copy: Record<string, string> = {
  new_follower: 'started following you',
  review_like: 'liked your review',
  review_reply: 'replied to your review',
  list_like: 'liked your list',
};

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { backgroundColor, accentColor } = useAppTheme();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) {
        setItems([]);
        return;
      }
      const { data, error: queryError } = await supabase
        .from('notifications')
        .select('id,notification_type,actor_id,entity_id,data,created_at,read_at,actor:users!notifications_actor_id_fkey(username,avatar_url)')
        .eq('recipient_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      setItems((data || []) as NotificationRow[]);
    } catch (e) {
      console.error('Notifications load failed:', e);
      setError('Could not load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    const channel = supabase
      .channel('my-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]));

  const openNotification = async (item: NotificationRow) => {
    if (!item.read_at) {
      const now = new Date().toISOString();
      setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: now } : row));
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: now })
        .eq('id', item.id);
      if (updateError) {
        console.warn('Could not mark notification as read:', updateError);
      }
    }
    if (item.notification_type === 'new_follower' && item.actor_id) {
      router.push(`/user/${item.actor_id}` as any);
      return;
    }
    if (item.notification_type === 'list_like' && item.entity_id) {
      router.push({ pathname: '/lists', params: { userId: item.actor_id || undefined } } as any);
      return;
    }
    if (item.notification_type === 'review_like' || item.notification_type === 'review_reply') {
      router.push(`/review/${item.entity_id}` as any);
    }
  };

  const markAllRead = async () => {
    const unread = items.filter(item => !item.read_at);
    if (!unread.length) return;
    const now = new Date().toISOString();
    setItems(current => current.map(item => ({ ...item, read_at: item.read_at || now })));
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('recipient_id', auth.user.id)
      .is('read_at', null);
    if (updateError) {
      console.warn('Could not mark all notifications read:', updateError);
      void load();
    }
  };

  const unreadCount = items.filter(item => !item.read_at).length;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => void markAllRead()}>
            <Text style={[styles.markRead, { color: accentColor }]}>Mark all read</Text>
          </TouchableOpacity>
        ) : <View style={styles.headerSpacer} />}
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={accentColor} />
      ) : error ? (
        <TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={styles.empty}>
          <Text style={styles.emptyText}>{error}</Text>
          <Text style={[styles.retry, { color: accentColor }]}>Tap to retry</Text>
        </TouchableOpacity>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
          <Text style={styles.emptyText}>Your notifications will appear here.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={accentColor} />}
        >
          {items.map(item => {
            const actor = Array.isArray(item.actor) ? item.actor[0] : item.actor;
            const username = actor?.username || 'Someone';
            return (
              <TouchableOpacity key={item.id} style={[styles.row, !item.read_at && styles.unread]} onPress={() => void openNotification(item)}>
                {actor?.avatar_url ? (
                  <Image source={{ uri: actor.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{username.charAt(0).toUpperCase()}</Text></View>
                )}
                <View style={styles.message}>
                  <Text style={styles.body}><Text style={styles.username}>{username}</Text>{' '}{copy[item.notification_type] || 'interacted with you'}</Text>
                  <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                </View>
                {!item.read_at && <View style={[styles.dot, { backgroundColor: accentColor }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#77777755' },
  backButton: { width: 34 },
  backText: { fontSize: 34, color: '#888', lineHeight: 38 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  markRead: { fontSize: 12, fontWeight: '600' },
  headerSpacer: { width: 70 },
  loader: { marginTop: 40 },
  list: { paddingVertical: 8 },
  row: { minHeight: 76, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  unread: { backgroundColor: '#77777712' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#333' },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#444', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontWeight: '700' },
  message: { flex: 1 },
  body: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  username: { color: '#fff', fontWeight: '700' },
  time: { color: '#888', fontSize: 11, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#888', textAlign: 'center', fontSize: 13 },
  retry: { marginTop: 10, fontWeight: '600' },
});
