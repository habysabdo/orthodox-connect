import type { Config } from '@netlify/functions';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { groupMembers, groups, posts, userProfiles, users } from '../../db/schema.js';
import type { Post } from '../../src/types.js';
import { isResponse, requireAdmin } from './_auth.js';
import { getIdentityUser, listIdentityUsers, updateIdentityUser } from './_identityAdmin.js';
import {
  identityProfileDefaults,
  loadPublicProfiles,
  loadSupabaseAuthUsers,
  supabaseAuthProfileDefaults,
} from './_supabaseProfiles.js';

const SUPER_ADMIN_EMAIL = 'lucasautocode@gmail.com';

export default async (req: Request, context: unknown) => {
  const actor = await requireAdmin(req);
  if (isResponse(actor)) return actor;
  const url = new URL(req.url);
  const resource = url.searchParams.get('resource') ?? 'users';

  if (req.method === 'GET' && resource === 'users') {
    try {
      const accountRows = await db.select().from(users).orderBy(desc(users.createdAt));
      const [profileRows, supabaseAuthUsers, identityUsers] = await Promise.all([
        loadPublicProfiles().catch((error) => {
          console.error('Failed to load public profiles', error);
          return [];
        }),
        loadSupabaseAuthUsers().catch((error) => {
          console.error('Failed to load Supabase auth users', error);
          return [];
        }),
        listIdentityUsers(context).catch((error) => {
          console.error('Failed to load Identity users', error);
          return [];
        }),
      ]);
      const accountsById = new Map(accountRows.map((account) => [account.id, account]));
      const profilesById = new Map(profileRows.map((profile) => [profile.id, profile]));
      const supabaseUsersById = new Map(supabaseAuthUsers.map((user) => [user.id, user]));
      const identityUsersById = new Map(identityUsers.map((user) => [user.id, user]));
      const userIds = new Set([
        ...accountsById.keys(),
        ...profilesById.keys(),
        ...supabaseUsersById.keys(),
        ...identityUsersById.keys(),
      ]);
      const managedUsers = [...userIds].map((userId) => {
        const account = accountsById.get(userId);
        const profile = profilesById.get(userId);
        const supabaseUser = supabaseUsersById.get(userId);
        const identityUser = identityUsersById.get(userId);
        const supabaseDefaults = supabaseUser ? supabaseAuthProfileDefaults(supabaseUser) : null;
        const identityDefaults = identityUser ? identityProfileDefaults(identityUser) : null;
        const joinedAt = profile?.created_at ? Date.parse(profile.created_at) : Number.NaN;
        const authCreatedAt = supabaseUser?.created_at
          ? Date.parse(supabaseUser.created_at)
          : identityUser?.createdAt
            ? Date.parse(identityUser.createdAt)
            : Number.NaN;
        const status = account?.status ?? 'active';
        const authRole = identityUser?.role === 'admin'
          || identityUser?.roles?.includes('admin')
          || supabaseUser?.app_metadata?.role === 'admin'
          || (Array.isArray(supabaseUser?.app_metadata?.roles) && supabaseUser.app_metadata.roles.includes('admin'));
        const email = supabaseDefaults?.email || identityDefaults?.email || account?.email || '';
        return {
          id: userId,
          email,
          name: profile?.full_name?.trim()
            || supabaseDefaults?.fullName
            || identityDefaults?.fullName
            || account?.name
            || 'Parish Member',
          age: 0,
          photo: profile?.avatar_url?.trim()
            || supabaseDefaults?.avatarUrl
            || identityDefaults?.avatarUrl
            || '',
          parish: profile?.parish ?? '',
          role: email.toLowerCase() === SUPER_ADMIN_EMAIL || profile?.role === 'admin' || account?.role === 'admin' || authRole ? 'admin' : 'user',
          status,
          joinedAt: Number.isFinite(joinedAt)
            ? joinedAt
            : Number.isFinite(authCreatedAt)
              ? authCreatedAt
              : account?.createdAt.getTime() ?? Date.now(),
          onboarded: true,
          online: status !== 'blocked',
        };
      });
      managedUsers.sort((a, b) => b.joinedAt - a.joinedAt);
      return Response.json(managedUsers);
    } catch (error) {
      console.error('Failed to load admin profiles', error);
      return Response.json([]);
    }
  }

  if (req.method === 'GET' && resource === 'groups') {
    try {
      const groupRows = await db.select().from(groups).orderBy(desc(groups.createdAt));
      const ownerIds = [...new Set(groupRows.map((group) => group.createdBy))];
      const [ownerRows, memberships] = await Promise.all([
        ownerIds.length ? db.select().from(users).where(inArray(users.id, ownerIds)) : [],
        db.select().from(groupMembers),
      ]);
      return Response.json(groupRows.map((group) => ({
        ...group,
        owner: ownerRows.find((owner) => owner.id === group.createdBy) ?? null,
        members: memberships.filter((member) => member.groupId === group.id),
        memberCount: memberships.filter((member) => member.groupId === group.id).length,
      })));
    } catch (error) {
      console.error('Failed to load admin groups', error);
      return Response.json([]);
    }
  }

  if (req.method === 'GET' && resource === 'promo-posts') {
    const pendingRows = await db
      .select({
        id: posts.id,
        data: posts.data,
        createdAt: posts.createdAt,
        authorId: posts.authorId,
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(and(eq(posts.postType, 'promo'), eq(posts.status, 'pending')))
      .orderBy(desc(posts.createdAt));
    return Response.json(pendingRows.map((row) => ({
      post: {
        ...(row.data as Post),
        id: row.id,
        authorId: row.authorId,
        postType: 'promo',
        status: 'pending',
      },
      author: {
        id: row.authorId,
        name: row.authorName ?? 'Community member',
        email: row.authorEmail ?? '',
      },
    })));
  }

  if (req.method === 'PATCH' && resource === 'users') {
    const body = (await req.json()) as {
      userId?: string;
      role?: 'user' | 'admin';
      status?: 'active' | 'blocked';
    };
    if (!body.userId) return Response.json({ error: 'userId is required' }, { status: 400 });
    const [target] = await db.select().from(users).where(eq(users.id, body.userId));
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });
    const protectedAdmin = body.userId === actor.id || target.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
    if (protectedAdmin && (body.role === 'user' || body.status === 'blocked')) {
      return Response.json({ error: 'This protected administrator cannot be demoted or blocked' }, { status: 400 });
    }

    const role = body.role ?? target.role;
    const status = body.status ?? target.status;
    // Mirror the change into Identity when operator access is configured. The
    // app's own record below is what enforces the change either way, so a
    // missing or failing Identity update must not fail the request.
    const identity = await getIdentityUser(body.userId, context).catch((error) => {
      console.error('Failed to read the Identity account', error);
      return null;
    });
    const appMetadata = { ...(identity?.appMetadata ?? {}), roles: role === 'admin' ? ['admin'] : [], blocked: status === 'blocked' };
    await updateIdentityUser(
      body.userId,
      {
        role: role === 'admin' ? 'admin' : '',
        app_metadata: appMetadata,
        ban_duration: status === 'blocked' ? '876000h' : 'none',
      },
      context,
    );
    await db.update(users).set({ role, status }).where(eq(users.id, body.userId));
    const [profileRow] = await db.select().from(userProfiles).where(eq(userProfiles.userId, body.userId));
    if (profileRow?.data && typeof profileRow.data === 'object' && !Array.isArray(profileRow.data)) {
      await db
        .update(userProfiles)
        .set({
          data: { ...(profileRow.data as Record<string, unknown>), role, status },
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, body.userId));
    }
    return Response.json({ ok: true, role, status });
  }

  if (req.method === 'PATCH' && resource === 'promo-posts') {
    const body = (await req.json()) as { postId?: string; action?: 'approve' | 'reject' };
    if (!body.postId || !body.action || !['approve', 'reject'].includes(body.action)) {
      return Response.json({ error: 'postId and a valid moderation action are required' }, { status: 400 });
    }
    const [pendingPost] = await db.select().from(posts).where(and(
      eq(posts.id, body.postId),
      eq(posts.postType, 'promo'),
      eq(posts.status, 'pending'),
    ));
    if (!pendingPost) return Response.json({ error: 'Pending promo post not found' }, { status: 404 });

    const status = body.action === 'approve' ? 'approved' : 'rejected';
    const data = { ...(pendingPost.data as Post), postType: 'promo' as const, status };
    await db.update(posts).set({ status, data }).where(eq(posts.id, pendingPost.id));
    return Response.json({ ok: true, status });
  }

  if (req.method === 'DELETE' && resource === 'groups') {
    const groupId = url.searchParams.get('id');
    if (!groupId) return Response.json({ error: 'id is required' }, { status: 400 });
    await db.transaction(async (tx) => {
      await tx.delete(posts).where(eq(posts.groupId, groupId));
      await tx.delete(groups).where(eq(groups.id, groupId));
    });
    return Response.json({ ok: true });
  }

  if (req.method === 'DELETE' && resource === 'posts') {
    const postId = url.searchParams.get('id');
    if (!postId) return Response.json({ error: 'id is required' }, { status: 400 });
    await db.delete(posts).where(eq(posts.id, postId));
    return Response.json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = { path: '/api/admin' };
