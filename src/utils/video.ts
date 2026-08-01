import { bunnyEmbedUrl, bunnyHlsUrl } from './bunny';

/**
 * Determines how a post's video URL should be rendered.
 *
 * - `mux`     → a Mux-hosted stream, played with <MuxPlayer> (adaptive HLS,
 *               works on every device including iOS Safari).
 * - `direct`  → a direct file or Bunny adaptive HLS stream played in an HTML5 <video> element.
 * - `embed`   → a known platform (YouTube/Facebook/Vimeo) rendered in a provider iframe.
 * - `iframe`  → any other external link, rendered in a generic iframe.
 * - `invalid` → the value is not a usable URL; callers should show the fallback link.
 */
export type VideoSource =
  | { kind: 'mux'; playbackId: string; originalUrl: string }
  | { kind: 'direct'; url: string; mimeType: string }
  | { kind: 'embed'; provider: 'youtube'; videoId: string; embedUrl: string; originalUrl: string }
  | { kind: 'embed'; provider: 'facebook' | 'vimeo'; embedUrl: string; originalUrl: string }
  | { kind: 'hosted-iframe'; embedUrl: string; originalUrl: string }
  | { kind: 'iframe'; embedUrl: string; originalUrl: string }
  | { kind: 'invalid'; originalUrl: string };

export type LinkifiedTextPart = {
  text: string;
  href?: string;
};

/** Maps a direct video file extension to the MIME type used in the <source> tag. */
const DIRECT_VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
};

const DIRECT_VIDEO_EXTENSIONS = Object.keys(DIRECT_VIDEO_MIME_TYPES);

function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already an absolute HTTP(S) URL (e.g. a Supabase Storage public URL or an
  // uploaded `https://…/api/media/…` link) — use it directly.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed);
    } catch {
      return null;
    }
  }

  // A relative media path stored in the database — `/api/media/…`, `api/media/…`
  // or `media/…`. These are NOT external links: prepending `https://` would turn
  // them into an empty-host or wrong-host URL that never loads. Resolve them
  // against the current origin so they become a full, directly-playable URL —
  // the fallback for any value that isn't already an absolute `http(s)` URL.
  if (/^\/|^(?:api\/media|media)\//i.test(trimmed)) {
    const origin = typeof window !== 'undefined' ? window.location?.origin : undefined;
    if (origin) {
      const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      try {
        return new URL(path, origin);
      } catch {
        return null;
      }
    }
  }

  // Otherwise treat it as a bare external link (e.g. `youtube.com/watch?v=…`).
  try {
    return new URL(`https://${trimmed}`);
  } catch {
    return null;
  }
}

function directVideoExtension(url: URL): string | null {
  const pathname = url.pathname.toLowerCase();
  const extension = pathname.split('.').pop() ?? '';
  return DIRECT_VIDEO_EXTENSIONS.includes(extension) ? extension : null;
}

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const url = normalizeUrl(raw);
  if (!url) return null;

  const host = url.hostname.replace(/^www\./, '');
  let candidate: string | null = null;

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? null;
  }

  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v');
    const segments = url.pathname.split('/').filter(Boolean);
    // /embed/ID, /shorts/ID, /v/ID, /live/ID
    if (['embed', 'shorts', 'v', 'live'].includes(segments[0])) candidate = segments[1] ?? null;
  }

  return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

function vimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const segments = url.pathname.split('/').filter(Boolean);
    const id = segments.find((segment) => /^\d+$/.test(segment));
    return id || null;
  }
  return null;
}

function isFacebook(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, '');
  return host === 'facebook.com' || host === 'm.facebook.com' || host === 'fb.watch' || host === 'fb.com';
}

function isFacebookVideoUrl(url: URL): boolean {
  if (!isFacebook(url)) return false;

  const host = url.hostname.replace(/^www\./, '');
  if (host === 'fb.watch') return url.pathname !== '/';

  const pathname = url.pathname.toLowerCase();
  return (
    (/^\/watch\/?$/.test(pathname) && url.searchParams.has('v')) ||
    pathname === '/video.php' ||
    /\/(?:videos?|reels?)(?:\/|$)/.test(pathname) ||
    /\/share\/v(?:\/|$)/.test(pathname)
  );
}

const TEXT_URL_PATTERN = /(?:https?:\/\/|www\.|(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch|fb\.com)\/)[^\s<>]+/gi;
const TRAILING_URL_PUNCTUATION = /[),.!?;:'"\]}]+$/;

function textUrlParts(raw: string): { display: string; trailing: string; href: string } | null {
  const trailing = raw.match(TRAILING_URL_PUNCTUATION)?.[0] ?? '';
  const display = trailing ? raw.slice(0, -trailing.length) : raw;
  const url = normalizeUrl(display);
  if (!url || !/^https?:$/.test(url.protocol)) return null;
  return { display, trailing, href: url.toString() };
}

export function linkifyText(raw: string | undefined | null): LinkifiedTextPart[] {
  const text = typeof raw === 'string' ? raw : '';
  const parts: LinkifiedTextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(TEXT_URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: text.slice(cursor, index) });

    const parsed = textUrlParts(match[0]);
    if (!parsed) {
      parts.push({ text: match[0] });
    } else {
      parts.push({ text: parsed.display, href: parsed.href });
      if (parsed.trailing) parts.push({ text: parsed.trailing });
    }

    cursor = index + match[0].length;
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function extractEmbeddedVideoUrl(text: string | undefined | null): string | null {
  if (!text) return null;

  for (const part of linkifyText(text)) {
    if (!part.href) continue;

    const url = normalizeUrl(part.href);
    if (!url) continue;

    if (extractYouTubeVideoId(url.toString()) || isFacebookVideoUrl(url)) return url.toString();
  }

  return null;
}

export function extractExternalUrl(text: string | undefined | null): string | null {
  if (!text) return null;
  return linkifyText(text).find((part) => part.href)?.href ?? null;
}

/**
 * Extract a Mux playback id from a stored value. Handles the canonical stream
 * URL we save (`https://stream.mux.com/<playbackId>.m3u8`), any other
 * `*.mux.com` URL that carries the id as its first path segment, and a bare
 * playback id stored on its own. Returns `null` when the value is not Mux.
 */
export function muxPlaybackId(raw: string | undefined | null): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  // A `*.mux.com` URL — pull the id out of the first path segment, dropping any
  // `.m3u8`/`.mp4`/`.json` style extension.
  const url = normalizeUrl(value);
  if (url && /(^|\.)mux\.com$/i.test(url.hostname)) {
    const segment = url.pathname.split('/').filter(Boolean)[0] ?? '';
    const id = segment.replace(/\.[a-z0-9]+$/i, '');
    return isMuxPlaybackId(id) ? id : null;
  }

  // A bare playback id (no scheme, no dots, no slashes) stored directly.
  if (!value.includes('/') && !value.includes('.') && isMuxPlaybackId(value)) {
    return value;
  }

  return null;
}

// Mux playback ids are opaque URL-safe tokens. Constrain the bare-id case to
// avoid misreading a short legacy filename as a Mux id.
function isMuxPlaybackId(value: string): boolean {
  return /^[A-Za-z0-9]{20,}$/.test(value);
}

/**
 * Classify a video URL so the player knows whether to use a native <video>
 * tag, a platform iframe embed, or a fallback link.
 */
export function parseVideoSource(raw: string | undefined | null): VideoSource {
  const original = (raw ?? '').trim();

  const bunnyPlayerEmbed = bunnyEmbedUrl(original);
  if (bunnyPlayerEmbed) {
    return { kind: 'hosted-iframe', embedUrl: bunnyPlayerEmbed, originalUrl: original };
  }

  // Mux-hosted streams take precedence — they play via <MuxPlayer> everywhere.
  const playbackId = muxPlaybackId(original);
  if (playbackId) {
    return { kind: 'mux', playbackId, originalUrl: original };
  }

  if (bunnyHlsUrl(original)) {
    return { kind: 'direct', url: original, mimeType: 'application/vnd.apple.mpegurl' };
  }

  const url = normalizeUrl(original);
  if (!url) return { kind: 'invalid', originalUrl: original };

  // Direct file uploads (e.g. Supabase Storage) keep using the HTML5 player.
  const directExtension = directVideoExtension(url);
  if (directExtension) {
    return {
      kind: 'direct',
      url: url.toString(),
      mimeType: DIRECT_VIDEO_MIME_TYPES[directExtension] ?? 'video/mp4',
    };
  }

  const yt = extractYouTubeVideoId(original);
  if (yt) {
    const origin = typeof window !== 'undefined' ? window.location?.origin : '';
    return {
      kind: 'embed',
      provider: 'youtube',
      videoId: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?enablejsapi=1&origin=${encodeURIComponent(origin)}`,
      originalUrl: url.toString(),
    };
  }

  const vimeo = vimeoId(url);
  if (vimeo) {
    return {
      kind: 'embed',
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeo}`,
      originalUrl: url.toString(),
    };
  }

  if (isFacebookVideoUrl(url)) {
    const facebookUrl = url.toString();
    return {
      kind: 'embed',
      provider: 'facebook',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(facebookUrl)}`,
      originalUrl: facebookUrl,
    };
  }

  // Any other external link renders inside a generic iframe.
  return { kind: 'iframe', embedUrl: url.toString(), originalUrl: url.toString() };
}
