import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, isTheme, nextTheme, type Theme } from './theme-context';

const STORAGE_KEY = 'orthodoxconnect-theme';
const THEME_COLORS: Record<Theme, string> = {
  light: '#f7f3eb',
  dark: '#0a0c12',
  ancient: '#eee0c0',
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Only `dark` flips Tailwind's dark variant. Ancient is a light theme with its
  // own palette, selected through `[data-theme='ancient']` in index.css.
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

function initialTheme(): Theme {
  // The inline boot script in index.html already resolved the theme before React
  // mounted, so trust what it wrote rather than guessing again.
  const booted = document.documentElement.dataset.theme;
  if (isTheme(booted)) return booted;
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

    // An explicit choice — including "ancient" — wins over the OS preference.
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
