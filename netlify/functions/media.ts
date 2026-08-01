import { getStore } from '@netlify/blobs';
import type { Config, Context } from '@netlify/functions';
import { isResponse, requireAppUser } from './_auth.js';

const validKey = /^[a-zA-Z0-9._-]+$/;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;
const MAX_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_PART_COUNT = Math.ceil(MAX_VIDEO_SIZE_BYTES / MAX_CHUNK_SIZE_BYTES);
const ALLOWED_VIDEO_CONTENT_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/ogg']);
const ALLOWED_VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'qt', 'webm', 'ogg', 'ogv']);

// Shared CORS headers so media can be uploaded and streamed from a different
// origin (e.g. a custom regional CDN/proxy domain fronting this site) without
// the browser blocking the request. Methods cover both playback (GET/HEAD) and
// the chunked-upload lifecycle (PUT/POST/DELETE).
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type',
};

// JSON response that always carries the CORS headers, so cross-domain callers
// can read success and error payloads alike.
function jsonWithCors(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'OPTIONS') {
    const actor = await requireAppUser(req);
    // Re-issue the auth failure with the CORS headers attached. A bare 401/403
    // is unreadable to a cross-origin caller, which turns an "expired session"
    // into an opaque media error in the browser console.
    if (isResponse(actor)) {
      const headers = new Headers(actor.headers);
      for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
      return new Response(actor.body, { status: actor.status, headers });
    }
  }
  const videoStore = getStore({ name: 'post-media', consistency: 'strong' });
  const key = context.params.key;
  if (!key || !validKey.test(key)) {
    return jsonWithCors({ error: 'Invalid media key' }, 400);
  }

  const url = new URL(req.url);

  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (req.method === 'PUT') {
      const part = parseInteger(url.searchParams.get('part'));
      const contentLength = parseInteger(req.headers.get('content-length'));
      if (part === null || part < 0 || part >= MAX_PART_COUNT) {
        return jsonWithCors({ error: 'Invalid video upload part' }, 400);
      }
      if (contentLength !== null && (contentLength <= 0 || contentLength > MAX_CHUNK_SIZE_BYTES)) {
        return jsonWithCors({ error: 'Video upload part is too large' }, 413);
      }

      const chunk = await req.arrayBuffer();
      if (chunk.byteLength === 0 || chunk.byteLength > MAX_CHUNK_SIZE_BYTES) {
        return jsonWithCors({ error: 'Video upload part is invalid' }, 413);
      }

      await videoStore.set(partKey(key, part), chunk);
      return jsonWithCors({ ok: true });
    }

    if (req.method === 'POST') {
      const media = parseChunkedMedia(url);
      if (!media) {
        return jsonWithCors({ error: 'Invalid video upload details' }, 400);
      }

      const lastChunk = await videoStore.get(partKey(key, media.parts - 1), { type: 'arrayBuffer' });
      const expectedLastChunkSize = media.size - (media.parts - 1) * media.chunkSize;
      if (!lastChunk || lastChunk.byteLength !== expectedLastChunkSize) {
        return jsonWithCors({ error: 'Video upload did not finish. Please try again.' }, 400);
      }

      // Record how the object was split so playback can rebuild it from the key
      // alone. Without this, streaming depends entirely on the `parts/size/chunk/
      // type` query string surviving on the stored post URL — and if any of it is
      // dropped or rewritten, the GET silently falls through to the legacy
      // single-blob lookup, which chunked uploads never write, and answers 404.
      await videoStore.setJSON(manifestKey(key), {
        parts: media.parts,
        size: media.size,
        chunkSize: media.chunkSize,
        contentType: media.contentType,
      } satisfies ChunkedMedia);

      return jsonWithCors({ url: `/api/media/${encodeURIComponent(key)}?${mediaParams(media)}` });
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      // Prefer the URL's own description of the object, then the manifest saved at
      // finalize time, and only then the legacy single-blob layout. The manifest
      // step is what keeps a chunked video playable when its query string is
      // missing or was rewritten in transit.
      const media = parseChunkedMedia(url) ?? (await loadManifest(videoStore, key));
      if (media) return serveChunkedVideo(req, videoStore, key, media);
      return serveLegacyVideo(req, videoStore, key);
    }

    if (req.method === 'DELETE') {
      const parts = parseInteger(url.searchParams.get('parts'));
      if (parts !== null && parts > 0 && parts <= MAX_PART_COUNT) {
        await Promise.all([
          ...Array.from({ length: parts }, (_, part) => videoStore.delete(partKey(key, part))),
          videoStore.delete(manifestKey(key)),
        ]);
      } else {
        await Promise.all([videoStore.delete(key), videoStore.delete(manifestKey(key))]);
      }
      return jsonWithCors({ ok: true });
    }

    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  } catch (error) {
    console.error('Post media request failed', {
      error,
      requestId: context.requestId,
      method: req.method,
      key,
    });
    return jsonWithCors(
      { error: 'The video storage service could not complete the upload. Please try again.' },
      500,
    );
  }
};

type ChunkedMedia = {
  parts: number;
  size: number;
  chunkSize: number;
  contentType: string;
};

// The query string that describes a chunked object. Still appended to the URL
// handed back at finalize time so links created by older clients keep working,
// but playback no longer depends on it — see the stored manifest.
function mediaParams(media: ChunkedMedia): string {
  return new URLSearchParams({
    parts: String(media.parts),
    size: String(media.size),
    chunk: String(media.chunkSize),
    type: media.contentType,
  }).toString();
}

function parseChunkedMedia(url: URL): ChunkedMedia | null {
  const parts = parseInteger(url.searchParams.get('parts'));
  const size = parseInteger(url.searchParams.get('size'));
  const chunkSize = parseInteger(url.searchParams.get('chunk'));
  const contentType = url.searchParams.get('type') ?? '';

  if (
    parts === null ||
    size === null ||
    chunkSize === null ||
    parts < 1 ||
    parts > MAX_PART_COUNT ||
    size < 1 ||
    size > MAX_VIDEO_SIZE_BYTES ||
    chunkSize < 1 ||
    chunkSize > MAX_CHUNK_SIZE_BYTES ||
    parts !== Math.ceil(size / chunkSize) ||
    !ALLOWED_VIDEO_CONTENT_TYPES.has(contentType) ||
    !ALLOWED_VIDEO_EXTENSIONS.has(keyExtension(url.pathname))
  ) {
    return null;
  }

  return { parts, size, chunkSize, contentType };
}

// The manifest written when the upload was finalized. Validated on read so a
// truncated or hand-edited entry can never drive the range arithmetic.
async function loadManifest(
  videoStore: ReturnType<typeof getStore>,
  key: string,
): Promise<ChunkedMedia | null> {
  const stored = (await videoStore.get(manifestKey(key), { type: 'json' })) as Partial<ChunkedMedia> | null;
  if (!stored) return null;

  const { parts, size, chunkSize, contentType } = stored;
  if (
    !Number.isSafeInteger(parts) || !Number.isSafeInteger(size) || !Number.isSafeInteger(chunkSize) ||
    typeof contentType !== 'string' ||
    (parts as number) < 1 || (parts as number) > MAX_PART_COUNT ||
    (size as number) < 1 || (size as number) > MAX_VIDEO_SIZE_BYTES ||
    (chunkSize as number) < 1 || (chunkSize as number) > MAX_CHUNK_SIZE_BYTES ||
    parts !== Math.ceil((size as number) / (chunkSize as number)) ||
    !ALLOWED_VIDEO_CONTENT_TYPES.has(contentType)
  ) {
    return null;
  }

  return { parts: parts as number, size: size as number, chunkSize: chunkSize as number, contentType };
}

async function serveChunkedVideo(
  req: Request,
  videoStore: ReturnType<typeof getStore>,
  key: string,
  media: ChunkedMedia,
): Promise<Response> {
  // A HEAD probe with no Range is the player asking "how big is this, and can I
  // seek?". Answer it with the full length and 200 rather than a 206 describing
  // only the first chunk, which understates the duration players compute from it.
  if (req.method === 'HEAD' && !req.headers.get('range')) {
    return new Response(null, {
      status: 200,
      headers: new Headers({
        ...CORS_HEADERS,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(media.size),
        'Content-Type': media.contentType,
      }),
    });
  }

  const range = requestedRange(req.headers.get('range'), media.size, media.chunkSize);
  if (!range) {
    return new Response('Requested range not satisfiable', {
      status: 416,
      headers: { ...CORS_HEADERS, 'Content-Range': `bytes */${media.size}` },
    });
  }

  const headers = videoHeaders(media.contentType, media.size, range.start, range.end);
  if (req.method === 'HEAD') return new Response(null, { status: 206, headers });

  const firstPart = Math.floor(range.start / media.chunkSize);
  const lastPart = Math.floor(range.end / media.chunkSize);
  const chunks = await Promise.all(
    Array.from({ length: lastPart - firstPart + 1 }, (_, index) =>
      videoStore.get(partKey(key, firstPart + index), { type: 'arrayBuffer' }),
    ),
  );
  if (chunks.some((chunk) => !chunk)) return new Response('Not found', { status: 404, headers: CORS_HEADERS });

  const body = new Blob(chunks as ArrayBuffer[]).slice(
    range.start - firstPart * media.chunkSize,
    range.end - firstPart * media.chunkSize + 1,
    media.contentType,
  );
  return new Response(body, { status: 206, headers });
}

async function serveLegacyVideo(
  req: Request,
  videoStore: ReturnType<typeof getStore>,
  key: string,
): Promise<Response> {
  const video = await videoStore.get(key, { type: 'blob' });
  if (!video) return new Response('Not found', { status: 404, headers: CORS_HEADERS });

  const range = requestedRange(req.headers.get('range'), video.size, MAX_CHUNK_SIZE_BYTES);
  if (!range) {
    return new Response('Requested range not satisfiable', {
      status: 416,
      headers: { ...CORS_HEADERS, 'Content-Range': `bytes */${video.size}` },
    });
  }

  const contentType = video.type || contentTypeForKey(key);
  const headers = videoHeaders(contentType, video.size, range.start, range.end);
  return new Response(req.method === 'HEAD' ? null : video.slice(range.start, range.end + 1, contentType), {
    status: 206,
    headers,
  });
}

function requestedRange(value: string | null, size: number, maxLength: number): { start: number; end: number } | null {
  const match = value?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0;
  let requestedEnd = size - 1;

  if (match) {
    if (!match[1] && match[2]) {
      const suffixLength = Number(match[2]);
      start = Math.max(size - suffixLength, 0);
    } else {
      start = Number(match[1]);
      if (match[2]) requestedEnd = Number(match[2]);
    }
  }

  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return null;
  const end = Math.min(requestedEnd, start + maxLength - 1, size - 1);
  if (!Number.isSafeInteger(end) || end < start) return null;
  return { start, end };
}

function videoHeaders(contentType: string, size: number, start: number, end: number): Headers {
  return new Headers({
    ...CORS_HEADERS,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': String(end - start + 1),
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Type': contentType,
  });
}

function partKey(key: string, part: number): string {
  return `${key}.part-${String(part).padStart(3, '0')}`;
}

function manifestKey(key: string): string {
  return `${key}.manifest`;
}

function parseInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function contentTypeForKey(key: string): string {
  const extension = key.split('.').pop()?.toLowerCase();
  if (extension === 'webm') return 'video/webm';
  if (extension === 'ogg' || extension === 'ogv') return 'video/ogg';
  if (extension === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

function keyExtension(pathname: string): string {
  return pathname.split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';
}

export const config: Config = {
  path: '/api/media/:key',
};
