import { apiError, apiFetch } from '../lib/api';

/** Who a member follows and who follows them, as plain id lists. */
export interface FollowGraph {
  userId: string;
  following: string[];
  followers: string[];
}

// Read one member's follow graph. Defaults to the signed-in member; pass a
// `userId` to read the counts shown on somebody else's profile.
export async function loadFollows(userId?: string): Promise<FollowGraph> {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  const res = await apiFetch(`/api/follows${query}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(await apiError(res, 'Failed to load follows'));
  const payload = (await res.json()) as Partial<FollowGraph> | null;
  return {
    userId: payload?.userId ?? userId ?? '',
    following: Array.isArray(payload?.following) ? payload.following : [],
    followers: Array.isArray(payload?.followers) ? payload.followers : [],
  };
}

// Follow a member. Takes effect immediately — there is no request to approve.
export async function followUser(followingId: string): Promise<void> {
  const res = await apiFetch('/api/follows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ followingId }),
  });
  if (!res.ok) throw new Error(await apiError(res, 'Failed to follow this member'));
}

export async function unfollowUser(followingId: string): Promise<void> {
  const res = await apiFetch(`/api/follows?following_id=${encodeURIComponent(followingId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await apiError(res, 'Failed to unfollow this member'));
}
