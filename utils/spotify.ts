import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_ID = '1aa0b67931ea472fb250a8dce0915c04';

const SCOPES = [
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'user-read-currently-playing',
];

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export function useSpotifyAuth() {
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      scopes: SCOPES,
      usePKCE: true,
      redirectUri,
    },
    discovery
  );

  return { request, response, promptAsync, redirectUri };
}
export const getTopTracks = async (token: string) => {
  const res = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=20', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};

export const getRecentlyPlayed = async (token: string) => {
  const res = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=20', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
};
