import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/utils/supabase';
import { recordActivity } from '@/utils/activity';

type MusicListItem = {
  id: string;
  type: 'album' | 'track';
  name: string;
  artist?: string;
  cover?: string;
  albumId?: string;
};

function isSameItem(left: any, right: MusicListItem) {
  return String(left?.id) === String(right.id) && left?.type === right.type;
}

/**
 * Adds an album or track to the user's local and cloud-backed list.
 * The list page stores its item array in the legacy "albums" property locally
 * and in the "items" column in Supabase.
 */
export async function addMusicItemToList(listId: string, item: MusicListItem) {
  const raw = await AsyncStorage.getItem('lists');
  const lists = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(lists)) throw new Error('Your lists could not be read.');

  const index = lists.findIndex((entry: any) => String(entry.id) === String(listId));
  if (index < 0) throw new Error('This list could not be found.');

  const localList = lists[index];
  const localItems = Array.isArray(localList.albums) ? localList.albums : [];
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  let canonicalItems = localItems;
  let listName = String(localList.name || 'Untitled list');
  let description = String(localList.description || '');
  let privacy = ['public', 'friends', 'link', 'private'].includes(localList.privacy)
    ? localList.privacy
    : 'public';
  let createdAt = localList.createdAt || new Date().toISOString();

  if (user) {
    const { data: cloudList, error: cloudReadError } = await supabase
      .from('music_lists')
      .select('name,description,privacy,items,created_at')
      .eq('id', String(listId))
      .eq('user_id', user.id)
      .maybeSingle();
    if (cloudReadError) throw cloudReadError;

    if (cloudList) {
      canonicalItems = Array.isArray(cloudList.items) ? cloudList.items : localItems;
      listName = cloudList.name || listName;
      description = cloudList.description || '';
      privacy = cloudList.privacy || privacy;
      createdAt = cloudList.created_at || createdAt;
    }
  }

  const alreadyAdded = canonicalItems.some((entry: any) => isSameItem(entry, item));
  const updatedItems = alreadyAdded ? canonicalItems : [item, ...canonicalItems];

  if (user) {
    const now = new Date().toISOString();
    const { data: existingCloudList, error: checkError } = await supabase
      .from('music_lists')
      .select('id')
      .eq('id', String(listId))
      .eq('user_id', user.id)
      .maybeSingle();
    if (checkError) throw checkError;

    const cloudPayload = {
      id: String(listId),
      user_id: user.id,
      name: listName,
      description,
      privacy,
      items: updatedItems,
      created_at: createdAt,
      updated_at: now,
    };

    const { error: cloudWriteError } = existingCloudList
      ? await supabase.from('music_lists').update({
          items: updatedItems,
          updated_at: now,
        }).eq('id', String(listId)).eq('user_id', user.id)
      : await supabase.from('music_lists').insert(cloudPayload);
    if (cloudWriteError) throw cloudWriteError;

    if (privacy === 'public') {
      const listData = {
        id: String(listId),
        name: listName,
        description,
        privacy,
        itemCount: updatedItems.length,
        albums: updatedItems,
        type: 'list',
        createdAt,
      };
      const { error: profileError } = await supabase
        .from('public_profile_items')
        .upsert({
          user_id: user.id,
          section: 'lists',
          item_key: String(listId),
          data: listData,
          updated_at: now,
        }, { onConflict: 'user_id,section,item_key' });
      if (profileError) throw profileError;

      const { data: activityRows, error: activityReadError } = await supabase
        .from('user_activity')
        .select('id')
        .eq('user_id', user.id)
        .eq('activity_type', 'created_list')
        .eq('item_key', String(listId))
        .order('created_at', { ascending: false })
        .limit(1);
      if (activityReadError) throw activityReadError;

      if (activityRows?.[0]?.id) {
        const { error: activityUpdateError } = await supabase
          .from('user_activity')
          .update({ data: listData, created_at: now })
          .eq('id', activityRows[0].id)
          .eq('user_id', user.id);
        if (activityUpdateError) throw activityUpdateError;
      } else {
        await recordActivity('created_list', String(listId), listData);
      }
    }
  }

  lists[index] = { ...localList, albums: updatedItems };
  await AsyncStorage.setItem('lists', JSON.stringify(lists));
  return { added: !alreadyAdded };
}
