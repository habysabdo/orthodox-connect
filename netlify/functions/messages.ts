import type { Config } from '@netlify/functions';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { chatAttachments, messages } from '../../db/schema.js';
import type { ChatAttachmentKind, ChatMessage } from '../../src/types.js';
import { isResponse, requireAppUser } from './_auth.js';
import { triggerPushDelivery } from './_pushTrigger.js';

// Persistence for direct chat messages. Each message document lives in the
// `data` column; `thread_id` and `created_at` are promoted for ordering.
export default async (req: Request) => {
  const actor = await requireAppUser();
  if (isResponse(actor)) return actor;
  // Return the most recent messages in chronological order; the client groups
  // by thread. Only the JSON document is needed, and the result is bounded so a
  // busy community never ships the entire message history on every load.
  if (req.method === 'GET') {
    const rows = await db
      .select({
        data: messages.data,
        threadId: messages.threadId,
        isRead: messages.isRead,
        readAt: messages.readAt,
      })
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(1000);
    const visible = actor.role === 'admin' ? rows : rows.filter((row) => row.threadId.split('__').includes(actor.id));
    return Response.json(visible.reverse().map((row) => ({
      ...(row.data as ChatMessage),
      isRead: row.isRead,
      readAt: row.readAt?.getTime() ?? null,
    })));
  }

  // Upsert a single message (a newly sent chat message).
  if (req.method === 'PUT') {
    const msg = (await req.json()) as ChatMessage;
    if (msg.senderId !== actor.id || !msg.threadId.split('__').includes(actor.id)) {
      return Response.json({ error: 'Invalid message sender' }, { status: 403 });
    }
    if (!msg.text.trim() && !msg.attachments?.length) {
      return Response.json({ error: 'Message is empty' }, { status: 400 });
    }
    const attachmentIds = msg.attachments?.map((attachment) => attachment.id) ?? [];
    if (attachmentIds.length) {
      const stored = await db.select().from(chatAttachments).where(inArray(chatAttachments.id, attachmentIds));
      const valid = stored.length === attachmentIds.length && stored.every(
        (attachment) => attachment.threadId === msg.threadId && attachment.uploaderId === actor.id,
      );
      if (!valid) return Response.json({ error: 'Invalid message attachment' }, { status: 403 });
      const byId = new Map(stored.map((attachment) => [attachment.id, attachment]));
      msg.attachments = attachmentIds.map((id) => {
        const attachment = byId.get(id)!;
        return {
          id: attachment.id,
          kind: attachment.kind as ChatAttachmentKind,
          name: attachment.fileName,
          contentType: attachment.contentType,
          size: attachment.size,
          url: `/api/chat-media?id=${encodeURIComponent(attachment.id)}`,
          ...(attachment.duration === null ? {} : { duration: attachment.duration }),
        };
      });
    }
    const storedMessage: ChatMessage = { ...msg, isRead: false, readAt: null };
    const inserted = await db
      .insert(messages)
      .values({
        id: storedMessage.id,
        threadId: storedMessage.threadId,
        data: storedMessage,
        isRead: false,
        readAt: null,
        createdAt: storedMessage.createdAt,
      })
      .onConflictDoNothing()
      .returning({ id: messages.id });
    const participants = storedMessage.threadId.split('__');
    const recipientId = participants.length === 2 ? participants.find((id) => id !== actor.id) : undefined;
    if (inserted.length && recipientId) {
      await triggerPushDelivery(req, { kind: 'direct-message', recordId: storedMessage.id })
        .catch(() => console.error('Direct message was saved, but its push background trigger failed'));
    }
    return Response.json({ ok: true });
  }

  if (req.method === 'PATCH') {
    const body = (await req.json()) as { threadId?: string; messageIds?: string[] };
    const threadId = body.threadId?.trim();
    const requestedIds = Array.isArray(body.messageIds) ? new Set(body.messageIds) : null;
    if (!threadId || !threadId.split('__').includes(actor.id)) {
      return Response.json({ error: 'Invalid message thread' }, { status: 403 });
    }

    const unreadRows = await db
      .select({ id: messages.id, data: messages.data })
      .from(messages)
      .where(and(eq(messages.threadId, threadId), eq(messages.isRead, false)));
    const messageIds = unreadRows
      .filter((row) => (row.data as ChatMessage).senderId !== actor.id && (!requestedIds || requestedIds.has(row.id)))
      .map((row) => row.id);
    const readAt = new Date();

    if (messageIds.length) {
      await db
        .update(messages)
        .set({ isRead: true, readAt })
        .where(inArray(messages.id, messageIds));
    }

    return Response.json({ messageIds, readAt: readAt.getTime() });
  }

  // Bulk insert used once to seed the table; existing rows are left untouched.
  if (req.method === 'POST') {
    if (actor.role !== 'admin') return Response.json({ error: 'Administrator access required' }, { status: 403 });
    const list = (await req.json()) as ChatMessage[];
    if (Array.isArray(list) && list.length) {
      await db
        .insert(messages)
        .values(
          list.map((m) => ({
            id: m.id,
            threadId: m.threadId,
            data: m,
            isRead: m.isRead,
            readAt: m.readAt ? new Date(m.readAt) : null,
            createdAt: m.createdAt,
          })),
        )
        .onConflictDoNothing();
    }
    return Response.json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config: Config = {
  path: '/api/messages',
};
