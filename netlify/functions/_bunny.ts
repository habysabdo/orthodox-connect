// Shared Bunny Stream library access. The library API key stays server-side and
// is never sent to the browser — uploads are authorized with a short-lived
// signature derived from it instead.
//
// Upload authorization uses these helpers from `get-bunny-upload-url.ts`, status
// and cleanup from `bunny-video.ts`, and the single-request binary PUT from
// `bunny-upload-binary.ts`. Files above the function payload limit and failed
// binary requests stream straight to Bunny through a signed TUS session.
//
// Configuration:
//   BUNNY_STREAM_API_KEY           library API key — required, secret
//   BUNNY_API_KEY                  accepted server-side alias
//   BUNNY_STREAM_LIBRARY_API_KEY   accepted server-side alias
//   BUNNY_STREAM_LIBRARY_ID        video library id
//   VITE_BUNNY_LIBRARY_ID          accepted alias, also readable by the client
//   BUNNY_STREAM_CDN_HOSTNAME      pull-zone hostname serving the playback files
import { createHash } from 'node:crypto';

export const BUNNY_API_BASE = 'https://video.bunnycdn.com';

/**
 * Only the API key is secret, so the library id and its pull-zone hostname carry
 * defaults. Both must match the configured Bunny Stream library.
 */
const DEFAULT_LIBRARY_ID = '713265';
const DEFAULT_CDN_HOSTNAME = 'vz-840ad26e-6fe.b-cdn.net';

/** The rendition every video gets, and the one we link to before encoding finishes. */
export const DEFAULT_RESOLUTION = '480p';

/**
 * CORS headers, so these endpoints work when the app is served from a different
 * origin than the functions (e.g. the configured regional proxy domain).
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': [
    'Content-Type',
    'Authorization',
    'AccessKey',
    'Expiration',
    'AuthorizationSignature',
    'AuthorizationExpire',
    'VideoId',
    'LibraryId',
    'Tus-Resumable',
    'Upload-Length',
    'Upload-Metadata',
    'Upload-Offset',
    'X-HTTP-Method-Override',
  ].join(', '),
};

export interface BunnyLibrary {
  libraryId: string;
  apiKey: string;
  cdnHostname: string;
}

function env(name: string): string {
  const netlifyValue = typeof Netlify !== 'undefined' ? Netlify.env.get(name) : undefined;
  const value = netlifyValue || process.env[name];
  return (value ?? '').trim();
}

function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = env(name);
    if (value) return value;
  }
  return '';
}

/** The configured library, or `null` when the secret API key is missing. */
export function readBunnyConfig(): BunnyLibrary | null {
  const apiKey = firstEnv('BUNNY_STREAM_API_KEY', 'BUNNY_API_KEY', 'BUNNY_STREAM_LIBRARY_API_KEY');
  if (!apiKey) return null;
  return {
    apiKey,
    libraryId:
      firstEnv('BUNNY_STREAM_LIBRARY_ID', 'VITE_BUNNY_LIBRARY_ID', 'BUNNY_LIBRARY_ID') || DEFAULT_LIBRARY_ID,
    cdnHostname:
      firstEnv('BUNNY_STREAM_CDN_HOSTNAME', 'VITE_BUNNY_STREAM_CDN_HOSTNAME', 'VITE_BUNNY_CDN_HOSTNAME')
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '') || DEFAULT_CDN_HOSTNAME,
  };
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function preflight(): Response {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
  });
}

/**
 * The response for a deploy with incomplete Bunny credentials.
 */
export function notConfigured(): Response {
  return json({ error: 'Video upload configuration is incomplete.', configured: false }, 503);
}

/** Playback URLs served by the library's CDN pull zone for a given video. */
export function playbackUrls(library: BunnyLibrary, videoId: string, resolution = DEFAULT_RESOLUTION) {
  const base = `https://${DEFAULT_CDN_HOSTNAME}/${videoId}`;
  return {
    embedUrl: `https://iframe.mediadelivery.net/embed/${library.libraryId}/${videoId}?autoplay=false`,
    playUrl: `${base}/play_${resolution}.mp4`,
    hlsUrl: `${base}/playlist.m3u8`,
    thumbnailUrl: `${base}/thumbnail.jpg`,
  };
}

/** An authenticated call against `…/library/<libraryId><path>`. */
export function bunnyFetch(library: BunnyLibrary, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BUNNY_API_BASE}/library/${library.libraryId}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      AccessKey: library.apiKey,
      Accept: 'application/json',
    },
  });
}

/** Remove a video object whose upload never completed, so the library stays clean. */
export async function deleteBunnyVideo(library: BunnyLibrary, videoId: string): Promise<boolean> {
  try {
    const response = await bunnyFetch(library, `/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
    return response.ok || response.status === 404;
  } catch (error) {
    console.error('Bunny Stream video deletion errored', error);
    return false;
  }
}

/**
 * The one Bunny Stream call an upload needs from the server: create the video
 * object and get its id.
 * `POST https://video.bunnycdn.com/library/<libraryId>/videos`
 */
export async function createBunnyVideo(library: BunnyLibrary, title: string): Promise<string> {
  const response = await bunnyFetch(library, '/videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error(`Bunny Stream video creation failed (${response.status})`);
  }

  const created = (await response.json().catch(() => null)) as { guid?: string } | null;
  if (!created?.guid) throw new Error('Bunny Stream video creation returned no video id');
  return created.guid;
}

/**
 * Send the raw video binary to Bunny in a single request.
 * `PUT https://video.bunnycdn.com/library/<libraryId>/videos/<videoId>`
 * with the file as the request body and `Content-Type: application/octet-stream`.
 *
 * This endpoint authenticates with the library API key in an `AccessKey` header
 * and has no signed equivalent, so it can only be called from the server — a
 * browser doing this PUT itself would need that key in its own JavaScript, which
 * would hand every visitor read, replace and delete access to the whole library.
 * `bunny-upload-binary.ts` exposes it to the app with the key kept here.
 *
 * Returns Bunny's own status and message rather than throwing, so the caller can
 * pass the real reason for a rejection back to the browser console.
 */
export async function uploadBunnyVideoBinary(
  library: BunnyLibrary,
  videoId: string,
  body: ArrayBuffer | Uint8Array,
): Promise<{ ok: boolean; status: number; message: string }> {
  const response = await bunnyFetch(library, `/videos/${encodeURIComponent(videoId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: body as BodyInit,
  });

  const raw = await response.text().catch(() => '');
  let message = raw.slice(0, 500);
  try {
    const parsed = JSON.parse(raw) as { message?: string; Message?: string };
    message = parsed.message || parsed.Message || message;
  } catch {
    // Not JSON — the raw text is the most useful thing we have.
  }

  return { ok: response.ok, status: response.status, message };
}

/** The TUS resumable endpoint the browser sends the file to. */
export const BUNNY_TUS_UPLOAD_URL = `${BUNNY_API_BASE}/tusupload`;

/**
 * How long an upload authorization stays valid, in seconds. Deliberately
 * generous: the expiry has to outlast the whole transfer, and a large video on a
 * slow mobile connection can take a long time to finish. Bunny compares this
 * against a Unix timestamp in seconds, so the signed value is
 * `Math.floor(Date.now() / 1000) + UPLOAD_AUTH_LIFETIME_SECONDS`.
 */
export const UPLOAD_AUTH_LIFETIME_SECONDS = 24 * 60 * 60;

/**
 * Sign one Bunny TUS upload with the library API key kept on the server.
 *
 * Bunny expects a plain SHA256 hex digest over the concatenation
 * `libraryId + apiKey + expirationTime + videoId`, where `expirationTime` is the
 * same Unix-seconds value sent in the `AuthorizationExpire` header. The API key
 * is part of the hashed *message*, not an HMAC key — hashing it any other way
 * produces a digest Bunny cannot reproduce, and it rejects the upload with 401.
 *
 * `library.libraryId` must be the id the browser sends in its `LibraryId` header,
 * or the two sides hash different strings and the result is the same 401.
 */
export function authorizationSignature(library: BunnyLibrary, videoId: string, authorizationExpire: number): string {
  return createHash('sha256')
    .update(`${library.libraryId}${library.apiKey}${authorizationExpire}${videoId}`)
    .digest('hex');
}
