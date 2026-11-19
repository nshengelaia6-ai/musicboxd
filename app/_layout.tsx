
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemeContextProvider } from '@/context/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'auth',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeContextProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen
            name="auth"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="modal"
            options={{ presentation: 'modal', title: 'Modal' }}
          />
          <Stack.Screen
            name="lists/index"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="customize"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen
            name="artist/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="album/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="track/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="review/new"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="review/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="find-people"
            options={{ headerShown: false }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ThemeContextProvider>
  );
}

