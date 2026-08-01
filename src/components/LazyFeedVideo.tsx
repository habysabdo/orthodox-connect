import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Play } from 'lucide-react';
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer';
import { ErrorBoundary } from './ErrorBoundary';
import { bunnyPosterUrl, bunnyPreviewUrl } from '@/utils/bunny';

const FEED_VIDEO_PLAY_EVENT = 'orthodox-connect:feed-video-play';

/**
 * The box a feed video occupies before there is anything to play in it. A poster,
 * a placeholder and the player itself all share it, so a post never reflows as it
 * moves between those states and never collapses to a zero-height black strip
 * while it waits.
 */
const FEED_VIDEO_FRAME_CLASSES = 'w-full aspect-video overflow-hidden rounded-xl bg-black';

interface LazyFeedVideoProps {
  /** a post's `video` field; an absent or empty value renders nothing */
  url?: string | null;
  className?: string;
  posterClassName?: string;
  loop?: boolean;
  title?: string;
  /** how far outside the viewport the player is allowed to mount */
  rootMargin?: string;
}

/**
 * A feed video that costs a thumbnail until it is worth more.
 *
 * Every video post used to mount a player — an iframe, a Mux element, or a
 * <video> fetching metadata — the moment the post rendered, so scrolling past
 * ten posts opened ten players and their network connections. Here the post
 * shows Bunny's preview image instead, and the real player is only created once
 * the video is scrolled into view or the member presses Play. Pressing Play also
 * starts playback, so the poster behaves like the player it replaces.
 */
export function LazyFeedVideo({
  url,
  className = '',
  posterClassName = '',
  loop = false,
  title,
  rootMargin = '0px',
}: LazyFeedVideoProps) {
  const [active, setActive] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const playerId = useId();

  // A post can carry `videoStatus: 'ready'` with no URL — an upload that failed
  // between reserving the post and storing the file. There is nothing to play, so
  // render nothing rather than a broken poster and a player pointed at ''.
  const videoUrl = (url ?? '').trim();
  const preview = previewFailed ? bunnyPosterUrl(videoUrl) : bunnyPreviewUrl(videoUrl);

  useEffect(() => {
    setActive(false);
    setAutoPlay(false);
    setPreviewFailed(false);
    setPlaybackFailed(false);
  }, [videoUrl]);

  useEffect(() => {
    if (!videoUrl) return;
    const container = containerRef.current;
    if (!container) return;
    // Without IntersectionObserver (very old browsers) there is no signal to
    // wait for, so mount the player as before.
    if (typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          return;
        }

        playerRef.current?.reset();
        setActive(false);
        setAutoPlay(false);
      },
      { rootMargin, threshold: 0.01 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [rootMargin, videoUrl]);

  useEffect(() => {
    const pauseWhenAnotherVideoPlays = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== playerId) playerRef.current?.pause();
    };
    window.addEventListener(FEED_VIDEO_PLAY_EVENT, pauseWhenAnotherVideoPlays);
    return () => window.removeEventListener(FEED_VIDEO_PLAY_EVENT, pauseWhenAnotherVideoPlays);
  }, [playerId]);

  const handlePlay = useCallback(() => {
    window.dispatchEvent(new CustomEvent(FEED_VIDEO_PLAY_EVENT, { detail: playerId }));
  }, [playerId]);

  if (!videoUrl) return null;

  // Callers size the frame themselves (feed cards square off the corners, the
  // admin promo list rounds them); anything that does not gets the shared 16:9 box.
  const frameClassName = `${FEED_VIDEO_FRAME_CLASSES} ${posterClassName || className}`;

  return (
    <div ref={containerRef} className="relative w-full">
      {playbackFailed ? (
        <div
          className={`relative flex flex-col items-center justify-center gap-3 px-6 text-center text-white ${frameClassName}`}
          role="alert"
        >
          {preview ? <img src={preview} alt="" className="absolute inset-0 h-full w-full object-contain opacity-30" /> : null}
          <span className="absolute inset-0 bg-black/65" />
          <AlertCircle size={30} className="relative text-red-300" aria-hidden="true" />
          <div className="relative">
            <p className="text-sm font-semibold">Video playback unavailable</p>
            <button
              type="button"
              onClick={() => {
                setPlaybackFailed(false);
                setAutoPlay(true);
                setActive(true);
              }}
              className="mt-3 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/20"
            >
              Try again
            </button>
          </div>
        </div>
      ) : active ? (
        <ErrorBoundary
          name="Feed video"
          resetKeys={[videoUrl]}
          fallback={(reset) => (
            <div className={`grid place-items-center px-6 text-center ${frameClassName}`} role="alert">
              <div>
                <AlertCircle size={30} className="mx-auto text-red-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-white">Video playback unavailable</p>
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setAutoPlay(true);
                    setActive(true);
                  }}
                  className="mt-3 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        >
          <VideoPlayer
            ref={playerRef}
            url={videoUrl}
            controls
            loop={loop}
            autoPlay={autoPlay}
            title={title}
            className={className}
            onPlay={handlePlay}
            onError={() => setPlaybackFailed(true)}
          />
        </ErrorBoundary>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAutoPlay(true);
            setActive(true);
          }}
          className={`group relative flex items-center justify-center ${frameClassName}`}
          aria-label={title ? `Play ${title}` : 'Play video'}
        >
          {preview ? (
            <img
              src={preview}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setPreviewFailed(true)}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.16),transparent_60%)]" />
          )}
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-white/25 bg-black/55 text-white shadow-lg backdrop-blur-sm transition group-hover:scale-105 group-hover:bg-black/70">
              <Play size={26} fill="currentColor" aria-hidden="true" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
