import { DefaultHttpStack, Upload, type HttpRequest, type HttpResponse, type HttpStack } from 'tus-js-client';
import { identityAuthorizationHeaders } from '../lib/auth';
import { apiUrl } from '../lib/config';
import { rememberBunnyLibraryId } from './bunny';
import {
  MAX_VIDEO_SIZE_LABEL,
  resolveVideoContentType,
  validatePostVideoSource,
  videoTitleFrom,
  type VideoUploadProgress,
} from './media';

const BUNNY_TUS_UPLOAD_URL = 'https://video.bunnycdn.com/tusupload';
const BUNNY_CDN_HOSTNAME = 'vz-840ad26e-6fe.b-cdn.net';
const BINARY_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const CHUNK_SIZE_BYTES = 1024 * 1024;
const RETRY_DELAYS_MS = [0, 3000, 5000, 10000];
const UPLOAD_PROGRESS_CEILING = 99;
const REQUEST_TIMEOUT_MS = 300_000;
const AUTHORIZATION_TIMEOUT_MS = REQUEST_TIMEOUT_MS;
const TUS_STALL_TIMEOUT_MS = REQUEST_TIMEOUT_MS;
export const VIDEO_UPLOAD_FAILED_MESSAGE = 'Upload failed, please tap Retry';
const VIDEO_UPLOAD_NETWORK_ERROR_MESSAGE = 'Upload failed. Check your connection, then tap Retry.';
const MOBILE_METHOD_OVERRIDE = { overridePatchMethod: true };

class TimedHttpRequest implements HttpRequest {
  constructor(private readonly request: HttpRequest) {}
  getMethod() { return this.request.getMethod(); }
  getURL() { return this.request.getURL(); }
  setHeader(header: string, value: string) { this.request.setHeader(header, value); }
  getHeader(header: string) { return this.request.getHeader(header); }
  setProgressHandler(handler: (bytesSent: number) => void) { this.request.setProgressHandler(handler); }
  getUnderlyingObject() { return this.request.getUnderlyingObject(); }
  abort() { return this.request.abort(); }
  send(body: unknown): Promise<HttpResponse> {
    const xhr = this.request.getUnderlyingObject() as XMLHttpRequest;
    xhr.timeout = REQUEST_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      const onTimeout = () => {
        void this.request.abort();
        reject(new Error('Network timeout: Bunny Stream did not accept the upload chunk.'));
      };
      xhr.addEventListener('timeout', onTimeout, { once: true });
      this.request.send(body).then(resolve, reject).finally(() => xhr.removeEventListener('timeout', onTimeout));
    });
  }
}

class TimedHttpStack implements HttpStack {
  private readonly stack = new DefaultHttpStack({});
  createRequest(method: string, url: string): HttpRequest {
    return new TimedHttpRequest(this.stack.createRequest(method, url));
  }
  getName() { return 'TimedXHRHttpStack'; }
}

interface DirectUploadAuthorization {
  videoId: string;
  libraryId: string;
  signature: string;
  expirationTime: number;
  playUrl: string;
  /** The title the video was created under, as the server recorded it. */
  title: string;
}

interface AuthorizationResponse {
  videoId?: string;
  libraryId?: string;
  signature?: string;
  expirationTime?: number;
  authorizationSignature?: string;
  authorizationExpire?: number;
  title?: string;
  error?: string;
}

interface BinaryUploadResponse {
  ok?: boolean;
  alreadyUploaded?: boolean;
  error?: string;
  bunnyMessage?: string;
}

class UploadHttpError extends Error {
  constructor(readonly status: number, message: string, readonly responseBody = '') {
    super(message);
    this.name = 'UploadHttpError';
  }
}

function abortError(): DOMException {
  return new DOMException('Video upload cancelled.', 'AbortError');
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timeout = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function authorizationErrorMessage(status: number, serverMessage?: string): string {
  if (serverMessage) return `Error ${status}: ${serverMessage}`;
  if (status === 413) return `Error 413: Video file is too large (Max ${MAX_VIDEO_SIZE_LABEL})`;
  if (status === 401) return 'Error 401: Authorization required. Please sign in again.';
  if (status === 403) return 'Error 403: This account cannot upload videos.';
  if (status === 503) return 'Error 503: Video upload configuration is incomplete. Please contact support.';
  return `Error ${status}: Video upload did not start.`;
}

export function videoUploadErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return VIDEO_UPLOAD_FAILED_MESSAGE;
}

function tusErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const statusMatch = message.match(/(?:response (?:code|status)|status(?: code)?)[^0-9]*(\d{3})/i);
  if (statusMatch) return `Error ${statusMatch[1]}: Bunny Stream rejected the video upload.`;
  if (
    (typeof ProgressEvent !== 'undefined' && error instanceof ProgressEvent) ||
    /\[object ProgressEvent\]|response code:\s*n\/a|cors|network|failed to fetch|load failed|connection/i.test(message)
  ) {
    return VIDEO_UPLOAD_NETWORK_ERROR_MESSAGE;
  }
  return message ? `Video upload connection failed: ${message}` : VIDEO_UPLOAD_FAILED_MESSAGE;
}

async function requestAuthorization(file: File, title: string, signal?: AbortSignal): Promise<DirectUploadAuthorization> {
  const endpoint = apiUrl('/api/get-bunny-upload-url');
  if (signal?.aborted) throw abortError();
  const requestBody = JSON.stringify({
    fileName: file.name,
    fileSize: file.size,
    fileType: resolveVideoContentType(file),
    title,
  });

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const requestController = new AbortController();
    let timedOut = false;
    const abortRequest = () => requestController.abort();
    const timeout = window.setTimeout(() => {
      timedOut = true;
      requestController.abort();
    }, AUTHORIZATION_TIMEOUT_MS);
    signal?.addEventListener('abort', abortRequest, { once: true });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', ...identityAuthorizationHeaders() },
        body: requestBody,
        signal: requestController.signal,
      });
      const rawBody = await response.text().catch(() => '');
      let payload: AuthorizationResponse | null = null;
      try {
        payload = rawBody ? (JSON.parse(rawBody) as AuthorizationResponse) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        if (retryable && attempt < RETRY_DELAYS_MS.length) {
          await waitForRetry(RETRY_DELAYS_MS[attempt], signal);
          continue;
        }
        throw new UploadHttpError(
          response.status,
          authorizationErrorMessage(response.status, payload?.error),
          rawBody.slice(0, 500),
        );
      }

      const signature = payload?.authorizationSignature ?? payload?.signature;
      const expirationTime = payload?.authorizationExpire ?? payload?.expirationTime;
      if (!payload?.videoId || !payload.libraryId || !signature || !Number.isSafeInteger(expirationTime)) {
        throw new Error('Video upload authorization was incomplete. Please try again.');
      }

      rememberBunnyLibraryId(payload.libraryId);
      return {
        videoId: payload.videoId,
        libraryId: payload.libraryId,
        signature,
        expirationTime: expirationTime as number,
        playUrl: `https://${BUNNY_CDN_HOSTNAME}/${payload.videoId}/play_480p.mp4`,
        title: videoTitleFrom(payload.title, title),
      };
    } catch (error) {
      if (signal?.aborted) throw abortError();
      if (error instanceof UploadHttpError) throw error;
      if (attempt < RETRY_DELAYS_MS.length) {
        console.warn('[video-upload] Retrying upload authorization', { attempt: attempt + 1, timedOut });
        await waitForRetry(RETRY_DELAYS_MS[attempt], signal);
        continue;
      }
      console.error('[video-upload] Upload authorization request failed', error);
      throw new Error(
        timedOut
          ? 'Network timeout: upload authorization did not respond.'
          : 'Network CORS blocked: upload authorization could not be reached.',
      );
    } finally {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abortRequest);
    }
  }

  throw new Error(VIDEO_UPLOAD_FAILED_MESSAGE);
}

async function discardVideo(videoId: string): Promise<void> {
  try {
    await fetch(`${apiUrl('/api/bunny-video')}?videoId=${encodeURIComponent(videoId)}`, {
      method: 'POST',
      credentials: 'omit',
      headers: identityAuthorizationHeaders(),
    });
  } catch {
    // Keep the original upload error as the actionable failure.
  }
}

async function uploadWithFetch(
  authorization: DirectUploadAuthorization,
  videoData: ArrayBuffer,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${apiUrl('/api/bunny-upload-binary')}?videoId=${encodeURIComponent(authorization.videoId)}`,
    {
      method: 'PUT',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/octet-stream',
        ...identityAuthorizationHeaders(),
      },
      body: videoData,
      signal,
    },
  );
  const payload = (await response.json().catch(() => null)) as BinaryUploadResponse | null;

  if (response.ok || payload?.alreadyUploaded) return;
  throw new UploadHttpError(
    response.status,
    payload?.error || payload?.bunnyMessage || `Error ${response.status}: Bunny Stream refused the video upload.`,
  );
}

function uploadWithTus(
  authorization: DirectUploadAuthorization,
  videoData: Blob,
  fileName: string,
  fileType: string,
  onProgress?: VideoUploadProgress,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stallTimeout: number | undefined;
    let upload: Upload | null = null;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (stallTimeout !== undefined) window.clearTimeout(stallTimeout);
      signal?.removeEventListener('abort', onAbort);
      callback();
    };

    const abortUpload = (error: Error) => {
      if (settled) return;
      const activeUpload = upload;
      if (!activeUpload) {
        finish(() => reject(error));
        return;
      }
      try {
        void activeUpload.abort()
          .catch(() => undefined)
          .then(() => finish(() => reject(error)));
      } catch {
        finish(() => reject(error));
      }
    };

    const resetStallTimeout = () => {
      if (settled) return;
      if (stallTimeout !== undefined) window.clearTimeout(stallTimeout);
      stallTimeout = window.setTimeout(() => {
        console.error('[video-upload] Bunny Stream TUS upload timed out', {
          videoId: authorization.videoId,
          fileBytes: videoData.size,
        });
        abortUpload(new Error('Network timeout: Bunny Stream stopped responding during upload.'));
      }, TUS_STALL_TIMEOUT_MS);
    };

    const onAbort = () => {
      abortUpload(abortError());
    };

    if (signal?.aborted) {
      finish(() => reject(abortError()));
      return;
    }

    try {
      upload = new Upload(videoData, {
        endpoint: BUNNY_TUS_UPLOAD_URL,
        ...MOBILE_METHOD_OVERRIDE,
        uploadSize: videoData.size,
        chunkSize: CHUNK_SIZE_BYTES,
        retryDelays: RETRY_DELAYS_MS,
        httpStack: new TimedHttpStack(),
        removeFingerprintOnSuccess: true,
        // Bunny takes the title from this metadata too, so send the same one the
        // video was created with rather than letting it fall back to a default.
        metadata: {
          filename: fileName || `${authorization.title}.mp4`,
          filetype: fileType,
          title: authorization.title,
        },
        headers: {
          AuthorizationSignature: authorization.signature,
          AuthorizationExpire: String(authorization.expirationTime),
          VideoId: authorization.videoId,
          LibraryId: authorization.libraryId,
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          resetStallTimeout();
          if (bytesTotal <= 0) return;
          try {
            onProgress?.(
              Math.min(UPLOAD_PROGRESS_CEILING, Math.round((bytesUploaded / bytesTotal) * UPLOAD_PROGRESS_CEILING)),
              'uploading',
            );
          } catch (error) {
            abortUpload(error instanceof Error ? error : new Error(VIDEO_UPLOAD_FAILED_MESSAGE));
          }
        },
        onSuccess: () => finish(resolve),
        onError: (error) => {
          if (signal?.aborted) {
            finish(() => reject(abortError()));
            return;
          }
          console.error('[video-upload] Bunny Stream TUS upload failed', {
            videoId: authorization.videoId,
            fileBytes: videoData.size,
            reason: error.message,
          });
          finish(() => reject(new Error(tusErrorMessage(error))));
        },
      });

      signal?.addEventListener('abort', onAbort, { once: true });
      resetStallTimeout();
      upload.start();
    } catch (error) {
      console.error('[video-upload] Bunny Stream TUS upload could not start', error);
      abortUpload(error instanceof Error ? new Error(tusErrorMessage(error)) : new Error(VIDEO_UPLOAD_FAILED_MESSAGE));
    }
  });
}

/**
 * Send the untouched video file directly to Bunny Stream and return its player
 * URL. Bunny performs codec conversion after accepting the upload.
 *
 * `title` names the video in the Bunny Stream library — pass the post caption or
 * broadcast title when there is one. Blank titles fall back to the uploader's
 * name server-side, then to a generic label.
 */
export async function uploadFeedVideo(
  file: File,
  onProgress?: VideoUploadProgress,
  signal?: AbortSignal,
  title?: string,
): Promise<string> {
  let authorization: DirectUploadAuthorization | undefined;

  try {
    const validationError = validatePostVideoSource(file);
    if (validationError) throw new Error(validationError);
    if (signal?.aborted) throw abortError();

    onProgress?.(0, 'uploading');
    // Sent as given: a blank title lets the server name the video after its
    // uploader instead.
    authorization = await requestAuthorization(file, (title ?? '').trim(), signal);
    if (signal?.aborted) throw abortError();

    // Materialize the browser File before sending it. Some mobile browsers can
    // expose a valid File object while streaming an empty fetch body from it.
    const videoData = await file.arrayBuffer();
    if (videoData.byteLength !== file.size || videoData.byteLength === 0) {
      throw new Error('The selected video could not be read. Please select it again and retry.');
    }

    const fileType = resolveVideoContentType(file);
    const resumableData = new Blob([videoData], { type: fileType });
    if (videoData.byteLength <= BINARY_UPLOAD_MAX_BYTES) {
      try {
        await uploadWithFetch(authorization, videoData, signal);
      } catch (error) {
        if (signal?.aborted) throw abortError();
        console.warn('[video-upload] Binary upload failed; retrying with Bunny TUS', {
          videoId: authorization.videoId,
          fileBytes: videoData.byteLength,
          error,
        });
        await uploadWithTus(authorization, resumableData, file.name, fileType, onProgress, signal);
      }
    } else {
      await uploadWithTus(authorization, resumableData, file.name, fileType, onProgress, signal);
    }
    onProgress?.(100, 'uploading');
    return authorization.playUrl;
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error('[video-upload] Video upload failed', {
        videoId: authorization?.videoId,
        fileBytes: file.size,
        fileName: file.name,
        error,
      });
    }
    if (authorization) void discardVideo(authorization.videoId);
    throw error;
  }
}
