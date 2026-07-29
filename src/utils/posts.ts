import type { Post } from '../types';
import { apiUrl } from '../lib/config';
import { normalizePost, normalizePosts, normalizeReelsPage } from './postSafety';

export interface ReelsPage {
  posts: Post[];
  hasMore: boolean;
}

// Load the centralized text, image, and video feed (newest first).
export async function loadPosts(groupId?: string | null, options: { limit?: number; before?: number } = {}): Promise<Post[]> {
  const params = new URLSearchParams({ refresh: Date.now().toString() });
  if (groupId) params.set('group_id', groupId);
  params.set('limit', String(options.limit ?? 10));
  if (options.before) params.set('before', String(options.before));
  const query = `?${params.toString()}`;
  const res = await fetch(apiUrl(`/api/posts${query}`), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load posts');
  return normalizePosts(await res.json());
}

// Load a single member's public posts (newest first) for their profile page.
export async function loadPostsByAuthor(authorId: string, limit = 30): Promise<Post[]> {
  const params = new URLSearchParams({
    author_id: authorId,
    limit: String(limit),
    refresh: Date.now().toString(),
  });
  const res = await fetch(apiUrl(`/api/posts?${params.toString()}`), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load this member’s posts');
  return normalizePosts(await res.json());
}

export async function loadReels(options: {
  groupId?: string | null;
  seed: string;
  offset: number;
  limit?: number;
}): Promise<ReelsPage> {
  const params = new URLSearchParams({
    reels: 'true',
    seed: options.seed,
    offset: String(options.offset),
    limit: String(options.limit ?? 8),
    refresh: Date.now().toString(),
  });
  if (options.groupId) params.set('group_id', options.groupId);
  const res = await fetch(apiUrl(`/api/posts?${params.toString()}`), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load reels');
  return normalizeReelsPage(await res.json());
}

// Create or update a single post (used for new posts, likes, comments, flags).
export async function savePost(post: Post): Promise<void> {
  const res = await fetch(apiUrl('/api/posts'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new Error('Failed to save post');
}

export async function createReshare(originalPostId: string, kind: 'repost' | 'quote', quote = ''): Promise<Post> {
  const res = await fetch(apiUrl('/api/posts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalPostId, kind, quote }),
  });
  if (!res.ok) throw new Error('Failed to re-share post');
  return normalizePost(await res.json());
}

export async function loadPost(id: string): Promise<Post> {
  const res = await fetch(apiUrl(`/api/posts?id=${encodeURIComponent(id)}`), { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load post');
  return normalizePost(await res.json());
}

// Remove a post from the database.
export async function deletePost(id: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/posts?id=${encodeURIComponent(id)}`), { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete post');
}
