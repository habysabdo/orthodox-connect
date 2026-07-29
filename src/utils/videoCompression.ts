import { resolveVideoContentType, type VideoUploadProgress } from './media';

const MAX_OUTPUT_BYTES = 25 * 1024 * 1024;
const TARGET_OUTPUT_BYTES = 24 * 1024 * 1024;
const MAX_VIDEO_BITRATE = 1_500_000;
const MIN_VIDEO_BITRATE = 250_000;
const AUDIO_BITRATE = 96_000;
const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 360;
const FRAME_RATE = 30;

type CaptureCanvas = HTMLCanvasElement & { captureStream?: (frameRate?: number) => MediaStream };
type FrameVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export interface PreparedVideo {
  file: File;
  thumbnailUrl: string;
}

function abortError(): DOMException {
  return new DOMException('Video upload cancelled.', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

function safeName(name: string): string {
  return (name || 'Selected video').replace(/[\r\n]+/g, ' ').slice(0, 48);
}

export function createFallbackVideoThumbnail(name: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return '';

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#111827');
  gradient.addColorStop(1, '#064e3b');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = 'rgba(255,255,255,0.14)';
  context.beginPath();
  context.arc(canvas.width / 2, 145, 54, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f5d06f';
  context.beginPath();
  context.moveTo(canvas.width / 2 - 13, 116);
  context.lineTo(canvas.width / 2 - 13, 174);
  context.lineTo(canvas.width / 2 + 34, 145);
  context.closePath();
  context.fill();

  context.fillStyle = 'rgba(255,255,255,0.9)';
  context.font = '600 22px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(safeName(name), canvas.width / 2, 245, canvas.width - 80);
  context.fillStyle = 'rgba(255,255,255,0.6)';
  context.font = '16px system-ui, sans-serif';
  context.fillText('Preparing mobile preview…', canvas.width / 2, 280);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: 'loadedmetadata' | 'loadeddata', signal?: AbortSignal) {
  if (eventName === 'loadedmetadata' && video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  if (eventName === 'loadeddata' && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, onReady);
      video.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('This video cannot be decoded on this device. Please select an MP4 or WebM video.'));
    };
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function outputDimensions(width: number, height: number) {
  const landscape = width >= height;
  const maxWidth = landscape ? 1280 : 720;
  const maxHeight = landscape ? 720 : 1280;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(2, Math.round((width * scale) / 2) * 2),
    height: Math.max(2, Math.round((height * scale) / 2) * 2),
  };
}

function preferredRecordingType(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

function outputFileName(originalName: string, mimeType: string): string {
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const stem = (originalName || 'video').replace(/\.[^.]+$/, '') || 'video';
  return `${stem}-mobile.${extension}`;
}

function outputBitrate(duration: number): number {
  const sizeLimitedBitrate = Math.floor((TARGET_OUTPUT_BYTES * 8) / duration) - AUDIO_BITRATE;
  return Math.max(MIN_VIDEO_BITRATE, Math.min(MAX_VIDEO_BITRATE, sizeLimitedBitrate));
}

async function createAudioStream(video: HTMLVideoElement): Promise<{
  stream: MediaStream | null;
  context: AudioContext | null;
}> {
  const AudioContextConstructor = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return { stream: null, context: null };

  try {
    const context = new AudioContextConstructor();
    const source = context.createMediaElementSource(video);
    const destination = context.createMediaStreamDestination();
    source.connect(destination);
    await context.resume().catch(() => undefined);
    return { stream: destination.stream, context };
  } catch {
    return { stream: null, context: null };
  }
}

export async function compressVideoForUpload(
  sourceFile: File,
  onProgress?: VideoUploadProgress,
  signal?: AbortSignal,
  initialThumbnailUrl = createFallbackVideoThumbnail(sourceFile.name),
): Promise<PreparedVideo> {
  throwIfAborted(signal);
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot compress video uploads. Please update your browser and try again.');
  }

  const sourceUrl = URL.createObjectURL(sourceFile);
  const video = document.createElement('video') as FrameVideo;
  video.src = sourceUrl;
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;

  let thumbnailUrl = initialThumbnailUrl;
  let animationFrame = 0;
  let videoFrame = 0;
  let audioContext: AudioContext | null = null;
  let recorder: MediaRecorder | null = null;
  const stopTracks: MediaStreamTrack[] = [];

  try {
    await waitForVideoEvent(video, 'loadedmetadata', signal);
    throwIfAborted(signal);
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
      throw new Error('This video has invalid duration or dimensions. Please select a different video.');
    }
    await waitForVideoEvent(video, 'loadeddata', signal);

    const dimensions = outputDimensions(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas') as CaptureCanvas;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context || typeof canvas.captureStream !== 'function') {
      throw new Error('This browser cannot resize video uploads. Please update your browser and try again.');
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    thumbnailUrl = canvas.toDataURL('image/jpeg', 0.82) || initialThumbnailUrl;

    const canvasStream = canvas.captureStream(FRAME_RATE);
    stopTracks.push(...canvasStream.getTracks());
    const sourceStream = video.captureStream?.() ?? video.mozCaptureStream?.();
    const sourceAudioTracks = sourceStream?.getAudioTracks() ?? [];
    if (sourceAudioTracks.length > 0) {
      sourceAudioTracks.forEach((track) => canvasStream.addTrack(track));
      stopTracks.push(...sourceAudioTracks);
    } else {
      const audio = await createAudioStream(video);
      audioContext = audio.context;
      audio.stream?.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
      if (audio.stream) stopTracks.push(...audio.stream.getTracks());
    }

    const mimeType = preferredRecordingType();
    const chunks: Blob[] = [];
    recorder = new MediaRecorder(canvasStream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: outputBitrate(video.duration),
      audioBitsPerSecond: AUDIO_BITRATE,
    });

    const drawFrame = () => {
      if (signal?.aborted || video.ended || video.paused) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress?.(Math.min(99, Math.round((video.currentTime / video.duration) * 100)), 'compressing');
      if (video.requestVideoFrameCallback) videoFrame = video.requestVideoFrameCallback(drawFrame);
      else animationFrame = window.requestAnimationFrame(drawFrame);
    };

    const output = await new Promise<Blob>((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener('ended', onEnded);
        signal?.removeEventListener('abort', onAbort);
      };
      const onEnded = () => {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (recorder?.state !== 'inactive') recorder?.stop();
      };
      const onAbort = () => {
        video.pause();
        if (recorder?.state !== 'inactive') recorder?.stop();
        cleanup();
        reject(abortError());
      };

      recorder!.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder!.onerror = () => {
        cleanup();
        reject(new Error('Video compression failed on this device. Please try a shorter video.'));
      };
      recorder!.onstop = () => {
        cleanup();
        if (signal?.aborted) {
          reject(abortError());
          return;
        }
        resolve(new Blob(chunks, { type: recorder?.mimeType || mimeType || 'video/webm' }));
      };
      video.addEventListener('ended', onEnded, { once: true });
      signal?.addEventListener('abort', onAbort, { once: true });
      recorder!.start(1000);
      onProgress?.(0, 'compressing');
      void video.play().then(drawFrame).catch(() => {
        if (recorder?.state !== 'inactive') recorder?.stop();
        cleanup();
        reject(new Error('Video compression could not start. Tap the page once, then try again.'));
      });
    });

    throwIfAborted(signal);
    if (!output.size) throw new Error('Video compression produced an empty file. Please try a different video.');
    if (output.size > MAX_OUTPUT_BYTES) {
      throw new Error('This video is too long to compress under 25MB. Please trim it and try again.');
    }

    onProgress?.(100, 'compressing');
    const outputType = output.type.split(';')[0] || resolveVideoContentType(sourceFile);
    return {
      file: new File([output], outputFileName(sourceFile.name, outputType), {
        type: outputType,
        lastModified: Date.now(),
      }),
      thumbnailUrl,
    };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    if (videoFrame && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(videoFrame);
    stopTracks.forEach((track) => track.stop());
    if (recorder?.state !== 'inactive') recorder?.stop();
    if (audioContext) void audioContext.close().catch(() => undefined);
    URL.revokeObjectURL(sourceUrl);
  }
}
