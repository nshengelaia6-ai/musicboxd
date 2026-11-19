
import { activateSpotifyAccount } from '@/utils/accountStorage';
import { supabase } from '@/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export default function TabLayout() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  async function activateUser(userId: string) {
    await activateSpotifyAccount(userId);
    await AsyncStorage.setItem('supabase_user_id', userId);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        // Remove the legacy development-only bypass flag; it is never honored.
        await AsyncStorage.removeItem('musicboxd_test_mode');
        const sessionResult = await supabase.auth.getSession();
        const session = sessionResult.data.session;

        if (session && !sessionResult.error) {
          await activateUser(session.user.id);
        }

        if (active) {
          setLoggedIn(!sessionResult.error && !!session);
        }
      } catch (error) {
        console.error('Account initialization failed:', error);
        if (active) setLoggedIn(false);
      }
    }

    initialize();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            setLoggedIn(null);
          }

          void activateUser(session.user.id)
            .then(() => {
              if (active) setLoggedIn(true);
            })
            .catch((error) => {
              console.error('Account activation failed:', error);
              if (active) setLoggedIn(false);
            });
        } else {
          void AsyncStorage.removeItem('supabase_user_id');
          if (active) setLoggedIn(false);
        }
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loggedIn === null) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#101010',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color="#00b4d8" size="large" />
      </View>
    );
  }

  if (!loggedIn) {
    return <Redirect href="/auth" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00b4d8',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'For You',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>♫</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⌕</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="shared"
        options={{
          title: 'Shared',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>✈</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>♡</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>◉</Text>
          ),
        }}
      />
    </Tabs>
  );
}
