import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Play } from 'lucide-react';
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer';
import { ErrorBoundary } from './ErrorBoundary';
import { bunnyPosterUrl, bunnyPreviewUrl } from '@/utils/bunny';

const FEED_VIDEO_PLAY_EVENT = 'orthodox-connect:feed-video-play';

interface LazyFeedVideoProps {
  url?: string | null;
  className?: string;
  posterClassName?: string;
  loop?: boolean;
  title?: string;
  rootMargin?: string;
}

export const LazyFeedVideo = memo(function LazyFeedVideo({
  url,
  className = '',
  posterClassName = '',
  loop = false,
  title,
  rootMargin = '100px', // Increased margin so slight scrolling won't trigger disconnects
}: LazyFeedVideoProps) {
  const [active, setActive] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const userInteractedRef = useRef(false); // Track manual play
  const playerId = useId();

  const videoUrl = (url ?? '').trim();
  const preview = previewFailed ? bunnyPosterUrl(videoUrl) : bunnyPreviewUrl(videoUrl);

  useEffect(() => {
    setActive(false);
    setAutoPlay(false);
    setPreviewFailed(false);
    setPlaybackFailed(false);
    userInteractedRef.current = false;
  }, [videoUrl]);

  useEffect(() => {
    if (!videoUrl) return;
    const container = containerRef.current;
    if (!container) return;

    if (typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
        } else if (!userInteractedRef.current) {
          // Only unmount if the user HAS NOT manually started playing the video
          playerRef.current?.reset();
          setActive(false);
          setAutoPlay(false);
        } else {
          // If user clicked play, just pause it when scrolled completely away, don't destroy the player
          playerRef.current?.pause();
        }
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
    userInteractedRef.current = true;
    window.dispatchEvent(new CustomEvent(FEED_VIDEO_PLAY_EVENT, { detail: playerId }));
  }, [playerId]);

  if (!videoUrl) return null;

  return (
    <div ref={containerRef} className="relative">
      {playbackFailed ? (
        <div
          className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden bg-black px-6 text-center text-white ${posterClassName || className}`}
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
                userInteractedRef.current = true;
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
            <div className={`grid place-items-center bg-black px-6 text-center ${posterClassName || className}`} role="alert">
              <div>
                <AlertCircle size={30} className="mx-auto text-red-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-white">Video playback unavailable</p>
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setAutoPlay(true);
                    setActive(true);
                    userInteractedRef.current = true;
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
            userInteractedRef.current = true;
            setAutoPlay(true);
            setActive(true);
          }}
          className={`group relative flex w-full items-center justify-center overflow-hidden bg-black ${posterClassName || className}`}
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
});
