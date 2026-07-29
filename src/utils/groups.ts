import type { DiscoverableGroup, Group, GroupMembershipStatus } from '../types';
import { apiUrl } from '../lib/config';

export async function loadGroups(): Promise<Group[]> {
  const response = await fetch(apiUrl('/api/groups'));
  if (!response.ok) throw new Error('Failed to load groups');
  return response.json();
}

export async function createGroupRemote(name: string, description: string): Promise<Group> {
  const response = await fetch(apiUrl('/api/groups'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!response.ok) throw new Error((await response.json()).error ?? 'Failed to create group');
  const group = (await response.json()) as Group;
  invalidateDiscoverCache();
  return group;
}

// Every group in the community, each annotated with the signed-in member's own
// membership status, so the discovery modal can offer Join / Request Pending /
// Joined.
//
// The result is briefly memoized so reopening the Explore Groups modal (a
// common back-and-forth) serves the last response instantly instead of
// refetching the full catalog every time. Any mutation (joining a group)
// invalidates the cache so a stale membership status is never shown.
const DISCOVER_TTL_MS = 30_000;
let discoverCache: { at: number; rows: DiscoverableGroup[] } | null = null;

export function invalidateDiscoverCache(): void {
  discoverCache = null;
}

export async function discoverGroups(force = false): Promise<DiscoverableGroup[]> {
  if (!force && discoverCache && Date.now() - discoverCache.at < DISCOVER_TTL_MS) {
    return discoverCache.rows;
  }
  const response = await fetch(apiUrl('/api/groups?discover=1'));
  if (!response.ok) throw new Error('Failed to load groups');
  const rows = (await response.json()) as DiscoverableGroup[];
  discoverCache = { at: Date.now(), rows };
  return rows;
}

// Request to join a group. Returns the resulting membership status ('pending'
// for a fresh request, or the existing status if one was already on file).
export async function joinGroupRemote(groupId: string): Promise<GroupMembershipStatus> {
  const response = await fetch(apiUrl('/api/groups'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId }),
  });
  if (!response.ok) throw new Error((await response.json()).error ?? 'Failed to join group');
  const data = (await response.json()) as { status: GroupMembershipStatus };
  // Membership just changed — drop the cached catalog so the next open reflects it.
  invalidateDiscoverCache();
  return data.status;
}
