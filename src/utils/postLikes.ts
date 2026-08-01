import type { LikedByUser } from '../types';
import { apiFetch } from '../lib/api';

/**
 * The members who liked a post, newest like first, with the avatar, display
 * name, and parish the "Liked by" modal shows. Resolved server-side so the list
 * is complete even for members the browser has not cached in the roster.
 */
export async function loadPostLikes(postId: string): Promise<LikedByUser[]> {
  const params = new URLSearchParams({ post_id: postId });
  const res = await apiFetch(`/api/post-likes?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load who liked this post');
  const payload = (await res.json()) as { users?: LikedByUser[] } | null;
  return Array.isArray(payload?.users) ? payload.users : [];
}
