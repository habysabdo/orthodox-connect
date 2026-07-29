import type { Post, User } from '../types';
import { normalizePosts, normalizeUser } from '../utils/postSafety';

const APP_CACHE_KEY = 'orthodox-connect.app-cache.v1';
const IDENTITY_STORAGE_KEY = 'gotrue.user';

interface CachedAppState {
  user: User;
  postsCache: Record<string, Post[]>;
  postsHasMoreCache: Record<string, boolean>;
}

function hasStoredIdentitySession(): boolean {
  try {
    const value = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!value) return false;
    const session = JSON.parse(value) as { token?: { access_token?: unknown; refresh_token?: unknown } };
    return typeof session.token?.access_token === 'string' && typeof session.token?.refresh_token === 'string';
  } catch {
    return false;
  }
}

/**
 * The cache was written by whichever build was deployed at the time, so its posts
 * can be missing fields the current renderer reads. Rebuilding them through
 * `normalizePosts` means a stale cache can never crash the first paint.
 */
function normalizeCachedPosts(raw: unknown): Record<string, Post[]> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, posts]) => [key, normalizePosts(posts)]),
  );
}

export function loadCachedAppState(): CachedAppState | null {
  if (typeof window === 'undefined' || !hasStoredIdentitySession()) return null;
  try {
    const value = window.localStorage.getItem(APP_CACHE_KEY);
    if (!value) return null;
    const cached = JSON.parse(value) as Partial<CachedAppState>;
    if (!cached.user?.id) return null;
    return {
      // The cached member is the whole roster on the first paint, so it goes
      // through the same normalization as one fetched from the database.
      user: normalizeUser(cached.user),
      postsCache: normalizeCachedPosts(cached.postsCache),
      postsHasMoreCache: cached.postsHasMoreCache ?? {},
    };
  } catch {
    return null;
  }
}

export function saveCachedAppState(state: CachedAppState): void {
  try {
    const postsCache = Object.fromEntries(
      Object.entries(state.postsCache).map(([key, posts]) => [
        key,
        posts.slice(0, 10).map((post) => ({
          ...post,
          image: post.image?.startsWith('data:') && post.image.length > 200_000 ? undefined : post.image,
        })),
      ]),
    );
    const postsHasMoreCache = Object.fromEntries(
      Object.entries(state.postsCache).map(([key, posts]) => [
        key,
        Boolean(state.postsHasMoreCache[key] || posts.length > 10),
      ]),
    );
    window.localStorage.setItem(APP_CACHE_KEY, JSON.stringify({ ...state, postsCache, postsHasMoreCache }));
  } catch {
    // Storage can be unavailable in private browsing or when the quota is full.
  }
}

export function clearCachedAppState(): void {
  try {
    window.localStorage.removeItem(APP_CACHE_KEY);
  } catch {
    // Ignore unavailable browser storage during logout.
  }
}
