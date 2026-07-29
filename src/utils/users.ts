import type { User } from '../types';
import { apiUrl } from '../lib/config';
import { normalizeUsers } from './postSafety';

export const SUPER_ADMIN_EMAIL = 'lucasautocode@gmail.com';

export function hasAdminAccess(user: Pick<User, 'email' | 'role'> | null | undefined): boolean {
  const profile = user;
  return user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL || profile?.role === 'admin';
}

// Load every registered member from the database (profiles saved during
// onboarding). Used by the admin panel to show the live community roster.
export async function loadUsers(): Promise<User[]> {
  const res = await fetch(apiUrl('/api/users'));
  if (!res.ok) throw new Error('Failed to load users');
  return normalizeUsers(await res.json());
}
