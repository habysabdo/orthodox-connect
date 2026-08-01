import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/config';
import { apiFetch } from '../lib/api';
import { compressImageFile } from './imageCompression';

// Photos never pass through this site's own functions. `/api/image-upload` only
// authorizes the upload — it signs a single-use target inside Supabase Storage —
// and the browser then sends the file straight there. That is what lifts the
// platform's 6MB request payload limit off photo posts, which previously carried
// the image inline as a base64 data URL and failed outright on anything larger
// than a phone snapshot.
//
// What gets saved on the post or profile record is the public Supabase URL of
// the stored object, so the feed serves images from Supabase's CDN rather than
// re-reading them out of the database.

export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_POST_IMAGE_LABEL = '10MB';
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_LABEL = '5MB';

/** Uploading counts for 95%; the last 5% is Supabase committing the object. */
const UPLOAD_PROGRESS_CEILING = 95;

export type ImageUploadKind = 'post' | 'avatar';
export type ImageUploadProgress = (percentage: number) => void;

/**
 * How far each kind of photo is re-encoded before upload. A feed photo is never
 * shown wider than the post column on a retina screen; an avatar never larger
 * than a profile header portrait.
 */
const COMPRESSION_OPTIONS: Record<ImageUploadKind, { maxDimension: number; quality: number }> = {
  post: { maxDimension: 1600, quality: 0.82 },
  avatar: { maxDimension: 640, quality: 0.85 },
};

// Mobile pickers routinely hand the browser a photo with a blank or generic MIME
// type, so a known image extension counts just as much as a `image/*` type.
const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
};

interface UploadTarget {
  uploadUrl: string;
  token: string;
  publicUrl: string;
}

interface AuthorizationResponse {
  bucket?: string;
  path?: string;
  token?: string;
  uploadUrl?: string;
  publicUrl?: string;
  error?: string;
}

function fileExtension(file: File): string {
  const name = file.name ?? '';
  if (!name.includes('.')) return '';
  return name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
}

/** True when the selection should be treated as a photo. */
export function isImageFile(file: File): boolean {
  if (file.type?.toLowerCase().startsWith('image/')) return true;
  return Object.prototype.hasOwnProperty.call(EXTENSION_MIME_TYPES, fileExtension(file));
}

/** The type to store and serve the photo with, inferred when the browser omits it. */
export function resolveImageContentType(file: File): string {
  const declared = file.type?.toLowerCase() ?? '';
  if (Object.values(EXTENSION_MIME_TYPES).includes(declared)) return declared;
  return EXTENSION_MIME_TYPES[fileExtension(file)] ?? 'image/jpeg';
}

/** A human-readable reason the photo cannot be uploaded, or null when it can. */
export function validateImage(file: File, kind: ImageUploadKind = 'post'): string | null {
  if (!isImageFile(file)) {
    return 'Unsupported image format. Please choose a JPEG, PNG, WebP, or GIF photo.';
  }
  if (file.size === 0) {
    return 'This image file is empty. Please choose a different photo.';
  }
  const limit = kind === 'avatar' ? MAX_AVATAR_BYTES : MAX_POST_IMAGE_BYTES;
  if (file.size > limit) {
    return `Image file is too large (Max ${kind === 'avatar' ? MAX_AVATAR_LABEL : MAX_POST_IMAGE_LABEL})`;
  }
  return null;
}

function abortError(): DOMException {
  return new DOMException('Photo upload cancelled.', 'AbortError');
}

function authorizationErrorMessage(status: number, serverMessage?: string): string {
  if (serverMessage) return serverMessage;
  if (status === 401 || status === 403) return 'Please sign in again to upload a photo.';
  if (status === 413) return `Image file is too large (Max ${MAX_POST_IMAGE_LABEL})`;
  if (status === 503) return 'Photo uploads are temporarily unavailable. Please try again later.';
  return 'The photo could not be uploaded. Please check your connection and try again.';
}

/** Ask this site to sign a storage target for the photo. Small JSON both ways. */
async function requestUploadTarget(
  file: File,
  kind: ImageUploadKind,
  signal?: AbortSignal,
): Promise<UploadTarget> {
  let response: Response;
  try {
    response = await apiFetch('/api/image-upload', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        fileName: file.name,
        fileSize: file.size,
        fileType: resolveImageContentType(file),
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('The photo upload did not start. Please check your connection and try again.');
  }

  const payload = (await response.json().catch(() => null)) as AuthorizationResponse | null;
  if (!response.ok) throw new Error(authorizationErrorMessage(response.status, payload?.error));
  if (!payload?.token || !payload.path || !payload.bucket || !payload.publicUrl) {
    throw new Error('The photo upload authorization was incomplete. Please try again.');
  }

  // Prefer this client's configured Supabase endpoint so the upload follows the
  // same route as the rest of the app's Supabase traffic, including a regional
  // proxy domain when one is set.
  const uploadUrl = SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/upload/sign/${payload.bucket}/${payload.path}`
    : payload.uploadUrl;
  if (!uploadUrl) throw new Error('Photo uploads are not configured. Please try again later.');

  return { uploadUrl, token: payload.token, publicUrl: payload.publicUrl };
}

/**
 * Send the file to the signed Supabase Storage target.
 *
 * `XMLHttpRequest` rather than `fetch`, because it reports how much of the body
 * has actually been sent — that is what drives the progress bar.
 */
function sendToStorage(
  target: UploadTarget,
  file: File,
  onProgress?: ImageUploadProgress,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', `${target.uploadUrl}?token=${encodeURIComponent(target.token)}`, true);
    request.setRequestHeader('Content-Type', resolveImageContentType(file));
    // The object name is random, so the stored file can never change underneath
    // a link that already points at it.
    request.setRequestHeader('Cache-Control', 'max-age=31536000');
    if (SUPABASE_ANON_KEY) request.setRequestHeader('apikey', SUPABASE_ANON_KEY);

    const onAbort = () => request.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const finished = () => signal?.removeEventListener('abort', onAbort);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.min(UPLOAD_PROGRESS_CEILING, Math.round((event.loaded / event.total) * UPLOAD_PROGRESS_CEILING)));
      }
    };
    request.onload = () => {
      finished();
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      if (request.status === 401 || request.status === 403) {
        reject(new Error('This photo upload is no longer authorized. Please try again.'));
        return;
      }
      if (request.status === 413) {
        reject(new Error(`Image file is too large (Max ${MAX_POST_IMAGE_LABEL})`));
        return;
      }
      reject(new Error('The photo could not be uploaded. Please try again.'));
    };
    request.onerror = () => {
      finished();
      reject(new Error('The photo could not be uploaded. Please check your connection and try again.'));
    };
    request.onabort = () => {
      finished();
      reject(abortError());
    };

    request.send(file);
  });
}

/**
 * Upload a photo and resolve with the public Supabase Storage URL to save on the
 * post or profile record.
 */
export async function uploadImage(
  file: File,
  kind: ImageUploadKind = 'post',
  onProgress?: ImageUploadProgress,
  signal?: AbortSignal,
): Promise<string> {
  const validationError = validateImage(file, kind);
  if (validationError) throw new Error(validationError);
  if (signal?.aborted) throw abortError();

  onProgress?.(0);
  // Re-encode in the browser first. A phone photo shrinks by roughly an order of
  // magnitude, so the bytes actually crossing the network — and the object kept
  // in storage — match what the feed and avatars render at.
  const payload = await compressImageFile(file, COMPRESSION_OPTIONS[kind]);
  if (signal?.aborted) throw abortError();
  const target = await requestUploadTarget(payload, kind, signal);
  await sendToStorage(target, payload, onProgress, signal);
  onProgress?.(100);
  return target.publicUrl;
}

/** A photo attached to a feed post, stored in the `post-images` bucket. */
export function uploadPostImage(
  file: File,
  onProgress?: ImageUploadProgress,
  signal?: AbortSignal,
): Promise<string> {
  return uploadImage(file, 'post', onProgress, signal);
}

/** A member's profile photo, stored in the `avatars` bucket. */
export function uploadProfilePhoto(
  file: File,
  onProgress?: ImageUploadProgress,
  signal?: AbortSignal,
): Promise<string> {
  return uploadImage(file, 'avatar', onProgress, signal);
}
