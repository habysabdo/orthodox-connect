import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, nextTheme, type Theme } from './theme-context';

const STORAGE_KEY = 'orthodoxconnect-theme';
const THEME_COLORS: Record<Theme, string> = {
  light: '#f7f3eb',
  dark: '#0a0c12',
  ancient: '#f0e3c2',
};

/** `ancient` is a parchment (light) palette, so it reports a light color-scheme to the UA. */
const COLOR_SCHEMES: Record<Theme, string> = {
  light: 'light',
  dark: 'dark',
  ancient: 'light',
};

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'ancient';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('ancient', theme === 'ancient');
  root.dataset.theme = theme;
  root.style.colorScheme = COLOR_SCHEMES[theme];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

function initialTheme(): Theme {
  const stored = document.documentElement.dataset.theme;
  if (isTheme(stored)) return stored;
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let storedTheme: string | null = null;
    try {
      storedTheme = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }

    if (isTheme(storedTheme)) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemTheme = (event: MediaQueryListEvent) => setTheme(event.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleSystemTheme);
    return () => mediaQuery.removeEventListener('change', handleSystemTheme);
  }, []);

  const toggleTheme = () => {
    const upcoming = nextTheme(theme);
    const root = document.documentElement;
    root.classList.add('theme-transition');
    setTheme(upcoming);
    try {
      localStorage.setItem(STORAGE_KEY, upcoming);
    } catch {
      root.dataset.themeStorage = 'session';
    }
    window.setTimeout(() => root.classList.remove('theme-transition'), 320);
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
