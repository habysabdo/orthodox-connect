import { useEffect, useState } from 'react';
import { ExternalLink, Film } from 'lucide-react';
import { facebookVideoEmbedUrl, facebookVideoUrl } from '@/utils/video';

interface FacebookVideoEmbedProps {
  /** any Facebook video link — watch, video.php, /videos/, /reel/, /share/v/ or fb.watch */
  url: string | null | undefined;
  title: string;
  /** applied to the 16:9 frame that wraps the iframe */
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
}

/**
 * A Facebook video in a responsive 16:9 frame.
 *
 * Facebook sends `X-Frame-Options` on its own pages and refuses to play a video
 * file that is fetched directly, so a Facebook link used as an ordinary embed
 * source renders a black box — which is what the feed used to show, together
 * with a "this video is available on the original site" card whenever the
 * server-side metadata lookup was blocked. The only embed Facebook serves to
 * other sites is its video plugin, so every Facebook video goes through that
 * here, with no metadata request in the way: the plugin either plays the video
 * or shows Facebook's own explanation inside the frame, and the caption keeps a
 * way out to Facebook itself.
 */
export function FacebookVideoEmbed({
  url,
  title,
  className = '',
  autoplay = false,
  muted = false,
}: FacebookVideoEmbedProps) {
  const embedUrl = facebookVideoEmbedUrl(url, { autoplay, muted });
  const watchUrl = facebookVideoUrl(url) ?? (url ?? '').trim();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [embedUrl]);

  if (!embedUrl || failed) {
    return <FacebookVideoFallback url={watchUrl} className={className} unplayable={!embedUrl} />;
  }

  return (
    <div>
      <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          scrolling="no"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
      {/^https?:\/\//i.test(watchUrl) && (
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-ink-400 transition hover:text-gold-200"
        >
          Watch on Facebook <ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function FacebookVideoFallback({
  url,
  className,
  unplayable,
}: {
  url: string;
  className: string;
  unplayable: boolean;
}) {
  const openable = /^https?:\/\//i.test(url);

  return (
    <div
      className={`relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_55%),linear-gradient(160deg,#151b24,#07090d)] px-6 text-center ${className}`}
      role="alert"
    >
      <div>
        <Film size={30} className="mx-auto text-gold-300/80" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-white">
          {unplayable ? 'This Facebook link cannot be played here' : 'This video could not be loaded'}
        </p>
        <p className="mt-1 text-xs text-white/60">
          {openable ? 'Open it on Facebook to watch.' : 'The shared address is not a usable video link.'}
        </p>
        {openable && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold-400 px-3.5 py-2 text-xs font-bold text-[#17130a] transition hover:bg-gold-300"
          >
            Watch on Facebook <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
