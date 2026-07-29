import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './theme-context';

const STORAGE_KEY = 'orthodoxconnect-theme';
const THEME_COLORS: Record<Theme, string> = {
  light: '#f7f3eb',
  dark: '#0a0c12',
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

function initialTheme(): Theme {
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

    if (storedTheme === 'light' || storedTheme === 'dark') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemTheme = (event: MediaQueryListEvent) => setTheme(event.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleSystemTheme);
    return () => mediaQuery.removeEventListener('change', handleSystemTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.add('theme-transition');
    setTheme(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      root.dataset.themeStorage = 'session';
    }
    window.setTimeout(() => root.classList.remove('theme-transition'), 320);
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
