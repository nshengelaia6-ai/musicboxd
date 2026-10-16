import AsyncStorage from '@react-native-async-storage/async-storage';
import { getValidSpotifyToken, refreshSpotifyToken } from './spotify';

export type SpotifyProfile = {
  id: string;
  display_name?: string | null;
  images?: { url: string }[];
};

export async function getCurrentSpotifyProfile(
  suppliedToken?: string
): Promise<SpotifyProfile | null> {
  let token = suppliedToken || await getValidSpotifyToken();
  if (!token) return null;

  const cachedOwnerId = await AsyncStorage.getItem('spotify_token_owner_id');

  try {
    let response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401 && !suppliedToken) {
      token = await refreshSpotifyToken() || '';
      if (!token) return null;
      response = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (!response.ok) return null;

    const profile: SpotifyProfile = await response.json();
    if (!profile.id) return null;

    await AsyncStorage.setItem('spotify_user_id', profile.id);
    await AsyncStorage.setItem('spotify_token_owner_id', profile.id);
    return profile;
  } catch (e) {
    console.log('Failed to get current Spotify profile', e);
    return !suppliedToken && cachedOwnerId ? { id: cachedOwnerId } : null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const profile = await getCurrentSpotifyProfile();
  return profile?.id ?? null;
}
