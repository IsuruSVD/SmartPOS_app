import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { ThemeColors, lightColors, darkColors, getThemeColors } from './theme';
import type { DatabaseService } from '../db/services/DatabaseService';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ActiveTheme = 'light' | 'dark';

export interface ThemeContextValue {
  themePreference: ThemePreference;
  activeTheme: ActiveTheme;
  colors: ThemeColors;
  isDark: boolean;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  themePreference: 'system',
  activeTheme: 'light',
  colors: lightColors,
  isDark: false,
  setThemePreference: async () => {},
});

export interface ThemeProviderProps {
  children: React.ReactNode;
  db?: DatabaseService | null;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, db }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme() ?? 'light');

  // Listen to OS appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'light');
    });
    return () => subscription.remove();
  }, []);

  // Load persisted theme preference from SQLite settings
  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    db.settings.get('theme_preference').then((val) => {
      if (isMounted && val && (val === 'system' || val === 'light' || val === 'dark')) {
        setThemePreferenceState(val as ThemePreference);
      }
    }).catch(() => {
      // Fallback to system default if setting not yet initialized
    });
    return () => { isMounted = false; };
  }, [db]);

  const setThemePreference = useCallback(async (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    if (db) {
      try {
        await db.settings.set('theme_preference', pref);
      } catch {
        // Safe fallback
      }
    }
  }, [db]);

  const activeTheme: ActiveTheme = useMemo(() => {
    if (themePreference === 'system') {
      return systemScheme === 'dark' ? 'dark' : 'light';
    }
    return themePreference;
  }, [themePreference, systemScheme]);

  const colors = useMemo(() => getThemeColors(activeTheme), [activeTheme]);
  const isDark = activeTheme === 'dark';

  const value = useMemo(
    () => ({
      themePreference,
      activeTheme,
      colors,
      isDark,
      setThemePreference,
    }),
    [themePreference, activeTheme, colors, isDark, setThemePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
