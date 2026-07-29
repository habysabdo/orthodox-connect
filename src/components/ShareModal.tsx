import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, QrCode as QrCodeIcon, Smartphone, X } from 'lucide-react';
import { Logo, Modal } from './ui';
import { useUI } from '@/store/ui';
import { useI18n } from '@/i18n';
import { encodeQr } from '@/utils/qrcode';

// The canonical install URL. Prefer the live origin the app is served from so
// QR codes on preview/staging deploys point back to themselves, and fall back
// to the production domain during SSR or when origin is unavailable.
function shareUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://orthodoxconnect.live';
}

/** Render a QR matrix as crisp, scalable SVG — no <img>, no network round-trip. */
function QrSvg({ value, size = 240 }: { value: string; size?: number }) {
  const matrix = useMemo(() => encodeQr(value, 'MEDIUM'), [value]);
  const count = matrix.length;
  const border = 2; // quiet zone (modules)
  const dim = count + border * 2;

  const rects: string[] = [];
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (matrix[y][x]) rects.push(`M${x + border},${y + border}h1v1h-1z`);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      role="img"
      aria-label={value}
      shapeRendering="crispEdges"
      className="rounded-xl"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={rects.join('')} fill="#0a0a0b" />
    </svg>
  );
}

export function ShareModal() {
  const { shareOpen, setShareOpen } = useUI();
  const { t } = useI18n();
  const url = shareUrl();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Reset the transient "copied" toast whenever the sheet is reopened.
  useEffect(() => {
    if (!shareOpen) setCopied(false);
  }, [shareOpen]);

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for browsers without the async clipboard API.
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — leave button state unchanged */
    }
  };

  const shareNative = async () => {
    try {
      await navigator.share({
        title: 'OrthodoxConnect',
        text: t('share.nativeText'),
        url,
      });
    } catch {
      /* user dismissed the share sheet — no-op */
    }
  };

  return (
    <Modal open={shareOpen} onClose={() => setShareOpen(false)} size="sm" className="relative !bg-ink-900 !p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
        <div className="flex items-center gap-2">
          <QrCodeIcon size={20} className="text-gold-300" />
          <span className="font-semibold text-ink-100">{t('share.title')}</span>
        </div>
        <button
          onClick={() => setShareOpen(false)}
          className="rounded-full p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          aria-label={t('common.cancel')}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-col items-center px-5 py-6">
        <div className="mb-4 flex items-center gap-2 text-ink-300">
          <Logo size={26} />
          <span className="text-sm font-medium">{t('share.subtitle')}</span>
        </div>

        {/* QR code */}
        <div className="rounded-2xl border border-ink-700 bg-white p-3 shadow-gold">
          <QrSvg value={url} size={232} />
        </div>

        {/* Instructions */}
        <p className="mt-4 max-w-xs text-center text-sm text-ink-300">{t('share.scanHint')}</p>

        {/* Link chip */}
        <div className="mt-4 w-full truncate rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-center text-xs text-ink-400">
          {url.replace(/^https?:\/\//, '')}
        </div>

        {/* Actions */}
        <div className="mt-4 flex w-full flex-col gap-2">
          <button onClick={copyLink} className="gold-btn w-full justify-center py-3" aria-live="polite">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t('share.copied') : t('share.copyLink')}
          </button>

          {canShare && (
            <button
              onClick={shareNative}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-850 py-3 text-sm font-semibold text-ink-100 transition-colors hover:border-gold-400/50 hover:bg-ink-800"
            >
              <Smartphone size={16} className="text-gold-300" />
              {t('share.shareMobile')}
            </button>
          )}
        </div>
      </div>

      {/* Toast confirmation */}
      {copied && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/95 px-4 py-2 text-sm font-semibold text-white shadow-lg animate-fade-in">
            <Check size={15} /> {t('share.copied')}
          </div>
        </div>
      )}
    </Modal>
  );
}
