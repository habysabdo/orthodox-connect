import type { Config } from '@netlify/functions';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { userProfiles, users } from '../../db/schema.js';
import { isResponse, requireAppUser, SUPER_ADMIN_EMAIL } from './_auth.js';
import { identityProfileDefaults, loadPublicProfiles } from './_supabaseProfiles.js';

export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;

  const rows = await db
    .select({ user: users, profile: userProfiles })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.status, 'active'))
    .orderBy(desc(users.createdAt));

  let publicProfiles = [];
  try {
    publicProfiles = await loadPublicProfiles();
  } catch (error) {
    console.error('Failed to load public member profiles', error);
  }

  const accountsById = new Map(rows.map((row) => [row.user.id, row]));
  const publicProfilesById = new Map(publicProfiles.map((profile) => [profile.id, profile]));
  const memberIds = new Set([...accountsById.keys(), ...publicProfilesById.keys()]);
  const actorDefaults = identityProfileDefaults(actor.identity);
  const directory = [...memberIds].map((userId) => {
    const row = accountsById.get(userId);
    const saved = row?.profile?.data && typeof row.profile.data === 'object' && !Array.isArray(row.profile.data)
      ? row.profile.data as Record<string, unknown>
      : {};
    const publicProfile = publicProfilesById.get(userId);
    const authDefaults = userId === actor.id ? actorDefaults : null;
    const name = publicProfile?.full_name?.trim()
      || (typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim() : '')
      || authDefaults?.fullName
      || row?.user.name
      || 'Parish Member';
    const photo = (typeof saved.photo === 'string' && saved.photo.trim() ? saved.photo.trim() : '')
      || publicProfile?.avatar_url?.trim()
      || authDefaults?.avatarUrl
      || '';
    const joinedAt = publicProfile?.created_at ? Date.parse(publicProfile.created_at) : Number.NaN;

    const email = row?.user.email ?? authDefaults?.email ?? '';
    return {
      ...saved,
      id: userId,
      name,
      email: actor.role === 'admin' || actor.id === userId ? email : '',
      role: email.toLowerCase() === SUPER_ADMIN_EMAIL || publicProfile?.role === 'admin' || row?.user.role === 'admin' ? 'admin' : 'user',
      status: actor.role === 'admin' ? row?.user.status ?? 'active' : undefined,
      joinedAt: Number.isFinite(joinedAt) ? joinedAt : row?.user.createdAt.getTime() ?? Date.now(),
      onboarded: true,
      online: row?.user.status !== 'blocked',
      age: typeof saved.age === 'number' ? saved.age : 0,
      photo,
      parish: publicProfile?.parish?.trim()
        || (typeof saved.parish === 'string' ? saved.parish : ''),
    };
  });
  directory.sort((a, b) => b.joinedAt - a.joinedAt);
  return Response.json(directory);
};

export const config: Config = { path: '/api/users' };
