import type { Config } from '@netlify/functions';
import { isResponse, requireAppUser } from './_auth.js';
import { CORS_HEADERS, playbackUrls, readBunnyConfig, uploadBunnyVideoBinary } from './_bunny.js';

// The single-request binary upload for a video that already exists in the Bunny
// Stream library: `PUT /api/bunny-upload-binary?videoId=…` with the raw file as
// the request body forwards those exact bytes to
// `PUT https://video.bunnycdn.com/library/<libraryId>/videos/<videoId>`
// with `Content-Type: application/octet-stream` and the library key in an
// `AccessKey` header.
//
// The browser uses this route first for files that fit inside the synchronous
// function payload limit. It materializes the selected File with
// `await file.arrayBuffer()` before this request, avoiding mobile browser cases
// where sending the File object itself produces an empty body. Larger files and
// failed requests use Bunny's signed, resumable TUS endpoint instead.
//
// It has to run here rather than in the browser because Bunny's plain upload
// endpoint only accepts the raw library API key — there is no signed form of it.
// A browser holding that key could read, replace and delete every video in the
// library, and in a bundled frontend it would be readable by every visitor, so
// the key stays in `BUNNY_STREAM_API_KEY` and the bytes make one extra hop.
//
// That hop is what limits this path: a function request body has to fit inside
// the platform's synchronous payload limit, so larger files can only go up over
// the resumable session. The browser checks the size before calling.

/**
 * The largest body this endpoint accepts. The platform rejects a synchronous
 * function request over 6MB before it reaches this code, so stay clear of it and
 * answer with a useful message instead of a generic platform error.
 */
export const BINARY_PUT_MAX_BYTES = 5 * 1024 * 1024;
export const BINARY_PUT_MAX_LABEL = '5MB';

const VIDEO_ID_PATTERN = /^[0-9a-fA-F-]{8,64}$/;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' },
    });
  }
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const actor = await requireAppUser(req);
  if (isResponse(actor)) {
    const payload = await actor.json().catch(() => ({ error: 'Authentication required' }));
    return json(payload, actor.status);
  }

  const library = readBunnyConfig();
  if (!library) {
    console.error('Bunny Stream upload credentials are not configured');
    return json({ error: 'Video upload configuration is incomplete.', configured: false }, 503);
  }

  const videoId = (new URL(req.url).searchParams.get('videoId') ?? '').trim();
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return json({ error: 'A valid videoId is required.' }, 400);
  }

  let body: ArrayBuffer;
  try {
    body = await req.arrayBuffer();
  } catch (error) {
    console.error('Could not read the video upload body', error);
    return json({ error: 'Could not read the uploaded video. Please try again.' }, 400);
  }

  if (body.byteLength === 0) {
    return json({ error: 'The uploaded video was empty.' }, 400);
  }
  if (body.byteLength > BINARY_PUT_MAX_BYTES) {
    return json(
      { error: `This upload route accepts files up to ${BINARY_PUT_MAX_LABEL}.`, maxBytes: BINARY_PUT_MAX_BYTES },
      413,
    );
  }

  let result: { ok: boolean; status: number; message: string };
  try {
    result = await uploadBunnyVideoBinary(library, videoId, body);
  } catch (error) {
    console.error('Bunny Stream binary upload errored', { videoId, error });
    return json({ error: 'Could not send the video to Bunny Stream. Please try again.' }, 502);
  }

  if (!result.ok) {
    // Bunny's own status and message, so the browser console can show why it was
    // refused rather than a generic failure.
    console.error('Bunny Stream binary upload was refused', {
      videoId,
      bytes: body.byteLength,
      status: result.status,
      message: result.message,
    });
    // 400 from this endpoint means the video already holds its file. The browser
    // treats that as delivery confirmed rather than as a failure, so flag it
    // explicitly instead of leaving it to be read out of Bunny's wording.
    return json(
      {
        error:
          result.status === 400
            ? 'Bunny Stream already has this video’s file.'
            : 'Bunny Stream refused the video upload.',
        ...(result.status === 400 ? { alreadyUploaded: true } : {}),
        bunnyStatus: result.status,
        bunnyMessage: result.message,
      },
      result.status === 400 || result.status === 404 ? result.status : 502,
    );
  }

  console.log('Bunny Stream binary upload accepted', { videoId, bytes: body.byteLength });
  return json({ ok: true, videoId, bytes: body.byteLength, ...playbackUrls(library, videoId) });
};

export const config: Config = {
  path: '/api/bunny-upload-binary',
};
