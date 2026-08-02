/**
 * Bunny Stream upload helper.
 *
 * Bunny Stream uses a pull-based or direct-upload API. For direct uploads,
 * you create an upload session via the Bunny Stream API and get back a
 * upload URL that the browser can PUT to directly.
 *
 * Required env vars (set in .env):
 *   VITE_BUNNY_LIBRARY_ID   — your Bunny Stream library ID
 *   VITE_BUNNY_API_KEY      — your Bunny Stream API key
 *
 * If env vars are not configured, `uploadToBunny` returns null and the
 * caller should fall back to Supabase Storage.
 */

const LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID ?? '';
const API_KEY = import.meta.env.VITE_BUNNY_API_KEY ?? '';
const BUNNY_HOST = 'video.bunnycdn.com';

interface BunnyUploadResult {
  guid: string;
  videoId: string;
  videoLibraryId: string;
}

/**
 * Create a Bunny Stream video entry and return its direct upload URL.
 * The browser then PUTs the file to that URL.
 */
export async function createBunnyVideo(filename: string, title: string): Promise<{ uploadUrl: string; videoId: string } | null> {
  if (!LIBRARY_ID || !API_KEY) return null;

  try {
    const res = await fetch(`https://${BUNNY_HOST}/library/${LIBRARY_ID}/videos`, {
      method: 'POST',
      headers: {
        'AccessKey': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) return null;
    const data = await res.json() as BunnyUploadResult;
    const uploadUrl = `https://${BUNNY_HOST}/library/${LIBRARY_ID}/videos/${data.guid}`;
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

    // Return the embed/playback URL
    // Bunny Stream embed: https://video.bunnycdn.com/embed/{libraryId}/{videoId}
    // Or HLS: https://vz-xxx.b-cdn.net/{videoId}/playlist.m3u8
    return `https://video.bunnycdn.com/embed/${LIBRARY_ID}/${session.videoId}`;
  } catch {
    return null;
  }
}

export function isBunnyConfigured(): boolean {
  return Boolean(LIBRARY_ID && API_KEY);
}
