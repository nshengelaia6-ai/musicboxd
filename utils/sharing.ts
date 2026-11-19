import { Share } from 'react-native';
import { supabase } from './supabase';

export type ShareableMusicItem = {
  id: string;
  type: 'album' | 'track';
  albumId?: string;
  name: string;
  artist?: string;
  cover?: string;
};

export async function shareMusicItem(item: ShareableMusicItem) {
  const url = `https://open.spotify.com/${item.type}/${item.id}`;

  try {
    await Share.share({
      title: item.name,
      message: `${item.name}${item.artist ? ` by ${item.artist}` : ''}\n${url}`,
      url,
    });
  } catch (error) {
    console.log('Could not open the system share sheet', error);
  }
}

export async function sendMusicToFriend(
  item: ShareableMusicItem,
  recipientId: string,
  message = ''
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('swift-service', {
    body: {
      recipient_id: recipientId,
      item_type: item.type,
      item_id: item.id,
      item_name: item.name,
      artist_name: item.artist || '',
      cover_url: item.cover || '',
      message: message.trim(),
    },
  });

  if (error) {
    throw new Error(error.message || 'Could not send music. Please try again.');
  }

  if (!data?.success) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'Could not send music. Please try again.'
    );
  }
}
