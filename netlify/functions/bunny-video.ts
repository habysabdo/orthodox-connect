import type { Config } from '@netlify/functions';
import { isResponse, requireAppUser } from './_auth.js';
import {
  DEFAULT_RESOLUTION,
  bunnyFetch,
  deleteBunnyVideo,
  json,
  notConfigured,
  playbackUrls,
  preflight,
  readBunnyConfig,
} from './_bunny.js';

// Encoding status and cleanup for Bunny Stream videos:
//   GET    /api/bunny-video?videoId=…  encoding progress + available renditions
//   DELETE /api/bunny-video?videoId=…  discard a video whose upload failed
//
// `get-bunny-upload-url.ts` issues short-lived signed TUS authorization,
// allowing the browser to upload directly without receiving the library API key.
//
// See `_bunny.ts` for the library configuration and the authenticated REST calls.

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();

  const actor = await requireAppUser(req);
  if (isResponse(actor)) return actor;

  const library = readBunnyConfig();
  if (!library) return notConfigured();

  const videoId = (new URL(req.url).searchParams.get('videoId') ?? '').trim();
  if (!videoId) return json({ error: 'videoId is required' }, 400);

  if (req.method === 'GET') {
    try {
      const response = await bunnyFetch(library, `/videos/${encodeURIComponent(videoId)}`);
      if (response.status === 404) return json({ error: 'Video not found' }, 404);
      if (!response.ok) {
        console.error('Bunny Stream status lookup failed', { status: response.status });
        return json({ error: 'Could not check the video status. Please try again.' }, 502);
      }

      // Bunny status codes: 0 created, 1 uploaded, 2 processing, 3 transcoding,
      // 4 finished, 5 error, 6 upload failed.
      const video = (await response.json()) as {
        status?: number;
        encodeProgress?: number;
        availableResolutions?: string | null;
        storageSize?: number;
      };

      const resolutions = (video.availableResolutions ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      return json({
        videoId,
        status: video.status ?? 0,
        encodeProgress: video.encodeProgress ?? 0,
        availableResolutions: resolutions,
        // Bytes Bunny is holding on disk. Note this stays 0 until encoding
        // finishes and the renditions exist, so it is context rather than proof
        // of delivery — `status` above is what tells you the file arrived (0 is
        // "created, nothing received").
        storageSize: Number(video.storageSize ?? 0),
        failed: video.status === 5 || video.status === 6,
        ...playbackUrls(library, videoId, resolutions[0] ?? DEFAULT_RESOLUTION),
      });
    } catch (error) {
      console.error('Bunny Stream status lookup errored', error);
      return json({ error: 'Could not check the video status. Please try again.' }, 502);
    }
  }

  if (req.method === 'POST' || req.method === 'DELETE') {
    return json({ ok: await deleteBunnyVideo(library, videoId) });
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config: Config = {
  path: '/api/bunny-video',
};
