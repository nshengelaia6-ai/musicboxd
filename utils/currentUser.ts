import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getCurrentUserId(): Promise<string | null> {
  const cached = await AsyncStorage.getItem('spotify_user_id');
  if (cached) return cached;

  const token = await AsyncStorage.getItem('spotify_token');
  if (!token) return null;

  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.id) {
      await AsyncStorage.setItem('spotify_user_id', data.id);
      return data.id;
    }
    return null;
  } catch (e) {
    console.log('Failed to get current user id', e);
    return null;
  }
}
