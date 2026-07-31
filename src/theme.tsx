// src/theme.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme } from './types';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isAncient: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('theme') as Theme;
      return (saved === 'light' || saved === 'dark' || saved === 'ancient') ? saved : 'light';
    } catch {
      return 'light';
    }
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'ancient';
      return 'light';
    });
  };

  useEffect(() => {
    const root = document.documentElement;
    
    // Clean up active classes/attributes
    root.classList.remove('dark', 'ancient');
    root.removeAttribute('data-theme');

    // Apply active theme
    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'ancient') {
      root.classList.add('ancient');
      root.setAttribute('data-theme', 'ancient');
    } else {
      root.setAttribute('data-theme', 'light');
    }

    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.warn('Unable to save theme to localStorage:', e);
    }
  }, [theme]);

  const isDark = theme === 'dark';
  const isAncient = theme === 'ancient';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark, isAncient }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
