import type { Config } from '@netlify/functions';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { pushSubscriptions } from '../../db/schema.js';
import { isResponse, requireAppUser } from './_auth.js';
import { getPublicVapidKey, isWebPushConfigured } from './_push.js';

interface SubscriptionInput {
  deviceId?: string;
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export default async (req: Request) => {
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;

  if (req.method === 'GET') {
    const publicKey = getPublicVapidKey();
    return Response.json({ publicKey, configured: isWebPushConfigured() });
  }

  if (req.method === 'PUT') {
    const body = (await req.json()) as SubscriptionInput;
    const deviceId = body.deviceId?.trim();
    const endpoint = body.endpoint?.trim();
    const p256dh = body.keys?.p256dh?.trim();
    const auth = body.keys?.auth?.trim();
    if (!deviceId || !endpoint || !p256dh || !auth) {
      return Response.json({ error: 'A complete push subscription is required' }, { status: 400 });
    }

    await db.delete(pushSubscriptions).where(and(
      eq(pushSubscriptions.userId, actor.id),
      eq(pushSubscriptions.deviceId, deviceId),
      ne(pushSubscriptions.endpoint, endpoint),
    ));

    const now = new Date();
    await db
      .insert(pushSubscriptions)
      .values({
        id: crypto.randomUUID(),
        userId: actor.id,
        deviceId,
        endpoint,
        p256dh,
        auth,
        lastSeenAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: actor.id, deviceId, p256dh, auth, lastSeenAt: now, updatedAt: now },
      });
    return Response.json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const body = (await req.json()) as { deviceId?: string; activeThreadId?: string | null; visible?: boolean };
    const deviceId = body.deviceId?.trim();
    if (!deviceId) return Response.json({ error: 'deviceId is required' }, { status: 400 });
    await db
      .update(pushSubscriptions)
      .set({
        activeThreadId: body.visible === false ? null : body.activeThreadId?.trim() || null,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(pushSubscriptions.userId, actor.id), eq(pushSubscriptions.deviceId, deviceId)));
    return Response.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const body = (await req.json()) as { deviceId?: string; endpoint?: string };
    const deviceId = body.deviceId?.trim();
    const endpoint = body.endpoint?.trim();
    if (!deviceId && !endpoint) {
      return Response.json({ error: 'deviceId or endpoint is required' }, { status: 400 });
    }
    const condition = endpoint
      ? and(eq(pushSubscriptions.userId, actor.id), eq(pushSubscriptions.endpoint, endpoint))
      : and(eq(pushSubscriptions.userId, actor.id), eq(pushSubscriptions.deviceId, deviceId!));
    await db.delete(pushSubscriptions).where(condition);
    return Response.json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = {
  path: '/api/push-subscriptions',
};
