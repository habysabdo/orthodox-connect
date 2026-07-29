import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LOCALE,
  LOCALES,
  TRANSLATIONS,
  type LocaleCode,
  type LocaleMeta,
} from './translations';

const STORAGE_KEY = 'oc.locale';

type Vars = Record<string, string | number>;

interface I18nState {
  locale: LocaleCode;
  dir: 'ltr' | 'rtl';
  locales: LocaleMeta[];
  setLocale: (code: LocaleCode) => void;
  /** Translate a key, interpolating any `{var}` placeholders. */
  t: (key: string, vars?: Vars) => string;
}

const I18nCtx = createContext<I18nState | null>(null);

function isLocale(v: string | null): v is LocaleCode {
  return !!v && LOCALES.some((l) => l.code === v);
}

// Resolve the initial locale: an explicit saved choice wins, otherwise fall back
// to the browser's preferred language when we ship a translation for it.
function detectInitialLocale(): LocaleCode {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(saved)) return saved;
  const nav = window.navigator.language?.slice(0, 2).toLowerCase();
  if (isLocale(nav)) return nav;
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(detectInitialLocale);

  const meta = useMemo(
    () => LOCALES.find((l) => l.code === locale) ?? LOCALES[0],
    [locale],
  );

  // Mirror the layout for RTL languages (Arabic) and expose the language to
  // assistive tech + CSS by keeping <html dir> and <html lang> in sync.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', locale);
    root.setAttribute('dir', meta.dir);
  }, [locale, meta.dir]);

  const setLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // localStorage can be unavailable (private mode); the in-memory choice
      // still applies for this session.
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const dict = TRANSLATIONS[locale] ?? TRANSLATIONS[DEFAULT_LOCALE];
      let str = dict[key] ?? TRANSLATIONS[DEFAULT_LOCALE][key] ?? key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
        }
      }
      return str;
    },
    [locale],
  );

  const value = useMemo<I18nState>(
    () => ({ locale, dir: meta.dir, locales: LOCALES, setLocale, t }),
    [locale, meta.dir, setLocale, t],
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
