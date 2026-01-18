/**
 * Custom hook for managing theme (light/dark mode)
 *
 * Supports:
 * - System preference detection
 * - Persistent storage in localStorage
 * - Toggle and explicit mode setting
 *
 * Usage:
 * ```tsx
 * const { mode, toggle, setMode, isDark } = useThemeMode();
 *
 * <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
 *   <Button onClick={toggle}>Toggle Theme</Button>
 * </ThemeProvider>
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { getSystemPreference, getStoredTheme, storeTheme } from '../theme';

type ThemeMode = 'light' | 'dark';

interface UseThemeModeReturn {
  /** Current theme mode */
  mode: ThemeMode;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Whether light mode is active */
  isLight: boolean;
  /** Toggle between light and dark */
  toggle: () => void;
  /** Set specific mode */
  setMode: (mode: ThemeMode) => void;
  /** Reset to system preference */
  resetToSystem: () => void;
}

export function useThemeMode(): UseThemeModeReturn {
  // Initialize with stored preference or system preference
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = getStoredTheme();
    if (stored) return stored;
    return getSystemPreference();
  });

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if no stored preference
      if (!getStoredTheme()) {
        setModeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    storeTheme(newMode);
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const newMode = current === 'dark' ? 'light' : 'dark';
      storeTheme(newMode);
      return newMode;
    });
  }, []);

  const resetToSystem = useCallback(() => {
    localStorage.removeItem('rss-calculator-theme');
    setModeState(getSystemPreference());
  }, []);

  return {
    mode,
    isDark: mode === 'dark',
    isLight: mode === 'light',
    toggle,
    setMode,
    resetToSystem,
  };
}

export default useThemeMode;
