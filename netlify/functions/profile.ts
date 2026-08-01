import type { Config } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { userProfiles } from '../../db/schema.js';
import { isResponse, requireAppUser } from './_auth.js';
import { identityProfileDefaults, loadPublicProfile, syncPublicProfile } from './_supabaseProfiles.js';

export default async (req: Request) => {
  const actor = await requireAppUser(req);
  if (isResponse(actor)) return actor;
  const requestedUserId = new URL(req.url).searchParams.get('userId') ?? actor.id;
  if (requestedUserId !== actor.id && actor.role !== 'admin') {
    return Response.json({ error: 'Not allowed to access this profile' }, { status: 403 });
  }

  if (req.method === 'GET') {
    const [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, requestedUserId));
    const saved = row?.data && typeof row.data === 'object' && !Array.isArray(row.data)
      ? row.data as Record<string, unknown>
      : {};
    let publicProfile = null;
    try {
      publicProfile = await loadPublicProfile(requestedUserId);
    } catch (error) {
      console.error('Failed to load public profile', error);
    }
    if (!row && !publicProfile) return Response.json(null);

    const authProfile = requestedUserId === actor.id ? identityProfileDefaults(actor.identity) : null;
    return Response.json({
      ...saved,
      id: requestedUserId,
      name: publicProfile?.full_name?.trim()
        || (typeof saved.name === 'string' ? saved.name : '')
        || authProfile?.fullName
        || 'Parish Member',
      photo: (typeof saved.photo === 'string' ? saved.photo : '')
        || publicProfile?.avatar_url?.trim()
        || authProfile?.avatarUrl
        || '',
      parish: publicProfile?.parish?.trim()
        || (typeof saved.parish === 'string' ? saved.parish : ''),
      onboarded: true,
    });
  }

  if (req.method === 'PUT') {
    if (requestedUserId !== actor.id) {
      return Response.json({ error: 'Administrators cannot overwrite member profiles' }, { status: 403 });
    }
    const incoming = (await req.json()) as Record<string, unknown>;
    const data = {
      ...incoming,
      id: actor.id,
      email: actor.email,
      role: actor.role,
      status: actor.status,
      joinedAt: actor.createdAt.getTime(),
    };
    await db
      .insert(userProfiles)
      .values({ userId: actor.id, data })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { data, updatedAt: new Date() },
      });
    try {
      await syncPublicProfile(actor.identity, data);
    } catch (error) {
      console.error('Failed to update the public profile avatar_url', error);
      throw error;
    }
    return Response.json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = { path: '/api/profile' };
