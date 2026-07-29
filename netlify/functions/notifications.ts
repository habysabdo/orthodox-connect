import type { Config } from '@netlify/functions';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { notifications } from '../../db/schema.js';
import type { Notification } from '../../src/types.js';
import { isResponse, requireAppUser } from './_auth.js';

// Persistence for in-app notifications. Each row is addressed to a single
// recipient (`user_id`); the client subscribes to its own notifications by
// polling this endpoint and reacts to newly inserted rows (badge + toast).
export default async (req: Request) => {
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;
  const url = new URL(req.url);

  // Return a member's notifications, newest first. `userId` is required so a
  // member only ever sees rows addressed to them.
  if (req.method === 'GET') {
    const userId = url.searchParams.get('userId');
    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });
    if (actor.role !== 'admin' && userId !== actor.id) return Response.json({ error: 'Not allowed' }, { status: 403 });
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
    return Response.json(rows);
  }

  // Create a single notification (fired when a member likes a post or sends a
  // direct message). Idempotent on id so a retried request never duplicates.
  if (req.method === 'POST') {
    const n = (await req.json()) as Notification;
    if (!n?.id || !n.userId || !n.actorId || !n.type) {
      return Response.json({ error: 'id, userId, actorId and type are required' }, { status: 400 });
    }
    if (n.actorId !== actor.id) return Response.json({ error: 'Invalid notification actor' }, { status: 403 });
    await db
      .insert(notifications)
      .values({
        id: n.id,
        userId: n.userId,
        actorId: n.actorId,
        actorName: n.actorName ?? '',
        type: n.type,
        content: n.content ?? '',
        postId: n.postId ?? null,
        threadId: n.threadId ?? null,
        isRead: n.isRead ?? false,
        createdAt: n.createdAt,
      })
      .onConflictDoNothing();
    return Response.json({ ok: true });
  }

  // Mark notifications read. With `?id=` a single row is updated; otherwise
  // every unread row for `userId` is cleared ("Mark all as read").
  if (req.method === 'PATCH') {
    const userId = url.searchParams.get('userId');
    const id = url.searchParams.get('id');
    if (id) {
      const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
      if (!notification || (actor.role !== 'admin' && notification.userId !== actor.id)) {
        return Response.json({ error: 'Not allowed' }, { status: 403 });
      }
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
      return Response.json({ ok: true });
    }
    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });
    if (actor.role !== 'admin' && userId !== actor.id) return Response.json({ error: 'Not allowed' }, { status: 403 });
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Response.json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = {
  path: '/api/notifications',
};
