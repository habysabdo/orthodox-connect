import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './theme-context';

const STORAGE_KEY = 'orthodoxconnect-theme';
const THEME_COLORS: Record<Theme, string> = {
  light: '#f7f3eb',
  dark: '#0a0c12',
  ancient: '#e8dcc4',
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('ancient', theme === 'ancient');
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark' || stored === 'ancient') {
      return stored;
    }
  } catch {
    // fallback if localStorage isn't available
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Cycle through Light -> Dark -> Ancient -> Light
  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'ancient' : 'light';
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

  const setThemeExplicit = (newTheme: Theme) => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    setTheme(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      root.dataset.themeStorage = 'session';
    }
    window.setTimeout(() => root.classList.remove('theme-transition'), 320);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeExplicit }}>
      {children}
    </ThemeContext.Provider>
  );
}
