import { Share } from 'react-native';
import { getValidSpotifyToken } from './spotify';

const SUPABASE_URL = 'https://jvxsfjxcydpdlvwrxmor.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_tH6PoxGwVF9JyUvsMw0mUg_cFiFzeCm';

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
  const spotifyToken = await getValidSpotifyToken();

  if (!spotifyToken) {
    throw new Error('Spotify session expired. Please sign in again.');
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/swift-service`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${spotifyToken}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient_id: recipientId,
        item_type: item.type,
        item_id: item.id,
        item_name: item.name,
        artist_name: item.artist || '',
        cover_url: item.cover || '',
        message: message.trim(),
      }),
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.success) {
    throw new Error(
      typeof result.error === 'string'
        ? result.error
        : 'Could not send music. Please try again.'
    );
  }
}