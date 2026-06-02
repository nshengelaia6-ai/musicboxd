import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#00b4d8' }}>
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