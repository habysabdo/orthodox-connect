import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

function formatDuration(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export function ChatAudioPlayer({ src, duration = 0 }: { src: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [knownDuration, setKnownDuration] = useState(duration);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setKnownDuration(duration);
  }, [src, duration]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  const total = knownDuration || duration;
  const progress = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;

  return (
    <div className="flex min-w-52 items-center gap-3 rounded-xl bg-black/10 px-3 py-2">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) setKnownDuration(event.currentTarget.duration);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-current/10 transition-transform hover:scale-105"
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-current/20">
          <div className="h-full rounded-full bg-current transition-[width]" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1 text-[10px] opacity-70">
          {formatDuration(currentTime)} / {formatDuration(total)}
        </div>
      </div>
    </div>
  );
}
