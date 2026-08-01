import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type Hls from 'hls.js';
import MuxPlayer, { type MuxPlayerRefAttributes } from '@mux/mux-player-react';
import { AlertCircle, ExternalLink, Film, Play, RotateCcw } from 'lucide-react';
import { parseVideoSource, type VideoSource } from '@/utils/video';
import { bunnyHlsUrl, bunnyHostedPlayerUrl, bunnyPosterUrl } from '@/utils/bunny';

export interface VideoPlayerHandle {
  play: () => Promise<void>;
  pause: () => void;
  reset: () => void;
  setMuted: (muted: boolean) => void;
}

interface VideoPlayerProps {
  /** a post's `video` field, which may be absent on a partially saved post */
  url?: string | null;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  title?: string;
  /**
   * Fill the parent box and crop to it instead of fitting a 16:9 letterbox.
   * The vertical reels feed needs edge-to-edge video; feed cards do not.
   */
  fill?: boolean;
  onPlay?: () => void;
  onError?: () => void;
  onAutoPlayBlocked?: () => void;
  onMutedChange?: (muted: boolean) => void;
}

type LinkPreview = {
  resolvedUrl: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
  provider: 'youtube' | 'facebook' | 'external';
  embeddable: boolean;
};

type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLIFrameElement, options: {
        events: {
          onReady: () => void;
          onError: () => void;
          onAutoplayBlocked?: () => void;
          onStateChange?: (event: { data: number }) => void;
        };
      }) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeApiPromise: Promise<void> | null = null;

function buildEmbedUrl(raw: string | undefined | null): URL | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function stopIframePlayback(iframe: HTMLIFrameElement | null): void {
  const source = iframe?.getAttribute('src');
  if (!iframe || !source) return;
  iframe.setAttribute('src', 'about:blank');
  iframe.setAttribute('src', source);
}

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (youTubeApiPromise) return youTubeApiPromise;

  youTubeApiPromise = new Promise((resolve, reject) => {
    const existingCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existingCallback?.();
      resolve();
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      existingScript.addEventListener('error', () => reject(new Error('YouTube player API failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.addEventListener('error', () => reject(new Error('YouTube player API failed to load')), { once: true });
    document.head.appendChild(script);
  });
  return youTubeApiPromise;
}

function fallbackLabel(provider: LinkPreview['provider'] | 'vimeo'): string {
  if (provider === 'facebook') return 'Watch video on Facebook';
  if (provider === 'youtube') return 'Watch video on YouTube';
  if (provider === 'vimeo') return 'Watch video on Vimeo';
  return 'Open link';
}

function LinkPreviewCard({
  url,
  preview,
  provider,
  className,
}: {
  url: string;
  preview: LinkPreview | null;
  provider: LinkPreview['provider'] | 'vimeo';
  className: string;
}) {
  const hostname = useMemo(() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }, [url]);
  const label = fallbackLabel(provider);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={`group relative flex min-h-52 flex-col justify-end overflow-hidden rounded-lg bg-ink-950 text-left ${className}`}
      aria-label={label}
    >
      {preview?.image ? (
        <img
          src={preview.image}
          alt=""
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
          {preview?.siteName || hostname || 'External video'}
        </div>
        <h3 className="line-clamp-2 text-base font-semibold text-white sm:text-lg">
          {preview?.title || 'This video is available on the original site'}
        </h3>
        {preview?.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/70">{preview.description}</p>}
        <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold-400 px-3.5 py-2 text-xs font-bold text-ink-950 transition group-hover:bg-gold-300">
          {label} <ExternalLink size={14} aria-hidden="true" />
        </span>
      </div>
    </a>
  );
}

function VideoUnavailable({ className, onRetry }: { className: string; onRetry?: () => void }) {
  return (
    <div className={`relative grid min-h-52 place-items-center overflow-hidden rounded-lg bg-black px-6 text-center ${className}`} role="alert">
      <div>
        <AlertCircle size={30} className="mx-auto text-red-300" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-white">Video playback unavailable</p>
        <p className="mt-1 text-xs text-white/60">Keep scrolling to watch the next reel or try retrying.</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold-400 px-3 py-1.5 text-xs font-bold text-ink-950 hover:bg-gold-300 transition"
          >
            <RotateCcw size={14} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}

const ExternalVideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps & { source: Extract<VideoSource, { kind: 'embed' | 'iframe' }> }>(function ExternalVideoPlayer({
  source,
  className = '',
  controls = true,
  autoPlay = false,
  loop = false,
  muted = false,
  title = 'Video',
  fill = false,
  onPlay,
  onError,
  onAutoPlayBlocked,
}, ref) {
  const initialProvider = source.kind === 'embed' ? source.provider : 'external';

  // Every provider we recognise has an official embed — a YouTube or Vimeo
  // iframe, or Facebook's `plugins/video.php` player — so a recognised link is
  // framed straight from the parsed URL. Only an unknown link needs
  // `/api/link-preview`, to find out whether it resolves to something
  // embeddable and to build a link card when it does not. YouTube and Facebook
  // both used to wait on that call and treat any error from it as "not
  // embeddable", so a slow, rate-limited or Facebook-blocked metadata request
  // silently downgraded a perfectly playable video to a black link card reading
  // "this video is available on the original site".
  const needsPreview = source.kind === 'iframe';

  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(needsPreview);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const youTubePlayerRef = useRef<YouTubePlayer | null>(null);

  // Only an unknown link is re-parsed against where the preview says it actually
  // resolves to (a shortener can land on a real video page). A recognised embed
  // is re-parsed from its own URL, which is deterministic, so the iframe's `src`
  // never changes mid-playback.
  const previewUrl = source.kind === 'iframe' ? preview?.resolvedUrl : undefined;
  const resolvedSource = useMemo(
    () => parseVideoSource(previewUrl || source.originalUrl),
    [previewUrl, source.originalUrl],
  );
  const provider = resolvedSource.kind === 'embed' ? resolvedSource.provider : initialProvider;
  const externalUrl = preview?.resolvedUrl || source.originalUrl;

  useEffect(() => {
    setPreview(null);
    setFailed(false);
    setLoading(needsPreview);
    if (!needsPreview) return;

    const controller = new AbortController();
    fetch(`/api/link-preview?url=${encodeURIComponent(source.originalUrl)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Preview unavailable');
        return response.json() as Promise<LinkPreview>;
      })
      .then((metadata) => setPreview(metadata))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [needsPreview, source.originalUrl]);

  // An embed URL from a provider we recognise is playable on its own terms; the
  // provider's player reports its own problems inside the frame, and `failed`
  // below still falls back to a link card.
  const canEmbed = resolvedSource.kind === 'embed' && Boolean(resolvedSource.embedUrl);

  useEffect(() => {
    if (!canEmbed || resolvedSource.kind !== 'embed' || resolvedSource.provider !== 'youtube' || !iframeRef.current) return;
    let disposed = false;

    void loadYouTubeApi()
      .then(() => {
        if (disposed || !iframeRef.current || !window.YT?.Player) return;
        youTubePlayerRef.current = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              if (muted) youTubePlayerRef.current?.mute();
              if (autoPlay) youTubePlayerRef.current?.playVideo();
            },
            onError: () => {
              setFailed(true);
              onError?.();
            },
            onAutoplayBlocked: onAutoPlayBlocked,
            onStateChange: (event) => {
              if (event.data === 1) onPlay?.();
            },
          },
        });
      })
      .catch(() => {
        setFailed(true);
        onError?.();
      });

    return () => {
      disposed = true;
      youTubePlayerRef.current?.destroy();
      youTubePlayerRef.current = null;
    };
  }, [autoPlay, canEmbed, muted, onAutoPlayBlocked, onError, onPlay, resolvedSource]);

  useEffect(() => {
    const player = youTubePlayerRef.current;
    if (!player) return;
    if (muted) player.mute();
    else player.unMute();
    if (autoPlay) player.playVideo();
    else player.pauseVideo();
  }, [autoPlay, muted]);

  useImperativeHandle(ref, () => ({
    play: async () => youTubePlayerRef.current?.playVideo(),
    pause: () => {
      if (youTubePlayerRef.current) {
        youTubePlayerRef.current.pauseVideo();
        return;
      }
      stopIframePlayback(iframeRef.current);
    },
    reset: () => {
      if (youTubePlayerRef.current) {
        youTubePlayerRef.current.pauseVideo();
        youTubePlayerRef.current.seekTo(0, false);
        return;
      }
      stopIframePlayback(iframeRef.current);
    },
    setMuted: (nextMuted) => nextMuted ? youTubePlayerRef.current?.mute() : youTubePlayerRef.current?.unMute(),
  }));

  if (loading) {
    return (
      <div className={`grid min-h-52 place-items-center overflow-hidden rounded-lg bg-ink-950 ${className}`} aria-label="Loading video preview">
        <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-gold-300" />
          Loading video preview
        </div>
      </div>
    );
  }

  if (failed || !canEmbed || resolvedSource.kind !== 'embed') {
    return <LinkPreviewCard url={externalUrl} preview={preview} provider={provider} className={className} />;
  }

  const embedUrl = buildEmbedUrl(resolvedSource.embedUrl);
  if (!embedUrl) {
    return <LinkPreviewCard url={externalUrl} preview={preview} provider={provider} className={className} />;
  }
  if (resolvedSource.provider === 'youtube') {
    embedUrl.searchParams.set('controls', controls ? '1' : '0');
    embedUrl.searchParams.set('autoplay', autoPlay ? '1' : '0');
    embedUrl.searchParams.set('mute', muted ? '1' : '0');
    if (loop) embedUrl.searchParams.set('loop', '1');
    if (loop) embedUrl.searchParams.set('playlist', resolvedSource.videoId);
  }

  return (
    <div className={`relative overflow-hidden bg-black ${fill ? 'h-full w-full' : 'aspect-video w-full rounded-xl'} ${className}`}>
      <iframe
        ref={iframeRef}
        src={embedUrl.toString()}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        onError={() => {
          setFailed(true);
          onError?.();
        }}
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
});

const HostedVideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps & { source: Exclude<VideoSource, { kind: 'embed' | 'iframe' }> }>(function HostedVideoPlayer({
  source,
  url,
  className = '',
  controls = true,
  autoPlay = false,
  loop = false,
  muted = false,
  title = 'Video',
  fill = false,
  onPlay,
  onError,
  onAutoPlayBlocked,
  onMutedChange,
}, ref) {
  const muxPlayerRef = useRef<MuxPlayerRefAttributes | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const hostedIframeRef = useRef<HTMLIFrameElement | null>(null);
  const onErrorRef = useRef(onError);
  const retryCount = useRef(0);

  const getPlayer = () => muxPlayerRef.current ?? nativeVideoRef.current;

  const src = ((source.kind === 'direct' ? source.url : url) ?? '').split('#')[0].trim();
  const hlsUrl = source.kind === 'direct' ? bunnyHlsUrl(src) : null;

  const [failedDirectSrc, setFailedDirectSrc] = useState<string | null>(null);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const hostedFallbackUrl = failedDirectSrc === src ? bunnyHostedPlayerUrl(src) : null;

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    setFailedDirectSrc(null);
    setPlaybackFailed(false);
    retryCount.current = 0;
  }, [src]);

  const handleRetry = useCallback(() => {
    setPlaybackFailed(false);
    setFailedDirectSrc(null);
    retryCount.current = 0;
    const player = nativeVideoRef.current;
    if (player) {
      player.load();
      void player.play().catch(() => undefined);
    }
  }, []);

  const reportFinalError = useCallback(() => {
    setPlaybackFailed(true);
    onErrorRef.current?.();
  }, []);

  useEffect(() => {
    const player = nativeVideoRef.current;
    if (!player || !hlsUrl || failedDirectSrc === src) return;

    let disposed = false;
    let hlsInstance: Hls | null = null;

    const handleStreamFailure = () => {
      if (disposed) return;
      if (bunnyHostedPlayerUrl(src)) {
        setFailedDirectSrc(src);
      } else {
        reportFinalError();
      }
    };

    if (player.canPlayType('application/vnd.apple.mpegurl')) {
      player.src = hlsUrl;
      player.load();
    } else {
      void import('hls.js')
        .then(({ default: HlsPlayer }) => {
          if (disposed) return;
          if (!HlsPlayer.isSupported()) {
            handleStreamFailure();
            return;
          }

          hlsInstance = new HlsPlayer({
            enableWorker: true,
            backBufferLength: 30,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            manifestLoadingMaxRetry: 4,
            levelLoadingMaxRetry: 4,
            fragLoadingMaxRetry: 6,
          });

          hlsInstance.on(HlsPlayer.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case HlsPlayer.ErrorTypes.NETWORK_ERROR:
                  hlsInstance?.startLoad();
                  break;
                case HlsPlayer.ErrorTypes.MEDIA_ERROR:
                  hlsInstance?.recoverMediaError();
                  break;
                default:
                  handleStreamFailure();
                  break;
              }
            }
          });

          hlsInstance.loadSource(hlsUrl);
          hlsInstance.attachMedia(player);
        })
        .catch(handleStreamFailure);
    }

    return () => {
      disposed = true;
      hlsInstance?.destroy();
      player.pause();
      player.removeAttribute('src');
      player.load();
    };
  }, [failedDirectSrc, hlsUrl, reportFinalError, src]);

  useEffect(() => () => {
    muxPlayerRef.current?.pause();

    const nativeVideo = nativeVideoRef.current;
    if (nativeVideo) {
      nativeVideo.pause();
      nativeVideo.removeAttribute('src');
      nativeVideo.load();
    }

    const hostedIframe = hostedIframeRef.current;
    if (hostedIframe) hostedIframe.src = 'about:blank';
  }, []);

  useImperativeHandle(ref, () => ({
    play: async () => getPlayer()?.play(),
    pause: () => {
      const player = getPlayer();
      if (player) {
        player.pause();
        return;
      }
      stopIframePlayback(hostedIframeRef.current);
    },
    reset: () => {
      const player = getPlayer();
      if (player) {
        player.pause();
        try {
          player.currentTime = 0;
        } catch {
          // Some hosted media elements reject seeking until metadata is ready.
        }
        return;
      }
      stopIframePlayback(hostedIframeRef.current);
    },
    setMuted: (nextMuted) => {
      const player = getPlayer();
      if (player) player.muted = nextMuted;
    },
  }));

  useEffect(() => {
    const player = getPlayer();
    if (!player) return;
    player.muted = muted;
  }, [muted, source.kind]);

  useEffect(() => {
    const player = getPlayer();
    if (!player) return;
    if (!autoPlay) {
      player.pause();
      return;
    }
    player.muted = muted;
    void player.play().catch(() => {
      if (player.muted) return;
      player.muted = true;
      onAutoPlayBlocked?.();
      void player.play().catch(() => undefined);
    });
  }, [autoPlay, muted, onAutoPlayBlocked, source.kind]);

  if (playbackFailed) return <VideoUnavailable className={className} onRetry={handleRetry} />;

  if (source.kind === 'mux') {
    return (
      <MuxPlayer
        ref={muxPlayerRef}
        playbackId={source.playbackId}
        streamType="on-demand"
        playsInline
        autoPlay={false}
        preload="none"
        loop={loop}
        muted={muted}
        onPlay={onPlay}
        onError={() => {
          if (retryCount.current < 2) {
            retryCount.current += 1;
            return;
          }
          reportFinalError();
        }}
        onVolumeChange={() => onMutedChange?.(muxPlayerRef.current?.muted ?? muted)}
        style={{
          '--controls': controls ? undefined : 'none',
          ...(fill ? { '--media-object-fit': 'cover' } : {}),
        }}
        className={fill ? `h-full w-full ${className}` : `w-full aspect-video rounded-lg ${className}`}
      />
    );
  }

  const embedUrl = source.kind === 'hosted-iframe' ? source.embedUrl : hostedFallbackUrl;
  if (embedUrl) {
    let playerUrl = embedUrl;
    try {
      const parsedUrl = new URL(embedUrl);
      parsedUrl.searchParams.set('autoplay', autoPlay ? 'true' : 'false');
      parsedUrl.searchParams.set('muted', muted ? 'true' : 'false');
      parsedUrl.searchParams.set('loop', loop ? 'true' : 'false');
      parsedUrl.searchParams.set('preload', 'false');
      playerUrl = parsedUrl.toString();
    } catch {
      // Safe fallback
    }
    return (
      <div className={`relative overflow-hidden bg-black ${fill ? 'h-full w-full' : 'aspect-video w-full rounded-xl'} ${className}`}>
        <iframe
          ref={hostedIframeRef}
          src={playerUrl}
          title={title}
          loading="lazy"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onError={reportFinalError}
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  if (!src) return <div className={className} aria-hidden="true" />;
  const poster = bunnyPosterUrl(src) ?? undefined;

  return (
    <video
      ref={nativeVideoRef}
      src={hlsUrl ? undefined : `${src}#t=0.1`}
      poster={poster}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline
      {...({ 'webkit-playsinline': 'true' } as Record<string, string>)}
      preload="none"
      style={fill ? { width: '100%', height: '100%', objectFit: 'cover' } : { width: '100%', objectFit: 'contain', aspectRatio: '16 / 9' }}
      onPlay={onPlay}
      onCanPlay={(event) => {
        if (!autoPlay || !event.currentTarget.paused) return;
        void event.currentTarget.play().catch(() => undefined);
      }}
      onVolumeChange={(event) => onMutedChange?.(event.currentTarget.muted)}
      onError={(event) => {
        const mediaError = event.currentTarget.error;
        console.error('Video playback failed', { url: src, code: mediaError?.code, message: mediaError?.message });
        if (bunnyHostedPlayerUrl(src) && failedDirectSrc !== src) {
          setFailedDirectSrc(src);
        } else {
          reportFinalError();
        }
      }}
      className={`bg-black ${fill ? '' : 'rounded-lg'} ${className}`}
    />
  );
});

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(props, ref) {
  const source = parseVideoSource(props.url);
  if (source.kind === 'embed' || source.kind === 'iframe') {
    return <ExternalVideoPlayer ref={ref} {...props} source={source} />;
  }
  // A stored value that is not a usable URL has nothing to play. Handing it to a
  // <video> element renders a black player with a broken timeline, so say so
  // instead — or render nothing at all when the field is simply empty.
  if (source.kind === 'invalid') {
    return source.originalUrl
      ? <VideoUnavailable className={props.className ?? ''} />
      : <div className={props.className} aria-hidden="true" />;
  }
  return <HostedVideoPlayer ref={ref} {...props} source={source} />;
});