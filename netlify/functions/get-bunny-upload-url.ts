import type { Config } from '@netlify/functions';
import { isResponse, requireAppUser } from './_auth.js';
import {
  CORS_HEADERS,
  UPLOAD_AUTH_LIFETIME_SECONDS,
  authorizationSignature,
  createBunnyVideo,
  readBunnyConfig,
} from './_bunny.js';

// Authorization for a video upload — and nothing else. No video bytes pass
// through this function, which is what keeps uploads clear of the platform's 6MB
// request payload limit; the browser sends the file straight to Bunny Stream.
//
// One request shape, `POST` with JSON `{ fileName, fileSize, fileType, title }`:
//
//   1. Create the video object in the Bunny Stream library
//      (`POST https://video.bunnycdn.com/library/<libraryId>/videos`) under a
//      title taken from the post caption, so the Bunny Stream dashboard lists
//      something recognizable rather than a row of identical uploads, and take
//      its `videoId`.
//   2. Sign a short-lived authorization for that specific video.
//
// The response carries only the `videoId`, `libraryId`, `title`, expiration time,
// and short-lived signature needed by the browser to authorize the TUS upload.
//
// The library API key never leaves the server. Bunny's plain
// `PUT /library/<libraryId>/videos/<videoId>` endpoint only accepts the raw
// library API key, so sending the file that way from the browser would hand
// every visitor a credential that can read, replace and delete every video in
// the library. Bunny's resumable endpoint accepts a SHA256 signature over
// `libraryId + apiKey + expiry + videoId` in the key's place, so this function
// signs one upload instead: the browser still sends the file directly to Bunny,
// but the authorization it holds expires and covers only this one video.
//
// Uploads target the configured Bunny Stream library (713265 by default). The
// API key and pull-zone hostname remain server-side configuration; see
// `_bunny.ts` for details.

const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_SIZE_LABEL = '500MB';
/** The library uploads land in when nothing is configured for the deploy. */
const FALLBACK_UPLOAD_LIBRARY_ID = '713265';
/** The slice size the browser sends per request. Bunny requires a multiple of 256KB. */
export const DIRECT_UPLOAD_CHUNK_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
/** The title a video carries when neither a caption nor an uploader name is available. */
const DEFAULT_VIDEO_TITLE = 'OrthodoxConnect Reel';
/** Captions can run long; Bunny titles are cut to something a dashboard row can show. */
const MAX_TITLE_LENGTH = 120;

interface UploadRequest {
  fileName?: unknown;
  fileSize?: unknown;
  fileType?: unknown;
  title?: unknown;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
  });
}

function normalizedContentType(value: unknown): string {
  return typeof value === 'string' ? value.split(';')[0].trim().toLowerCase() : '';
}

/**
 * The title the video is created under: the caption the browser sent, else the
 * uploader's name, else a generic label. Captions arrive as free-form text, so
 * control characters and runs of whitespace collapse to single spaces and the
 * result is cut to a length the dashboard can show.
 */
function videoTitle(requested: unknown, uploaderName: string): string {
  const candidates = [typeof requested === 'string' ? requested : '', uploaderName ? `${uploaderName} — reel` : ''];
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned) return cleaned.slice(0, MAX_TITLE_LENGTH).trim();
  }
  return DEFAULT_VIDEO_TITLE;
}

/** A rejection response for the described file, or null when it can be uploaded. */
function rejectFile(fileSize: number, fileType: string): Response | null {
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    return json({ error: 'This video file is empty. Please select a different video.' }, 400);
  }
  if (fileSize > MAX_VIDEO_SIZE_BYTES) {
    return json({ error: `Video file is too large (Max ${MAX_VIDEO_SIZE_LABEL})` }, 413);
  }
  if (!ALLOWED_CONTENT_TYPES.has(fileType)) {
    return json({ error: 'Unsupported video format. Please select an MP4, MOV, or WebM video.' }, 415);
  }
  return null;
}

/**
 * Create the Bunny video and authorize its upload.
 *
 * Exported so `upload-video.ts` can serve the same handler at its own path,
 * keeping the previous endpoint working for any client still calling it.
 */
export const authorizeBunnyUpload = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
    });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const actor = await requireAppUser(req);
  if (isResponse(actor)) {
    const payload = await actor.json().catch(() => ({ error: 'Authentication required' }));
    return json(payload, actor.status);
  }

  const configuredLibrary = readBunnyConfig();
  if (!configuredLibrary) {
    console.error('Bunny Stream upload credentials are not configured');
    return json({ error: 'Video upload configuration is incomplete.', configured: false }, 503);
  }
  // The video is created in, and the upload signed for, the configured library —
  // the signature hashes this id together with that library's API key, so a
  // different id here would make Bunny reject the upload with 401.
  const library = {
    ...configuredLibrary,
    libraryId: configuredLibrary.libraryId || FALLBACK_UPLOAD_LIBRARY_ID,
  };

  let body: UploadRequest;
  try {
    body = (await req.json()) as UploadRequest;
  } catch (error) {
    console.error('Could not read the video upload request', error);
    return json({ error: 'Invalid video upload request.' }, 400);
  }

  const fileSize = Number(body.fileSize);
  const fileType = normalizedContentType(body.fileType);
  const rejection = rejectFile(fileSize, fileType);
  if (rejection) return rejection;

  const title = videoTitle(body.title, actor.name);
  // Unix seconds, matching what Bunny compares `AuthorizationExpire` against and
  // what the signature hashes.
  const expirationTime = Math.floor(Date.now() / 1000) + UPLOAD_AUTH_LIFETIME_SECONDS;

  // Step one: the video object, and the id everything else hangs off.
  let videoId: string;
  try {
    videoId = await createBunnyVideo(library, title);
  } catch (error) {
    console.error('Bunny Stream video creation errored', error);
    return json({ error: 'Could not prepare the video upload. Please try again.' }, 502);
  }

  const signature = authorizationSignature(library, videoId, expirationTime);

  return json(
    {
      videoId,
      libraryId: library.libraryId,
      title,
      expirationTime,
      signature,
      authorizationExpire: expirationTime,
      authorizationSignature: signature,
    },
    201,
  );
};

export default authorizeBunnyUpload;

export const config: Config = {
  path: '/api/get-bunny-upload-url',
};
