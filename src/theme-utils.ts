import type { Theme } from './types';

const nextThemeByTheme: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'ancient',
  ancient: 'light',
};

export const getNextTheme = (theme: Theme): Theme => nextThemeByTheme[theme];
