import * as UpChunk from '@mux/upchunk';
import { apiFetch } from '../lib/api';
import {
  MAX_VIDEO_SIZE_BYTES,
  MAX_VIDEO_SIZE_LABEL,
  resolveVideoContentType,
  validatePostVideo,
  type VideoUploadProgress,
} from './media';

// Uploads a post video through Mux Direct Uploads and returns a Mux stream URL
// (`https://stream.mux.com/<playbackId>.m3u8`). Mux transcodes any source into
// adaptive HLS, so the resulting stream plays inline on every device — the key
// win over serving a raw file whose codec a given browser may not support.
//
// Pipeline:
//   1. Ask our function for a one-time direct-upload URL.
//   2. PUT the raw File straight to Mux (progress reported here).
//   3. Poll our asset endpoint until Mux reports a public playback id.

// How long to keep polling for the playback id before giving up. Transcoding a
// short clip usually yields a playback id within a few seconds.
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
const RESUMABLE_CHUNK_SIZE_KB = 5 * 1024;

/** Build the canonical Mux HLS stream URL saved on the post. */
export function muxStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export async function uploadPostVideoToMux(file: File, onProgress?: VideoUploadProgress): Promise<string> {
  const validationError = validatePostVideo(file);
  if (validationError) throw new Error(validationError);

  onProgress?.(1);

  // 1. Request a direct upload URL from our serverless function.
  const { uploadUrl, uploadId } = await createDirectUpload(file);

  // 2. Send the raw File directly to Mux. Larger files use fault-tolerant,
  // resumable chunks so a brief mobile network interruption does not restart
  // the entire transfer.
  const reportTransferProgress = (fraction: number) => onProgress?.(Math.round(fraction * 80));
  if (file.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    await putToMuxResumable(uploadUrl, file, reportTransferProgress);
  } else {
    await putToMux(uploadUrl, file, reportTransferProgress);
  }

  // 3. Poll for the transcoded asset's public playback id.
  const playbackId = await pollForPlaybackId(uploadId, (fraction) => onProgress?.(80 + Math.round(fraction * 20)));

  onProgress?.(100);
  return muxStreamUrl(playbackId);
}

async function createDirectUpload(file: File): Promise<{ uploadUrl: string; uploadId: string }> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const createRes = await apiFetch('/api/mux-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name || 'video',
          size: file.size,
          contentType: resolveVideoContentType(file),
        }),
      });
      if (!createRes.ok) {
        throw await responseError(createRes, 'Could not start the video upload. Please try again.');
      }
      const data = (await createRes.json()) as { uploadUrl?: string; uploadId?: string };
      if (!data.uploadUrl || !data.uploadId) {
        throw new Error('Could not start the video upload. Please try again.');
      }
      return { uploadUrl: data.uploadUrl, uploadId: data.uploadId };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Could not start the video upload. Please try again.');
      if (attempt === 0) await delay(750);
    }
  }

  throw lastError ?? new Error('Could not start the video upload. Please try again.');
}

function putToMuxResumable(uploadUrl: string, file: File, onFraction: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = UpChunk.createUpload({
      endpoint: uploadUrl,
      file,
      chunkSize: RESUMABLE_CHUNK_SIZE_KB,
      dynamicChunkSize: true,
      maxFileSize: MAX_VIDEO_SIZE_BYTES / 1024,
    });

    upload.on('progress', (event) => onFraction(event.detail / 100));
    upload.on('success', () => resolve());
    upload.on('error', (event) => {
      const detail = typeof event.detail === 'string' ? event.detail : '';
      reject(new Error(detail || 'Video upload failed. Please check your connection and try again.'));
    });
  });
}

function putToMux(uploadUrl: string, file: File, onFraction: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.timeout = 15 * 60 * 1000;
    xhr.setRequestHeader('Content-Type', resolveVideoContentType(file));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onFraction(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Video upload failed. Please select a video under ${MAX_VIDEO_SIZE_LABEL} and try again.`));
    };
    xhr.onerror = () => reject(new Error('Video upload failed. Please check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('Video upload timed out. Please check your connection and try again.'));
    xhr.send(file);
  });
}

async function pollForPlaybackId(uploadId: string, onFraction: (fraction: number) => void): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetchWithTimeout(`/api/mux-asset?uploadId=${encodeURIComponent(uploadId)}`, 10_000);
    if (res.ok) {
      const data = (await res.json()) as { status?: string; playbackId?: string | null; error?: string };
      if (data.playbackId) return data.playbackId;
      if (data.status === 'failed' || data.status === 'errored') {
        throw new Error(data.error || 'The video could not be prepared. Please try a different file.');
      }
    } else if (res.status >= 400 && res.status < 500) {
      throw await responseError(res, 'The video could not be prepared.');
    }
    // Advance the reported progress toward (but never reaching) 100% while we wait.
    onFraction(Math.min(0.9, (Date.now() - (deadline - POLL_TIMEOUT_MS)) / POLL_TIMEOUT_MS));
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error('The video was not ready before the processing timeout. Please try again.');
}

async function fetchWithTimeout(path: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch(path, { signal: controller.signal, cache: 'no-store' });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(data?.error?.trim() || fallback);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
