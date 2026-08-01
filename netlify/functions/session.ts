import type { Config } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { userProfiles } from '../../db/schema.js';
import { isResponse, requireAppUser } from './_auth.js';
import { ensurePublicProfile, identityProfileDefaults } from './_supabaseProfiles.js';

export default async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const actor = await requireAppUser(req);
  if (isResponse(actor)) return actor;

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, actor.id));
  const saved = (profile?.data ?? {}) as Record<string, unknown>;
  const authProfile = identityProfileDefaults(actor.identity);
  let publicProfile = null;
  try {
    publicProfile = await ensurePublicProfile(actor.identity);
  } catch (error) {
    console.error('Failed to ensure public profile', error);
  }

  const name = publicProfile?.full_name?.trim()
    || (typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim() : '')
    || authProfile.fullName;
  const photo = publicProfile?.avatar_url?.trim()
    || (typeof saved.photo === 'string' && saved.photo.trim() ? saved.photo.trim() : '')
    || authProfile.avatarUrl;
  const parish = publicProfile?.parish?.trim()
    || (typeof saved.parish === 'string' ? saved.parish : '');
  const sessionProfile = {
    ...saved,
    id: actor.id,
    email: actor.email,
    name,
    role: actor.role,
    status: actor.status,
    joinedAt: actor.createdAt.getTime(),
    onboarded: true,
    online: true,
    age: typeof saved.age === 'number' ? saved.age : 0,
    photo,
    parish,
  };

  if (!profile) {
    await db
      .insert(userProfiles)
      .values({ userId: actor.id, data: sessionProfile })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { data: sessionProfile, updatedAt: new Date() },
      });
  } else if (
    saved.onboarded !== true
    || saved.name !== name
    || saved.photo !== photo
    || saved.parish !== parish
  ) {
    await db
      .update(userProfiles)
      .set({ data: sessionProfile, updatedAt: new Date() })
      .where(eq(userProfiles.userId, actor.id));
  }

  return Response.json(sessionProfile, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
};

export const config: Config = { path: '/api/session' };
