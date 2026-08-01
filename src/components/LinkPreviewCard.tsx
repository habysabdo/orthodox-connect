import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Film, Play } from 'lucide-react';
import { apiFetch } from '@/lib/api';

/** The shape `/api/link-preview` answers with. */
export type LinkPreviewMetadata = {
  resolvedUrl: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
  provider: 'youtube' | 'facebook' | 'external';
  embeddable: boolean;
};

export type LinkPreviewProvider = LinkPreviewMetadata['provider'] | 'vimeo';

function linkPreviewLabel(provider: LinkPreviewProvider): string {
  if (provider === 'facebook') return 'Watch on Facebook';
  if (provider === 'youtube') return 'Watch on YouTube';
  if (provider === 'vimeo') return 'Watch on Vimeo';
  return 'Open link';
}

/**
 * Metadata for a link the card was not handed any.
 *
 * The request goes through `apiFetch` rather than a bare `fetch`: `/api/link-preview`
 * requires a signed-in member, and the session token lives in localStorage, so a
 * plain request answered 401 for anyone whose `nf_jwt` cookie was missing — which
 * showed as a card with no thumbnail and no title.
 */
function useLinkPreview(url: string, enabled: boolean): LinkPreviewMetadata | null {
  const [preview, setPreview] = useState<LinkPreviewMetadata | null>(null);

  useEffect(() => {
    setPreview(null);
    if (!enabled || !/^https?:\/\//i.test(url)) return;

    const controller = new AbortController();
    apiFetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { signal: controller.signal })
      .then(async (response) => (response.ok ? (await response.json()) as LinkPreviewMetadata : null))
      .then((metadata) => {
        if (metadata && !controller.signal.aborted) setPreview(metadata);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [enabled, url]);

  return preview;
}

/**
 * An external link rendered as something worth tapping.
 *
 * Links that no player on this site can play — a Facebook post, an article, a
 * shortened link that resolves to neither — used to be handed to a `<video>` tag
 * or a generic iframe, and both render a black box: no frame, no controls, no
 * explanation. Here the link keeps its own thumbnail, title and site name, and
 * the whole card opens the original in a new tab.
 */
export function LinkPreviewCard({
  url,
  preview: given = null,
  provider,
  className = '',
}: {
  url: string;
  /** already-fetched metadata; omit and the card fetches its own */
  preview?: LinkPreviewMetadata | null;
  /** the site this link belongs to; inferred from the fetched metadata when omitted */
  provider?: LinkPreviewProvider;
  className?: string;
}) {
  const fetched = useLinkPreview(url, !given);
  const preview = given ?? fetched;

  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }, [url]);
  const label = linkPreviewLabel(provider ?? preview?.provider ?? 'external');

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={`group relative flex min-h-52 flex-col justify-end overflow-hidden rounded-xl bg-ink-950 text-left ${className}`}
      aria-label={preview?.title ? `${label}: ${preview.title}` : label}
    >
      {preview?.image ? (
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.24),transparent_48%),linear-gradient(135deg,#1b2430,#090d12)]">
          <Film size={46} className="text-gold-300/70" aria-hidden="true" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
      <div className="relative z-10 p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-300">
          <Play size={12} fill="currentColor" aria-hidden="true" />
          {preview?.siteName || hostname || 'External link'}
        </div>
        <h3 className="line-clamp-2 text-base font-semibold text-white sm:text-lg">
          {preview?.title || 'This link opens on the original site'}
        </h3>
        {preview?.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/70">{preview.description}</p>}
        <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold-400 px-3.5 py-2 text-xs font-bold text-ink-950 transition group-hover:bg-gold-300">
          {label} <ExternalLink size={14} aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}
