import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { SimulatedCanvas } from './SimulatedCanvas';
import { VideoUnavailable } from './VideoFrame';
import { parseLiveStreamSource } from '@/utils/video';

/**
 * One broadcast, one player.
 *
 * A YouTube source renders only the responsive iframe; a direct file, HLS
 * playlist or captured WebRTC stream renders only the native `<video>`; a
 * camera broadcast with no URL keeps the animated canvas. The `<video>` element
 * is never mounted alongside the iframe, so the viewer no longer stacks two
 * players and pays to load both.
 */
export function LiveStreamPlayer({
  sourceUrl,
  title,
  className = 'h-full w-full',
}: {
  sourceUrl?: string;
  title: string;
  className?: string;
}) {
  const source = parseLiveStreamSource(sourceUrl);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeUrl = source.kind === 'native' ? source.url : null;
  const needsHls = source.kind === 'native' && source.hls;
  // A broadcast whose stream drops — the host ended it, the playlist expired, the
  // codec is refused — used to leave the element mounted on a black rectangle with
  // no explanation. `failed` swaps in the shared placeholder instead, and its
  // retry re-mounts the element so a stream that comes back can be picked up.
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
  }, [nativeUrl]);

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !nativeUrl || !needsHls) return;

    // Safari plays HLS natively; everywhere else hls.js drives the element.
    if (player.canPlayType('application/vnd.apple.mpegurl')) {
      player.src = nativeUrl;
      player.load();
      return;
    }

    let disposed = false;
    let instance: Hls | null = null;

    void import('hls.js')
      .then(({ default: HlsPlayer }) => {
        if (disposed) return;
        if (!HlsPlayer.isSupported()) {
          setFailed(true);
          return;
        }
        instance = new HlsPlayer({ enableWorker: true, lowLatencyMode: true });
        instance.on(HlsPlayer.Events.ERROR, (_event, data) => {
          if (!data.fatal || disposed) return;
          if (data.type === HlsPlayer.ErrorTypes.NETWORK_ERROR) {
            instance?.startLoad();
            return;
          }
          if (data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR) {
            instance?.recoverMediaError();
            return;
          }
          setFailed(true);
        });
        instance.loadSource(nativeUrl);
        instance.attachMedia(player);
      })
      .catch(() => setFailed(true));

    return () => {
      disposed = true;
      instance?.destroy();
    };
  }, [attempt, nativeUrl, needsHls]);

  if (source.kind === 'youtube') {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={source.embedUrl}
          title={title || 'Live broadcast'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  if (nativeUrl) {
    if (failed) {
      return (
        <VideoUnavailable
          className={className}
          description="This broadcast is not streaming right now."
          onRetry={() => {
            setFailed(false);
            setAttempt((count) => count + 1);
          }}
        />
      );
    }

    return (
      <video
        key={attempt}
        ref={videoRef}
        src={needsHls ? undefined : nativeUrl}
        autoPlay
        controls
        playsInline
        preload="metadata"
        {...({ 'webkit-playsinline': 'true' } as Record<string, string>)}
        onError={() => setFailed(true)}
        className={`bg-black object-contain ${className}`}
      />
    );
  }

  return <SimulatedCanvas className={className} />;
}
