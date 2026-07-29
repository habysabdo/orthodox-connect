import type { Config } from '@netlify/functions';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { adminNotifications } from '../../db/schema.js';
import { isResponse, requireAdmin } from './_auth.js';

// How many alerts the dropdown shows. The badge counts every unread row, so a
// long backlog is still reflected accurately even though the list is capped.
const RECENT_LIMIT = 30;

// Admin-only console alerts (currently new user registrations). Rows are written
// server-side by `_auth.ts` the first time an identity is seen; this endpoint is
// read + mark-as-read only, so an alert can never be fabricated by a client.
// Every administrator reads the same feed and clearing it clears it for all.
export default async (req: Request) => {
  const actor = await requireAdmin();
  if (isResponse(actor)) return actor;

  // Newest alerts plus the full unread total, in one response so the bell can
  // render its badge and its list from a single poll.
  if (req.method === 'GET') {
    const [rows, [unread]] = await Promise.all([
      db
        .select()
        .from(adminNotifications)
        .orderBy(desc(adminNotifications.createdAt))
        .limit(RECENT_LIMIT),
      db
        .select({ value: count() })
        .from(adminNotifications)
        .where(eq(adminNotifications.read, false)),
    ]);
    return Response.json(
      { notifications: rows, unreadCount: Number(unread?.value ?? 0) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Mark alerts read. With `?id=` a single row is cleared; otherwise every
  // unread row is cleared ("Mark all as read").
  if (req.method === 'PATCH') {
    const id = new URL(req.url).searchParams.get('id')?.trim();
    if (id) {
      await db.update(adminNotifications).set({ read: true }).where(eq(adminNotifications.id, id));
      return Response.json({ ok: true });
    }
    await db
      .update(adminNotifications)
      .set({ read: true })
      .where(eq(adminNotifications.read, false));
    return Response.json({ ok: true });
  }

  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: 'GET, PATCH' },
  });
};

export const config: Config = { path: '/api/admin-notifications' };
