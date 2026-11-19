import { supabase } from '@/utils/supabase';

export type ActivityType =
  | 'listened'
  | 'liked'
  | 'wants_to_listen'
  | 'reviewed'
  | 'created_list'
  | 'followed_artist';

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

    const { error } = await supabase
      .from('user_activity')
      .insert({
        user_id: user.id,
        activity_type: activityType,
        item_key: String(itemKey),
        data,
      });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Activity recording failed:', error);
    return false;
  }
}
