import type { Config } from '@netlify/functions';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { follows, users } from '../../db/schema.js';
import { isResponse, requireAppUser } from './_auth.js';

// The follow graph. Unlike the friend requests this replaced, a follow is
// one-directional and takes effect the moment it is created — there is nothing
// for the other member to approve. A member may only create or remove their own
// follows; reading another member's counts is public to signed-in members so a
// profile can show "following / followers".
export default async (req: Request) => {
  const actor = await requireAppUser(req);
  if (isResponse(actor)) return actor;
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const userId = url.searchParams.get('user_id') ?? url.searchParams.get('userId') ?? actor.id;
    const [followingRows, followerRows] = await Promise.all([
      db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, userId)),
      db.select({ id: follows.followerId }).from(follows).where(eq(follows.followingId, userId)),
    ]);
    return Response.json(
      {
        userId,
        following: followingRows.map((row) => row.id),
        followers: followerRows.map((row) => row.id),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  if (req.method === 'POST') {
    const body = (await req.json()) as { followingId?: string; userId?: string };
    const followingId = (body.followingId ?? body.userId ?? '').trim();
    if (!followingId) return Response.json({ error: 'followingId is required' }, { status: 400 });
    if (followingId === actor.id) {
      return Response.json({ error: 'You cannot follow yourself' }, { status: 400 });
    }

    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, followingId));
    if (!target) return Response.json({ error: 'That member could not be found' }, { status: 404 });

    // Following twice is a no-op rather than an error, so a double tap on a
    // slow connection can never fail the button.
    await db
      .insert(follows)
      .values({ followerId: actor.id, followingId, createdAt: Date.now() })
      .onConflictDoNothing();

    return Response.json({ followerId: actor.id, followingId, following: true }, { status: 201 });
  }

  if (req.method === 'DELETE') {
    const followingId = (url.searchParams.get('following_id') ?? url.searchParams.get('followingId') ?? '').trim();
    if (!followingId) return Response.json({ error: 'following_id is required' }, { status: 400 });
    await db
      .delete(follows)
      .where(and(eq(follows.followerId, actor.id), eq(follows.followingId, followingId)));
    return Response.json({ followerId: actor.id, followingId, following: false });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = {
  path: '/api/follows',
};
