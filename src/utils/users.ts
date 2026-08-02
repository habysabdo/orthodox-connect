import { supabase } from '../lib/supabase';
import type { User } from '../types';

export function hasAdminAccess(user?: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'global_admin';
}

export async function loadUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name || row.email?.split('@')[0] || 'Member',
      email: row.email || '',
      avatarUrl: row.avatar_url || '',
      role: row.role || 'user',
      status: 'online',
      onboarded: row.onboarded ?? true,
    }));
  } catch {
    return [];
  }
}
