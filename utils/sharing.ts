import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';

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
  const profileData = await AsyncStorage.getItem('profile');
  const profile = profileData ? JSON.parse(profileData) : {};
  const stored = await AsyncStorage.getItem('shared_songs');
  const shares = stored ? JSON.parse(stored) : [];

  shares.unshift({
    id: `${Date.now()}-${item.id}`,
    itemId: item.id,
    type: item.type,
    albumId: item.albumId,
    name: item.name,
    artist: item.artist || '',
    cover: item.cover || '',
    from: profile.username || 'you',
    date: new Date().toISOString(),
    url,
  });

  await AsyncStorage.setItem('shared_songs', JSON.stringify(shares));

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