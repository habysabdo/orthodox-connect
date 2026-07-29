import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';

// Serves the avatars that were stored in Netlify Blobs before profile photos
// moved to Supabase Storage. A member who has not changed their photo since
// still has a `/api/avatar?key=…` URL saved on their profile, so this keeps
// those rendering.
//
// New uploads no longer come through here: a photo now goes from the browser
// straight into the Supabase Storage `avatars` bucket, authorized by
// `image-upload.ts`. That is what frees photos from the 6MB request payload limit
// this endpoint's upload was bound by.

const avatars = getStore({ name: 'profile-avatars', consistency: 'strong' });
const AVATAR_KEY = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9-]+\.jpg$/;

export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const key = new URL(req.url).searchParams.get('key') ?? '';
  if (!AVATAR_KEY.test(key)) return new Response('Not found', { status: 404 });

  const image = await avatars.get(key, { type: 'arrayBuffer' });
  if (!image) return new Response('Not found', { status: 404 });

  return new Response(image as ArrayBuffer, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/jpeg',
    },
  });
};

export const config: Config = { path: '/api/avatar' };
