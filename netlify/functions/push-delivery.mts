import type { Config } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { messages, notifications, users } from '../../db/schema.js';
import type { ChatMessage, Notification } from '../../src/types.js';
import { sendDirectMessagePush, sendNotificationPush } from './_push.js';
import {
  hasValidPushSignature,
  pushSignatureHeader,
  type PushDeliveryEvent,
} from './_pushTrigger.js';

async function deliverDirectMessage(recordId: string): Promise<void> {
  const [row] = await db
    .select({ data: messages.data, threadId: messages.threadId })
    .from(messages)
    .where(eq(messages.id, recordId));
  if (!row) return;

  const message = row.data as ChatMessage;
  const participants = row.threadId.split('__');
  const recipientId = participants.length === 2
    ? participants.find((participantId) => participantId !== message.senderId)
    : undefined;
  if (!recipientId) return;

  const [sender] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, message.senderId));

  await sendDirectMessagePush({
    recipientId,
    senderName: sender?.name || 'New message',
    message,
  });
}

async function deliverNotification(recordId: string): Promise<void> {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, recordId));
  if (!notification) return;

  // Direct-message rows are the canonical push source for message alerts. The
  // matching in-app notification still invokes this worker, but does not send a
  // second browser alert for the same event.
  if (notification.type === 'message') return;
  await sendNotificationPush(notification as Notification);
}

export default async (req: Request) => {
  if (req.method !== 'POST') return;

  const body = await req.text();
  if (!hasValidPushSignature(body, req.headers.get(pushSignatureHeader()))) {
    console.warn('Rejected an unauthorized push background trigger');
    return;
  }

  let event: PushDeliveryEvent;
  try {
    event = JSON.parse(body) as PushDeliveryEvent;
  } catch {
    console.warn('Rejected a malformed push background trigger');
    return;
  }

  if (!event.recordId) return;
  if (event.kind === 'direct-message') {
    await deliverDirectMessage(event.recordId);
  } else if (event.kind === 'notification') {
    await deliverNotification(event.recordId);
  }
};

export const config: Config = {
  background: true,
};
