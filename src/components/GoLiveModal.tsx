import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, Link2, Loader2, Radio, Square, X } from 'lucide-react';
import { Avatar, Modal } from './ui';
import { SimulatedCanvas } from './SimulatedCanvas';
import { LiveStreamPlayer } from './LiveStreamPlayer';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import { LiveBroadcastRecorder, isLiveRecordingSupported, type LiveRecording } from '@/utils/liveRecording';
import { MAX_VIDEO_SIZE_LABEL } from '@/utils/media';
import { parseLiveStreamSource } from '@/utils/video';
import { uploadFeedVideo, videoUploadErrorMessage } from '@/utils/videoUpload';

type BroadcastStatus = 'idle' | 'requesting' | 'live' | 'saving' | 'saved';

/**
 * How the broadcast is produced: an animated canvas, the host's own camera, or
 * a stream that already exists somewhere else and is played from its link.
 */
type BroadcastMode = 'simulated' | 'camera' | 'link';

/** Frame rate the simulated (canvas) broadcast is recorded at. */
const SIMULATED_CAPTURE_FPS = 24;

function cameraErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return 'Camera and microphone access failed. Check your browser permissions and try again.';
  }

  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera or microphone permission was blocked. Allow access in your browser settings and try again.';
    case 'NotFoundError':
      return 'No camera or microphone was found on this device.';
    case 'NotReadableError':
      return 'Your camera or microphone is already in use by another app.';
    case 'OverconstrainedError':
      return 'This device cannot provide the requested camera or microphone settings.';
    default:
      return 'Camera and microphone access failed. Check your browser permissions and try again.';
  }
}

export function GoLiveModal() {
  const { users, currentUserId, goLive, endLive, streams, createPost } = useStore();
  const { goLiveOpen, setGoLiveOpen } = useUI();
  const me = users.find((u) => u.id === currentUserId);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<BroadcastMode>('simulated');
  /** Link a 'link' broadcast plays from — a YouTube Live URL, file, or playlist. */
  const [sourceUrl, setSourceUrl] = useState('');
  const useCamera = mode === 'camera';
  const [status, setStatus] = useState<BroadcastStatus>('idle');
  const [streamId, setStreamId] = useState<string | null>(null);
  const [error, setError] = useState('');
  /** Informational line about the recording, e.g. when it cannot be captured. */
  const [recordingNotice, setRecordingNotice] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [wasTruncated, setWasTruncated] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRequestIdRef = useRef(0);
  const recorderRef = useRef<LiveBroadcastRecorder | null>(null);
  /** Canvas capture stream backing a recorded simulated broadcast. */
  const canvasStreamRef = useRef<MediaStream | null>(null);
  /** The assembled recording, kept so a failed upload can be retried. */
  const pendingRecordingRef = useRef<File | null>(null);
  const saveRequestIdRef = useRef(0);
  /** Title the broadcast actually went live with, used for the saved post. */
  const broadcastTitleRef = useRef('');

  const cleanup = () => {
    mediaRequestIdRef.current += 1;
    recorderRef.current?.cancel();
    recorderRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach((t) => t.stop());
      canvasStreamRef.current = null;
    }
  };

  // Reset on close. A recording still uploading is deliberately left running —
  // the post lands in the feed on its own — so only the visible state is reset.
  useEffect(() => {
    if (!goLiveOpen) {
      cleanup();
      saveRequestIdRef.current += 1;
      pendingRecordingRef.current = null;
      setTitle('');
      setMode('simulated');
      setSourceUrl('');
      setStatus('idle');
      setStreamId(null);
      setError('');
      setRecordingNotice('');
      setIsRecording(false);
      setIsEnding(false);
      setSaveProgress(0);
      setSaveError('');
      setWasTruncated(false);
    }
  }, [goLiveOpen]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (status !== 'live' || !useCamera || !video || !stream) return;

    video.srcObject = stream;
    void video.play().catch(() => {
      setError('The camera connected, but the local preview could not start. Tap the video to retry playback.');
    });

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [status, useCamera]);

  /** Start collecting chunks for the broadcast that is about to go live. */
  const beginRecording = (stream: MediaStream) => {
    if (!isLiveRecordingSupported()) {
      setRecordingNotice('This browser cannot record video, so this broadcast will not be saved to your feed.');
      return;
    }
    const recorder = new LiveBroadcastRecorder();
    if (!recorder.start(stream)) {
      setRecordingNotice('This broadcast could not be recorded, so it will not be saved to your feed.');
      return;
    }
    recorderRef.current = recorder;
    setIsRecording(true);
  };

  // A simulated broadcast has no camera stream, so its recording comes from the
  // animated canvas itself once it starts drawing. There is no audio track to
  // capture in that mode.
  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    if (recorderRef.current || typeof canvas.captureStream !== 'function') return;
    let capture: MediaStream;
    try {
      capture = canvas.captureStream(SIMULATED_CAPTURE_FPS);
    } catch (captureError) {
      console.error('The simulated broadcast could not be captured', captureError);
      setRecordingNotice('This broadcast could not be recorded, so it will not be saved to your feed.');
      return;
    }
    canvasStreamRef.current = capture;
    beginRecording(capture);
    setRecordingNotice('Simulated broadcasts are saved without audio.');
  }, []);

  const start = async () => {
    if (!me) return;
    setError('');
    setRecordingNotice('');

    // A linked broadcast is validated before going live, so viewers never open a
    // stream whose URL resolves to no player at all.
    const trimmedSource = sourceUrl.trim();
    if (mode === 'link') {
      if (!trimmedSource) {
        setError('Paste the link your stream plays from, or pick another broadcast source.');
        return;
      }
      if (parseLiveStreamSource(trimmedSource).kind === 'none') {
        setError('That link cannot be played here. Use a YouTube link, an .m3u8 playlist, or a direct video file.');
        return;
      }
    }

    if (useCamera) {
      if (!window.isSecureContext) {
        setError('Camera and microphone access requires HTTPS. Open the secure site URL and try again.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support camera and microphone access. Try a current browser over HTTPS.');
        return;
      }

      const requestId = mediaRequestIdRef.current + 1;
      mediaRequestIdRef.current = requestId;
      setStatus('requesting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (mediaRequestIdRef.current !== requestId) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        beginRecording(stream);
        setStatus('live');
      } catch (permissionError) {
        if (mediaRequestIdRef.current !== requestId) return;
        setStatus('idle');
        setError(cameraErrorMessage(permissionError));
        return;
      }
    } else {
      setStatus('live');
      if (mode === 'link') {
        setRecordingNotice('Linked streams play from their own source, so nothing is recorded here.');
      }
    }
    const broadcastTitle = title.trim() || `${me.name} is live`;
    broadcastTitleRef.current = broadcastTitle;
    const id = goLive(broadcastTitle, mode === 'link' ? trimmedSource : undefined);
    setStreamId(id);
  };

  /** Upload the finished recording to Bunny Stream and post it to the feed. */
  const saveRecording = async (file: File) => {
    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    pendingRecordingRef.current = file;
    setStatus('saving');
    setSaveProgress(0);
    setSaveError('');

    try {
      const videoUrl = await uploadFeedVideo(
        file,
        (percent) => {
          if (saveRequestIdRef.current === requestId) setSaveProgress(percent);
        },
        undefined,
        // Names the recording in the Bunny Stream library after the broadcast.
        `${broadcastTitleRef.current} — recorded live broadcast`,
      );
      const post = createPost({
        text: `${broadcastTitleRef.current} — recorded live broadcast`,
        video: videoUrl,
        videoStatus: 'ready',
      });
      if (!post) {
        throw new Error('The recording was uploaded, but the post could not be created. Please sign in again.');
      }
      if (saveRequestIdRef.current !== requestId) return;
      pendingRecordingRef.current = null;
      setSaveProgress(100);
      setStatus('saved');
    } catch (uploadError) {
      if (saveRequestIdRef.current !== requestId) return;
      console.error('Saving the recorded broadcast failed', uploadError);
      setSaveError(videoUploadErrorMessage(uploadError));
    }
  };

  /** Stop broadcasting, then assemble and save whatever was recorded. */
  const endBroadcast = async () => {
    if (isEnding) return;
    setIsEnding(true);
    if (streamId) endLive(streamId);

    const recorder = recorderRef.current;
    recorderRef.current = null;
    let recording: LiveRecording | null = null;
    try {
      recording = recorder ? await recorder.finish(broadcastTitleRef.current) : null;
    } catch (recordingError) {
      console.error('The broadcast recording could not be assembled', recordingError);
    }

    cleanup();
    setIsRecording(false);
    setIsEnding(false);

    if (!recording || recording.file.size === 0) {
      setGoLiveOpen(false);
      return;
    }
    setWasTruncated(recording.truncated);
    await saveRecording(recording.file);
  };

  const retrySave = () => {
    const file = pendingRecordingRef.current;
    if (!file) {
      setGoLiveOpen(false);
      return;
    }
    void saveRecording(file);
  };

  const discardRecording = () => {
    pendingRecordingRef.current = null;
    setGoLiveOpen(false);
  };

  // While live, show the viewer room instead
  const liveStream = streamId ? streams.find((s) => s.id === streamId) : null;

  const close = () => {
    if (status === 'live') {
      void endBroadcast();
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
            {isRecording && (
              <span className="flex items-center gap-1.5 rounded-full border border-gold-400/40 bg-gold-400/10 px-2 py-0.5 text-[11px] font-bold text-gold-200">
                <span className="h-1.5 w-1.5 animate-live-blink rounded-full bg-gold-300" /> RECORDING
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
                  onClick={() => setMode('simulated')}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    mode === 'simulated' ? 'border-gold-400/60 bg-gold-400/10' : 'border-ink-600 bg-ink-850'
                  }`}
                >
                  <Radio size={18} className={mode === 'simulated' ? 'text-gold-300' : 'text-ink-400'} />
                  <div>
                    <div className="text-sm font-semibold text-ink-100">Simulated broadcast</div>
                    <div className="text-xs text-ink-400">No camera needed — animated candle-light stream.</div>
                  </div>
                </button>
                <button
                  onClick={() => setMode('camera')}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    mode === 'camera' ? 'border-gold-400/60 bg-gold-400/10' : 'border-ink-600 bg-ink-850'
                  }`}
                >
                  <Camera size={18} className={mode === 'camera' ? 'text-gold-300' : 'text-ink-400'} />
                  <div>
                    <div className="text-sm font-semibold text-ink-100">Use my camera and microphone</div>
                    <div className="text-xs text-ink-400">Requires browser permission and a secure HTTPS connection.</div>
                  </div>
                </button>
                <button
                  onClick={() => setMode('link')}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    mode === 'link' ? 'border-gold-400/60 bg-gold-400/10' : 'border-ink-600 bg-ink-850'
                  }`}
                >
                  <Link2 size={18} className={mode === 'link' ? 'text-gold-300' : 'text-ink-400'} />
                  <div>
                    <div className="text-sm font-semibold text-ink-100">Stream from a link</div>
                    <div className="text-xs text-ink-400">Relay a YouTube Live, HLS playlist, or hosted video file.</div>
                  </div>
                </button>
                {mode === 'link' && (
                  <input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://www.youtube.com/live/…"
                    inputMode="url"
                    className="input"
                  />
                )}
              </div>

              <button onClick={start} className="gold-btn mt-5 w-full py-3">
                <Radio size={16} /> Start broadcast
              </button>
              <p className="mt-2 text-center text-xs text-ink-400">
                {mode === 'link'
                  ? 'Linked streams play from their own source and are not recorded or saved to your feed.'
                  : 'Your broadcast is recorded and saved to your feed automatically when you end it.'}
              </p>
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
            <p className="text-sm text-ink-300">Requesting camera and microphone access…</p>
          </div>
        ) : status === 'saving' ? (
          /* Uploading the recording to Bunny Stream and posting it to the feed */
          <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            {saveError ? (
              <>
                <AlertCircle size={30} className="text-red-300" />
                <p className="font-semibold text-ink-100">The recording could not be saved</p>
                <p className="max-w-md text-sm text-red-200">{saveError}</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <button onClick={discardRecording} className="ghost-btn py-2 text-xs">Discard recording</button>
                  <button onClick={retrySave} className="gold-btn py-2 text-xs">Retry</button>
                </div>
              </>
            ) : (
              <>
                <Loader2 size={30} className="animate-spin text-gold-300" />
                <p className="font-semibold text-ink-100">Saving your broadcast</p>
                <p className="text-sm text-ink-400">Uploading the recording and adding it to your feed…</p>
                <div className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-ink-800">
                  <div className="h-full rounded-full bg-gold-400 transition-[width]" style={{ width: `${saveProgress}%` }} />
                </div>
                <p className="text-xs text-ink-400">Uploading: {saveProgress}%</p>
              </>
            )}
          </div>
        ) : status === 'saved' ? (
          <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <CheckCircle2 size={32} className="text-gold-300" />
            <p className="font-semibold text-ink-100">Broadcast saved to your feed</p>
            <p className="max-w-md text-sm text-ink-400">
              The recording is posted for your community. It becomes playable as soon as processing finishes.
            </p>
            {wasTruncated && (
              <p className="max-w-md text-xs text-amber-200">
                The broadcast ran longer than a single upload allows, so the saved copy stops at {MAX_VIDEO_SIZE_LABEL}.
              </p>
            )}
            <button onClick={() => setGoLiveOpen(false)} className="gold-btn mt-2 py-2 text-xs">Done</button>
          </div>
        ) : (
          /* Live broadcast view */
          <div className="grid gap-0 md:grid-cols-[1fr_300px]">
            {/* Video — the camera preview, the animated canvas, or the linked
                stream's own player. Never more than one of them. */}
            <div className="relative aspect-video bg-black md:aspect-auto md:min-h-[440px]">
              {useCamera ? (
                <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-cover" />
              ) : mode === 'link' ? (
                <LiveStreamPlayer sourceUrl={sourceUrl.trim()} title={liveStream?.title ?? ''} />
              ) : (
                <SimulatedCanvas className="h-full w-full" onCanvasReady={handleCanvasReady} />
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
              <p className="px-4 pb-1 text-[11px] leading-relaxed text-ink-400">
                {isRecording
                  ? 'Recording — this broadcast is saved to your feed when you end it.'
                  : recordingNotice || 'This broadcast is not being recorded.'}
              </p>
              <button
                onClick={() => void endBroadcast()}
                disabled={isEnding}
                className="m-3 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEnding ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} className="fill-white" />}
                {isEnding ? 'Ending broadcast…' : 'End broadcast'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="border-t border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-200">{error}</div>
        )}
        {status === 'live' && recordingNotice && isRecording && (
          <div className="border-t border-ink-700 px-5 py-2 text-xs text-ink-400">{recordingNotice}</div>
        )}
      </div>
    </Modal>
  );
}
