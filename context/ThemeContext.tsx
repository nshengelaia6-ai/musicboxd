import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export const BACKGROUND_OPTIONS = ['#0a0a0a', '#141414', '#1a1a2e', '#16213e', '#0d1b0d', '#1a0d1a', '#2b1d0e', '#1c1c1c'];
export const ACCENT_OPTIONS = ['#ffb6c1', '#1DB954', '#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa', '#ff9f43', '#54a0ff'];

type ThemeContextType = {
  backgroundColor: string;
  accentColor: string;
  setBackgroundColor: (c: string) => void;
  setAccentColor: (c: string) => void;
  loaded: boolean;
};

const ThemeContext = createContext<ThemeContextType>({
  backgroundColor: BACKGROUND_OPTIONS[0],
  accentColor: ACCENT_OPTIONS[0],
  setBackgroundColor: () => {},
  setAccentColor: () => {},
  loaded: false,
});

export function ThemeContextProvider({ children }: { children: ReactNode }) {
  const [backgroundColor, setBackgroundColorState] = useState(BACKGROUND_OPTIONS[0]);
  const [accentColor, setAccentColorState] = useState(ACCENT_OPTIONS[0]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('appTheme').then(data => {
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.backgroundColor) setBackgroundColorState(parsed.backgroundColor);
        if (parsed.accentColor) setAccentColorState(parsed.accentColor);
      }
      setLoaded(true);
    });
  }, []);

  function setBackgroundColor(c: string) {
    setBackgroundColorState(c);
    AsyncStorage.getItem('appTheme').then(data => {
      const parsed = data ? JSON.parse(data) : {};
      AsyncStorage.setItem('appTheme', JSON.stringify({ ...parsed, backgroundColor: c }));
    });
  }

  function setAccentColor(c: string) {
    setAccentColorState(c);
    AsyncStorage.getItem('appTheme').then(data => {
      const parsed = data ? JSON.parse(data) : {};
      AsyncStorage.setItem('appTheme', JSON.stringify({ ...parsed, accentColor: c }));
    });
  }

  return (
    <ThemeContext.Provider value={{ backgroundColor, accentColor, setBackgroundColor, setAccentColor, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
