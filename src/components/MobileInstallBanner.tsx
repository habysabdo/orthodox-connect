import { Check, Download, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from './ui';
import { useI18n } from '@/i18n';

// The `beforeinstallprompt` event isn't in the standard lib DOM types.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'oc.installBannerDismissed';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as "Macintosh" but exposes a touch screen.
  const isIpadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || isIpadOs) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Top-of-landing install banner aimed at mobile visitors arriving from external
 * links or QR codes. On Android/Chrome it fires the browser's native install
 * prompt in a single tap (captured via `beforeinstallprompt`); on iOS Safari —
 * which has no programmatic install — it opens a modal with the manual
 * "Share → Add to Home Screen" steps. Hidden on desktop, when already installed,
 * or once dismissed.
 */
export function MobileInstallBanner() {
  const { t } = useI18n();
  const [platform] = useState<Platform>(detectPlatform);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    // Only target phones/tablets — desktop has its own affordances.
    if (platform === 'other') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    setVisible(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setVisible(false);
      setShowHelp(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [platform]);

  const dismiss = () => {
    setVisible(false);
    setShowHelp(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* localStorage may be unavailable in private mode */
    }
  };

  // One tap: native prompt when available (Android/Chrome), otherwise fall back
  // to the manual instructions modal (iOS, or Android without a deferred event).
  const onInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === 'accepted') setVisible(false);
      return;
    }
    setShowHelp(true);
  };

  if (!visible) return null;

  return (
    <>
      <div className="animate-slide-up sm:hidden">
        <div className="flex items-center gap-3 rounded-2xl border border-gold-400/40 bg-gradient-to-br from-ink-850/95 to-ink-900/95 p-3 shadow-gold backdrop-blur-md">
          <div className="shrink-0">
            <Logo size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-gold-100">
              {t('installBanner.cta')}
            </div>
            <div className="mt-0.5 truncate text-xs text-ink-400">
              {t('installBanner.subtitle')}
            </div>
          </div>
          <button onClick={onInstall} className="gold-btn shrink-0 px-3 py-2 text-xs">
            <Download size={14} /> {t('install.button')}
          </button>
          <button
            onClick={dismiss}
            className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
            aria-label={t('install.dismiss')}
            title={t('install.dismiss')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showHelp && (
        <InstallInstructions
          platform={platform}
          onClose={() => setShowHelp(false)}
        />
      )}
    </>
  );
}

/** Full-screen sheet with the manual add-to-home-screen steps per platform. */
function InstallInstructions({
  platform,
  onClose,
}: {
  platform: Platform;
  onClose: () => void;
}) {
  const { t } = useI18n();

  // Show the visitor's own platform first; keep the other for completeness.
  const showIosFirst = platform !== 'android';

  const ios = (
    <PlatformSteps
      key="ios"
      icon={<Share size={18} />}
      title={t('installModal.iosTitle')}
      steps={[
        t('installModal.iosStep1'),
        t('installModal.iosStep2'),
        t('installModal.iosStep3'),
      ]}
      highlight={platform === 'ios'}
    />
  );
  const android = (
    <PlatformSteps
      key="android"
      icon={<MoreVertical size={18} />}
      title={t('installModal.androidTitle')}
      steps={[
        t('installModal.androidStep1'),
        t('installModal.androidStep2'),
        t('installModal.androidStep3'),
      ]}
      highlight={platform === 'android'}
    />
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-950/80 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('installModal.title')}
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-md rounded-2xl border border-gold-400/40 bg-ink-900 p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-400/10 text-gold-300">
            <Smartphone size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gold-100">{t('installModal.title')}</h2>
            <p className="mt-0.5 text-sm text-ink-400">{t('installModal.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-200"
            aria-label={t('installModal.close')}
            title={t('installModal.close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {showIosFirst ? [ios, android] : [android, ios]}
        </div>

        <button onClick={onClose} className="ghost-btn mt-5 w-full">
          {t('installModal.close')}
        </button>
      </div>
    </div>
  );
}

function PlatformSteps({
  icon,
  title,
  steps,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  steps: string[];
  highlight: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? 'border-gold-400/50 bg-gold-400/[0.06]'
          : 'border-ink-700 bg-ink-850/60'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-gold-200">
        <span className="text-gold-300">{icon}</span>
        {title}
        {highlight && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-[11px] font-semibold text-gold-300">
            <Check size={11} /> {t('installModal.yourDevice')}
          </span>
        )}
      </div>
      <ol className="mt-3 space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-ink-200">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-400/15 text-[11px] font-bold text-gold-200">
              {i + 1}
            </span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
      {highlight && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gold-300">
          <Check size={13} /> {title}
        </div>
      )}
    </div>
  );
}
