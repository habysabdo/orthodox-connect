import { useEffect, useState } from 'react';
import { ExternalLink, Film } from 'lucide-react';
import { youTubeEmbedUrl } from '@/utils/video';

interface YouTubeEmbedProps {
  /** any YouTube link shape — watch, youtu.be, shorts, live or embed */
  url: string | null | undefined;
  title: string;
  /** applied to the 16:9 frame that wraps the iframe */
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  modestBranding?: boolean;
}

/**
 * A YouTube video in a responsive 16:9 frame.
 *
 * Post feeds used to parse YouTube links with a hand-rolled regular expression
 * that only matched `watch?v=` and `youtu.be` and insisted on an eleven
 * character id, so Shorts and Live links fell through to a player that cannot
 * play them. Parsing now goes through the shared `youTubeEmbedUrl` helper, and
 * anything it cannot turn into an embed — along with an iframe that fails to
 * load — shows a placeholder that still links out to the video instead of a
 * blank black box.
 */
export function YouTubeEmbed({
  url,
  title,
  className = '',
  autoplay = false,
  muted = false,
  controls = true,
  loop = false,
  modestBranding = false,
}: YouTubeEmbedProps) {
  const embedUrl = youTubeEmbedUrl(url, { autoplay, muted, controls, loop, modestBranding });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [embedUrl]);

  if (!embedUrl || failed) {
    return <YouTubeEmbedFallback url={url} className={className} unplayable={!embedUrl} />;
  }

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
      <iframe
        src={embedUrl}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

function YouTubeEmbedFallback({
  url,
  className,
  unplayable,
}: {
  url: string | null | undefined;
  className: string;
  unplayable: boolean;
}) {
  const link = (url ?? '').trim();
  const openable = /^https?:\/\//i.test(link);

  return (
    <div
      className={`relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_55%),linear-gradient(160deg,#151b24,#07090d)] px-6 text-center ${className}`}
      role="alert"
    >
      <div>
        <Film size={30} className="mx-auto text-gold-300/80" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-white">
          {unplayable ? 'This video link cannot be played here' : 'This video could not be loaded'}
        </p>
        <p className="mt-1 text-xs text-white/60">
          {openable ? 'Open it on YouTube to watch.' : 'The shared address is not a usable video link.'}
        </p>
        {openable && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold-400 px-3.5 py-2 text-xs font-bold text-[#17130a] transition hover:bg-gold-300"
          >
            Watch on YouTube <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
