import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from './ui';
import { useI18n } from '@/i18n';

// The `beforeinstallprompt` event isn't in the standard lib DOM types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'oc.installDismissed';

/**
 * "Add to Home Screen" banner. Captures the browser's deferred install prompt
 * and surfaces a friendly banner so mobile visitors can install the PWA with a
 * single tap. Hidden when already installed or previously dismissed.
 */
export function InstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already running as an installed app → never show.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-gold-400/40 bg-ink-900/95 p-3 shadow-card backdrop-blur-md animate-slide-up">
        <div className="shrink-0">
          <Logo size={40} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-gold-100">{t('install.title')}</div>
          <div className="mt-0.5 text-xs text-ink-400">{t('install.body')}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button onClick={install} className="gold-btn px-3 py-2 text-xs">
            <Download size={14} /> {t('install.button')}
          </button>
          <button
            onClick={dismiss}
            className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
            aria-label={t('install.dismiss')}
            title={t('install.dismiss')}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
