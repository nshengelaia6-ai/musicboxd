import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_SPOTIFY_SESSION_KEYS = [
  'spotify_token',
  'spotify_refresh_token',
  'spotify_token_expires_at',
  'spotify_user_id',
  'spotify_token_owner_id',
];

const sessionListeners = new Set<() => void>();

export function subscribeToSpotifySession(listener: () => void) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

export function notifySpotifySessionChanged() {
  sessionListeners.forEach(listener => listener());
}

/** Remove credentials left behind by older versions that supported Spotify account linking. */
export async function clearSpotifySession() {
  await AsyncStorage.multiRemove(LEGACY_SPOTIFY_SESSION_KEYS);
  notifySpotifySessionChanged();
}
