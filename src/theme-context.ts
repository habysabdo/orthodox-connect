import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark' | 'ancient';

/** Cycle order used by the theme toggle: light → dark → ancient → light. */
export const THEME_CYCLE: Theme[] = ['light', 'dark', 'ancient'];

export function nextTheme(theme: Theme): Theme {
  const index = THEME_CYCLE.indexOf(theme);
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
}

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
