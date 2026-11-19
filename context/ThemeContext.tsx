import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export const BACKGROUND_OPTIONS = ['#14181C', '#1D2329', '#2C3440', '#343D49', '#202830', '#252D35', '#303943', '#39434F'];
export const ACCENT_OPTIONS = ['#00E054', '#1DB954', '#65E572', '#FFFFFF', '#9BA7B2', '#54A0FF', '#F4C95D', '#FF7A90'];

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
    async function loadTheme() {
      try {
        const migration = await AsyncStorage.getItem('appThemeLetterboxdV1');

        if (!migration) {
          const newTheme = {
            backgroundColor: BACKGROUND_OPTIONS[0],
            accentColor: ACCENT_OPTIONS[0],
          };

          await AsyncStorage.setItem('appTheme', JSON.stringify(newTheme));
          await AsyncStorage.setItem('appThemeLetterboxdV1', 'true');
          setBackgroundColorState(newTheme.backgroundColor);
          setAccentColorState(newTheme.accentColor);
        } else {
          const data = await AsyncStorage.getItem('appTheme');
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.backgroundColor) setBackgroundColorState(parsed.backgroundColor);
            if (parsed.accentColor) setAccentColorState(parsed.accentColor);
          }
        }
      } catch (error) {
        console.error('Theme loading failed:', error);
      } finally {
        setLoaded(true);
      }
    }

    loadTheme();
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
