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
    root.classList.remove('dark', 'ancient');
    root.removeAttribute('data-theme');

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

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        setTheme, 
        toggleTheme, 
        isDark: theme === 'dark', 
        isAncient: theme === 'ancient' 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return a fallback object instead of throwing an unhandled exception
    return {
      theme: 'light' as Theme,
      setTheme: () => {},
      toggleTheme: () => {},
      isDark: false,
      isAncient: false,
    };
  }
  return context;
};
