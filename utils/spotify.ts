
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export const SPOTIFY_CLIENT_ID = '1aa0b67931ea472fb250a8dce0915c04';

const SCOPES = [
  'user-read-private',
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'user-read-currently-playing',
];

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

type SpotifyTokenResponse = {
  accessToken?: string;
  access_token?: string;
  expiresIn?: number;
  expires_in?: number;
  issuedAt?: number;
  issued_at?: number;
  refreshToken?: string;
  refresh_token?: string;
};

const SESSION_KEYS = [
  'spotify_token',
  'spotify_refresh_token',
  'spotify_token_expires_at',
  'spotify_user_id',
  'spotify_token_owner_id',
];

let refreshInProgress: Promise<string | null> | null = null;
const sessionListeners = new Set<() => void>();

export function subscribeToSpotifySession(listener: () => void) {
  sessionListeners.add(listener);

  return () => {
    sessionListeners.delete(listener);
  };
}

export function notifySpotifySessionChanged() {
  sessionListeners.forEach(listener => listener());
}

export async function persistSpotifyTokenResponse(
  response: SpotifyTokenResponse,
  preserveRefreshToken = false
) {
  const accessToken = response.accessToken || response.access_token;

  if (!accessToken) {
    throw new Error('Spotify did not return an access token');
  }

  const expiresIn = response.expiresIn ?? response.expires_in;

  const refreshToken =
    response.refreshToken ||
    response.refresh_token ||
    (preserveRefreshToken
      ? await AsyncStorage.getItem('spotify_refresh_token')
      : null);

  await AsyncStorage.setItem('spotify_token', accessToken);

  if (!preserveRefreshToken) {
    await AsyncStorage.removeItem('spotify_user_id');
    await AsyncStorage.removeItem('spotify_token_owner_id');
  }

  if (expiresIn) {
    await AsyncStorage.setItem(
      'spotify_token_expires_at',
      String(Date.now() + expiresIn * 1000)
    );
  } else {
    await AsyncStorage.removeItem('spotify_token_expires_at');
  }

  if (refreshToken) {
    await AsyncStorage.setItem('spotify_refresh_token', refreshToken);
  } else {
    await AsyncStorage.removeItem('spotify_refresh_token');
  }

  return accessToken;
}

export async function clearSpotifySession() {
  await AsyncStorage.multiRemove(SESSION_KEYS);
  notifySpotifySessionChanged();
}

async function refreshSpotifyTokenInternal() {
  const refreshToken = await AsyncStorage.getItem('spotify_refresh_token');

  if (!refreshToken) {
    await clearSpotifySession();
    return null;
  }

  try {
    const response = await AuthSession.refreshAsync(
      {
        clientId: SPOTIFY_CLIENT_ID,
        refreshToken,
      },
      discovery
    );

    return await persistSpotifyTokenResponse(response, true);
  } catch (error) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error
        ? String(error.code)
        : '';

    if (code === 'invalid_grant' || code === 'invalid_token') {
      await clearSpotifySession();
    }

    return null;
  }
}

export function refreshSpotifyToken() {
  if (!refreshInProgress) {
    refreshInProgress = refreshSpotifyTokenInternal().finally(() => {
      refreshInProgress = null;
    });
  }

  return refreshInProgress;
}

export async function getValidSpotifyToken() {
  const accessToken = await AsyncStorage.getItem('spotify_token');

  if (!accessToken) {
    return null;
  }

  const expiresAt = Number(
    await AsyncStorage.getItem('spotify_token_expires_at')
  );

  if (!expiresAt) {
    const refreshToken = await AsyncStorage.getItem(
      'spotify_refresh_token'
    );

    return refreshToken ? refreshSpotifyToken() : accessToken;
  }

  if (expiresAt > Date.now() + 60_000) {
    return accessToken;
  }

  return refreshSpotifyToken();
}

export function useSpotifyAuth() {
  const redirectUri =
    Platform.OS === 'web'
      ? 'http://127.0.0.1:8081'
      : AuthSession.makeRedirectUri({
          scheme: 'myapp',
          path: 'redirect',
        });

  console.log('SPOTIFY REDIRECT URI:', redirectUri);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SCOPES,
      usePKCE: true,
      redirectUri,
      extraParams: {
        show_dialog: 'true',
      },
    },
    discovery
  );

  return {
    request,
    response,
    promptAsync,
    redirectUri,
  };
}

export const getTopTracks = async (token: string) => {
  const res = await fetch(
    'https://api.spotify.com/v1/me/top/tracks?limit=20',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.json();
};

export const getRecentlyPlayed = async (token: string) => {
  const res = await fetch(
    'https://api.spotify.com/v1/me/player/recently-played?limit=20',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.json();
};
