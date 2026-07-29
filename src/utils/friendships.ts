import type { Friendship } from '../types';
import { apiUrl } from '../lib/config';

// A friendship row exactly as stored in the database (canonical direction).
export interface FriendshipRow {
  id: string;
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
  since: number | null;
}

// Load the whole social graph, then project every row into the signed-in
// member's perspective so the UI can show incoming vs. outgoing requests.
// Rows that don't involve the current member are dropped.
export async function loadFriendships(currentUserId: string): Promise<Friendship[]> {
  const res = await fetch(apiUrl('/api/friendships'));
  if (!res.ok) throw new Error('Failed to load friendships');
  const rows: FriendshipRow[] = await res.json();

  return rows
    .filter((r) => r.requester === currentUserId || r.addressee === currentUserId)
    .map((r) => {
      const other = r.requester === currentUserId ? r.addressee : r.requester;
      const status: Friendship['status'] =
        r.status === 'accepted'
          ? 'accepted'
          : r.requester === currentUserId
            ? 'outgoing'
            : 'incoming';
      return { id: r.id, a: currentUserId, b: other, status, since: r.since ?? undefined };
    });
}

// Persist a friend request or acceptance.
export async function saveFriendship(
  requester: string,
  addressee: string,
  status: 'pending' | 'accepted',
  since?: number | null,
): Promise<FriendshipRow> {
  const res = await fetch(apiUrl('/api/friendships'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester, addressee, status, since }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || 'Failed to save friendship');
  }
  return res.json();
}

// Remove a connection (or a pending request) between two members.
export async function deleteFriendship(a: string, b: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/api/friendships?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`),
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error('Failed to delete friendship');
}
