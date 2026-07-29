import { Check, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n';

export function LanguageSwitcher({
  className = '',
  variant = 'compact',
}: {
  className?: string;
  variant?: 'compact' | 'sidebar';
}) {
  const { locale, locales, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = locales.find((l) => l.code === locale) ?? locales[0];

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={variant === 'sidebar'
          ? 'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 transition-all hover:bg-ink-800 hover:text-ink-100'
          : 'flex items-center gap-1.5 rounded-lg px-2 py-2 text-ink-300 transition-colors hover:bg-ink-800 hover:text-gold-200'}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current.englishLabel}
      >
        <Globe size={variant === 'sidebar' ? 20 : 18} className={variant === 'sidebar' ? 'text-ink-400 group-hover:text-gold-300' : ''} />
        {variant === 'sidebar' ? (
          <>
            <span className="flex-1 text-left">{t('settings.language')}</span>
            <span className="text-xs text-ink-500">{current.code.toUpperCase()}</span>
          </>
        ) : (
          <span className="hidden text-sm font-medium sm:inline">{current.code.toUpperCase()}</span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-card animate-scale-in ${
            variant === 'sidebar' ? 'inset-x-0 w-full' : 'end-0'
          }`}
        >
          {locales.map((l) => {
            const active = l.code === locale;
            return (
              <button
                key={l.code}
                role="option"
                aria-selected={active}
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm transition-colors ${
                  active
                    ? 'bg-gold-400/10 text-gold-200'
                    : 'text-ink-200 hover:bg-ink-800'
                }`}
              >
                <span className="text-base leading-none">{l.flag}</span>
                <span className="flex-1">{l.label}</span>
                {active && <Check size={15} className="text-gold-300" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
