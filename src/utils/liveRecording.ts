import { MAX_VIDEO_SIZE_BYTES } from './media';

// Records a live broadcast in the browser so it can be uploaded to Bunny Stream
// and saved to the feed once the host ends the stream.
//
// The recording is a WebM (or MP4, where that is the only supported container)
// file assembled from the chunks `MediaRecorder` emits while broadcasting. Bunny
// accepts both containers, and Bunny Stream transcodes on its side.

const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  // Safari records MP4 only.
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
];

/** How often `MediaRecorder` hands us a chunk. Small enough that ending the
 * broadcast never waits long for the final slice. */
const CHUNK_INTERVAL_MS = 2000;

// Deliberately modest bitrates: the saved copy has to fit under the 50MB upload
// ceiling, and a broadcast lasting more than a few minutes would blow past it at
// the browser defaults.
const VIDEO_BITS_PER_SECOND = 1_200_000;
const AUDIO_BITS_PER_SECOND = 96_000;

export interface LiveRecording {
  file: File;
  /** True when the size ceiling cut the recording short before the host ended it. */
  truncated: boolean;
  durationMs: number;
}

export function isLiveRecordingSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
}

/** The best container this browser can record, or undefined when it cannot record at all. */
export function pickRecordingMimeType(): string | undefined {
  if (!isLiveRecordingSupported()) return undefined;
  return PREFERRED_MIME_TYPES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

function recordingFileName(title: string, extension: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'live-broadcast'}.${extension}`;
}

/**
 * Collects the chunks of one broadcast. Create it when the stream starts, call
 * `finish()` when the host ends the broadcast to get the assembled file.
 */
export class LiveBroadcastRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private bytes = 0;
  private truncated = false;
  private container = 'video/webm';
  private startedAt = 0;
  private stoppedAt = 0;

  /** True once recording has begun and the chunks are still being collected. */
  get active(): boolean {
    return this.recorder !== null && this.recorder.state !== 'inactive';
  }

  /** True when at least one chunk has been captured. */
  get hasData(): boolean {
    return this.chunks.length > 0;
  }

  /** Begin recording `stream`. Returns false when the browser cannot record it. */
  start(stream: MediaStream): boolean {
    if (this.recorder) return true;
    const mimeType = pickRecordingMimeType();
    if (!mimeType) return false;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
    } catch (error) {
      console.error('This broadcast could not be recorded', error);
      return false;
    }

    this.recorder = recorder;
    this.container = mimeType.split(';')[0].trim().toLowerCase();
    this.chunks = [];
    this.bytes = 0;
    this.truncated = false;
    this.startedAt = Date.now();
    this.stoppedAt = 0;

    recorder.ondataavailable = (event) => {
      if (!event.data || event.data.size === 0) return;
      // Stop collecting once the saved copy would exceed what can be uploaded.
      // The broadcast itself keeps running — only the recording is cut short.
      if (this.bytes + event.data.size > MAX_VIDEO_SIZE_BYTES) {
        this.truncated = true;
        this.stoppedAt = this.stoppedAt || Date.now();
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      this.chunks.push(event.data);
      this.bytes += event.data.size;
    };
    recorder.onerror = (event) => console.error('Broadcast recording errored', event);

    try {
      recorder.start(CHUNK_INTERVAL_MS);
    } catch (error) {
      console.error('This broadcast could not be recorded', error);
      this.recorder = null;
      return false;
    }
    return true;
  }

  /**
   * Stop recording and assemble the captured chunks into an uploadable file.
   * Resolves with null when nothing was captured.
   */
  async finish(title: string): Promise<LiveRecording | null> {
    const recorder = this.recorder;
    this.recorder = null;

    if (recorder && recorder.state !== 'inactive') {
      // `stop()` emits one last chunk before `onstop`, so waiting for it is what
      // guarantees the tail of the broadcast makes it into the file.
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        try {
          recorder.stop();
        } catch (error) {
          console.error('Could not stop the broadcast recording cleanly', error);
          resolve();
        }
      });
      this.stoppedAt = Date.now();
    }

    const chunks = this.chunks;
    this.chunks = [];
    if (chunks.length === 0) return null;

    const extension = this.container === 'video/mp4' ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: this.container });
    return {
      file: new File([blob], recordingFileName(title, extension), { type: this.container }),
      truncated: this.truncated,
      durationMs: Math.max(0, (this.stoppedAt || Date.now()) - this.startedAt),
    };
  }

  /** Abandon the recording without producing a file. */
  cancel(): void {
    const recorder = this.recorder;
    this.recorder = null;
    this.chunks = [];
    this.bytes = 0;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      try {
        recorder.stop();
      } catch (error) {
        console.error('Could not cancel the broadcast recording', error);
      }
    }
  }
}
