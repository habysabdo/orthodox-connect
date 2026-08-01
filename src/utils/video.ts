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

/**
 * Every host YouTube hands out share links on — `youtube.com` and its
 * subdomains (`www`, `m`, `music`), the privacy-preserving `youtube-nocookie`
 * domain, and the `youtu.be` shortener. Matching the family rather than a fixed
 * list keeps a link copied from a phone or from YouTube Music out of the HTML5
 * player, which cannot play any of them.
 */
function isYouTubeHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return /(?:^|\.)youtube\.com$/.test(host) || /(?:^|\.)youtube-nocookie\.com$/.test(host) || /(?:^|\.)youtu\.be$/.test(host);
}

/** YouTube video ids are 11 URL-safe characters; anything else is a channel, playlist or search. */
function asYouTubeId(value: string | null | undefined): string | null {
  const id = (value ?? '').trim();
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

function youTubeId(url: URL): string | null {
  if (!isYouTubeHost(url)) return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') return asYouTubeId(segments[0]);

  // `watch?v=ID` — also the shape behind `/watch/?v=ID` and mobile share links
  // that carry extra tracking parameters.
  const queryId = asYouTubeId(url.searchParams.get('v') ?? url.searchParams.get('vi'));
  if (queryId) return queryId;

  // /embed/ID, /e/ID, /shorts/ID, /v/ID, /live/ID
  if (['embed', 'e', 'shorts', 'v', 'live'].includes(segments[0])) return asYouTubeId(segments[1]);

  return null;
}

/**
 * Canonical YouTube embed URL for any YouTube link shape we accept —
 * `watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/` and `/v/`.
 * Returns null when the value is not a YouTube video, so callers can branch on
 * it to decide between an iframe and their own player.
 */
export function youTubeEmbedUrl(
  raw: string | undefined | null,
  options: {
    autoplay?: boolean;
    muted?: boolean;
    controls?: boolean;
    loop?: boolean;
    /** live/broadcast surfaces want the chrome-free look */
    modestBranding?: boolean;
  } = {},
): string | null {
  const url = normalizeUrl((raw ?? '').trim());
  if (!url) return null;
  const videoId = youTubeId(url);
  if (!videoId) return null;

  const query = new URLSearchParams({ playsinline: '1', rel: '0' });
  if (options.autoplay) query.set('autoplay', '1');
  if (options.muted) query.set('mute', '1');
  if (options.controls === false) query.set('controls', '0');
  if (options.modestBranding) query.set('modestbranding', '1');
  if (options.loop) {
    query.set('loop', '1');
    // YouTube only loops a single video when it is also the playlist.
    query.set('playlist', videoId);
  }

  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${query.toString()}`;
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

function cleanFacebookVideoUrl(url: URL): URL {
  const cleaned = new URL(url.toString());
  const host = cleaned.hostname.replace(/^www\./, '');

  if (host === 'facebook.com' || host === 'm.facebook.com' || host === 'fb.com') {
    cleaned.protocol = 'https:';
    cleaned.hostname = 'www.facebook.com';
  }

  for (const parameter of [...cleaned.searchParams.keys()]) {
    if (!['v', 'story_fbid', 'id'].includes(parameter)) cleaned.searchParams.delete(parameter);
  }
  cleaned.hash = '';
  return cleaned;
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
    // `/share/v/<id>` for videos and `/share/r/<id>` for reels — the shapes the
    // current Facebook apps put on the clipboard.
    /\/share\/[vr](?:\/|$)/.test(pathname)
  );
}

/**
 * The official Facebook video plugin URL for a Facebook video link.
 *
 * Facebook refuses to be framed directly, so pointing an iframe (or worse, an
 * HTML5 `<video>` element) at a `facebook.com/watch?v=…` link renders an empty
 * black box. Every Facebook video therefore has to go through
 * `plugins/video.php`, which is the only embed Facebook serves to other sites.
 * Returns null when the link is not a Facebook video, so callers can fall back
 * to their own rendering.
 */
export function facebookVideoEmbedUrl(
  raw: string | undefined | null,
  options: { autoplay?: boolean; muted?: boolean } = {},
): string | null {
  const url = normalizeUrl((raw ?? '').trim());
  if (!url || !isFacebookVideoUrl(url)) return null;

  const query = new URLSearchParams({
    href: cleanFacebookVideoUrl(url).toString(),
    show_text: 'false',
    width: '1280',
    allowfullscreen: 'true',
    autoplay: options.autoplay ? 'true' : 'false',
  });
  if (options.muted) query.set('muted', '1');
  return `https://www.facebook.com/plugins/video.php?${query.toString()}`;
}

/** The canonical Facebook URL an embed or out-link should point at. */
export function facebookVideoUrl(raw: string | undefined | null): string | null {
  const url = normalizeUrl((raw ?? '').trim());
  if (!url || !isFacebookVideoUrl(url)) return null;
  return cleanFacebookVideoUrl(url).toString();
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

    if (youTubeId(url) || isFacebookVideoUrl(url)) return url.toString();
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
 * Resolve a broadcast source to exactly one player.
 *
 * A live stream is either a YouTube broadcast, or a stream the browser can play
 * itself (a direct file, an HLS playlist, or a local MediaStream captured as a
 * blob URL). Callers render the branch this returns and nothing else, so a
 * broadcast can never stack an iframe on top of a `<video>` element.
 */
export type LiveStreamSource =
  | { kind: 'youtube'; embedUrl: string; originalUrl: string }
  | { kind: 'native'; url: string; hls: boolean }
  | { kind: 'none' };

export function parseLiveStreamSource(raw: string | undefined | null): LiveStreamSource {
  const value = (raw ?? '').trim();
  if (!value) return { kind: 'none' };

  // A captured MediaStream (WebRTC / getUserMedia) is handed to the native
  // element as a blob URL — there is nothing to parse.
  if (value.startsWith('blob:')) return { kind: 'native', url: value, hls: false };

  const embedUrl = youTubeEmbedUrl(value, { autoplay: true, modestBranding: true });
  if (embedUrl) return { kind: 'youtube', embedUrl, originalUrl: value };

  const url = normalizeUrl(value);
  if (!url) return { kind: 'none' };

  if (/\.m3u8$/i.test(url.pathname)) return { kind: 'native', url: url.toString(), hls: true };
  if (bunnyHlsUrl(value)) return { kind: 'native', url: bunnyHlsUrl(value) as string, hls: true };
  if (directVideoExtension(url)) return { kind: 'native', url: url.toString(), hls: false };

  // Any other link is not something a video element can play, so the caller
  // shows its own placeholder rather than an empty player.
  return { kind: 'none' };
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

  const yt = youTubeId(url);
  if (yt) {
    const origin = typeof window !== 'undefined' ? window.location?.origin : '';
    const query = new URLSearchParams({ playsinline: '1', rel: '0', enablejsapi: '1' });
    if (origin) query.set('origin', origin);
    return {
      kind: 'embed',
      provider: 'youtube',
      videoId: yt,
      embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(yt)}?${query.toString()}`,
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
    const facebookUrl = cleanFacebookVideoUrl(url);
    return {
      kind: 'embed',
      provider: 'facebook',
      embedUrl: facebookVideoEmbedUrl(url.toString()) ?? '',
      originalUrl: facebookUrl.toString(),
    };
  }

  // A self-hosted upload — `/api/media/<key>` — describes itself with a `type`
  // query parameter rather than a file extension, and a signed storage URL
  // (Supabase, S3) often has no extension in its path either. Both are files the
  // HTML5 player can play, so they must not fall through to the iframe branch
  // below. Checked after the platform branches so a platform link always wins.
  const declaredType = url.searchParams.get('type') ?? '';
  if (/^video\//i.test(declaredType)) {
    return { kind: 'direct', url: url.toString(), mimeType: declaredType };
  }
  if (/^\/api\/media\//i.test(url.pathname) || /\/storage\/v\d+\/object\//i.test(url.pathname)) {
    return { kind: 'direct', url: url.toString(), mimeType: 'video/mp4' };
  }

  // Any other external link renders inside a generic iframe.
  return { kind: 'iframe', embedUrl: url.toString(), originalUrl: url.toString() };
}
