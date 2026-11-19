import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';

export type ActivityType =
  | 'listened'
  | 'liked'
  | 'wants_to_listen'
  | 'reviewed'
  | 'created_list'
  | 'followed_artist';

type PendingActivity = {
  user_id: string;
  activity_type: ActivityType;
  item_key: string;
  data: Record<string, any>;
};

function pendingKey(userId: string) {
  return `pending_activity_sync_${userId}`;
}

async function readPending(userId: string): Promise<PendingActivity[]> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Could not read pending activity queue:', error);
    return [];
  }
}

/**
 * Retries activity rows that could not be sent earlier.
 * Returns the number of rows still waiting to sync.
 */
export async function flushPendingActivities(): Promise<number> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) return 0;

    const key = pendingKey(user.id);
    const pending = await readPending(user.id);
    if (!pending.length) return 0;

    let sent = 0;
    for (const item of pending) {
      const { error } = await supabase.from('user_activity').insert(item);
      if (error) {
        console.error('Pending activity sync failed:', error);
        break;
      }
      sent += 1;
    }

    const remaining = pending.slice(sent);
    if (remaining.length) {
      await AsyncStorage.setItem(key, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(key);
    }
    return remaining.length;
  } catch (error) {
    console.error('Could not sync pending activity:', error);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? (await readPending(user.id)).length : 0;
  }
}

export async function recordActivity(
  activityType: ActivityType,
  itemKey: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) return false;

    // Retry older events first, but do not block the current user action if offline.
    await flushPendingActivities();

    const activity: PendingActivity = {
      user_id: user.id,
      activity_type: activityType,
      item_key: String(itemKey),
      data,
    };

    const { error } = await supabase.from('user_activity').insert(activity);
    if (error) {
      const pending = await readPending(user.id);
      pending.push(activity);
      await AsyncStorage.setItem(pendingKey(user.id), JSON.stringify(pending));
      console.error('Activity saved locally and queued for sync:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Activity recording failed:', error);
    return false;
  }
}
