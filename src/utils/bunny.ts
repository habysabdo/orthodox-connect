const env = import.meta.env as Record<string, string | undefined>;

/**
 * The Bunny Stream video library. Only the library's API key is secret, so the
 * public id and pull-zone hostname carry defaults and need no configuration —
 * they must match the library `netlify/functions/get-bunny-upload-url.ts`
 * uploads to, which reads its id from `BUNNY_STREAM_LIBRARY_ID`.
 */
const CONFIGURED_LIBRARY_ID = (env.VITE_BUNNY_LIBRARY_ID ?? '').trim() || '713265';
export const BUNNY_CDN_HOSTNAME = (env.VITE_BUNNY_STREAM_CDN_HOSTNAME ?? env.VITE_BUNNY_CDN_HOSTNAME ?? '')
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/\/+$/, '') || 'vz-840ad26e-6fe.b-cdn.net';

/**
 * The library id the hosted player embeds against.
 *
 * `BUNNY_STREAM_LIBRARY_ID` is a server-side variable, so the browser cannot
 * read it; the default above stands in. Each upload authorization answers with
 * the library the video was actually created in, which `rememberBunnyLibraryId`
 * records — so an embed stays correct even if the deploy points at a different
 * library than this default.
 */
let libraryId = CONFIGURED_LIBRARY_ID;

export function rememberBunnyLibraryId(id: string | undefined | null): void {
  const value = (id ?? '').trim();
  if (/^\d+$/.test(value)) libraryId = value;
}

export function bunnyLibraryId(): string {
  return libraryId;
}

const DEFAULT_RESOLUTION = '480p';
const VIDEO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BunnyReference {
  videoId: string;
  hostname: string;
}

export function isBunnyVideoId(value: string): boolean {
  return VIDEO_ID_PATTERN.test(value.trim());
}

export function bunnyEmbedUrl(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.hostname.toLowerCase() !== 'iframe.mediadelivery.net') return null;
    if (segments[0] !== 'embed' || !segments[1] || !segments[2] || !isBunnyVideoId(segments[2])) return null;
    return `https://iframe.mediadelivery.net/embed/${segments[1]}/${segments[2]}?autoplay=false`;
  } catch {
    return null;
  }
}

function parseBunnyReference(raw: string | undefined | null): BunnyReference | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (isBunnyVideoId(value)) return { videoId: value, hostname: BUNNY_CDN_HOSTNAME };

  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const hostname = url.hostname.toLowerCase();
    const segments = url.pathname.split('/').filter(Boolean);
    const isPullZone = hostname === BUNNY_CDN_HOSTNAME.toLowerCase() || /^vz-[a-z0-9-]+\.b-cdn\.net$/i.test(hostname);
    if (isPullZone && segments[0] && isBunnyVideoId(segments[0])) {
      return { videoId: segments[0], hostname };
    }
  } catch {
    return null;
  }

  return null;
}

export function toBunnyDirectUrl(raw: string | undefined | null): string | null {
  const reference = parseBunnyReference(raw);
  if (!reference) return null;
  const match = (raw ?? '').match(/\/play_(\d{3,4}p)\.mp4/i);
  const resolution = match ? match[1].toLowerCase() : DEFAULT_RESOLUTION;
  return `https://${reference.hostname}/${reference.videoId}/play_${resolution}.mp4`;
}

export function bunnyPosterUrl(raw: string | undefined | null): string | null {
  const reference = parseBunnyReference(raw);
  return reference ? `https://${reference.hostname}/${reference.videoId}/thumbnail.jpg` : null;
}

/**
 * Bunny's animated WebP preview for a video — a handful of kilobytes, and the
 * image the feed shows in place of a player until a video is actually watched.
 * Falls back to the static thumbnail wherever the preview is unavailable.
 */
export function bunnyPreviewUrl(raw: string | undefined | null): string | null {
  const reference = parseBunnyReference(raw);
  return reference ? `https://${reference.hostname}/${reference.videoId}/preview.webp` : null;
}

/** Bunny's adaptive HLS manifest, used to warm the next reel before it appears. */
export function bunnyHlsUrl(raw: string | undefined | null): string | null {
  const reference = parseBunnyReference(raw);
  return reference ? `https://${reference.hostname}/${reference.videoId}/playlist.m3u8` : null;
}

/**
 * Bunny's own player for a stored pull-zone URL or bare video id.
 *
 * A freshly uploaded video only gains its `play_<res>.mp4` renditions once Bunny
 * finishes encoding, so the direct MP4 404s for the first moments of a new post.
 * The hosted player handles that state itself, which makes this the fallback the
 * player switches to when the direct file will not load.
 */
export function bunnyHostedPlayerUrl(raw: string | undefined | null): string | null {
  const reference = parseBunnyReference(raw);
  if (!reference || !libraryId) return null;
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${reference.videoId}?autoplay=false`;
}
