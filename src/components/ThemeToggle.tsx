import { Moon, Scroll, Sun } from 'lucide-react';
import { THEME_LABELS, nextTheme, useTheme } from '../theme-context';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const upcomingTheme = nextTheme(theme);
  const label = `Switch to ${THEME_LABELS[upcomingTheme].toLowerCase()}`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-700 bg-ink-850 text-ink-300 shadow-sm transition-colors hover:border-gold-400/60 hover:bg-ink-800 hover:text-gold-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 ${className}`}
      aria-label={label}
      title={label}
    >
      <Sun
        size={18}
        className={`absolute transition-all duration-300 ${theme === 'light' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`}
        aria-hidden="true"
      />
      <Moon
        size={17}
        className={`absolute transition-all duration-300 ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-50 opacity-0'}`}
        aria-hidden="true"
      />
      <Scroll
        size={17}
        className={`absolute transition-all duration-300 ${theme === 'ancient' ? 'rotate-0 scale-100 opacity-100' : 'rotate-45 scale-50 opacity-0'}`}
        aria-hidden="true"
      />
    </button>
  );
}
