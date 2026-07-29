import Mux from '@mux/mux-node';
import type { Config } from '@netlify/functions';
import { isResponse, requireAppUser } from './_auth.js';

// Creates a Mux Direct Upload so the browser can PUT a raw video file straight
// to Mux. Mux ingests and transcodes it into an adaptive HLS stream that plays
// on every device (iOS included), which the plain <video>/Blob pipeline can't
// guarantee for arbitrary source codecs.
//
// Credentials come from the environment (never the client):
//   MUX_TOKEN_ID / MUX_TOKEN_SECRET
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const ALLOWED_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);

interface UploadRequest {
  fileName?: string;
  size?: number;
  contentType?: string;
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
  }
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
  }

  const uploadRequest = (await req.json().catch(() => null)) as UploadRequest | null;
  const validationError = validateUploadRequest(uploadRequest);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400, headers: CORS_HEADERS });
  }

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    return Response.json({ error: 'Video uploads are not configured.' }, { status: 500, headers: CORS_HEADERS });
  }

  try {
    const mux = new Mux({ tokenId, tokenSecret });

    // `cors_origin: '*'` lets the browser PUT the file to the returned URL from
    // any origin; the resulting asset is given a public playback policy so it
    // can be streamed without signed tokens.
    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: { playback_policy: ['public'], passthrough: actor.id },
    });

    return Response.json({ uploadUrl: upload.url, uploadId: upload.id }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Mux direct upload creation failed', error);
    return Response.json(
      { error: 'Could not start the video upload. Please try again.' },
      { status: 502, headers: CORS_HEADERS },
    );
  }
};

function validateUploadRequest(upload: UploadRequest | null): string | null {
  if (!upload || typeof upload.size !== 'number' || !Number.isFinite(upload.size)) {
    return 'Video file details are required.';
  }
  if (upload.size <= 0) return 'This video file is empty.';
  if (upload.size > MAX_VIDEO_BYTES) return 'Video file is too large. Please select a video under 50MB.';

  const contentType = upload.contentType?.trim().toLowerCase() ?? '';
  const extension = upload.fileName?.split('.').pop()?.trim().toLowerCase() ?? '';
  if (!ALLOWED_VIDEO_TYPES.has(contentType) && !ALLOWED_VIDEO_EXTENSIONS.has(extension)) {
    return 'Unsupported video format. Please select an MP4, MOV, or WebM video.';
  }
  return null;
}

export const config: Config = {
  path: '/api/mux-upload',
};
