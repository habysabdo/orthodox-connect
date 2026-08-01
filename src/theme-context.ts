import { createContext, useContext } from 'react';

/**
 * The order the theme button cycles through: light → dark → ancient → light.
 * "Ancient" is a parchment/illuminated-manuscript reading mode — it is a light
 * theme, so it never carries the `dark` class.
 */
export const THEME_CYCLE = ['light', 'dark', 'ancient'] as const;

export type Theme = (typeof THEME_CYCLE)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEME_CYCLE as readonly string[]).includes(value);
}

export function nextTheme(theme: Theme): Theme {
  const index = THEME_CYCLE.indexOf(theme);
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
}

export const THEME_LABELS: Record<Theme, string> = {
  light: 'Light Mode',
  dark: 'Dark Mode',
  ancient: 'Ancient Mode',
};

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
