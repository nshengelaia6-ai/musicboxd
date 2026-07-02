import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeContextProvider } from '@/context/ThemeContext';

export const unstable_settings = {
  anchor: '(tabs)',
};
<Stack.Screen name="lists/index" options={{ headerShown: false }} />

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeContextProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="lists" options={{ headerShown: false }} />
          <Stack.Screen name="customize" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ThemeContextProvider>
  );
}
