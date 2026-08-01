import { useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import { SimulatedCanvas } from './SimulatedCanvas';
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
        if (disposed || !HlsPlayer.isSupported()) return;
        instance = new HlsPlayer({ enableWorker: true, lowLatencyMode: true });
        instance.loadSource(nativeUrl);
        instance.attachMedia(player);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      instance?.destroy();
    };
  }, [nativeUrl, needsHls]);

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
    return (
      <video
        ref={videoRef}
        src={needsHls ? undefined : nativeUrl}
        autoPlay
        controls
        playsInline
        {...({ 'webkit-playsinline': 'true' } as Record<string, string>)}
        className={`bg-black object-contain ${className}`}
      />
    );
  }

  return <SimulatedCanvas className={className} />;
}
