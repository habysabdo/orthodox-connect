import Mux from '@mux/mux-node';
import type { Config } from '@netlify/functions';
import { isResponse, requireAppUser } from './_auth.js';

// Resolves a Direct Upload into a playable asset. After the browser finishes
// PUTting the file, Mux asynchronously creates an Asset and transcodes it. The
// frontend polls this endpoint with the `uploadId` until a public playback id
// is ready, then stores the resulting Mux stream URL on the post.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
  }
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;

  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
  }

  const uploadId = new URL(req.url).searchParams.get('uploadId');
  if (!uploadId) {
    return Response.json({ error: 'uploadId is required' }, { status: 400, headers: CORS_HEADERS });
  }

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    return Response.json({ error: 'Video uploads are not configured.' }, { status: 500, headers: CORS_HEADERS });
  }

  try {
    const mux = new Mux({ tokenId, tokenSecret });

    // Step 1: the upload record tells us which asset (if any) it produced.
    const upload = await mux.video.uploads.retrieve(uploadId);
    if (upload.status === 'errored' || upload.status === 'cancelled') {
      return Response.json(
        { status: 'failed', error: 'The video could not be prepared. Please try a different file.' },
        { headers: CORS_HEADERS },
      );
    }
    if (!upload.asset_id) {
      // File still uploading or asset not created yet — keep polling.
      return Response.json({ status: 'waiting' }, { headers: CORS_HEADERS });
    }

    // Step 2: the asset carries the public playback id once transcoding starts.
    const asset = await mux.video.assets.retrieve(upload.asset_id);
    if (asset.passthrough !== actor.id) {
      return Response.json({ error: 'Video upload not found.' }, { status: 404, headers: CORS_HEADERS });
    }
    const playbackId = asset.playback_ids?.find((entry) => entry.policy === 'public')?.id
      ?? asset.playback_ids?.[0]?.id
      ?? null;

    if (asset.status === 'errored') {
      return Response.json(
        { status: 'failed', error: 'The video could not be prepared. Please try a different file.' },
        { headers: CORS_HEADERS },
      );
    }
    if (!playbackId) {
      return Response.json({ status: asset.status ?? 'preparing' }, { headers: CORS_HEADERS });
    }

    // `ready` means fully transcoded; `preparing` is playable-soon. We return
    // the playback id as soon as it exists so the client can save it, while
    // reporting the underlying asset status for the caller to decide on.
    return Response.json(
      { status: asset.status ?? 'preparing', playbackId },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('Mux asset lookup failed', error);
    return Response.json(
      { error: 'Could not check the video status. Please try again.' },
      { status: 502, headers: CORS_HEADERS },
    );
  }
};

export const config: Config = {
  path: '/api/mux-asset',
};
