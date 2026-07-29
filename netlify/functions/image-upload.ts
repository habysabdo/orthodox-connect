import type { Config } from '@netlify/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isResponse, requireAppUser } from './_auth.js';
import { createSupabaseServerClient, supabaseProjectUrl } from './_supabase.js';

// Authorization for an image upload — and nothing else. Post images and profile
// photos go from the browser straight into Supabase Storage, so no image bytes
// pass through this function and the platform's 6MB request payload limit never
// applies to a photo.
//
//   POST /api/image-upload   { kind: 'post' | 'avatar', fileName, fileSize, fileType }
//
// The response carries a single-use signed upload target and the public URL the
// image will be served from, which is what gets saved on the post or profile
// record. Signing happens here because it needs the project's service role key,
// which stays server-side; the browser receives only a token scoped to this one
// object path.

const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** The formats a browser can reliably display, plus the two Apple photo types. */
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

interface BucketPolicy {
  name: string;
  maxBytes: number;
  label: string;
}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

const BUCKETS: Record<'post' | 'avatar', BucketPolicy> = {
  post: {
    name: env('SUPABASE_POST_IMAGE_BUCKET') || 'post-images',
    maxBytes: MAX_POST_IMAGE_BYTES,
    label: '10MB',
  },
  avatar: {
    name: env('SUPABASE_AVATAR_BUCKET') || 'avatars',
    maxBytes: MAX_AVATAR_BYTES,
    label: '5MB',
  },
};

/**
 * Buckets confirmed to exist during this instance's lifetime, so the common case
 * costs no extra round trip to Supabase.
 */
const readyBuckets = new Set<string>();

interface UploadRequest {
  kind?: unknown;
  fileName?: unknown;
  fileSize?: unknown;
  fileType?: unknown;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function normalizedContentType(value: unknown): string {
  return typeof value === 'string' ? value.split(';')[0].trim().toLowerCase() : '';
}

/**
 * Create the bucket on first use so a fresh Supabase project needs no manual
 * setup. Public, because post images and avatars are served straight from their
 * stored URL to anyone who can see the post.
 */
async function ensureBucket(supabase: SupabaseClient, bucket: BucketPolicy): Promise<void> {
  if (readyBuckets.has(bucket.name)) return;

  const existing = await supabase.storage.getBucket(bucket.name);
  if (existing.data) {
    readyBuckets.add(bucket.name);
    return;
  }

  const created = await supabase.storage.createBucket(bucket.name, {
    public: true,
    fileSizeLimit: bucket.maxBytes,
    allowedMimeTypes: Object.keys(ALLOWED_CONTENT_TYPES),
  });
  // Two uploads racing on a cold project both try to create it; the loser's
  // "already exists" is success as far as the caller is concerned.
  if (created.error && !/exists/i.test(created.error.message)) throw created.error;
  readyBuckets.add(bucket.name);
}

/** The extension to store the object under, from its type or its filename. */
function fileExtension(contentType: string, fileName: unknown): string {
  const fromType = ALLOWED_CONTENT_TYPES[contentType];
  if (fromType) return fromType;
  const name = typeof fileName === 'string' ? fileName : '';
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
  return /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'jpg';
}

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;

  let body: UploadRequest;
  try {
    body = (await req.json()) as UploadRequest;
  } catch (error) {
    console.error('Could not read the image upload request', error);
    return json({ error: 'Invalid image upload request.' }, 400);
  }

  const bucket = body.kind === 'avatar' ? BUCKETS.avatar : BUCKETS.post;
  const fileSize = Number(body.fileSize);
  const fileType = normalizedContentType(body.fileType);

  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    return json({ error: 'This image file is empty. Please choose a different photo.' }, 400);
  }
  if (fileSize > bucket.maxBytes) {
    return json({ error: `Image file is too large (Max ${bucket.label})` }, 413);
  }
  if (!ALLOWED_CONTENT_TYPES[fileType]) {
    return json({ error: 'Unsupported image format. Please choose a JPEG, PNG, WebP, or GIF photo.' }, 415);
  }

  const supabase = createSupabaseServerClient(true);
  if (!supabase || !supabaseProjectUrl()) {
    console.error('Supabase Storage is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return json({ error: 'Photo uploads are temporarily unavailable.', configured: false }, 503);
  }

  try {
    await ensureBucket(supabase, bucket);
  } catch (error) {
    console.error('Supabase Storage bucket could not be prepared', error);
    return json({ error: 'Photo uploads are temporarily unavailable. Please try again later.' }, 502);
  }

  // Namespaced by member so one account can never overwrite another's image, and
  // a random name so re-uploading the same file is always a new object.
  const path = `${actor.id}/${crypto.randomUUID()}.${fileExtension(fileType, body.fileName)}`;

  const signed = await supabase.storage.from(bucket.name).createSignedUploadUrl(path);
  if (signed.error || !signed.data?.token) {
    console.error('Supabase Storage upload could not be signed', signed.error);
    return json({ error: 'Could not prepare the photo upload. Please try again.' }, 502);
  }

  const { data } = supabase.storage.from(bucket.name).getPublicUrl(path);
  return json(
    {
      bucket: bucket.name,
      path,
      token: signed.data.token,
      uploadUrl: `${supabaseProjectUrl()}/storage/v1/object/upload/sign/${bucket.name}/${path}`,
      publicUrl: data.publicUrl,
    },
    201,
  );
};

export const config: Config = { path: '/api/image-upload' };
