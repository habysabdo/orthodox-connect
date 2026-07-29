import type { Config } from '@netlify/functions';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { friendships } from '../../db/schema.js';
import { isResponse, requireAppUser } from './_auth.js';

// Canonical id for a pair of users, independent of who sent the request, so
// there is exactly one friendship row per pair.
function pairId(a: string, b: string): string {
  return [a, b].sort().join('__');
}

// Persistent social graph shared by every member. Rows are stored canonically
// (`requester` sent the request to `addressee`) so the client can render the
// correct incoming/outgoing state for whichever member is signed in.
export default async (req: Request) => {
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;
  if (req.method === 'GET') {
    const rows = await db
      .select()
      .from(friendships)
      .where(
        or(
          eq(friendships.requester, actor.id),
          eq(friendships.addressee, actor.id),
        ),
      );
    return Response.json(rows);
  }

  if (req.method === 'PUT') {
    const body = (await req.json()) as {
      requester?: string;
      addressee?: string;
      status?: string;
      since?: number | null;
    };
    const { requester, addressee, status } = body;
    if (!requester || !addressee || !status) {
      return Response.json({ error: 'requester, addressee and status are required' }, { status: 400 });
    }
    if (requester === addressee) {
      return Response.json({ error: 'You cannot connect with yourself' }, { status: 400 });
    }
    if (status !== 'pending' && status !== 'accepted') {
      return Response.json({ error: 'Invalid friendship status' }, { status: 400 });
    }

    const id = pairId(requester, addressee);
    const since = status === 'accepted' ? body.since ?? Date.now() : null;

    if (status === 'accepted') {
      const [existing] = await db.select().from(friendships).where(eq(friendships.id, id));
      if (!existing) {
        return Response.json({ error: 'Friend request not found' }, { status: 404 });
      }
      if (existing.addressee !== actor.id && existing.status !== 'accepted') {
        return Response.json({ error: 'Only the recipient can accept this request' }, { status: 403 });
      }

      const [saved] = await db
        .update(friendships)
        .set({ status: 'accepted', since, updatedAt: new Date() })
        .where(eq(friendships.id, id))
        .returning();
      return Response.json(saved);
    }

    if (requester !== actor.id) {
      return Response.json({ error: 'Invalid requester' }, { status: 403 });
    }

    const [saved] = await db
      .insert(friendships)
      .values({ id, requester, addressee, status, since })
      .onConflictDoUpdate({
        target: friendships.id,
        set: { requester, addressee, status, since, updatedAt: new Date() },
      })
      .returning();
    return Response.json(saved);
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url);
    const a = url.searchParams.get('a');
    const b = url.searchParams.get('b');
    if (!a || !b) {
      return Response.json({ error: 'a and b are required' }, { status: 400 });
    }
    if (actor.role !== 'admin' && a !== actor.id && b !== actor.id) {
      return Response.json({ error: 'Not allowed to remove this connection' }, { status: 403 });
    }
    await db
      .delete(friendships)
      .where(
        or(
          and(eq(friendships.requester, a), eq(friendships.addressee, b)),
          and(eq(friendships.requester, b), eq(friendships.addressee, a)),
        ),
      );
    return Response.json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = {
  path: '/api/friendships',
};
