import { apiFetch } from '../lib/api';

// Persist profile updates to the server so they survive across devices and reloads.
export async function saveUserProfile(userId: string, userData: unknown): Promise<void> {
  const res = await apiFetch(`/api/profile?userId=${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  if (!res.ok) throw new Error('Failed to save user profile');
}

// Load a saved profile, e.g. on app startup.
export async function loadUserProfile(userId: string): Promise<unknown | null> {
  const res = await apiFetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to load user profile');
  return res.json();
}
