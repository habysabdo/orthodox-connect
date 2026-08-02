/**
 * Bunny Stream video helpers for OrthodoxConnect.
 *
 * Production library ID: 713265
 * Stream dashboard: https://dash.bunny.net/stream/713265
 * CDN playback host:    https://vz-713265.b-cdn.net
 * Embed host:           https://video.bunnycdn.com/embed/713265
 *
 * Env vars (optional — set in .env):
 *   VITE_BUNNY_LIBRARY_ID  — Bunny Stream library ID (default: 713265)
 *   VITE_BUNNY_API_KEY     — Bunny Stream API key (needed for uploads)
 */

const LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID || '713265';
const API_KEY = import.meta.env.VITE_BUNNY_API_KEY ?? '';
const BUNNY_HOST = 'dash.bunny.net';
const BUNNY_API_HOST = 'video.bunnycdn.com';
const CDN_HOST = `vz-${LIBRARY_ID}.b-cdn.net`;

interface BunnyUploadResult {
  guid: string;
  videoId: string;
  videoLibraryId: string;
}

/** Build the embed URL for a Bunny Stream video. */
export function bunnyEmbedUrl(videoId: string): string {
  return `https://${BUNNY_API_HOST}/embed/${LIBRARY_ID}/${videoId}`;
}

/** Build the HLS playlist URL for a Bunny Stream video. */
export function bunnyHlsUrl(videoId: string): string {
  return `https://${CDN_HOST}/${videoId}/playlist.m3u8`;
}

/** Build a thumbnail URL for a Bunny Stream video. */
export function bunnyThumbnailUrl(videoId: string): string {
  return `https://${CDN_HOST}/${videoId}/thumbnail.jpg`;
}

/**
 * Create a Bunny Stream video entry and return its direct upload URL.
 * The browser then PUTs the file to that URL.
 */
export async function createBunnyVideo(filename: string, title: string): Promise<{ uploadUrl: string; videoId: string } | null> {
  if (!LIBRARY_ID || !API_KEY) return null;

  try {
    const res = await fetch(`https://${BUNNY_API_HOST}/library/${LIBRARY_ID}/videos`, {
      method: 'POST',
      headers: {
        'AccessKey': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) return null;
    const data = await res.json() as BunnyUploadResult;
    const uploadUrl = `https://${BUNNY_API_HOST}/library/${LIBRARY_ID}/videos/${data.guid}`;
    return { uploadUrl, videoId: data.guid };
  } catch {
    return null;
  }
}

/**
 * Upload a video file directly to Bunny Stream.
 * Returns the playback URL if successful, null otherwise.
 */
export async function uploadToBunny(file: File, title: string): Promise<string | null> {
  const session = await createBunnyVideo(file.name, title);
  if (!session) return null;

  try {
    const res = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: file,
    });

    if (!res.ok) return null;

    return bunnyEmbedUrl(session.videoId);
  } catch {
    return null;
  }
}

export function isBunnyConfigured(): boolean {
  return Boolean(LIBRARY_ID && API_KEY);
}

export function getBunnyLibraryId(): string {
  return LIBRARY_ID;
}

export function getBunnyStreamDashboard(): string {
  return `https://${BUNNY_HOST}/stream/${LIBRARY_ID}`;
}
