import type { User as IdentityUser } from '@netlify/identity';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { createSupabaseServerClient } from './_supabase.js';

export const PROFILE_COLUMNS = 'id, role, full_name, parish, avatar_url, created_at';

export interface PublicProfile {
  id: string;
  role: 'user' | 'admin' | null;
  full_name: string | null;
  parish: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

function metadataText(metadata: Record<string, unknown> | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function identityProfileDefaults(identity: IdentityUser) {
  const email = identity.email?.trim().toLowerCase() ?? '';
  const fullName = identity.name?.trim()
    || metadataText(identity.userMetadata, 'full_name')
    || metadataText(identity.userMetadata, 'name')
    || email.split('@')[0]
    || 'Parish Member';
  const avatarUrl = identity.pictureUrl?.trim()
    || metadataText(identity.userMetadata, 'avatar_url')
    || metadataText(identity.userMetadata, 'picture');
  return { email, fullName, avatarUrl };
}

export function supabaseAuthProfileDefaults(user: SupabaseAuthUser) {
  const email = user.email?.trim().toLowerCase() ?? '';
  const fullName = metadataText(user.user_metadata, 'full_name')
    || metadataText(user.user_metadata, 'name')
    || email.split('@')[0]
    || 'Parish Member';
  const avatarUrl = metadataText(user.user_metadata, 'avatar_url')
    || metadataText(user.user_metadata, 'picture');
  return { email, fullName, avatarUrl };
}

export async function loadPublicProfiles(): Promise<PublicProfile[]> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .schema('public')
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return Array.from(new Map(((data ?? []) as PublicProfile[]).map((profile) => [profile.id, profile])).values());
}

/**
 * The public profiles for a known set of members, so a caller that already has
 * the ids (the members who liked a post, say) does not pull the whole table.
 */
export async function loadPublicProfilesByIds(userIds: string[]): Promise<PublicProfile[]> {
  if (userIds.length === 0) return [];
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .schema('public')
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .in('id', userIds);
  if (error) throw error;
  return Array.from(new Map(((data ?? []) as PublicProfile[]).map((profile) => [profile.id, profile])).values());
}

export async function loadPublicProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .schema('public')
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as PublicProfile | null;
}

export async function ensurePublicProfile(identity: IdentityUser): Promise<PublicProfile | null> {
  const existing = await loadPublicProfile(identity.id);
  if (existing) return existing;

  const supabase = createSupabaseServerClient();
  if (!supabase) return null;
  const defaults = identityProfileDefaults(identity);
  const { data, error } = await supabase
    .schema('public')
    .from('profiles')
    .insert({
      id: identity.id,
      role: 'user',
      full_name: defaults.email || defaults.fullName,
      avatar_url: defaults.avatarUrl || null,
    })
    .select(PROFILE_COLUMNS)
    .single();
  if (error?.code === '23505') return loadPublicProfile(identity.id);
  if (error) throw error;
  return data as PublicProfile;
}

export async function syncPublicProfile(
  identity: IdentityUser,
  profile: Record<string, unknown>,
): Promise<void> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return;
  const defaults = identityProfileDefaults(identity);
  const name = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : defaults.fullName;
  const photo = typeof profile.photo === 'string' && profile.photo.trim() ? profile.photo.trim() : defaults.avatarUrl;
  const parish = typeof profile.parish === 'string' ? profile.parish.trim() : '';
  const { error } = await supabase
    .schema('public')
    .from('profiles')
    .upsert({
      id: identity.id,
      role: identity.role === 'admin' || identity.roles?.includes('admin') ? 'admin' : 'user',
      full_name: name,
      avatar_url: photo || null,
      parish: parish || null,
    }, { onConflict: 'id' });
  if (error) throw error;
}

export async function loadSupabaseAuthUsers(): Promise<SupabaseAuthUser[]> {
  const supabase = createSupabaseServerClient(true);
  if (!supabase) return [];

  const users: SupabaseAuthUser[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}
