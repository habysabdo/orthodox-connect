import type { Config } from '@netlify/functions';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { groupMembers, posts, userProfiles, users } from '../../db/schema.js';
import type { Post } from '../../src/types.js';
import { isResponse, requireAppUser, SUPER_ADMIN_EMAIL, type AppActor } from './_auth.js';
import { loadPublicProfilesByIds } from './_supabaseProfiles.js';

/** Guards the payload for a post that somehow collected a huge like list. */
const MAX_LIKERS = 500;

interface LikedByUser {
  id: string;
  name: string;
  photo: string;
  parish: string;
  role: 'user' | 'admin';
}

function savedProfile(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function canAccessGroup(actor: AppActor, groupId: string): Promise<boolean> {
  if (actor.role === 'admin') return true;
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, actor.id),
      eq(groupMembers.status, 'approved'),
    ));
  return Boolean(membership);
}

/**
 * The members who liked one post, with the profile fields the "Liked by" modal
 * renders: avatar, display name, and parish.
 *
 * A like is a user id inside the post's JSON document, so this joins those ids
 * against the accounts table, their saved profile document, and the public
 * profile mirror — the same three sources the member directory reads — and
 * resolves each field from whichever source has it.
 */
export default async (req: Request) => {
  if (req.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const actor = await requireAppUser(req);
  if (isResponse(actor)) return actor;

  const url = new URL(req.url);
  const postId = url.searchParams.get('post_id') ?? url.searchParams.get('postId');
  if (!postId) return Response.json({ error: 'A post id is required' }, { status: 400 });

  const [row] = await db
    .select({ data: posts.data, groupId: posts.groupId })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!row) return Response.json({ error: 'Post not found' }, { status: 404 });
  if (row.groupId && !(await canAccessGroup(actor, row.groupId))) {
    return Response.json({ error: 'Group membership required' }, { status: 403 });
  }

  const post = row.data as Post;
  // Newest like first, which is how every other social surface lists them.
  const likeIds = [...new Set(Array.isArray(post.likes) ? post.likes.filter((id) => typeof id === 'string' && id) : [])]
    .reverse()
    .slice(0, MAX_LIKERS);

  if (likeIds.length === 0) {
    return Response.json({ postId, total: 0, users: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const accounts = await db
    .select({ user: users, profile: userProfiles })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(inArray(users.id, likeIds));

  let publicProfiles: Awaited<ReturnType<typeof loadPublicProfilesByIds>> = [];
  try {
    publicProfiles = await loadPublicProfilesByIds(likeIds);
  } catch (error) {
    console.error('Failed to load public profiles for the post likes list', error);
  }

  const accountsById = new Map(accounts.map((account) => [account.user.id, account]));
  const publicProfilesById = new Map(publicProfiles.map((profile) => [profile.id, profile]));

  const likedBy: LikedByUser[] = likeIds
    // A member whose account was removed leaves an id behind with nothing to
    // render, and a blocked account is hidden everywhere else in the app.
    .filter((userId) => accountsById.has(userId) || publicProfilesById.has(userId))
    .filter((userId) => (accountsById.get(userId)?.user.status ?? 'active') !== 'blocked')
    .map((userId) => {
      const account = accountsById.get(userId);
      const saved = savedProfile(account?.profile?.data);
      const publicProfile = publicProfilesById.get(userId);
      const email = account?.user.email ?? '';
      return {
        id: userId,
        name: text(saved.name) || text(publicProfile?.full_name) || account?.user.name || 'Parish Member',
        photo: text(saved.photo) || text(publicProfile?.avatar_url),
        parish: text(saved.parish) || text(publicProfile?.parish),
        role: (email.toLowerCase() === SUPER_ADMIN_EMAIL
          || publicProfile?.role === 'admin'
          || account?.user.role === 'admin'
          ? 'admin'
          : 'user') as 'user' | 'admin',
      };
    });

  return Response.json(
    { postId, total: likedBy.length, users: likedBy },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
};

export const config: Config = {
  path: '/api/post-likes',
};
