
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSpotifySession, notifySpotifySessionChanged } from './spotify';

const ACTIVE_ACCOUNT_KEY = 'active_spotify_user_id';
const ACCOUNT_DATA_PREFIX = 'musicboxd_account_data:';
const PENDING_SWITCH_KEY = 'musicboxd_account_switch_pending';

const ACCOUNT_DATA_KEYS = new Set([
  'profile',
  'reviews',
  'listened',
  'liked',
  'wantToListen',
  'lists',
  'diary_entries',
  'following',
  'followers',
  'shared_songs',
  'shared_song_likes',
  'shared_song_replies',
  'followed_artists',
  'recent_searches',
  'review_saved_notification',
  'user_id',
  'supabase_user_id',
  'pendingFavoriteAlbums',
  'returnToSettings',
]);

type AccountData = Record<string, string>;

type PendingSwitch = {
  userId: string;
  data: AccountData;
};

let activationQueue: Promise<void> = Promise.resolve();

function isAccountDataKey(key: string) {
  return (
    ACCOUNT_DATA_KEYS.has(key) ||
    key.startsWith('likes_') ||
    key.startsWith('review_liked_') ||
    key.startsWith('monthly_fav_')
  );
}

function accountDataKey(userId: string) {
  return `${ACCOUNT_DATA_PREFIX}${userId}`;
}

async function readCurrentAccountData(): Promise<AccountData> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isAccountDataKey);
  const pairs = await AsyncStorage.multiGet(keys);

  return Object.fromEntries(
    pairs.filter(
      (entry): entry is [string, string] => entry[1] !== null
    )
  );
}

async function replaceCurrentAccountData(data: AccountData) {
  const currentKeys = (await AsyncStorage.getAllKeys()).filter(
    isAccountDataKey
  );

  if (currentKeys.length > 0) {
    await AsyncStorage.multiRemove(currentKeys);
  }

  const entries = Object.entries(data);

  if (entries.length > 0) {
    await AsyncStorage.multiSet(entries);
  }
}

async function recoverPendingSwitch() {
  const pendingValue = await AsyncStorage.getItem(PENDING_SWITCH_KEY);

  if (!pendingValue) return;

  const pending = JSON.parse(pendingValue) as PendingSwitch;

  await replaceCurrentAccountData(pending.data);
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, pending.userId);
  await AsyncStorage.removeItem(accountDataKey(pending.userId));
  await AsyncStorage.removeItem(PENDING_SWITCH_KEY);
}

async function activateAccount(
  userId: string,
  previousUserId?: string
) {
  await recoverPendingSwitch();

  let activeUserId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);

  console.log('ACCOUNT SWITCH:', {
    newUserId: userId,
    previousUserId,
    activeUserId,
  });

  if (!activeUserId) {
    if (previousUserId === userId) {
      await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, userId);
      notifySpotifySessionChanged();
      return;
    }

    if (previousUserId) {
      activeUserId = previousUserId;
      await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, activeUserId);
    } else {
      const legacyData = await readCurrentAccountData();

      if (Object.keys(legacyData).length > 0) {
        await AsyncStorage.setItem(
          accountDataKey('unassigned'),
          JSON.stringify(legacyData)
        );
      }

      const targetDataValue = await AsyncStorage.getItem(
        accountDataKey(userId)
      );

      const targetData = targetDataValue
        ? (JSON.parse(targetDataValue) as AccountData)
        : {};

      await AsyncStorage.setItem(
        PENDING_SWITCH_KEY,
        JSON.stringify({ userId, data: targetData } satisfies PendingSwitch)
      );

      await replaceCurrentAccountData(targetData);
      await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, userId);
      await AsyncStorage.removeItem(accountDataKey(userId));
      await AsyncStorage.removeItem(PENDING_SWITCH_KEY);

      notifySpotifySessionChanged();
      return;
    }
  }

  if (activeUserId === userId) return;

  const currentData = await readCurrentAccountData();

  await AsyncStorage.setItem(
    accountDataKey(activeUserId),
    JSON.stringify(currentData)
  );

  const targetDataValue = await AsyncStorage.getItem(
    accountDataKey(userId)
  );

  const targetData = targetDataValue
    ? (JSON.parse(targetDataValue) as AccountData)
    : {};

  await AsyncStorage.setItem(
    PENDING_SWITCH_KEY,
    JSON.stringify({ userId, data: targetData } satisfies PendingSwitch)
  );

  await replaceCurrentAccountData(targetData);
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, userId);
  await AsyncStorage.removeItem(accountDataKey(userId));
  await AsyncStorage.removeItem(PENDING_SWITCH_KEY);

  notifySpotifySessionChanged();
}

export function activateSpotifyAccount(
  userId: string,
  previousUserId?: string
) {
  const activation = activationQueue
    .catch(() => undefined)
    .then(() => activateAccount(userId, previousUserId));

  activationQueue = activation;

  return activation;
}

export async function getActiveSpotifyAccountId() {
  await recoverPendingSwitch();
  return AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

export async function removeDeletedSpotifyAccountData(userId: string) {
  const cleanup = activationQueue
    .catch(() => undefined)
    .then(async () => {
      await recoverPendingSwitch();

      const activeUserId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);

      // Clear account-scoped app data and Spotify credentials only for this account.
      if (activeUserId === userId) {
        await replaceCurrentAccountData({});
        await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      }

      // Spotify tokens are device-global, so clear them after this account is deleted.
      await clearSpotifySession();
      notifySpotifySessionChanged();
      await AsyncStorage.removeItem(accountDataKey(userId));
      await AsyncStorage.removeItem('musicboxd_test_mode');
    });

  activationQueue = cleanup;
  await cleanup;
}
