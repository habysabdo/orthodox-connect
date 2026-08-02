import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Radio, Square, X } from 'lucide-react';
import { Avatar, Modal } from './ui';
import { SimulatedCanvas } from './SimulatedCanvas';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';

export function GoLiveModal() {
  const { users, currentUserId, goLive, endLive, streams } = useStore();
  const { goLiveOpen, setGoLiveOpen, setOpenStreamId } = useUI();
  const me = users.find((u) => u.id === currentUserId);
  const [title, setTitle] = useState('');
  const [useCamera, setUseCamera] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'live' | 'denied'>('idle');
  const [streamId, setStreamId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reset on close
  useEffect(() => {
    if (!goLiveOpen) {
      cleanup();
      setTitle('');
      setUseCamera(false);
      setStatus('idle');
      setStreamId(null);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goLiveOpen]);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const start = async () => {
    if (!me) return;
    if (useCamera) {
      setStatus('requesting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('live');
      } catch {
        setStatus('denied');
        setError('Camera access was blocked. Showing a simulated broadcast instead.');
        setUseCamera(false);
        setStatus('live');
      }
    } else {
      setStatus('live');
    }
    const id = goLive(title.trim() || `${me.name} is live`);
    setStreamId(id);
  };

  const stop = () => {
    if (streamId) endLive(streamId);
    cleanup();
    setGoLiveOpen(false);
  };

  // While live, show the viewer room instead
  const liveStream = streamId ? streams.find((s) => s.id === streamId) : null;

  const close = () => {
    if (status === 'live' && streamId) {
      stop();
    } else {
      cleanup();
      setGoLiveOpen(false);
    }
  };

  return (
    <Modal open={goLiveOpen} onClose={close} size="xl" className="!bg-ink-900 !p-0 overflow-hidden">
      <div className="flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
          <div className="flex items-center gap-2">
            <Radio size={20} className="text-gold-300" />
            <span className="font-semibold text-ink-100">Go Live</span>
            {status === 'live' && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2 py-0.5 text-[11px] font-bold text-white">
                <span className="h-1.5 w-1.5 animate-live-blink rounded-full bg-white" /> LIVE BROADCAST
              </span>
            )}
          </div>
          <button onClick={close} className="rounded-full p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100">
            <X size={18} />
          </button>
        </div>

        {status === 'idle' ? (
          /* Setup screen */
          <div className="grid gap-5 p-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-400">Stream title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Evening Bible Study — Romans 8"
                className="input"
                autoFocus
              />
              <p className="mt-2 text-xs text-ink-400">Your parish and the whole community will see this in the Live Now panel.</p>

              <div className="mt-5 space-y-2">
                <button
                  onClick={() => setUseCamera(false)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    !useCamera ? 'border-gold-400/60 bg-gold-400/10' : 'border-ink-600 bg-ink-850'
                  }`}
                >
                  <Radio size={18} className={!useCamera ? 'text-gold-300' : 'text-ink-400'} />
                  <div>
                    <div className="text-sm font-semibold text-ink-100">Simulated broadcast</div>
                    <div className="text-xs text-ink-400">No camera needed — animated candle-light stream.</div>
                  </div>
                </button>
                <button
                  onClick={() => setUseCamera(true)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    useCamera ? 'border-gold-400/60 bg-gold-400/10' : 'border-ink-600 bg-ink-850'
                  }`}
                >
                  <Camera size={18} className={useCamera ? 'text-gold-300' : 'text-ink-400'} />
                  <div>
                    <div className="text-sm font-semibold text-ink-100">Use my webcam</div>
                    <div className="text-xs text-ink-400">Requires camera permission in your browser.</div>
                  </div>
                </button>
              </div>

              <button onClick={start} className="gold-btn mt-5 w-full py-3">
                <Radio size={16} /> Start broadcast
              </button>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl border border-ink-700 bg-ink-850 p-6 text-center">
              <Avatar src={me?.photo ?? ''} name={me?.name ?? ''} size={80} ring="gold" />
              <p className="mt-3 font-semibold text-ink-100">{me?.name}</p>
              <p className="text-xs text-ink-400">{me?.parish}</p>
              <p className="mt-3 text-xs text-ink-400">Preview will appear here once you go live.</p>
            </div>
          </div>
        ) : status === 'requesting' ? (
          <div className="flex h-72 flex-col items-center justify-center gap-3">
            <Loader2 size={28} className="animate-spin text-gold-300" />
            <p className="text-sm text-ink-300">Requesting camera access…</p>
          </div>
        ) : (
          /* Live broadcast view */
          <div className="grid gap-0 md:grid-cols-[1fr_300px]">
            {/* Video */}
            <div className="relative aspect-video bg-black md:aspect-auto md:min-h-[440px]">
              {useCamera ? (
                <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              ) : (
                <SimulatedCanvas className="h-full w-full" />
              )}
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[11px] font-bold text-white">
                  <span className="h-1.5 w-1.5 animate-live-blink rounded-full bg-white" /> LIVE BROADCAST
                </span>
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div>
                  <div className="text-sm font-semibold text-white drop-shadow">{liveStream?.title}</div>
                  <div className="text-xs text-white/80 drop-shadow">{me?.name}</div>
                </div>
              </div>
            </div>

            {/* Live chat */}
            <div className="flex h-72 flex-col border-t border-ink-700 md:h-auto md:border-l md:border-t-0">
              <div className="border-b border-ink-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink-400">
                Live chat
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
                {liveStream?.chat.length ? (
                  liveStream.chat.map((m) => {
                    const s = users.find((u) => u.id === m.senderId);
                    return (
                      <div key={m.id} className="mb-2 text-sm">
                        <span className="font-semibold text-gold-200">{s?.name?.split(' ')[0] ?? 'Someone'} </span>
                        <span className="text-ink-200">{m.text}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-xs text-ink-400">
                    Viewers will see your stream in the Live Now panel. Say hi!
                  </p>
                )}
              </div>
              <button onClick={stop} className="m-3 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-500">
                <Square size={14} className="fill-white" /> End broadcast
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="border-t border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-200">{error}</div>
        )}
      </div>
    </Modal>
  );
}
