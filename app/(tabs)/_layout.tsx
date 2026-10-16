import { getActiveSpotifyAccountId } from '@/utils/accountStorage';
import { getValidSpotifyToken, subscribeToSpotifySession } from '@/utils/spotify';
import { Tabs } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';

export default function TabLayout() {
  const [session, setSession] = useState({ loggedIn: false, userId: null as string | null });

  const refreshSession = useCallback(async () => {
    const token = await getValidSpotifyToken();
    const userId = token ? await getActiveSpotifyAccountId() : null;
    setSession({ loggedIn: !!token && !!userId, userId: token ? userId : null });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSpotifySession(() => {
      refreshSession();
    });
    refreshSession();
    return unsubscribe;
  }, [refreshSession]);

  return (
    <Tabs
      key={session.userId ?? 'signed-out'}
      screenOptions={{
        tabBarActiveTintColor: '#00b4d8',
        headerShown: false,
        tabBarStyle: session.loggedIn ? undefined : { display: 'none' },
      }}
    >

      <Tabs.Screen
        name="index"
        options={{
          title: 'For You',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>♪</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          href: session.loggedIn ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⌕</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="shared"
        options={{
          title: 'Shared',
          href: session.loggedIn ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>✈</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          href: session.loggedIn ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>♡</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: session.loggedIn ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>◉</Text>
          ),
        }}
      />
    </Tabs>
  );
}