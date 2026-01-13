import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getTheme, setTheme as persistTheme } from '../lib/localSettings';

const ThemeContext = createContext(null);

const lightColors = {
  mode: 'light',
  bg: '#F7F8FA',
  card: '#FFFFFF',
  border: '#EEF2F7',
  text: '#111827',
  muted: '#6C757D',
  primary: '#6366F1',
  danger: '#DC2626',
  chipBg: '#F3F4F6',
};

const darkColors = {
  mode: 'dark',
  bg: '#0B1220',
  card: '#0F172A',
  border: '#1F2937',
  text: '#E5E7EB',
  muted: '#A1A1AA',
  primary: '#818CF8',
  danger: '#F87171',
  chipBg: '#111827',
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light'); // 'light' | 'dark'

  useEffect(() => {
    let mounted = true;
    (async () => {
      const t = await getTheme();
      if (mounted) setThemeState(t);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setTheme = async (next) => {
    const t = next === 'dark' ? 'dark' : 'light';
    setThemeState(t);
    await persistTheme(t);
  };

  const toggleTheme = async () => {
    await setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const colors = useMemo(() => (theme === 'dark' ? darkColors : lightColors), [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      colors,
      setTheme,
      toggleTheme,
    }),
    [theme, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}


