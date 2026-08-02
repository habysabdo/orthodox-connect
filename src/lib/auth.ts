import { supabase } from './supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export type IdentityUser = SupabaseUser;

/**
 * Utility to retrieve the active Supabase user session.
 */
export async function getSessionUser(): Promise<IdentityUser | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;
  return session.user;
}

/**
 * Retrieve authorization headers using the active Supabase access token.
 */
export async function identityAuthorizationHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Safe fallback no-ops for remaining session recovery references.
 */
export function persistIdentityCookiesFromLocalStorage(): boolean {
  return false;
}

export async function restoreIdentitySession(): Promise<IdentityUser | null> {
  return getSessionUser();
}